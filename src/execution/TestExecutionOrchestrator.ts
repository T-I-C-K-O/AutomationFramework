import { Browser, TestInfo } from '@playwright/test';
import { StepExecutor } from '../steps/StepExecutor';
import { logger } from '../helpers/logger';
import { logMemoryUsage } from '../helpers/memory-utils';
import { EvidenceCapture } from '../evidence/EvidenceCapture';
import { updateExcelResult } from '../reporting/resultUpdater';
import type { TestResult, StepResult, Evidence, Iteration, ExcelIteration } from '../types';

export class TestExecutionOrchestrator {
  private readonly results: TestResult[] = [];
  private iterationContext: {
    [testKey: string]: {
      overallStatus: 'PASSED' | 'FAILED';
      evidences: Evidence[];
      iterations: Iteration[];
      excelIterations?: ExcelIteration[];
      steps: [];
    };
  } = {};

  /**
   * Factory method for StepExecutor.
   * Can be overridden in child class to provide a custom executor
   *
   * @param page - Playwright Page instance
   * @param testCaseKey - Test case identifier for evidence naming
   * @param iteration - Current iteration number (optional)
   */
  protected createStepExecutor(page: any, testCaseKey?: string, iteration?: number): StepExecutor {
    return new StepExecutor(page, {
      enableRetry: true,
      testCaseKey: testCaseKey ?? 'unknown',
      iteration: iteration ?? 1,
    });
  }

  /**
   * Group testcases by execution key + mode.
   * Creates unique groups combining testExecutionKey and executionMode.
   *
   * @param testcases - Array of test cases to group
   * @returns Object with grouped test cases by unique key (executionKey_mode)
   */
  groupByExecution(testcases: any[]) {
    const grouped: { [key: string]: { mode: 'parallel' | 'serial'; cases: any[] } } = {};
    for (const tc of testcases) {
      if (!tc.testExecutionKey) continue;

      // Create unique group key combining execution key and mode
      const mode = tc.executionMode || 'parallel'; // ← CHANGED from 'serial' to 'parallel'
      const groupKey = `${tc.testExecutionKey}_${mode}`;
      if (!grouped[groupKey]) {
        grouped[groupKey] = { mode, cases: [] };
      }
      grouped[groupKey].cases.push(tc);
    }
    return grouped;
  }

  /**
   * Run a single testcase (no iterations)
   */
  async runSingleTest({ testInfo, testcase, browser }: { testInfo: TestInfo; testcase: any; browser: Browser }) {
    const start = Date.now();
    logger.info(
      `[TestExecutionOrchestrator] [${new Date().toISOString()}][PID:${process.pid}] START ${testInfo.title}`
    );

    logMemoryUsage(`Before Test ${testcase.jira.key}`);

    let status: 'PASSED' | 'FAILED' = 'PASSED';
    const evidences: Evidence[] = [];
    let errorMessage: string | undefined = undefined;
    let failedAction: string | undefined = undefined;
    const stepResults: StepResult[] = [];

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const stepExecutor = this.createStepExecutor(page, testcase.jira.key);

    try {
      for (const step of testcase.steps) {
        try {
          //Execute step without capturing unused return value
          await stepExecutor.executeStep(step, undefined);
          // ✅ Step passed
          stepResults.push({ status: 'PASSED' });
          logger.info(`[TestExecutionOrchestrator] Step PASSED: ${step.action}`);
        } catch (err: any) {
          status = 'FAILED';
          // Only keep the first line of the error message
          errorMessage = (err?.message || String(err)).split('\n')[0];

          // If step has an action, use it; else stringify
          failedAction = step.action || (typeof step === 'string' ? step : JSON.stringify(step));

          logger.error(
            `[TestExecutionOrchestrator] Test ${testcase.jira.key} failed at step "${failedAction}": ${errorMessage}`
          );

          // 🔹 Capture screenshot
          const shot = await EvidenceCapture.captureScreenshot(page, testcase.jira.key);
          if (shot) {
            evidences.push({
              data: shot.base64Data,
              filename: shot.filename,
              contentType: 'image/png',
            });
            logger.info(`[TestExecutionOrchestrator] Evidence captured for FAILED test: ${testcase.jira.key}`);
          }

          // ✅ Record a failed step
          stepResults.push({ status: 'FAILED', comment: errorMessage });
          throw err;
        }
      }
    } finally {
      //hook for after each test level operations from the tear down mechanism
      await context.close();

      //Build comment with failed step action
      const comment =
        status === 'PASSED' ? 'Test passed' : `Test failed at step "${failedAction}" Error Message : ${errorMessage}`;

      this.results.push({
        testKey: testcase.jira.key,
        status,
        comment,
        evidences: evidences.length ? evidences : undefined,
        steps: stepResults, // ✅ add step-level results
      });

      const duration = Date.now() - start;
      logger.info(
        `[${new Date().toISOString()}][PID:${process.pid}] END ${testInfo.title} in ${duration}ms (status=${status})`
      );
    }
  }

  /**
   * Run a single iteration of a testcase
   */
  async runTestIteration({
    testInfo,
    testcase,
    iterationIndex,
    iterationData,
    browser,
  }: {
    testInfo: TestInfo;
    testcase: any;
    iterationIndex: number;
    iterationData: any;
    browser: Browser;
  }): Promise<{
    testKey: string;
    status: 'PASSED' | 'FAILED';
    comment: string;
    evidences?: Evidence[];
    iteration: Iteration;
  }> {
    const start = Date.now();
    const iterationName = `Iteration-${iterationIndex + 1}`;
    logger.info(
      `[TestExecutionOrchestrator] [${new Date().toISOString()}][PID:${process.pid}] START ${testInfo.title}`
    );

    logMemoryUsage(`Before Test ${testcase.jira.key} ${iterationName} `);

    let status: 'PASSED' | 'FAILED' = 'PASSED';
    const evidences: Evidence[] = [];
    let errorMessage: string | undefined = undefined;

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const stepExecutor = this.createStepExecutor(page, testcase.jira.key, iterationIndex + 1);

    const stepResults: StepResult[] = [];

    try {
      for (const step of testcase.steps) {
        await stepExecutor.executeStep(step, iterationData);
        stepResults.push({ status: 'PASSED' });
      }
    } catch (err: any) {
      errorMessage = err?.message || String(err);
      logger.error(`[TestExecutionOrchestrator] Test ${testcase.jira.key} ${iterationName} `);
      status = 'FAILED';
      const shot = await EvidenceCapture.captureScreenshot(page, testcase.jira.key, iterationIndex + 1);
      if (shot) {
        evidences.push({
          data: shot.base64Data,
          filename: shot.filename,
          contentType: 'image/png',
        });
        logger.info(
          `[TestExecutionOrchestrator] Evidence captured for FAILED test: ${testcase.jira.key} ${iterationName} `
        );
      }
      //  Mark this step as FAILED
      stepResults.push({
        status: 'FAILED',
        comment: errorMessage,
      });
      throw err; // Ensure the error is propagated to Playwright
    } finally {
      await context.close();

      // Initialize iteration context for this testcase
      if (!this.iterationContext[testcase.jira.key]) {
        this.iterationContext[testcase.jira.key] = {
          overallStatus: 'PASSED',
          evidences: [],
          iterations: [],
          steps: [],
        };
      }

      const ctx = this.iterationContext[testcase.jira.key];

      if (status === 'FAILED') ctx.overallStatus = 'FAILED';
      if (evidences.length) ctx.evidences.push(...evidences);

      const iterationDetails: Iteration = {
        name: iterationName,
        status,
        steps: stepResults.map((s) => ({
          status: s.status,
          comment: errorMessage || '',
        })),
        parameters: [{ name: 'run', value: String(iterationIndex + 1) }],
      };

      ctx.iterations.push(iterationDetails);

      const duration = Date.now() - start;
      logger.info(
        `[TestExecutionOrchestrator] [${new Date().toISOString()}][PID: ${process.pid}] END ${testInfo.title} in ${duration} ms(status = ${status})`
      );
    }

    return {
      testKey: testcase.jira.key,
      status,
      comment: status === 'PASSED' ? 'Iteration passed' : `Iteration failed: ${errorMessage} `,
      evidences: evidences.length ? evidences : undefined,
      iteration: {
        name: iterationName,
        status,
        steps: [],
        parameters: [{ name: 'run', value: String(iterationIndex + 1) }],
      },
    };
  }
  /**
   * Finalize iteration results into main results array
   */
  finalizeIterationResults(testcase: any) {
    const ctx = this.iterationContext[testcase.jira.key];
    if (!ctx) return;

    // Ensure iterations have proper structure
    const iterations = ctx.iterations.map((iter) => ({
      name: iter.name,
      status: iter.status,
      steps: iter.steps ?? [], // fallback to empty array if undefined
      parameters: iter.parameters ?? [], // fallback to empty array if undefined
    }));

    this.results.push({
      testKey: testcase.jira.key,
      status: ctx.overallStatus,
      comment: ctx.overallStatus === 'PASSED' ? 'All iterations passed' : 'One or more iterations failed',
      evidences: ctx.evidences.length ? ctx.evidences : undefined,
      iterations,
    });

    // cleanup memory
    delete this.iterationContext[testcase.jira.key];
  }

  /**
   * Group collected results by execution key
   */
  getResultsByExecutionKey(testcases: any[]): { [key: string]: TestResult[] } {
    const resultsByExecKey: { [key: string]: TestResult[] } = {};
    for (const result of this.results) {
      const testcase = testcases.find((tc) => tc.jira.key === result.testKey);
      const execKey = testcase?.testExecutionKey;
      if (!execKey) continue;
      if (!resultsByExecKey[execKey]) resultsByExecKey[execKey] = [];
      resultsByExecKey[execKey].push(result);
    }
    return resultsByExecKey;
  }
  async runExcelSingleTest({
    testInfo: _testInfo,
    testcase,
    browser,
  }: {
    testInfo: TestInfo;
    testcase: any;
    browser: Browser;
  }) {
    let status: 'PASSED' | 'FAILED' = 'PASSED';
    const evidences: Evidence[] = [];
    let errorMessage: string | undefined = undefined;
    let failedAction: string | undefined = undefined;

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const stepExecutor = this.createStepExecutor(page);

    try {
      for (const step of testcase.steps) {
        try {
          await stepExecutor.executeStep(step, undefined);
        } catch (err: any) {
          status = 'FAILED';
          errorMessage = (err?.message || String(err)).split('\n')[0];
          failedAction = step.action || (typeof step === 'string' ? step : JSON.stringify(step));

          logger.error(
            `[TestExecutionOrchestrator] Test ${testcase.jira.key} failed at step "${failedAction}": ${errorMessage}`
          );

          throw err;
        }
      }
    } finally {
      await context.close();

      const comment =
        status === 'PASSED' ? 'Test passed' : `Test failed at step "${failedAction}" Error Message : ${errorMessage}`;

      this.results.push({
        testKey: testcase.jira.key,
        status,
        comment,
        evidences: evidences.length ? evidences : undefined,
      });

      await updateExcelResult(testcase.jira.executionFilePath, testcase.jira.key, status, comment);
    }
  }

  async runExcelFailedSingleTest({
    testInfo: _testInfo,
    testcase,
    browser,
  }: {
    testInfo: TestInfo;
    testcase: any;
    browser: Browser;
  }) {
    let status: 'PASSED' | 'FAILED' = 'PASSED';
    const evidences: Evidence[] = [];
    let errorMessage: string | undefined = undefined;
    let failedAction: string | undefined = undefined;

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const stepExecutor = this.createStepExecutor(page, testcase.jira.key);

    try {
      for (const step of testcase.steps) {
        try {
          await stepExecutor.executeStep(step, undefined);
        } catch (err: any) {
          status = 'FAILED';
          errorMessage = (err?.message || String(err)).split('\n')[0];
          failedAction = step.action || (typeof step === 'string' ? step : JSON.stringify(step));

          logger.error(
            `[TestExecutionOrchestrator] Test ${testcase.jira.key} failed at step "${failedAction}": ${errorMessage}`
          );

          throw err;
        }
      }
    } finally {
      await context.close();

      const comment =
        status === 'PASSED' ? 'Test passed' : `Test failed at step "${failedAction}" Error Message : ${errorMessage}`;

      this.results.push({
        testKey: testcase.jira.key,
        status,
        comment,
        evidences: evidences.length ? evidences : undefined,
      });

      await updateExcelResult(testcase.jira.executionFilePath, testcase.jira.key, status, comment);
    }
  }

  /**
   * Run a single iteration of a testcase for Excel-based tests.
   * Updates Excel directly after each iteration (no Xray/Jira).
   */
  async runExcelTestIteration({
    testInfo,
    testcase,
    iterationIndex,
    iterationData,
    browser,
  }: {
    testInfo: TestInfo;
    testcase: any;
    iterationIndex: number;
    iterationData: any;
    browser: Browser;
  }): Promise<void> {
    const start = Date.now();
    const iterationName = `Iteration-${iterationIndex + 1}`;
    logger.info(
      `[TestExecutionOrchestrator] [${new Date().toISOString()}][PID:${process.pid}] START ${testInfo.title}`
    );

    logMemoryUsage(`Before Test ${testcase.jira.key} ${iterationName}`);

    let status = 'PASSED' as 'PASSED' | 'FAILED';
    let errorMessage: string | undefined = undefined;
    let failedAction: string | undefined = undefined;

    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const stepExecutor = this.createStepExecutor(page, testcase.jira.key, iterationIndex + 1);

    try {
      for (const step of testcase.steps) {
        try {
          await stepExecutor.executeStep(step, iterationData);
        } catch (err: any) {
          errorMessage = (err?.message || String(err)).split('\n')[0];
          failedAction = step.action || (typeof step === 'string' ? step : JSON.stringify(step));
          logger.error(
            `[TestExecutionOrchestrator] Test ${testcase.jira.key} ${iterationName} failed at step "${failedAction}": ${errorMessage}`
          );
          status = 'FAILED';
          throw err;
        }
      }
    } finally {
      await context.close();

      // Build comment for this iteration
      const comment =
        status === 'PASSED'
          ? `${iterationName}: Test passed`
          : `${iterationName}: Test failed at step "${failedAction}" - ${errorMessage}`;

      // Track iteration results for aggregation in finalizeExcelIterationResults
      if (!this.iterationContext[testcase.jira.key]) {
        this.iterationContext[testcase.jira.key] = {
          overallStatus: 'PASSED',
          evidences: [],
          iterations: [],
          excelIterations: [],
          steps: [],
        };
      }

      const ctx = this.iterationContext[testcase.jira.key];
      if (status === 'FAILED') ctx.overallStatus = 'FAILED';

      if (!ctx.excelIterations) ctx.excelIterations = [];
      ctx.excelIterations.push({
        name: iterationName,
        iterationName,
        status,
        failedAction,
        errorMessage,
        comment, // Include the comment in iteration tracking
      });

      const duration = Date.now() - start;
      logger.info(
        `[TestExecutionOrchestrator] [${new Date().toISOString()}][PID:${process.pid}] END ${testInfo.title} in ${duration}ms (status=${status})`
      );
    }
  }

  /**
   * Finalize Excel iteration results and update the Excel file.
   * Called after all iterations of a testcase complete.
   */
  async finalizeExcelIterationResults(testcase: any): Promise<void> {
    const ctx = this.iterationContext[testcase.jira.key];
    if (!ctx) return;

    // Build summary comment from all iterations
    const iterationSummaries = (ctx.excelIterations || []).map((iter) => {
      if (iter.status === 'PASSED') {
        return `${iter.iterationName}: PASSED`;
      } else {
        return `${iter.iterationName}: FAILED at "${iter.failedAction}" - ${iter.errorMessage}`;
      }
    });

    const comment =
      ctx.overallStatus === 'PASSED'
        ? `All iterations passed. ${iterationSummaries.join('; ')}`
        : `One or more iterations failed. ${iterationSummaries.join('; ')}`;

    // Update Excel with the aggregated result
    await updateExcelResult(testcase.jira.executionFilePath, testcase.jira.key, ctx.overallStatus, comment);

    logger.info(`[TestExecutionOrchestrator] Excel updated for ${testcase.jira.key}: ${ctx.overallStatus}`);

    // Cleanup memory
    delete this.iterationContext[testcase.jira.key];
  }
}

export const testExecutionOrchestrator = new TestExecutionOrchestrator();
// export const executionManager = testExecutionOrchestrator; // Backward compatibility alias
