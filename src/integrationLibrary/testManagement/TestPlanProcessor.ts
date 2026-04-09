/**
 * @fileoverview Xray Test Plan & Execution Fetcher
 *
 * Retrieves test executions for a given Xray Test Plan, fetches detailed test run data
 * (including steps, iterations & attachments), enriches test cases with external Excel data,
 * downloads referenced attachments, and writes structured JSON test case files classified
 * as serial vs parallel based on execution summary keywords.
 *
 * Key Features:
 * - Interactive fallback prompt for Test Plan key when not provided as CLI arg
 * - Modular GraphQL query builders (delegated to xrayAPI helpers)
 * - Cleans and parses step action/data/result fields (supports JSON-in-string)
 * - Attachment downloading and Excel-based enrichment hooks
 * - Safe directory creation and classification by execution summary
 *
 * Usage (CLI):
 *   npx ts-node utils/integrationLibrary/testManagement/TestPlanProcessor.ts TP-123
 *   # or run without argument and input key interactively
 *
 * Output:
 *   testcases/x-ray/<TestPlanKey>/<ExecutionKey>_(serial|parallel)_testCases.json
 *
 * @since 1.0.0
 * @version 1.0.0
 */
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../helpers/logger';
import { getXrayAccessToken, buildGetTestPlanQuery, buildTestExecutionDetailsQuery } from './xrayAPI';
import { downloadAllAttachments } from './downloadAttachment';
import { enrichTestCaseWithExcel } from './readDataFromExcel';
import { TestCase } from '../../types/types';
import * as readline from 'readline';

dotenv.config({ quiet: true });

/** CLI provided Test Plan Key (optional). */
const testPlanKey = process.argv[2];

/**
 * Resolve the Test Plan key from CLI args or prompt interactively.
 */
async function getTestPlanKey(): Promise<string> {
  if (testPlanKey) return testPlanKey;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Enter Test Plan Key: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** Ensure a directory exists (creates recursively if missing). */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.debug(`[TestPlanProcessor] Created directory: ${dirPath}`);
  }
}

/**
 * Validate existence of a required directory; throws if missing.
 */
function assertDirExists(dirPath: string, description: string): void {
  if (!fs.existsSync(dirPath)) {
    throw new Error(`${description} does not exist: ${dirPath}`);
  }
}

/**
 * Discover APS-prefixed subfolders under a base directory.
 */
function listApsSubFolders(baseFolder: string): string[] {
  return fs
    .readdirSync(baseFolder, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith('APS'))
    .map((d) => d.name);
}

/**
 * Clean and parse step fields (action, data, result). Trims surrounding pipes and attempts JSON parse.
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

/** Transform raw testRuns array into structured TestCase array. */
function buildTestCasesFromRuns(testRuns: any[]): TestCase[] {
  return testRuns.map((run: any) => {
    const test = run.test || {};
    const steps = Array.isArray(run.steps) ? run.steps.map(cleanStepFields) : [];
    return {
      id: run.id,
      name: test.jira?.summary || 'Unnamed Test',
      // Status: run.status?.name,
      jira: {
        ...test.jira,
        status: run.status?.name,
      },
      steps,
      iterations: run.iterations?.results || [],
    } as TestCase;
  });
}

/** Determine output file path based on execution summary content. */
function buildOutputFilePath(saveDir: string, execKey: string, execSummary: string): string {
  const lower = execSummary.toLowerCase();
  const flavor = lower.includes('serial') || lower.includes('sequential') ? 'serial' : 'parallel';
  return path.join(saveDir, `${execKey}_${flavor}_testCases.json`);
}

/**
 * Process a single execution: fetch details, build test cases, download attachments,
 * enrich from Excel, and persist JSON.
 */
async function processExecution(exec: any, token: string, baseFolder: string, saveDir: string): Promise<void> {
  const execKey = exec.jira.key;
  const execSummary = exec.jira.summary;
  logger.info(`[TestPlanProcessor] Processing execution ${execKey}`);

  const queryTests = buildTestExecutionDetailsQuery(execKey);
  const testsResponse = await axios.post(
    'https://xray.cloud.getxray.app/api/v2/graphql',
    { query: queryTests },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );

  const testRuns = testsResponse.data?.data?.getTestExecutions?.results?.[0]?.testRuns?.results || [];
  let testCases = buildTestCasesFromRuns(testRuns);

  // Attachments & enrichment
  await downloadAllAttachments(testCases, baseFolder);
  testCases = testCases.map((tc) => enrichTestCaseWithExcel(tc, baseFolder));

  const filePath = buildOutputFilePath(saveDir, execKey, execSummary);
  fs.writeFileSync(filePath, JSON.stringify(testCases, null, 2), 'utf-8');
  logger.info(`[TestPlanProcessor] Test cases for execution ${execKey} saved to ${filePath}`);
}

export async function getTestExecutionsFromTestPlan(testPlanKey: string): Promise<void> {
  try {
    const token = await getXrayAccessToken();
    const queryExecutions = buildGetTestPlanQuery(testPlanKey);
    logger.info(`[TestPlanProcessor] Fetching test executions for test plan ${testPlanKey}`);

    const execResponse = await axios.post(
      'https://xray.cloud.getxray.app/api/v2/graphql',
      { query: queryExecutions },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    logger.debug(`[TestPlanProcessor] Execution query status: ${execResponse.status}`);
    const testExecutions = execResponse.data?.data?.getTestPlans?.results?.[0]?.testExecutions?.results || [];
    if (testExecutions.length === 0) {
      logger.warn(`[TestPlanProcessor] No test executions found for test plan ${testPlanKey}`);
      return;
    }

    // Prepare directories
    const saveDir = path.join(process.cwd(), 'testcases/x-ray', testPlanKey);
    const baseFolderParent = path.join(process.cwd(), 'testdata');
    const baseFolder = path.join(baseFolderParent, 'x-ray');

    if (!fs.existsSync(baseFolder)) {
      fs.mkdirSync(baseFolder, { recursive: true });
      logger.warn(`[TestPlanProcessor] Base testdata/x-ray folder created: ${baseFolder}`);
    } else {
      logger.debug(`[TestPlanProcessor] using Base testdata/x-ray folder exists: ${baseFolder}`);
    }
    ensureDir(saveDir);
    assertDirExists(baseFolder, 'Base folder for attachments');

    // Validate APS subfolders (ensures structure is expected)
    listApsSubFolders(baseFolder).forEach((sub) => {
      const folderPath = path.join(baseFolder, sub);
      assertDirExists(folderPath, 'Subfolder for attachments');
    });

    // Process each execution sequentially (can be parallelized if needed)
    for (const exec of testExecutions) {
      await processExecution(exec, token, baseFolder, saveDir);
    }
  } catch (error: any) {
    logger.error(
      `[TestPlanProcessor] Failed to fetch executions/cases from test plan ${testPlanKey}: ${error?.message || error}`
    );
    throw new Error(`Unable to fetch executions/cases from test plan ${testPlanKey}`);
  }
}

// CLI Entrypoint
if (require.main === module) {
  (async () => {
    const resolvedPlanKey = await getTestPlanKey();
    await getTestExecutionsFromTestPlan(resolvedPlanKey);
  })();
}
