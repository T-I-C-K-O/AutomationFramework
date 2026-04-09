import { FullConfig } from '@playwright/test';
import { logger } from '../../helpers/logger';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();

// ============================================================================
// AI Feature Import (Lazy loaded)
// ============================================================================
let aiService: { initialize: () => Promise<void>; isEnabled: () => boolean } | null = null;

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

/**
 * Base Global Setup class – meant to be extended by consumer projects.
 */
export class BaseGlobalSetup {
  protected config: FullConfig;
  /**
   * When true, the validator will throw on validation errors. Defaults to
   * environment variable FAIL_ON_VALIDATION_ERROR (true unless explicitly 'false').
   *
   * TEST_CASE_SOURCE is automatically set based on command line arguments and file paths:
   * - 'excel' if 'excel' found in paths like /excel/, excel.spec.ts, or excel*test
   * - 'x-ray' if 'xray'/'x-ray' found in paths like /xray/, xray.spec.ts, or xray*test
   * - unset otherwise (validates all sources)
   * Works for both CLI runs and Test Explorer/VS Code test runner.
   */
  protected failOnValidationError: boolean;

  constructor(config: FullConfig) {
    this.config = config;
    this.failOnValidationError = process.env.FAIL_ON_VALIDATION_ERROR !== 'false';

    // Auto-detect test case source from command line arguments
    this.detectTestCaseSource();
  }

  /**
   * Automatically detects the test case source from command line arguments.
   * Enhanced detection works for both CLI runs and Test Explorer/VS Code runs.
   * Checks for keywords in file paths, test names, and command arguments.
   */
  private detectTestCaseSource(): void {
    const argv = process.argv.join(' ').toLowerCase();

    // Debug: Log the command arguments
    console.log('[TestCaseSource] Command arguments:', argv);
    console.log('[TestCaseSource] Current working directory:', process.cwd());
    console.log('[TestCaseSource] Environment TEST_CASE_SOURCE:', process.env.TEST_CASE_SOURCE);

    // Check for explicit keywords in any part of the command
    if (argv.includes('excel')) {
      process.env.TEST_CASE_SOURCE = 'excel';
      console.log('[TestCaseSource] Detected EXCEL from command arguments');
      return;
    } else if (argv.includes('xray') || argv.includes('x-ray')) {
      process.env.TEST_CASE_SOURCE = 'x-ray';
      console.log('[TestCaseSource] Detected X-RAY from command arguments');
      return;
    }

    // Check for file paths containing keywords (works for Test Explorer selections)
    // Look for patterns like /excel/, \excel\, excel.spec.ts, etc.
    if (
      argv.includes('/excel/') ||
      argv.includes('\\excel\\') ||
      argv.includes('excel.spec.') ||
      argv.includes('excel')
    ) {
      process.env.TEST_CASE_SOURCE = 'excel';
      console.log('[TestCaseSource] Detected EXCEL from file path patterns');
      return;
    }

    if (
      argv.includes('/xray/') ||
      argv.includes('\\xray\\') ||
      argv.includes('/x-ray/') ||
      argv.includes('\\x-ray\\') ||
      argv.includes('xray.spec.') ||
      argv.includes('x-ray.spec.') ||
      argv.includes('xray') ||
      argv.includes('x-ray')
    ) {
      process.env.TEST_CASE_SOURCE = 'x-ray';
      console.log('[TestCaseSource] Detected X-RAY from file path patterns');
      return;
    }

    // Additional check: Look for VS Code specific patterns
    // VS Code might pass test file paths in different formats
    const vsCodePatterns = [
      'run-excel',
      'excel-test',
      'excel.spec',
      'run-xray',
      'xray-test',
      'xray.spec',
      'x-ray.spec',
    ];

    for (const pattern of vsCodePatterns) {
      if (argv.includes(pattern.toLowerCase())) {
        if (pattern.includes('excel')) {
          process.env.TEST_CASE_SOURCE = 'excel';
          console.log(`[TestCaseSource] Detected EXCEL from VS Code pattern: ${pattern}`);
          return;
        } else if (pattern.includes('xray') || pattern.includes('x-ray')) {
          process.env.TEST_CASE_SOURCE = 'x-ray';
          console.log(`[TestCaseSource] Detected X-RAY from VS Code pattern: ${pattern}`);
          return;
        }
      }
    }

    console.log('[TestCaseSource] No test case source detected, will validate all sources');
    // If no detection, leave TEST_CASE_SOURCE unset (validate all sources)
  }

  /** Main setup pipeline */
  async onSetup(): Promise<void> {
    await this.validateEnvironment();
    await this.performHealthCheck();
    await this.initializeAIFeatures();
    // await this.setupAuthentication();
    await this.fetchApiTokens();
    await this.jsonTestCaseValidator();
  }

  protected getRequiredEnvVars(): string[] {
    return ['LOGIN_URL', 'ENV'];
  }

  protected async validateEnvironment(): Promise<void> {
    const missing = this.getRequiredEnvVars().filter((v) => !process.env[v]);
    if (missing.length) {
      logger.info(`[GlobalSetup] Missing env vars: ${missing.join(', ')}`);
    }
  }

  protected async initializeAIFeatures(): Promise<void> {
    if (process.env.ENABLE_AI_FEATURES !== 'true') {
      logger.info('[GlobalSetup] AI features disabled');
      return;
    }

    try {
      const service = await getAIService();
      if (service) {
        await service.initialize();
        logger.info('[GlobalSetup] ✓ AI features initialized');
      }
    } catch (error) {
      logger.warn(`[GlobalSetup] AI init failed: ${error}`);
    }
  }

  protected async performHealthCheck(): Promise<void> {
    const baseUrl = process.env.LOGIN_URL || process.env.BASE_URL;
    if (!baseUrl) return;

    try {
      const response = await fetch(baseUrl, { method: 'HEAD' });
      response.ok
        ? logger.info('[GlobalSetup] ✓ Health check passed')
        : logger.warn(`[GlobalSetup] Health check failed: ${response.status}`);
    } catch (error) {
      logger.warn(`[GlobalSetup] Health check error: ${error}`);
    }
  }

  // protected async setupAuthentication(): Promise<void> {
  //   const authStatePath = path.resolve(process.cwd(), 'auth.json');

  //   if (fs.existsSync(authStatePath)) {
  //     const ageHours = (Date.now() - fs.statSync(authStatePath).mtimeMs) / 3_600_000;
  //     if (ageHours < 1) {
  //       logger.info('[GlobalSetup] ✓ Using cached auth state');
  //       return;
  //     }
  //   }

  //   logger.info('[GlobalSetup] Authentication skipped (base class)');
  // }

  protected async fetchApiTokens(): Promise<void> {
    if (process.env.AUTH_TOKEN) {
      logger.info('[GlobalSetup] ✓ AUTH_TOKEN already present');
      return;
    }
    logger.info('[GlobalSetup] Token fetch skipped (base class)');
  }

  /**
   * Auto-detects which test case folders contain JSON files and returns only those paths.
   * Checks testcases/excel/ and testcases/x-ray/ directories and validates only folders
   * that have actual test case files.
   */
  protected getTestCaseSourcePaths(): { paths: string[]; sources: string[] } {
    const baseTestCasesPath = path.resolve(process.cwd(), 'testcases');
    const possibleSources = [
      { name: 'excel', folder: 'excel' },
      { name: 'x-ray', folder: 'x-ray' },
    ];

    const activePaths: string[] = [];
    const activeSources: string[] = [];

    // Check for TEST_CASE_SOURCE environment variable to filter sources
    const testCaseSource = process.env.TEST_CASE_SOURCE?.toLowerCase();
    console.log('[TestCaseSource] TEST_CASE_SOURCE env var:', testCaseSource);
    console.log('[TestCaseSource] Base testcases path:', baseTestCasesPath);

    for (const source of possibleSources) {
      // If TEST_CASE_SOURCE is set, only include the matching source
      if (testCaseSource && source.name !== testCaseSource) {
        console.log(`[TestCaseSource] Skipping ${source.name} (filtered by TEST_CASE_SOURCE)`);
        continue;
      }

      const sourcePath = path.join(baseTestCasesPath, source.folder);
      console.log(`[TestCaseSource] Checking ${source.name} path: ${sourcePath}`);

      if (fs.existsSync(sourcePath) && this.hasJsonFiles(sourcePath)) {
        activePaths.push(sourcePath);
        activeSources.push(source.name);
        console.log(`[TestCaseSource] Added ${source.name} (${sourcePath})`);
      } else {
        console.log(`[TestCaseSource] Skipped ${source.name} (no JSON files or doesn't exist)`);
      }
    }

    console.log('[TestCaseSource] Final active sources:', activeSources);
    console.log('[TestCaseSource] Final active paths:', activePaths);

    return { paths: activePaths, sources: activeSources };
  }

  /**
   * Checks if a directory contains any JSON files (recursively).
   */
  private hasJsonFiles(dir: string): boolean {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (this.hasJsonFiles(fullPath)) return true;
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  }

  protected async jsonTestCaseValidator(): Promise<void> {
    const { paths: sourcePaths, sources } = this.getTestCaseSourcePaths();

    if (sourcePaths.length === 0) {
      logger.info('[GlobalSetup] No test case folders with JSON files found, skipping validation');
      return;
    }

    // Collect all JSON files from the detected source paths
    const jsonFiles: string[] = [];
    for (const testCasesPath of sourcePaths) {
      jsonFiles.push(...this.findJsonFiles(testCasesPath));
    }

    if (jsonFiles.length === 0) {
      logger.info('[GlobalSetup] No JSON test case files found');
      return;
    }

    const errors: string[] = [];

    for (const file of jsonFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const testCase = JSON.parse(content);

        const validationErrors = this.validateTestCaseFormat(testCase, file);
        errors.push(...validationErrors);
      } catch (error) {
        errors.push(`[${file}] Invalid JSON: ${error}`);
      }
    }

    if (errors.length > 0) {
      logger.warn(`[GlobalSetup] Test case validation errors:\n${errors.join('\n')}`);

      if (this.failOnValidationError) {
        throw new Error(
          `Test case validation failed with ${errors.length} error(s). Set FAIL_ON_VALIDATION_ERROR=false to continue despite errors.`
        );
      } else {
        logger.warn(
          `[GlobalSetup] Continuing despite ${errors.length} validation error(s) (validator configured to non-failing mode)`
        );
      }
    } else {
      logger.info(`[GlobalSetup] ✓ Validated ${jsonFiles.length} test case files (sources: ${sources.join(', ')})`);
    }
  }

  /**
   * Allow toggling the fail-on-validation behavior at runtime.
   * Call `setFailOnValidationError(false)` in a subclass to make the
   * validator non-fatal.
   */
  public setFailOnValidationError(value: boolean) {
    this.failOnValidationError = value;
  }

  private findJsonFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.findJsonFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  private validateTestCaseFormat(testCase: unknown, filePath: string): string[] {
    const errors: string[] = [];
    const relativePath = path.relative(process.cwd(), filePath);

    // Root must be an array
    if (!Array.isArray(testCase)) {
      errors.push(`[${relativePath}] Root must be an array of test cases`);
      return errors;
    }

    testCase.forEach((tc: unknown, tcIndex: number) => {
      if (typeof tc !== 'object' || tc === null) {
        errors.push(`[${relativePath}] Test case [${tcIndex}] must be an object`);
        return;
      }

      const testCaseObj = tc as Record<string, unknown>;

      // Required fields
      if (typeof testCaseObj.name !== 'string') {
        errors.push(`[${relativePath}] Test case [${tcIndex}] missing or invalid 'name'`);
      }

      if (typeof testCaseObj.jira !== 'object' || testCaseObj.jira === null) {
        errors.push(`[${relativePath}] Test case [${tcIndex}] missing or invalid 'jira' object`);
      } else {
        const jira = testCaseObj.jira as Record<string, unknown>;

        if (typeof jira.key !== 'string') {
          errors.push(`[${relativePath}] Test case [${tcIndex}] jira.key must be a string`);
        }

        if (typeof jira.summary !== 'string') {
          errors.push(`[${relativePath}] Test case [${tcIndex}] jira.summary must be a string`);
        }
      }

      // Steps validation
      if (!Array.isArray(testCaseObj.steps)) {
        errors.push(`[${relativePath}] Test case [${tcIndex}] 'steps' must be an array`);
      } else {
        testCaseObj.steps.forEach((step: unknown, stepIndex: number) => {
          if (typeof step !== 'object' || step === null) {
            errors.push(`[${relativePath}] Test case [${tcIndex}] steps[${stepIndex}] must be an object`);
            return;
          }

          const s = step as Record<string, unknown>;

          if (typeof s.action === 'string') {
            const action = s.action.trim().split(' ')[0].toLowerCase();
            if (
              !action.match(
                /^(click|type|enter|select|goto|login|navigate|switch|store|check|uncheck|hover|assert|verify|validate|scroll|trigger|execute|upload|download|double)/i
              )
            ) {
              errors.push(
                `[${relativePath}] Test case [${tcIndex}] steps[${stepIndex}] has unrecognized action '${s.action}'`
              );
            }
          } else if (typeof s.action !== 'string') {
            errors.push(`[${relativePath}] Test case [${tcIndex}] steps[${stepIndex}] missing or invalid 'action'`);
          }

          // if (typeof s.result !== 'string') {
          //   errors.push(
          //     `[${relativePath}] Test case [${tcIndex}] steps[${stepIndex}] missing or invalid 'result'`
          //   );
          // }
        });
      }
    });

    return errors;
  }

  async run(): Promise<void> {
    logger.info('[GlobalSetup] === START ===');
    const start = Date.now();
    await this.onSetup();
    logger.info(`[GlobalSetup] === DONE (${Date.now() - start}ms) ===`);
  }
}
