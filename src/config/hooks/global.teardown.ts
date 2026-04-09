/**
 * @fileoverview Playwright Global Teardown
 *
 * Base global teardown that runs once after all tests.
 *
 * To override: Create utils/customHooks/custom.teardown.ts with:
 * ```
 * import { BaseGlobalTeardown } from '../../config/hooks/global.teardown';
 * export class CustomGlobalTeardown extends BaseGlobalTeardown {
 *   async onTeardown(): Promise<void> {
 *     // Your custom logic here
 *     await super.onTeardown();
 *   }
 * }
 * ```
 *
 * @since 1.0.0
 */

import { FullConfig } from '@playwright/test';
import { logger } from '../../helpers/logger';
import { ResourceCleanupManager } from '../../helpers/ResourceCleanupManager';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// AI Feature Import (Lazy loaded)
// ============================================================================
let aiService: {
  shutdown: () => Promise<void>;
  isEnabled: () => boolean;
  getHealedLocators: () => Map<string, { originalLocator: string; healedRef: string }>;
  analyzeFailure: (
    error: Error,
    context?: { action?: string; locator?: string; step?: number }
  ) => Promise<{
    summary: string;
    possibleCauses: string[];
    suggestedFixes: string[];
    pageState: { hasErrors: boolean; consoleErrors: string[]; failedRequests: string[] };
  }>;
} | null = null;

// Test result tracking for AI analysis
interface TestFailure {
  testName: string;
  error: string;
  file: string;
  duration: number;
}

interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  file: string;
  error?: string;
}

async function getAIService() {
  if (aiService === null && process.env.ENABLE_AI_FEATURES === 'true') {
    try {
      const aiModule = require('../../coreLibraries/ai');
      aiService = aiModule.aiService;
    } catch (error) {
      logger.warn(`[AI] Failed to load AI service: ${error}`);
    }
  }
  return aiService;
}

// ============================================================================
// Path Configuration
// ============================================================================
// const CUSTOM_HOOKS_DIR = '../../utils/customHooks';
// const CUSTOM_TEARDOWN_FILE = 'custom.teardown';
// const CUSTOM_TEARDOWN_PATH = path.resolve(__dirname, CUSTOM_HOOKS_DIR, `${CUSTOM_TEARDOWN_FILE}.ts`);

/**
 * Base Global Teardown class - can be extended for custom teardown logic.
 */
export class BaseGlobalTeardown {
  protected config: FullConfig;
  protected testResults: TestResult[] = [];
  protected testFailures: TestFailure[] = [];
  protected aiAnalysisResults: Map<
    string,
    {
      summary: string;
      causes: string[];
      fixes: string[];
      category?: string;
      suggestions?: string[];
      affectedElements?: string[];
    }
  > = new Map();

  constructor(config: FullConfig) {
    this.config = config;
  }

  /** Main teardown method - override this in custom class */
  async onTeardown(): Promise<void> {
    logger.info('[Teardown] Starting onTeardown sequence...');

    await this.collectTestResults();
    await this.analyzeFailuresWithAI();
    await this.cleanupTestData();
    // await this.cleanupAuthenticationState();
    await this.shutdownAIFeatures();
    await this.uploadTestArtifacts();
    await this.generateTestSummary();
    await this.sendNotification();
    await this.cleanupResources();

    logger.info('[Teardown] onTeardown sequence completed');
  }

  // ============================================================================
  // Test Results Collection
  // ============================================================================

  /**
   * Collects test results from Playwright's output files.
   * Parses JUnit XML or JSON results to identify failures.
   */
  protected async collectTestResults(): Promise<void> {
    try {
      logger.info('[Teardown] Starting test results collection...');

      // Try to read from JUnit XML results (most reliable format)
      const junitPath = path.resolve(process.cwd(), 'playwright-results', 'results.xml');
      logger.info(`[Teardown] Checking JUnit XML at: ${junitPath}`);

      if (fs.existsSync(junitPath)) {
        const xmlContent = fs.readFileSync(junitPath, 'utf-8');
        this.parseJUnitResults(xmlContent);
        logger.info(
          `[Teardown] Collected ${this.testResults.length} test result(s), ${this.testFailures.length} failure(s) from JUnit XML`
        );
        return;
      }
      logger.info('[Teardown] JUnit XML not found, trying next source...');

      // Alternative: Try to read from Playwright HTML report
      const playwrightReportDir = path.resolve(process.cwd(), 'playwright-report');
      logger.info(`[Teardown] Checking Playwright HTML report at: ${playwrightReportDir}`);

      if (fs.existsSync(playwrightReportDir)) {
        this.parsePlaywrightHtmlReport(playwrightReportDir);
        if (this.testResults.length > 0) {
          logger.info(
            `[Teardown] Collected ${this.testResults.length} test result(s), ${this.testFailures.length} failure(s) from Playwright HTML Report`
          );
          return;
        }
        logger.info('[Teardown] Playwright HTML report found but no results parsed');
      }

      // Alternative: Try to read from Allure results
      const allureDir = path.resolve(process.cwd(), 'allure-results');
      logger.info(`[Teardown] Checking Allure results at: ${allureDir}`);

      if (fs.existsSync(allureDir)) {
        this.parseAllureResults(allureDir);
        logger.info(
          `[Teardown] Collected ${this.testResults.length} test result(s), ${this.testFailures.length} failure(s) from Allure`
        );
        return;
      }

      logger.warn('[Teardown] No test results files found in any location');
    } catch (error) {
      logger.warn(`[Teardown] Failed to collect test results: ${error}`);
    }
  }

  /**
   * Parses JUnit XML format results.
   */
  private parseJUnitResults(xmlContent: string): void {
    logger.info('[Teardown] Parsing JUnit XML results...');

    // Parse all test cases (passed, failed, skipped)
    const testCaseRegex =
      /<testcase\s+name="([^"]+)"[^>]*classname="([^"]+)"[^>]*(?:time="([^"]+)")?[^>]*>([\s\S]*?)<\/testcase>/gi;

    let match;
    let parseCount = 0;

    while ((match = testCaseRegex.exec(xmlContent)) !== null) {
      const testName = match[1];
      const file = match[2];
      const duration = parseFloat(match[3] || '0');
      const testContent = match[4];

      let status: 'passed' | 'failed' | 'skipped' | 'timedOut' = 'passed';
      let error: string | undefined;

      // Check for failure
      if (testContent.includes('<failure')) {
        status = 'failed';
        error = this.extractErrorFromXml(testContent);

        this.testFailures.push({ testName, file, duration, error: error || 'Unknown error' });
        logger.info(`[Teardown] Found failure: ${testName.substring(0, 50)}... Error: ${error?.substring(0, 60)}...`);
      } else if (testContent.includes('<skipped')) {
        status = 'skipped';
      }

      this.testResults.push({ testName, status, duration, file, error });
      parseCount++;
    }

    // Also try self-closing testcase tags (passed tests with no content)
    const selfClosingRegex = /<testcase\s+name="([^"]+)"[^>]*classname="([^"]+)"[^>]*(?:time="([^"]+)")?[^>]*\/>/gi;
    while ((match = selfClosingRegex.exec(xmlContent)) !== null) {
      this.testResults.push({
        testName: match[1],
        status: 'passed',
        duration: parseFloat(match[3] || '0'),
        file: match[2],
      });
      parseCount++;
    }

    logger.info(
      `[Teardown] Parsed ${parseCount} test cases: ${this.testResults.filter((r) => r.status === 'passed').length} passed, ${this.testFailures.length} failed`
    );
  }

  /**
   * Extracts error message from XML test content.
   */
  private extractErrorFromXml(testContent: string): string {
    // Try to extract from CDATA first (contains the actual error)
    const cdataMatch = /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(testContent);

    if (cdataMatch && cdataMatch[1]) {
      const cdataContent = cdataMatch[1].trim();
      const lines = cdataContent.split('\n');

      // Find the line with "Error:"
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('Error:')) {
          return trimmedLine;
        }
      }

      // If no "Error:" line, look for common error patterns
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (
          trimmedLine.includes('Error:') ||
          trimmedLine.includes('Timeout') ||
          trimmedLine.includes('failed') ||
          trimmedLine.includes('not found')
        ) {
          return trimmedLine.substring(0, 150);
        }
      }
    }

    // Fallback to message attribute
    const messageMatch = /<failure[^>]*message="([^"]*)"/.exec(testContent);
    if (messageMatch && messageMatch[1]) {
      return messageMatch[1];
    }

    return 'Test failed - see detailed logs';
  }

  /**
   * Parses Allure results directory for all test results.
   */
  private parseAllureResults(allureDir: string): void {
    try {
      const files = fs.readdirSync(allureDir);
      const resultFiles = files.filter((f) => f.endsWith('-result.json'));

      for (const file of resultFiles) {
        try {
          const content = fs.readFileSync(path.join(allureDir, file), 'utf-8');
          const result = JSON.parse(content);

          const testName = result.name || result.fullName || 'Unknown test';
          const testFile = result.labels?.find((l: { name: string }) => l.name === 'suite')?.value || 'unknown';
          const duration = (result.stop - result.start) / 1000 || 0;

          // Map Allure status to TestResult status
          let status: 'passed' | 'failed' | 'skipped' | 'timedOut' = 'passed';
          let error: string | undefined;

          if (result.status === 'failed' || result.status === 'broken') {
            status = 'failed';
            error = result.statusDetails?.message || result.statusDetails?.trace || 'Test failed';

            this.testFailures.push({ testName, file: testFile, duration, error: error as string });
          } else if (result.status === 'skipped') {
            status = 'skipped';
          } else if (result.status === 'passed') {
            status = 'passed';
          }

          this.testResults.push({ testName, status, duration, file: testFile, error });
        } catch {
          // Skip invalid JSON files
        }
      }
    } catch (error) {
      logger.warn(`[Teardown] Failed to parse Allure results: ${error}`);
    }
  }

  /**
   * Parses Playwright HTML report directory for test results.
   * The HTML reporter generates data in the 'data' subfolder as JSON.
   */
  private parsePlaywrightHtmlReport(reportDir: string): void {
    try {
      // Playwright HTML report stores data in 'data' folder or as embedded JSON
      const dataDir = path.join(reportDir, 'data');

      if (fs.existsSync(dataDir)) {
        // Parse from data directory (Playwright v1.30+)
        const files = fs.readdirSync(dataDir);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));

        for (const file of jsonFiles) {
          try {
            const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
            const data = JSON.parse(content);

            // Handle different JSON structures in playwright-report/data
            if (Array.isArray(data)) {
              this.parsePlaywrightReportArray(data);
            } else if (data.suites) {
              this.parsePlaywrightSuites(data.suites);
            } else if (data.specs) {
              this.parsePlaywrightSpecs(data.specs, data.file || 'unknown');
            }
          } catch {
            // Skip invalid JSON files
          }
        }
      }

      // Also try to parse report.json if it exists (older format)
      const reportJsonPath = path.join(reportDir, 'report.json');
      if (fs.existsSync(reportJsonPath)) {
        try {
          const content = fs.readFileSync(reportJsonPath, 'utf-8');
          const report = JSON.parse(content);

          if (report.suites) {
            this.parsePlaywrightSuites(report.suites);
          }
        } catch {
          // Skip if invalid
        }
      }
    } catch (error) {
      logger.warn(`[Teardown] Failed to parse Playwright HTML report: ${error}`);
    }
  }

  /**
   * Parses Playwright report array format.
   */
  private parsePlaywrightReportArray(data: unknown[]): void {
    for (const item of data) {
      const test = item as {
        title?: string;
        file?: string;
        status?: string;
        duration?: number;
        error?: { message?: string };
        errors?: Array<{ message?: string }>;
      };

      if (test.title && test.status) {
        const testName = test.title;
        const testFile = test.file || 'unknown';
        const duration = (test.duration || 0) / 1000;

        let status: 'passed' | 'failed' | 'skipped' | 'timedOut' = 'passed';
        let error: string | undefined;

        if (test.status === 'failed' || test.status === 'timedOut') {
          status = test.status === 'timedOut' ? 'timedOut' : 'failed';
          error = test.error?.message || test.errors?.[0]?.message || 'Test failed';

          this.testFailures.push({ testName, file: testFile, duration, error });
        } else if (test.status === 'skipped') {
          status = 'skipped';
        }

        this.testResults.push({ testName, status, duration, file: testFile, error });
      }
    }
  }

  /**
   * Parses Playwright suites structure (nested format).
   */
  private parsePlaywrightSuites(suites: unknown[]): void {
    for (const suite of suites) {
      const s = suite as {
        title?: string;
        file?: string;
        specs?: unknown[];
        suites?: unknown[];
      };

      // Recursively parse nested suites
      if (s.suites) {
        this.parsePlaywrightSuites(s.suites);
      }

      // Parse specs in this suite
      if (s.specs) {
        this.parsePlaywrightSpecs(s.specs, s.file || s.title || 'unknown');
      }
    }
  }

  /**
   * Parses Playwright specs array.
   */
  private parsePlaywrightSpecs(specs: unknown[], suiteFile: string): void {
    for (const spec of specs) {
      const s = spec as {
        title?: string;
        ok?: boolean;
        tests?: Array<{
          status?: string;
          duration?: number;
          results?: Array<{ status?: string; duration?: number; error?: { message?: string } }>;
        }>;
      };

      if (s.title && s.tests) {
        for (const test of s.tests) {
          const testName = s.title;
          const testFile = suiteFile;

          // Get result from the test or its results array
          const result = test.results?.[0];
          const testStatus = result?.status || test.status || (s.ok ? 'passed' : 'failed');
          const duration = (result?.duration || test.duration || 0) / 1000;

          let status: 'passed' | 'failed' | 'skipped' | 'timedOut' = 'passed';
          let error: string | undefined;

          if (testStatus === 'failed' || testStatus === 'timedOut') {
            status = testStatus === 'timedOut' ? 'timedOut' : 'failed';
            error = result?.error?.message || 'Test failed';

            this.testFailures.push({ testName, file: testFile, duration, error: error as string });
          } else if (testStatus === 'skipped') {
            status = 'skipped';
          }

          this.testResults.push({ testName, status, duration, file: testFile, error });
        }
      }
    }
  }

  // ============================================================================
  // AI Failure Analysis
  // ============================================================================

  /**
   * Analyzes test failures using AI to provide insights.
   * Generates summaries, possible causes, and suggested fixes.
   */
  protected async analyzeFailuresWithAI(): Promise<void> {
    if (process.env.ENABLE_AI_FEATURES !== 'true') {
      logger.info('[AI] AI failure analysis disabled');
      return;
    }

    if (this.testFailures.length === 0) {
      logger.info('[AI] No test failures to analyze');
      return;
    }

    logger.info(`[AI] Analyzing ${this.testFailures.length} test failure(s)...`);

    try {
      const service = await getAIService();
      if (!service || !service.isEnabled()) {
        logger.info('[AI] AI service not available, using basic analysis');
        this.performBasicFailureAnalysis();
        return;
      }

      // Analyze each failure
      for (const failure of this.testFailures) {
        try {
          const error = new Error(failure.error);
          const analysis = await service.analyzeFailure(error, {
            action: 'test execution',
            locator: failure.file,
          });

          // Determine failure category from analysis
          const category = this.categorizeFailure(failure.error, analysis.possibleCauses);

          // Extract affected elements from error message for specific categories
          const affectedElements: string[] = [];

          if (category === 'Locator Failure') {
            // Extract element name from error: "failed for 'ElementName'" or "'ElementName' failed"
            const locatorMatch =
              failure.error.match(/for\s*['"]([^'"]+)['"]/i) ||
              failure.error.match(/['"]([^'"]+)['"]\s*(?:failed|locator)/i);
            if (locatorMatch) affectedElements.push(locatorMatch[1]);
          } else if (category === 'Data Dependency') {
            // Extract variable name from error: "variable 'ProductId'"
            const varMatch =
              failure.error.match(/variable\s*['"]?(\w+)['"]?/i) ||
              failure.error.match(/['"](\w+)['"]\s*(?:not found|is not stored)/i);
            if (varMatch) affectedElements.push(varMatch[1]);
          } else if (category === 'Element Not Found' || category === 'Element Interaction') {
            // Extract element from various patterns
            const elemMatch =
              failure.error.match(/element\s*['"]([^'"]+)['"]/i) ||
              failure.error.match(/locator\s*['"]([^'"]+)['"]/i) ||
              failure.error.match(/selector\s*['"]([^'"]+)['"]/i);
            if (elemMatch) affectedElements.push(elemMatch[1]);
          }

          this.aiAnalysisResults.set(failure.testName, {
            summary: analysis.summary,
            causes: analysis.possibleCauses,
            fixes: analysis.suggestedFixes,
            category,
            suggestions: analysis.suggestedFixes.slice(0, 2), // Top 2 suggestions
            affectedElements: affectedElements.length > 0 ? affectedElements : undefined,
          });

          const elementInfo = affectedElements.length > 0 ? ` (elements: ${affectedElements.join(', ')})` : '';
          logger.info(`[AI] Analysis for "${failure.testName}":`);
          logger.info(`  Category: ${category}${elementInfo}`);
          logger.info(`  Summary: ${analysis.summary}`);
          if (analysis.possibleCauses.length > 0) {
            logger.info(`  Possible causes: ${analysis.possibleCauses.join(', ')}`);
          }
          if (analysis.suggestedFixes.length > 0) {
            logger.info(`  Suggested fixes: ${analysis.suggestedFixes.join(', ')}`);
          }
        } catch (analysisError) {
          logger.warn(`[AI] Failed to analyze "${failure.testName}": ${analysisError}`);
          // Use basic analysis as fallback
          this.performBasicAnalysisForFailure(failure);
        }
      }

      // Store analysis summary in environment for notification
      this.storeAnalysisSummary();
    } catch (error) {
      logger.warn(`[AI] Failure analysis error: ${error}`);
      this.performBasicFailureAnalysis();
    }
  }

  /**
   * Categorizes a failure based on error message and causes.
   */
  private categorizeFailure(errorMessage: string, causes: string[]): string {
    const errorLower = errorMessage.toLowerCase();
    const causesLower = causes.join(' ').toLowerCase();

    // Timeout errors
    if (errorLower.includes('timeout') || errorLower.includes('exceeded')) {
      return 'Timeout';
    }

    // Browser/Page closed errors
    if (
      errorLower.includes('target page') ||
      errorLower.includes('browser has been closed') ||
      errorLower.includes('context has been closed') ||
      errorLower.includes('target closed')
    ) {
      return 'Browser Closed';
    }

    // Data dependency errors
    if (
      errorLower.includes('no stored value') ||
      errorLower.includes('stored value found') ||
      (errorLower.includes('variable') && errorLower.includes('undefined'))
    ) {
      return 'Data Dependency';
    }

    // Locator/Selector failures
    if (
      errorLower.includes('all locators') ||
      errorLower.includes('locator failed') ||
      errorLower.includes('all dropdown') ||
      errorLower.includes('strategies failed')
    ) {
      return 'Locator Failure';
    }

    // Element interaction issues
    if (errorLower.includes('not clickable') || errorLower.includes('intercept') || causesLower.includes('overlay')) {
      return 'Element Interaction';
    }

    // Element not found (but not "stored value not found")
    if (
      (errorLower.includes('not found') || errorLower.includes('no element')) &&
      !errorLower.includes('stored value')
    ) {
      return 'Element Not Found';
    }

    // Assertion failures
    if (
      errorLower.includes('assertion') ||
      errorLower.includes('expect') ||
      errorLower.includes('toequal') ||
      errorLower.includes('tobe')
    ) {
      return 'Assertion Failure';
    }

    // Network errors
    if (
      errorLower.includes('network') ||
      errorLower.includes('request failed') ||
      errorLower.includes('response') ||
      errorLower.includes('fetch')
    ) {
      return 'Network Error';
    }

    // Authentication issues
    if (
      errorLower.includes('auth') ||
      errorLower.includes('login') ||
      errorLower.includes('permission') ||
      errorLower.includes('401') ||
      errorLower.includes('403')
    ) {
      return 'Authentication';
    }

    // Browser/Page crashes
    if (
      errorLower.includes('crashed') ||
      errorLower.includes('target closed') ||
      errorLower.includes('browser') ||
      errorLower.includes('context')
    ) {
      return 'Browser Crash';
    }

    // Navigation issues
    if (errorLower.includes('navigation') || errorLower.includes('goto') || errorLower.includes('url')) {
      return 'Navigation Error';
    }

    return 'Other';
  }

  /**
   * Performs basic failure analysis without AI.
   * Used as fallback when AI is unavailable.
   */
  private performBasicFailureAnalysis(): void {
    for (const failure of this.testFailures) {
      this.performBasicAnalysisForFailure(failure);
    }
    this.storeAnalysisSummary();
  }

  /**
   * Basic analysis for a single failure.
   */
  private performBasicAnalysisForFailure(failure: TestFailure): void {
    const errorLower = failure.error.toLowerCase();
    let summary = failure.error.substring(0, 100);
    const causes: string[] = [];
    const fixes: string[] = [];
    let category = 'Other';

    // Timeout errors
    if (errorLower.includes('timeout') || errorLower.includes('exceeded')) {
      summary = 'Operation timed out waiting for element or condition';
      causes.push('Element not visible or not in DOM', 'Page loading slowly', 'Dynamic content not loaded');
      fixes.push('Increase timeout value', 'Add explicit wait for element', 'Check if element selector is correct');
      category = 'Timeout';
    }
    // Browser/Page closed errors
    else if (
      errorLower.includes('target page') ||
      errorLower.includes('browser has been closed') ||
      errorLower.includes('context has been closed') ||
      errorLower.includes('target closed')
    ) {
      summary = 'Browser or page was closed during navigation';
      causes.push(
        'Page navigation was interrupted',
        'Previous action caused page to close',
        'Test setup/teardown timing issue'
      );
      fixes.push(
        'Add wait for page to be ready before navigation',
        'Check if previous step closes the page',
        'Ensure proper page initialization in test setup'
      );
      category = 'Browser Closed';
    }
    // Data dependency errors (stored variables)
    else if (errorLower.includes('no stored value') || errorLower.includes('stored value found')) {
      // Extract variable name from error message
      // Patterns: "variable 'ProductId'", "No stored value found for variable 'ProductId'"
      const varNameMatch =
        failure.error.match(/variable\s*['"]?(\w+)['"]?/i) ||
        failure.error.match(/['"](\w+)['"]\s*(?:not found|is not stored)/i);
      const variableName = varNameMatch ? varNameMatch[1] : 'variable';

      summary = `Required value '${variableName}' not available from previous test`;
      causes.push(
        `Previous test case failed to store '${variableName}'`,
        'Test execution order issue',
        'Variable name mismatch in test data'
      );
      fixes.push(
        `Ensure '${variableName}' is stored before use`,
        `Check if test storing '${variableName}' passed`,
        'Add fallback value or skip dependent test'
      );
      category = 'Data Dependency';
      // Store the affected variable for detailed reporting
      if (variableName !== 'variable') {
        (this as any)._currentAffectedElements = [variableName];
      }
    }
    // Locator/Strategy failures
    else if (
      errorLower.includes('all locators') ||
      errorLower.includes('locator failed') ||
      errorLower.includes('all dropdown') ||
      errorLower.includes('strategies failed')
    ) {
      // Extract element/locator name from error message
      // Pattern: "All locators for 'element_name' failed" or "'element_name' failed"
      const locatorMatch =
        failure.error.match(/['"]([^'"]+)['"]\s*(?:failed|locator)/i) || failure.error.match(/for\s*['"]([^'"]+)['"]/i);
      const elementName = locatorMatch ? locatorMatch[1] : undefined;

      summary = elementName
        ? `Locator '${elementName}' failed - all strategies exhausted`
        : 'All locator strategies failed to find the element';
      causes.push(
        'Element selectors are outdated',
        'UI has changed after deployment',
        'Element is dynamically generated'
      );
      fixes.push(
        elementName ? `Update locators for '${elementName}' in page objects` : 'Update locators in page objects',
        'Add more robust selector strategies',
        'Verify element exists in current UI'
      );
      category = 'Locator Failure';
      // Store the affected element for detailed reporting
      if (elementName) {
        (this as any)._currentAffectedElements = [elementName];
      }
    }
    // Element interaction issues
    else if (errorLower.includes('not clickable') || errorLower.includes('intercept')) {
      summary = 'Element is blocked or not interactable';
      causes.push('Modal or popup blocking the element', 'Element is disabled', 'Another element overlaying');
      fixes.push('Wait for overlay to disappear', 'Scroll element into view', 'Check element state before click');
      category = 'Element Interaction';
    }
    // Element not found
    else if (errorLower.includes('not found') || errorLower.includes('no element')) {
      summary = 'Element not found on page';
      causes.push('Selector is incorrect', 'Element not yet rendered', 'Wrong page or route');
      fixes.push('Verify selector in browser DevTools', 'Add navigation wait', 'Check page URL is correct');
      category = 'Element Not Found';
    }
    // Assertion failures
    else if (errorLower.includes('assertion') || errorLower.includes('expect')) {
      summary = 'Test assertion did not match expected value';
      causes.push('Expected value has changed', 'Data inconsistency', 'Timing or race condition');
      fixes.push('Update expected value in test', 'Add retry logic for flaky assertions', 'Verify test data');
      category = 'Assertion Failure';
    }
    // Browser crashes
    else if (errorLower.includes('crashed') || errorLower.includes('target crashed')) {
      summary = 'Browser or page crashed during test execution';
      causes.push('Memory leak in application', 'Heavy JavaScript execution', 'Browser resource exhaustion');
      fixes.push('Check for memory leaks', 'Reduce parallel test count', 'Add page reload handling');
      category = 'Browser Crash';
    }
    // Network errors
    else if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('request')) {
      summary = 'Network request failed or timed out';
      causes.push('API server is down', 'Network connectivity issue', 'Request timeout');
      fixes.push('Verify API server is running', 'Check network configuration', 'Increase request timeout');
      category = 'Network Error';
    }
    // Authentication
    else if (errorLower.includes('auth') || errorLower.includes('login') || errorLower.includes('401')) {
      summary = 'Authentication or authorization failed';
      causes.push('Invalid credentials', 'Session expired', 'Permission denied');
      fixes.push('Verify login credentials', 'Check token expiration', 'Verify user permissions');
      category = 'Authentication';
    }
    // Fallback for unknown errors
    else {
      summary = `Test failed: ${failure.error.substring(0, 80)}`;
      causes.push('Unknown error occurred', 'Check detailed test logs');
      fixes.push('Review test execution logs', 'Check screenshot for context', 'Debug test locally');
      category = 'Other';
    }

    // Get the affected elements if extracted
    const affectedElements: string[] | undefined = (this as any)._currentAffectedElements;
    delete (this as any)._currentAffectedElements;

    this.aiAnalysisResults.set(failure.testName, {
      summary,
      causes,
      fixes,
      category,
      suggestions: fixes.slice(0, 2),
      affectedElements,
    });

    const elementInfo =
      affectedElements && affectedElements.length > 0 ? ` (elements: ${affectedElements.join(', ')})` : '';
    logger.info(`[AI] Categorized "${failure.testName.substring(0, 40)}..." as: ${category}${elementInfo}`);
  }

  /**
   * Stores analysis summary in environment for use in notifications.
   */
  private storeAnalysisSummary(): void {
    if (this.aiAnalysisResults.size === 0) return;

    const summaries: string[] = [];
    this.aiAnalysisResults.forEach((analysis, testName) => {
      summaries.push(`• ${testName}: ${analysis.summary}`);
    });

    process.env.AI_FAILURE_ANALYSIS = summaries.join('\n');
    process.env.TEST_FAILURES_COUNT = this.testFailures.length.toString();
  }

  /**
   * Gets the AI analysis results for external use.
   */
  protected getFailureAnalysis(): Map<string, { summary: string; causes: string[]; fixes: string[] }> {
    return this.aiAnalysisResults;
  }

  // ============================================================================
  // Test Data Cleanup
  // ============================================================================

  /**
   * Cleans up test data created during test execution.
   * Override this method to implement your cleanup logic.
   *
   * Common use cases:
   * - Delete test users created during tests
   * - Remove test records from database
   * - Clean up uploaded files
   */
  protected async cleanupTestData(): Promise<void> {
    // TODO: Implement your test data cleanup logic here
    // This is a placeholder - override in custom teardown
    logger.info('Test data cleanup skipped (not implemented in base class)');

    // Store value file cleanup — reset the runtime KV store
    try {
      const storeFile = path.resolve(process.cwd(), 'src', 'testdata', 'storeValue.ts');
      if (fs.existsSync(storeFile)) {
        fs.writeFileSync(
          storeFile,
          'export const storeValue: Record<string, any> = {};\n',
          'utf-8',
        );
        logger.info('[Teardown] ✓ Runtime store value file reset');
      }
    } catch (e) {
      logger.warn(`[Teardown] ⚠️ Failed to reset store value file: ${e}`);
    }

    /*
    // Example implementation:
    const apiBaseUrl = process.env.API_BASE_URL;
    const authToken = process.env.AUTH_TOKEN;
    const testUserId = process.env.TEST_USER_ID;

    if (testUserId) {
      try {
        const response = await fetch(`${apiBaseUrl}/users/${testUserId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });

        if (response.ok) {
          logger.info(`✓ Test user deleted: ${testUserId}`);
        } else {
          logger.warn(`⚠️ Failed to delete test user: ${response.status}`);
        }
      } catch (error) {
        logger.warn(`⚠️ Error deleting test user: ${error}`);
      }
    }

    // Clean up any test records stored in environment
    const testRecordIds = process.env.TEST_RECORD_IDS?.split(',') || [];
    for (const recordId of testRecordIds) {
      // Delete each test record
      logger.info(`Cleaning up test record: ${recordId}`);
    }
    */
  }

  // ============================================================================
  // Resource & Session Cleanup
  // ============================================================================

  /**
   * Cleans up browser instances, API connections, temporary files and logs
   * memory footprint. Parallel-execution safe.
   *
   * Override this method to customise cleanup behaviour (e.g. pass in
   * additional temp directories or skip certain steps).
   */
  protected async cleanupResources(): Promise<void> {
    try {
      logger.info('[Teardown] Starting resource & session cleanup…');
      const cleanupManager = new ResourceCleanupManager();
      const result = await cleanupManager.cleanupAll();

      if (result.warnings.length > 0) {
        for (const w of result.warnings) {
          logger.warn(`[Teardown] ⚠️ Cleanup warning: ${w}`);
        }
      }

      logger.info(
        `[Teardown] ✓ Resource cleanup completed in ${result.durationMs}ms — ` +
          `pages: ${result.pagesClosed}, contexts: ${result.browserContextsClosed}, ` +
          `temp removed: ${result.tempItemsRemoved}, API conns: ${result.apiConnectionsTerminated}`,
      );
    } catch (error) {
      logger.warn(`[Teardown] ⚠️ Resource cleanup failed (non-fatal): ${error}`);
    }
  }

  // ============================================================================
  // Authentication State Cleanup
  // ============================================================================

  /**
   * Cleans up authentication state files.
   * Override this method to customize cleanup behavior.
   */
  // protected async cleanupAuthenticationState(): Promise<void> {
  //   const authStatePath = path.resolve(process.cwd(), 'auth.json');

  //   // Option 1: Always delete auth state (for security)
  //   // Option 2: Keep auth state for faster subsequent runs

  //   if (fs.existsSync(authStatePath)) {
  //     // Uncomment to delete auth state after tests:
  //     // fs.unlinkSync(authStatePath);
  //     // logger.info('✓ Authentication state file deleted');

  //     logger.info('Authentication state file preserved for next run');
  //   } else {
  //     logger.info('No authentication state file to clean up');
  //   }
  // }

  // ============================================================================
  // AI Features Shutdown
  // ============================================================================

  /**
   * Shuts down AI features and logs healed locators.
   */
  protected async shutdownAIFeatures(): Promise<void> {
    if (process.env.ENABLE_AI_FEATURES !== 'true') {
      return;
    }

    try {
      const service = await getAIService();
      if (service && service.isEnabled()) {
        // Log any healed locators for review
        const healedLocators = service.getHealedLocators();
        if (healedLocators.size > 0) {
          logger.info(`[AI] Healed locators during test run:`);
          healedLocators.forEach((value, key) => {
            logger.info(`  - ${key}: ${value.originalLocator} → ${value.healedRef}`);
          });
          logger.info(`[AI] Consider updating object map with healed locators`);
        }

        await service.shutdown();
        logger.info('✓ AI features shut down');
      }
    } catch (error) {
      logger.warn(`⚠️ AI features shutdown failed: ${error}`);
    }
  }

  // ============================================================================
  // Upload Test Artifacts
  // ============================================================================

  /**
   * Uploads test artifacts to external storage.
   * Override this method to implement your upload logic.
   *
   * Common use cases:
   * - Upload Playwright HTML report to S3/GCS
   * - Upload Allure results
   * - Archive screenshots and videos
   */
  protected async uploadTestArtifacts(): Promise<void> {
    // TODO: Implement your artifact upload logic here
    // This is a placeholder - override in custom teardown
    logger.info('Test artifacts upload skipped (not implemented in base class)');

    /*
    // Example implementation:
    const reportPath = path.resolve(process.cwd(), 'playwright-report');
    const testRunId = process.env.TEST_RUN_ID || Date.now().toString();

    if (fs.existsSync(reportPath)) {
      try {
        // Upload to S3
        const s3Bucket = process.env.S3_REPORTS_BUCKET;
        const s3Key = `playwright-reports/${testRunId}/`;

        // Using AWS SDK (pseudo-code)
        // await s3.uploadDirectory(reportPath, s3Bucket, s3Key);

        logger.info(`✓ Test report uploaded to: s3://${s3Bucket}/${s3Key}`);

        // Store report URL in environment for notification
        process.env.REPORT_URL = `https://${s3Bucket}.s3.amazonaws.com/${s3Key}index.html`;
      } catch (error) {
        logger.warn(`⚠️ Failed to upload test report: ${error}`);
      }
    }

    // Upload Allure results if they exist
    const allureResultsPath = path.resolve(__dirname, '../../allure-results');
    if (fs.existsSync(allureResultsPath)) {
      logger.info('Uploading Allure results...');
      // Implement Allure upload logic
    }
    */
  }

  // ============================================================================
  // Test Summary & Reporting
  // ============================================================================

  protected async generateTestSummary(): Promise<void> {
    const testStartTime = process.env.TEST_START_TIME;
    if (testStartTime) {
      const duration = Date.now() - new Date(testStartTime).getTime();
      const minutes = (duration / 1000 / 60).toFixed(2);
      logger.info(`Total test run duration: ${minutes} minutes`);
    }
  }

  protected async sendNotification(): Promise<void> {
    const webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.info('[Notification] GOOGLE_CHAT_WEBHOOK_URL not configured, skipping notification');
      return;
    }

    try {
      logger.info(
        `[Notification] Preparing notification with ${this.testResults.length} results, ${this.aiAnalysisResults.size} AI analyses`
      );

      const message = this.buildNotificationMessage();
      logger.debug(`[Notification] Message: ${JSON.stringify(message)}`);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (response.ok) {
        logger.info('[Notification] Google Chat notification sent successfully');
      } else {
        logger.warn(`[Notification] Failed to send: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      logger.warn(`[Notification] Failed to send notification: ${error}`);
    }
  }

  /** Override to customize notification message */
  protected buildNotificationMessage(): object {
    const testStartTime = process.env.TEST_START_TIME;
    const duration = testStartTime ? ((Date.now() - new Date(testStartTime).getTime()) / 1000 / 60).toFixed(2) : '0';

    // Check if AI features are enabled
    const isAIEnabled = process.env.ENABLE_AI_FEATURES === 'true';
    const aiPoweredBadge = isAIEnabled ? ' 🧠 _AI-Powered_' : '';

    // Build test results summary
    const totalTests = this.testResults.length;
    const passed = this.testResults.filter((r) => r.status === 'passed').length;
    const failed = this.testResults.filter((r) => r.status === 'failed').length;
    const skipped = this.testResults.filter((r) => r.status === 'skipped').length;

    // Build AI analysis summary if available
    let aiAnalysisSummary = '';
    if (this.aiAnalysisResults.size > 0) {
      const analyses = Array.from(this.aiAnalysisResults.values());
      const categorySummary = new Map<string, number>();
      const categoryRecommendations = new Map<string, string>();
      const categoryAffectedElements = new Map<string, string[]>();

      for (const analysis of analyses) {
        const category = analysis.category || 'unknown';
        categorySummary.set(category, (categorySummary.get(category) || 0) + 1);

        // Store first recommendation for each category (if not already stored)
        if (!categoryRecommendations.has(category) && analysis.suggestions && analysis.suggestions.length > 0) {
          categoryRecommendations.set(category, analysis.suggestions[0]);
        }

        // Collect affected elements for each category (aggregate from all failures)
        if (analysis.affectedElements && analysis.affectedElements.length > 0) {
          const elements = categoryAffectedElements.get(category) || [];
          for (const elem of analysis.affectedElements) {
            if (!elements.includes(elem)) {
              elements.push(elem);
            }
          }
          categoryAffectedElements.set(category, elements);
        }
      }

      aiAnalysisSummary =
        `\n\n🤖 *AI-Powered Failure Analysis*\n` +
        Array.from(categorySummary.entries())
          .map(([category, count]) => {
            const elements = categoryAffectedElements.get(category);
            const elementInfo =
              elements && elements.length > 0 ? ` → ${elements.map((e) => `\`${e}\``).join(', ')}` : '';
            return `   • ${category}: ${count} failure(s)${elementInfo}`;
          })
          .join('\n');

      // Add one recommendation per category (unique and diverse)
      const uniqueRecommendations = Array.from(categoryRecommendations.values());
      if (uniqueRecommendations.length > 0) {
        aiAnalysisSummary +=
          `\n\n💡 *AI Recommendations:*\n` + uniqueRecommendations.map((s) => `   • ${s}`).join('\n');
      }
    }

    // Build status emoji
    const statusEmoji = failed > 0 ? '❌' : '✅';

    return {
      text:
        `🎭 *Playwright Test Run Completed*${aiPoweredBadge}\n\n` +
        `${statusEmoji} *Results Summary*\n` +
        `   • Total: ${totalTests}\n` +
        `   • Passed: ${passed} ✅\n` +
        `   • Failed: ${failed} ❌\n` +
        `   • Skipped: ${skipped} ⏭️\n\n` +
        `📅 Date: ${new Date().toISOString()}\n` +
        `⏱️ Duration: ${duration} minutes` +
        aiAnalysisSummary,
    };
  }

  async run(): Promise<void> {
    const startTime = Date.now();
    logger.info('=== GLOBAL TEARDOWN STARTED ===');
    try {
      await this.onTeardown();
      logger.info(`=== GLOBAL TEARDOWN COMPLETED in ${Date.now() - startTime}ms ===`);
    } catch (error) {
      logger.error(`Global teardown failed: ${error}`);
    }
  }
}
