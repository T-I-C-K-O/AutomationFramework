/**
 * @fileoverview Xray Test Execution Fetcher
 *
 * Retrieves all test runs for a given Xray Test Execution, including step details,
 * iterations, and attachments. It enriches test cases with data from Excel files,
 * downloads referenced attachments, and saves structured JSON files.
 *
 * Usage:
 *   npx ts-node utils/integrationLibrary/testManagement/TestExecutionProcessor.ts APS-123
 *
 * Output:
 *   testcases/x-ray/<ExecutionKey>_(serial|parallel)_testCases.json
 *
 * @since 1.0.0
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { logger } from '../../helpers/logger';
import { getXrayAccessToken, buildTestExecutionDetailsQuery } from './xrayAPI';
import { downloadAllAttachments } from './downloadAttachment';
import { enrichTestCaseWithExcel } from './readDataFromExcel';
import { TestCase } from '../../types/types';

dotenv.config({ quiet: true });

/** CLI-provided Test Execution key (optional). */
const testExecutionKey = process.argv[2];

/**
 * Resolve the Test Execution key from CLI or prompt user.
 */
async function getTestExecutionKey(): Promise<string> {
  if (testExecutionKey) return testExecutionKey;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Enter Test Execution Key: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Ensure a directory exists (creates recursively if missing). */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.debug(`[TestExecutionProcessor] Created directory: ${dirPath}`);
  }
}

/** Throw error if required directory doesn't exist. */
function assertDirExists(dirPath: string, description: string): void {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`${description} does not exist: ${dirPath}`);
  }
}

/**
 * Clean and parse step fields (action, data, result). Trims surrounding pipes and parses JSON if possible.
 */
function cleanStepFields(step: any): any {
  const cleanStep: any = { ...step };
  ['action', 'data', 'result'].forEach((field) => {
    if (typeof step[field] === 'string') {
      let value = (step[field] as string).trim();
      value = value.replace(/^\|+|\|+$/g, '').trim();
      try {
        cleanStep[field] = JSON.parse(value);
      } catch {
        cleanStep[field] = value;
      }
    }
  });
  return cleanStep;
}

/** Transform raw testRuns into structured TestCase objects. */
function buildTestCasesFromRuns(testRuns: any[]): TestCase[] {
  return testRuns.map((run: any) => {
    const test = run.test || {};
    const steps = Array.isArray(run.steps) ? run.steps.map(cleanStepFields) : [];
    return {
      id: run.id,
      name: test.jira?.summary || 'Unnamed Test',
      executionStatus: run.status?.name,
      jira: test.jira,
      steps,
      iterations: run.iterations?.results || [],
    } as TestCase;
  });
}

/** Determine file path based on execution summary content. */
function buildOutputFilePath(saveDir: string, execKey: string, execSummary: string): string {
  const lower = execSummary.toLowerCase();
  const flavor = lower.includes('serial') || lower.includes('sequential') ? 'serial' : 'parallel';
  return path.join(saveDir, `${execKey}_${flavor}_testCases.json`);
}

/**
 * Fetch and process test cases from a single Test Execution key.
 */
export async function getTestFromExecution(execKey: string): Promise<void> {
  try {
    const token = await getXrayAccessToken();
    logger.info(`[TestExecutionProcessor] Fetching tests from execution ${execKey}`);

    const queryTests = buildTestExecutionDetailsQuery(execKey);
    const testsResponse = await axios.post(
      'https://xray.cloud.getxray.app/api/v2/graphql',
      { query: queryTests },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const executionData = testsResponse.data?.data?.getTestExecutions?.results?.[0];
    if (!executionData) {
      throw new Error(`No data found for Test Execution: ${execKey}`);
    }

    const testRuns = executionData.testRuns?.results || [];
    const execSummary = executionData.jira?.summary || 'Unknown Execution';
    logger.info(`[TestExecutionProcessor] Fetched ${testRuns.length} test runs for ${execKey}`);

    const testCases = buildTestCasesFromRuns(testRuns);

    const baseFolder = path.join(__dirname, '../../../../testdata/x-ray');
    const saveDir = path.join(__dirname, '../../../../testcases/x-ray', execKey);

    ensureDir(saveDir);
    assertDirExists(baseFolder, 'Base folder for attachments');

    // Download and enrich
    await downloadAllAttachments(testCases, baseFolder);
    const enriched = testCases.map((tc) => enrichTestCaseWithExcel(tc, baseFolder));

    const outputFile = buildOutputFilePath(saveDir, execKey, execSummary);
    fs.writeFileSync(outputFile, JSON.stringify(enriched, null, 2), 'utf-8');

    logger.info(`[TestExecutionProcessor] ✅ Test cases saved to: ${outputFile}`);
  } catch (error: any) {
    logger.error(
      `[TestExecutionProcessor]  Failed to fetch from Test Execution ${execKey}: ${error?.message || error}`
    );
    throw error;
  }
}

// CLI entrypoint
if (require.main === module) {
  (async () => {
    const resolvedKey = await getTestExecutionKey();
    await getTestFromExecution(resolvedKey);
  })();
}
