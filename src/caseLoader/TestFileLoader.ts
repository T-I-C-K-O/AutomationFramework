/**
 * @fileoverview Test File Loader Module for Playwright Test Automation Framework
 *
 * This module provides comprehensive test case file loading capabilities for automated testing.
 * It supports recursive directory traversal, filename parsing, and execution mode determination
 * with robust error handling and metadata enrichment.
 *
 * Key Features:
 * - Recursive directory traversal for test file discovery
 * - Automatic execution key extraction from filenames
 * - Support for parallel and serial execution modes
 * - Robust JSON parsing with error handling
 * - Metadata enrichment for test cases
 * - Performance-optimized for large test suites
 * - Run mode filtering for test cases (all/failed/pending/skipped)
 *
 * Usage:
 * ```typescript
 * import { loadXrayTestcases, loadExcelTestcases, RunMode } from './TestFileLoader';
 *
 * // Load X-Ray test cases with run mode filtering
 * const xrayCases = loadXrayTestcases("all");
 *
 * // Load Excel test cases with run mode filtering
 * const allCases = loadExcelTestcases("all");       // All cases
 * const pendingCases = loadExcelTestcases("pending"); // Cases with empty Result column
 * const failedCases = loadExcelTestcases("failed");   // Only failed cases
 * const skippedCases = loadExcelTestcases("skipped"); // Only skipped cases
 * ```
 *
 * Environment Variables:
 * - EXCEL_RUN_MODE: "all" | "failed" | "pending" | "skipped" (default: "all")
 * - XRAY_RUN_MODE: "all" | "failed" | "pending" | "skipped" (default: "all")
 * - TEST_CASE_SOURCE: "excel" | "x-ray" (auto-detected from command line, filters to load only specified source)
 *
 * @author Automation Framework Team
 * @since 1.0.0
 * @version 1.1.0
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../helpers/logger';

/**
 * Execution mode configuration for test cases
 */
type ExecutionMode = 'parallel' | 'serial';

/**
 * Run mode for test case filtering
 * - "all": Run all test cases regardless of status
 * - "failed": Run failed, pending, and skipped cases (excludes only PASSED)
 * - "pending": Run only cases without results (empty Result column)
 * - "skipped": Run only skipped test cases
 */
export type RunMode = 'all' | 'failed' | 'pending' | 'skipped';

/**
 * Result structure for execution key extraction
 */
interface ExecutionKeyResult {
  execKey: string | undefined;
  mode: ExecutionMode;
}

/**
 * Shape of test case structure after loading and processing
 */
interface TestCase {
  testExecutionKey?: string;
  executionMode: ExecutionMode;
  [key: string]: any;
}

/**
 * Extracts execution key and mode from test case filename using pattern matching.
 *
 * Behavior:
 * - Matches filenames ending with '_testCases.json'
 * - Extracts execution key from filename prefix
 * - Determines execution mode from optional suffix (_serial/_parallel)
 * - Defaults to 'parallel' mode if no suffix specified
 * - Returns undefined execution key for invalid filenames
 *
 * @param filename The test case filename to parse
 * @returns Object containing execution key and mode
 * @since 1.0.0
 */
function extractExecutionKey(filename: string): ExecutionKeyResult {
  const regex = /^(.*?)_testCases\.json$/;
  const match = regex.exec(path.basename(filename));
  if (!match) return { execKey: undefined, mode: 'parallel' };

  let rawKey = match[1];
  const mode: 'parallel' | 'serial' = rawKey.endsWith('_serial') ? 'serial' : 'parallel';
  rawKey = rawKey.replace(/_(serial|parallel)$/, '');
  return { execKey: rawKey, mode };
}

/**
 * Loads test cases from JSON files under the /testcases/x-ray/ directory.
 * Filters based on the run mode and derives testExecutionKey and executionMode from filename.
 *
 * @param runMode - Filter mode: "all" (default), "failed", "pending", or "skipped"
 * @returns Array of TestCase objects filtered by run mode
 *
 * @example
 * // Load all test cases
 * const allCases = loadXrayTestcases("all");
 *
 * // Load only pending (not yet executed) test cases
 * const pendingCases = loadXrayTestcases("pending");
 *
 * // Load only failed test cases
 * const failedCases = loadXrayTestcases("failed");
 */
export function loadXrayTestcases(runMode: RunMode = 'all'): TestCase[] {
  // Check if TEST_CASE_SOURCE is set and filter accordingly
  const testCaseSource = process.env.TEST_CASE_SOURCE?.toLowerCase();
  console.log(`[TestFileLoader] loadXrayTestcases called, TEST_CASE_SOURCE=${testCaseSource}`);

  if (testCaseSource && testCaseSource !== 'x-ray') {
    console.log(`[TestFileLoader] Skipping X-Ray test cases (TEST_CASE_SOURCE=${testCaseSource})`);
    return [];
  }

  console.log(`[TestFileLoader] Loading X-Ray test cases (TEST_CASE_SOURCE allows it)`);

  const testcases: TestCase[] = [];
  const dir = path.join(process.cwd(), 'testcases/x-ray/');

  logger.info(`[TestFileLoader] Loading X-Ray test cases with run mode: "${runMode}"`);

  function walk(d: string): void {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const { execKey, mode } = extractExecutionKey(entry.name);
          const fileContent = fs.readFileSync(fullPath, 'utf8');
          const jsonData: TestCase[] = [].concat(JSON.parse(fileContent));

          jsonData.forEach((tc: TestCase) => {
            const status = tc.jira?.status?.toUpperCase() || '';

            // Apply filter based on run mode
            let shouldInclude = false;
            switch (runMode) {
              case 'all':
                shouldInclude = true;
                break;
              case 'failed':
                // Include failed, pending (empty), and skipped cases
                shouldInclude = status !== 'PASSED';
                break;
              case 'pending':
                // Include only cases without a result
                shouldInclude = !status || status === 'TO DO';
                break;
              case 'skipped':
                shouldInclude = status === 'TO DO';
                break;
            }

            if (shouldInclude) {
              tc.testExecutionKey = execKey;
              tc.executionMode = mode;
              testcases.push(tc);
            }
          });

          logger.info(`[TestFileLoader] Processed X-Ray file "${entry.name}" (key: ${execKey}, mode: ${mode})`);
        } catch (err: any) {
          logger.error(`[TestFileLoader] Error parsing ${fullPath}: ${err?.message || err}`);
        }
      }
    }
  }

  walk(dir);
  logger.info(`[TestFileLoader] Total X-Ray test cases loaded (${runMode}): ${testcases.length}`);
  return testcases;
}

/**
 * Extracts execution key and mode from a JSON filename.
 * Expected format: "Test Plan Name.execution_parallel.json" or "Test Plan Name.execution_serial.json"
 * Default mode is parallel for any filename that doesn't match the patterns.
 *
 * @param filename - The JSON filename to parse
 * @returns Object containing testExecutionKey and executionMode
 *
 * @example
 * parseExecutionInfoFromFilename("Test Plan -Sprint 1.execution_parallel.json")
 * // Returns: { testExecutionKey: "Test Plan -Sprint 1", executionMode: "parallel" }
 * parseExecutionInfoFromFilename("Test Plan -Sprint 1.json")
 * // Returns: { testExecutionKey: "Test Plan -Sprint 1", executionMode: "parallel" }
 */
function parseExecutionInfoFromFilename(filename: string): {
  testExecutionKey: string;
  executionMode: 'parallel' | 'serial';
} {
  // Remove .json extension
  const baseName = filename.replace(/\.json$/i, '');

  // Check for execution mode pattern using contains
  const lowerBaseName = baseName.toLowerCase();
  const hasParallel = lowerBaseName.includes('parallel');
  const hasSerial = lowerBaseName.includes('serial');

  if (hasParallel) {
    return {
      testExecutionKey: baseName.replace(/\.parallel$/i, '').trim(),
      executionMode: 'parallel',
    };
  } else if (hasSerial) {
    return {
      testExecutionKey: baseName.replace(/\.serial$/i, '').trim(),
      executionMode: 'serial',
    };
  }

  // Default: use filename as key, default to serial mode
  return {
    testExecutionKey: baseName.trim(),
    executionMode: 'parallel',
  };
}

/**
 * Loads test cases from JSON files under the /testcases/excel/ directory.
 * Filters based on the run mode and derives testExecutionKey and executionMode from filename.
 *
 * @param runMode - Filter mode: "all" (default), "failed", "pending", or "skipped"
 * @returns Array of TestCase objects filtered by run mode
 *
 * @example
 * // Load all test cases
 * const allCases = loadExcelTestcases("all");
 *
 * // Load only pending (not yet executed) test cases
 * const pendingCases = loadExcelTestcases("pending");
 *
 * // Load only failed test cases
 * const failedCases = loadExcelTestcases("failed");
 */
export function loadExcelTestcases(runMode: RunMode = 'all'): TestCase[] {
  // Check if TEST_CASE_SOURCE is set and filter accordingly
  const testCaseSource = process.env.TEST_CASE_SOURCE?.toLowerCase();
  console.log(`[TestFileLoader] loadExcelTestcases called, TEST_CASE_SOURCE=${testCaseSource}`);

  if (testCaseSource && testCaseSource !== 'excel') {
    console.log(`[TestFileLoader] Skipping Excel test cases (TEST_CASE_SOURCE=${testCaseSource})`);
    return [];
  }

  console.log(`[TestFileLoader] Loading Excel test cases (TEST_CASE_SOURCE allows it)`);

  const testcases: TestCase[] = [];
  const dir = path.join(process.cwd(), 'testcases/excel/');

  logger.info(`[TestFileLoader] Loading Excel test cases with run mode: "${runMode}"`);

  /**
   * Recursively walks through directories to find and process all `.json` files
   * under the Excel testcases directory.
   */
  function walk(d: string): void {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          // Extract execution info from filename
          const { testExecutionKey, executionMode } = parseExecutionInfoFromFilename(entry.name);

          const fileContent = fs.readFileSync(fullPath, 'utf8');
          const jsonData: TestCase[] = [].concat(JSON.parse(fileContent));

          jsonData.forEach((tc: TestCase) => {
            const status = tc.jira?.status?.toUpperCase() || '';

            // Apply filter based on run mode
            let shouldInclude = false;
            switch (runMode) {
              case 'all':
                // Include all cases regardless of status
                shouldInclude = true;
                break;
              case 'failed':
                // Include failed, pending (empty), and skipped cases for re-runs
                // Excludes only PASSED cases
                shouldInclude = status !== 'PASSED';
                break;
              case 'pending':
                // Include only cases without a result (empty status)
                shouldInclude = !status || status === '';
                break;
              case 'skipped':
                // Include only skipped cases
                shouldInclude = status === 'SKIPPED';
                break;
            }

            if (shouldInclude) {
              // Augment test case with execution key and mode from filename
              testcases.push({
                ...tc,
                testExecutionKey,
                executionMode,
              });
            }
          });

          logger.info(`[TestFileLoader] Processed "${entry.name}" (key: ${testExecutionKey}, mode: ${executionMode})`);
        } catch (err: any) {
          logger.error(`[TestFileLoader] Error parsing ${fullPath}: ${err?.message || err}`);
        }
      }
    }
  }

  walk(dir);
  logger.info(`[TestFileLoader] Total Excel test cases loaded (${runMode}): ${testcases.length}`);
  return testcases;
}

/**
 * Gets test cases that would be SKIPPED based on the run mode.
 * These are cases that exist but don't match the filter criteria.
 *
 * @param runMode - The run mode to check against
 * @returns Array of test cases that would be skipped, with their executionFilePath
 *
 * @example
 * // Get cases that would be skipped when running in "pending" mode
 * const skippedCases = getSkippedCasesByRunMode("pending");
 */
export function getSkippedCasesByRunMode(runMode: RunMode): TestCase[] {
  const skippedCases: TestCase[] = [];
  const dir = path.join(process.cwd(), 'testcases/excel/');

  function walk(d: string): void {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const fullPath = path.join(d, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const { testExecutionKey, executionMode } = parseExecutionInfoFromFilename(entry.name);
          const fileContent = fs.readFileSync(fullPath, 'utf8');
          const jsonData: TestCase[] = [].concat(JSON.parse(fileContent));

          jsonData.forEach((tc: TestCase) => {
            // const status = tc.jira?.status?.toUpperCase() || '';

            // Determine if this case would be marked as SKIPPED in Excel
            // Note: PASSED cases should NEVER be marked as SKIPPED - they should remain unchanged
            let shouldMarkAsSkipped = false;
            switch (runMode) {
              case 'all':
                // All cases run, none are marked as skipped
                shouldMarkAsSkipped = false;
                break;
              case 'failed':
                // PASSED cases are excluded from execution but should NOT be marked as SKIPPED
                // They should retain their PASSED status
                shouldMarkAsSkipped = false;
                break;
              case 'pending':
                // Cases with FAILED/SKIPPED status are not run but should not be overwritten
                // Only mark SKIPPED if the case has no result or is already SKIPPED
                shouldMarkAsSkipped = false;
                break;
              case 'skipped':
                // Only running SKIPPED cases - others are excluded but not marked
                shouldMarkAsSkipped = false;
                break;
            }

            if (shouldMarkAsSkipped) {
              skippedCases.push({
                ...tc,
                testExecutionKey,
                executionMode,
              });
            }
          });
        } catch (err: any) {
          logger.error(`[TestFileLoader] Error parsing ${fullPath}: ${err?.message || err}`);
        }
      }
    }
  }

  walk(dir);
  logger.info(`[TestFileLoader] Found ${skippedCases.length} case(s) to be skipped for run mode: "${runMode}"`);
  return skippedCases;
}
