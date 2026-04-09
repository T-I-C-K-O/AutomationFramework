/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * StepExecutor.ts - Core Test Step Execution Engine
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This module is the heart of the test automation framework. It orchestrates
 * the execution of individual test steps by coordinating parsing, variable
 * resolution, action dispatch, and retry/recovery logic.
 *
 * @module coreLibraries/steps/StepExecutor
 */

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────────────────────

// Playwright imports for browser automation
import { Page } from '@playwright/test';

// Core step processing components
import { StepParser, TestStep } from './StepParser'; // Parses raw steps into structured format
import { LocatorResolver } from './LocatorResolver'; // Resolves element descriptions to Playwright locators
import { ActionDispatcher } from './ActionDispatcher'; // Routes actions to appropriate handlers

// Page object registry for dynamic page class instantiation
import { pageClassMap } from '../pages/pageclassMap';

// Utilities
import { logger } from '../helpers/logger'; // Centralized logging
import { getValue } from '../data/storeManager'; // Access stored runtime values
import { getPageContext } from '../helpers/StepErrorFormatter'; // Error context collection

// Retry and recovery components for handling flaky tests
import { RetryHandler, RetryConfig } from '../recovery/RetryHandler'; // Core retry logic
import { RecoveryActions, createRecoveryChain } from '../recovery/RecoveryActions'; // Recovery strategies

// Global retry configuration
import { isRetryEnabled } from '../config/timeouts.config';

// Security - Origin validation for navigation
import { validateNavigationOrigin } from '../security/OriginValidator';

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * StepExecutor
 *
 * Core orchestrator that executes test steps from Excel/Xray test cases.
 * Coordinates parsing, variable resolution, and action dispatch for each step.
 *
 * Execution Flow:
 * ```
 * Raw Step (JSON/String)
 *     ↓
 * StepParser.parse()           → Validate & normalize step structure
 *     ↓
 * StepParser.replaceParameters() → Substitute ${variables} with iteration data
 *     ↓
 * ActionDispatcher.dispatch()  → Route to appropriate handler
 *     ↓
 * Handler.execute()            → Perform the actual action
 *     ↓
 * [On Failure with Retry Enabled]
 *     ↓
 * RetryHandler.executeWithRetry() → Capture screenshot, recover, retry
 * ```
 *
 * Key Components:
 * | Component        | Purpose                                           |
 * |------------------|---------------------------------------------------|
 * | StepParser       | Parse raw steps, replace variables                |
 * | LocatorResolver  | Resolve element locators from objectMap           |
 * | ActionDispatcher | Route actions to appropriate handlers             |
 * | RetryHandler     | Handle retries with exponential backoff           |
 * | RecoveryActions  | Execute recovery strategies between retries       |
 * | Page Context     | Maintain current Playwright page reference        |
 *
 * Features:
 * - Variable resolution: `${paramName}` from Excel iteration data
 * - Stored value access: `[variableName]` from storeManager
 * - JSON action parsing: Handles `{"action": "goto", "value": "url"}`
 * - Page function calls: `PageClass.methodName('arg1', 'arg2')`
 * - Multi-page support: `updatePage()` for new tab/popup scenarios
 * - Retry with recovery: Automatic retry with screenshot capture
 *
 * Usage:
 * ```typescript
 * const executor = new StepExecutor(page, {
 *   enableRetry: true,
 *   testCaseKey: 'TC-001',
 *   iteration: 1
 * });
 *
 * // Execute a single step with retry
 * await executor.executeStep(
 *   { action: "Click 'Submit'", data: "", result: "" },
 *   { "Email Address": "test@example.com" }
 * );
 *
 * // Update page context (e.g., after popup)
 * executor.updatePage(newPage);
 * ```
 *
 * Data Resolution:
 * | Format              | Example                | Resolution                    |
 * |---------------------|------------------------|-------------------------------|
 * | Parameter variable  | `${username}`          | From iteration parameters     |
 * | Stored variable     | `[orderId]`            | From storeManager             |
 * | Direct value        | `john.doe`             | Used as-is                    |
 *
 * @see StepParser for step parsing logic
 * @see ActionDispatcher for action routing
 * @see LocatorResolver for element resolution
 * @see RetryHandler for retry logic
 * @see RecoveryActions for recovery strategies
 * @since 1.0.0
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for step execution with retry capabilities.
 *
 * This interface defines the options available when creating a StepExecutor
 * or when updating its configuration at runtime.
 *
 * @example
 * ```typescript
 * // Create executor with custom config
 * const config: StepExecutionConfig = {
 *   enableRetry: true,
 *   testCaseKey: 'TC-001',
 *   iteration: 1,
 *   retryConfig: {
 *     maxRetries: 3,
 *     retryDelay: 2000
 *   }
 * };
 * const executor = new StepExecutor(page, config);
 * ```
 */
export interface StepExecutionConfig {
  /**
   * Enable step-level retry mechanism.
   *
   * When enabled (default: true), failed steps will be retried with:
   * - Screenshot capture before each retry
   * - Recovery actions (dismiss dialogs, wait for stability)
   * - Exponential backoff between attempts
   *
   * @default true
   */
  enableRetry?: boolean;

  /**
   * Test case key used for naming screenshots and evidence.
   *
   * This should match the test case identifier from your test management
   * system (e.g., Xray, TestRail) for easy correlation.
   *
   * @example "TC-001", "PROJ-123", "LoginTest"
   * @default "unknown"
   */
  testCaseKey?: string;

  /**
   * Current iteration number for data-driven tests.
   *
   * Used in screenshot naming to distinguish between iterations
   * when running the same test with different data sets.
   *
   * @default 1
   */
  iteration?: number;

  /**
   * Custom retry configuration to override defaults.
   *
   * See RetryConfig for available options:
   * - maxRetries: Maximum retry attempts
   * - retryDelay: Initial delay between retries (ms)
   * - retryMaxDelay: Maximum delay cap (ms)
   * - captureScreenshot: Whether to capture screenshots
   *
   * @see RetryConfig
   */
  retryConfig?: Partial<RetryConfig>;
}

/**
 * StepExecutor - Core class responsible for executing individual test steps.
 *
 * This class orchestrates the execution of test steps by:
 * - Parsing raw step definitions (JSON or string format)
 * - Resolving variable placeholders (e.g., ${Email Address})
 * - Dispatching actions to appropriate handlers
 * - Providing retry logic with recovery mechanisms for flaky steps
 *
 * @example
 * ```typescript
 * const executor = new StepExecutor(page, { enableRetry: true, testCaseKey: 'TC-001' });
 * await executor.executeStep({ action: "Click on 'Submit' button", data: "", result: "" }, iterationData);
 * ```
 */
export class StepExecutor {
  /** The Playwright Page instance used for browser interactions */
  private page: Page;

  /** Parser for converting raw step definitions into structured TestStep objects */
  private parser: StepParser;

  /** Resolver for converting element descriptions into Playwright Locators */
  private locatorResolver: LocatorResolver;

  /** Dispatcher that routes actions to their appropriate handlers */
  private dispatcher: ActionDispatcher;

  /** Handler for retry logic with exponential backoff and screenshot capture */
  private retryHandler: RetryHandler;

  /** Collection of recovery actions to execute between retry attempts */
  private recoveryActions: RecoveryActions;

  /** Configuration for step execution including retry settings */
  private executionConfig: StepExecutionConfig;

  /**
   * Create a new StepExecutor instance.
   *
   * @param page - The Playwright Page instance to operate on
   * @param config - Optional configuration for retry behavior and test context
   *
   * @remarks
   * - Retry is ENABLED by default (enableRetry defaults to true)
   * - Can be disabled globally via RETRY_ENABLED=false environment variable
   * - Default retry attempts: 2 (configured in timeouts.config.ts)
   * - Default retry delay: 1000ms with exponential backoff
   */
  constructor(page: Page, config: StepExecutionConfig = {}) {
    this.page = page;
    this.parser = new StepParser();
    this.locatorResolver = new LocatorResolver(page);

    // Merge provided config with defaults
    // Priority: explicit config > environment variable > default (true)
    // Set RETRY_ENABLED=false in environment to disable globally
    this.executionConfig = {
      enableRetry: config.enableRetry ?? isRetryEnabled(), // Check env var if not explicitly set
      testCaseKey: config.testCaseKey ?? 'unknown', // Used for screenshot naming
      iteration: config.iteration ?? 1, // Used for screenshot naming
      retryConfig: config.retryConfig, // Custom retry overrides
    };

    // Initialize the action dispatcher which routes actions to handlers
    // (e.g., "Click on 'Submit'" → ClickHandler, "Enter 'text'" → EnterHandler)
    this.dispatcher = new ActionDispatcher(page, this.locatorResolver);

    // Initialize retry handler with smart recovery capabilities
    // This handles: retry attempts, exponential backoff, screenshot capture
    this.retryHandler = new RetryHandler(page, {
      testCaseKey: this.executionConfig.testCaseKey,
      iteration: this.executionConfig.iteration,
      ...this.executionConfig.retryConfig,
    });

    // Initialize recovery actions for use between retry attempts
    // Available actions: dismissDialogs, waitForStability, clearOverlays, etc.
    this.recoveryActions = new RecoveryActions(page);
  }

  /**
   * Update the page instance for all internal components.
   *
   * Call this method when the test needs to continue on a NEW page
   * (e.g., after a popup opens or after navigating to a new window).
   *
   * @param Newpage - The new Playwright Page instance to use
   *
   * @remarks
   * This updates ALL internal components that depend on the Page:
   * - LocatorResolver (for element resolution)
   * - ActionDispatcher (for action execution)
   * - RetryHandler (for retry screenshots)
   * - RecoveryActions (for recovery operations)
   *
   * @example
   * ```typescript
   * // After handling a popup
   * const [popup] = await Promise.all([
   *   page.waitForEvent('popup'),
   *   page.click('a[target="_blank"]')
   * ]);
   * executor.updatePage(popup);
   * ```
   */
  public updatePage(Newpage: Page) {
    logger.info(`[StepExecutor] StepExecutor.updatePage() called . New page URL :${Newpage.url()}`);
    this.page = Newpage;
    this.locatorResolver = new LocatorResolver(Newpage);
    this.dispatcher = new ActionDispatcher(Newpage, this.locatorResolver);
    this.retryHandler.updatePage(Newpage);
    this.recoveryActions.updatePage(Newpage);
  }

  /**
   * Update execution configuration at runtime.
   *
   * Use this to change retry behavior or update test context mid-execution.
   *
   * @param config - Partial configuration to merge with existing settings
   *
   * @example
   * ```typescript
   * // Disable retry for a specific section
   * executor.updateConfig({ enableRetry: false });
   *
   * // Increase max retries for flaky steps
   * executor.updateConfig({ retryConfig: { maxRetries: 5 } });
   * ```
   */
  public updateConfig(config: Partial<StepExecutionConfig>): void {
    // Merge the new config with existing config
    this.executionConfig = { ...this.executionConfig, ...config };

    // If retry-related config changed, update the RetryHandler
    if (config.retryConfig || config.testCaseKey || config.iteration) {
      this.retryHandler.updateConfig({
        testCaseKey: this.executionConfig.testCaseKey,
        iteration: this.executionConfig.iteration,
        ...this.executionConfig.retryConfig,
      });
    }
  }

  /**
   * Get the RetryHandler instance for custom retry operations.
   *
   * Use this when you need direct access to retry functionality,
   * such as wrapping custom code blocks with retry logic.
   *
   * @returns The RetryHandler instance
   *
   * @example
   * ```typescript
   * const retryHandler = executor.getRetryHandler();
   * await retryHandler.executeWithRetry(async () => {
   *   // Your custom flaky operation
   *   await customApiCall();
   * }, 'Custom API Call');
   * ```
   */
  public getRetryHandler(): RetryHandler {
    return this.retryHandler;
  }

  /**
   * Get the RecoveryActions instance for custom recovery operations.
   *
   * Use this when you need to manually trigger recovery actions
   * outside of the normal retry flow.
   *
   * @returns The RecoveryActions instance
   *
   * @example
   * ```typescript
   * const recovery = executor.getRecoveryActions();
   * await recovery.dismissDialogs(); // Dismiss any open dialogs
   * await recovery.waitForStability(); // Wait for page to stabilize
   * ```
   */
  public getRecoveryActions(): RecoveryActions {
    return this.recoveryActions;
  }

  /**
   * Get the current Playwright Page instance.
   *
   * @returns The current Page instance
   */
  public getPage(): Page {
    return this.page;
  }

  // ===========================================================================
  // MAIN EXECUTION METHOD - Entry point for all step execution
  // ===========================================================================

  /**
   * Execute a test step with optional retry logic.
   *
   * This is the PRIMARY method for executing test steps. It handles:
   * 1. Parsing the raw step definition into a structured format
   * 2. Replacing variable placeholders (e.g., ${Email Address})
   * 3. Dispatching to the appropriate action handler
   * 4. Retry logic with recovery actions on failure (when enabled)
   *
   * ## Retry Behavior (when enabled):
   * 1. Attempt to execute the step
   * 2. On failure, capture a screenshot for debugging
   * 3. Execute recovery actions (dismiss dialogs, wait for stability)
   * 4. Retry the step up to maxRetries times with exponential backoff
   * 5. If all retries fail, throw the last error
   *
   * @param rawStep - The test step to execute (JSON object or string)
   * @param iterationData - Iteration data for variable substitution (e.g., { "Email Address": "test@example.com" })
   * @param stepRetryConfig - Optional override for retry configuration for this specific step
   *
   * @throws Error if the step fails after all retry attempts (or immediately if retry is disabled)
   *
   * @example
   * ```typescript
   * // Basic usage
   * await executor.executeStep(
   *   { action: "Click on 'Submit' button", data: "", result: "" },
   *   { "Email Address": "user@test.com" }
   * );
   *
   * // With custom retry config for a flaky step
   * await executor.executeStep(
   *   { action: "Wait for 'Loading...' text to disappear", data: "", result: "" },
   *   {},
   *   { maxRetries: 5, retryDelay: 2000 } // More retries, longer delay
   * );
   * ```
   */
  public async executeStep(
    rawStep: TestStep | string,
    iterationData: any,
    stepRetryConfig?: Partial<RetryConfig>
  ): Promise<void> {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Parse the raw step definition
    // Converts string or JSON into a structured TestStep object
    // ─────────────────────────────────────────────────────────────────────────
    let step = this.parser.parse(rawStep);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Replace variable placeholders
    // Substitutes ${variableName} with actual values from iterationData
    // Example: "Enter ${Email Address}" → "Enter test@example.com"
    // ─────────────────────────────────────────────────────────────────────────
    step = this.parser.replaceParameters(step, iterationData);

    const { action, data, result } = step;
    const actionName = this.getActionName(action);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Execute with or without retry based on configuration
    // ─────────────────────────────────────────────────────────────────────────
    // Skip retry for actions starting with Execute/Trigger/Hit/Fire
    const skipRetryForAction = /^(Execute|Trigger|Hit|Fire)\b/i.test(action.trim());

    // Check if retry is enabled (defaults to TRUE)
    if (!this.executionConfig.enableRetry || skipRetryForAction) {
      // ─────────────────────────────────────────────────────────────────────────
      // DIRECT EXECUTION (No Retry)
      // When retry is disabled, execute once and throw immediately on failure
      // ─────────────────────────────────────────────────────────────────────────
      await this.executeStepCore(action, data, result, step);
      return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXECUTION WITH RETRY
    // Uses RetryHandler to wrap execution with retry logic
    // On failure: captures screenshot → runs recovery → retries with backoff
    // ─────────────────────────────────────────────────────────────────────────
    const retryResult = await this.retryHandler.executeWithRetry(
      async () => {
        // The actual step execution wrapped in retry logic
        await this.executeStepCore(action, data, result, step);
      },
      actionName, // Used for logging and screenshot naming
      {
        ...stepRetryConfig, // Allow per-step retry overrides

        // Recovery action to run between retry attempts
        // Uses the basic recovery chain: dismissDialogs + waitForStability
        recoveryAction: async () => {
          const recoveryChain = createRecoveryChain(this.page);
          await recoveryChain.basic(); // Dismiss dialogs, wait for stability
        },
      }
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Handle retry result
    // If all retries exhausted, throw the last captured error
    // ─────────────────────────────────────────────────────────────────────────
    if (!retryResult.success && retryResult.error) {
      logger.error(`[StepExecutor] Step "${actionName}" failed after ${retryResult.attempts} attempt(s)`);
      throw retryResult.error;
    }
  }

  /**
   * Execute step WITHOUT retry logic.
   *
   * Use this method when you explicitly want to bypass retry,
   * such as for setup steps or when testing error handling.
   *
   * @param rawStep - The test step to execute
   * @param iterationData - Iteration data for variable substitution
   *
   * @remarks
   * This method is also used internally by executeStep when retry is disabled.
   * It provides backward compatibility for code that expects no retry behavior.
   */
  public async executeStepWithoutRetry(rawStep: TestStep | string, iterationData: any): Promise<void> {
    let step = this.parser.parse(rawStep);
    step = this.parser.replaceParameters(step, iterationData);
    const { action, data, result } = step;
    await this.executeStepCore(action, data, result, step);
  }

  /**
   * Core step execution logic - dispatches actions to handlers.
   *
   * This is the internal method that actually executes the step.
   * It's separated from executeStep to allow the retry wrapper
   * to retry just this logic without re-parsing.
   *
   * @param action - The action string (e.g., "Click on 'Submit' button")
   * @param data - Optional data for the action
   * @param result - Optional expected result
   * @param step - The full parsed TestStep object
   *
   * @throws Error if no handler is found or if the handler fails
   */
  protected async executeStepCore(
    action: string,
    data: string | Record<string, any> | undefined,
    result: string | undefined,
    step: TestStep
  ): Promise<void> {
    try {
      // ─────────────────────────────────────────────────────────────────────────
      // Dispatch the action to the appropriate handler
      // The dispatcher routes actions like:
      //   "Click on 'Submit'" → ClickHandler
      //   "Enter 'text' into 'field'" → EnterHandler
      //   "Verify 'element' is visible" → VerifyHandler
      // ─────────────────────────────────────────────────────────────────────────
      const handled = await this.dispatcher.dispatch(action, data, result, step);

      if (!handled) {
        // ─────────────────────────────────────────────────────────────────────────
        // Fallback: Try to parse as JSON-style action
        // Supports legacy format like: { "action": "goto", "value": "https://..." }
        // ─────────────────────────────────────────────────────────────────────────
        const parsedData = typeof data === 'string' && data.trim().startsWith('{') ? this.parser.parseData(data) : data;

        if (typeof parsedData === 'object' && (await this.handleJsonActions(parsedData))) {
          return;
        }

        // No handler found - log warning but don't fail
        // This allows for extensibility and custom handlers
        logger.warn(`[StepExecutor]  No handler found for action: ${action}`);
      }
    } catch (error: any) {
      // Enrich the error with step-level context for real-time debugging
      const pageCtx = await getPageContext(this.page);
      const stepInfo = [
        `\n── Step Context ──`,
        `  Action:  ${action}`,
        data ? `  Data:    ${typeof data === 'object' ? JSON.stringify(data) : data}` : null,
        result ? `  Expected: ${result}` : null,
        `  Page:    ${pageCtx.url}`,
        pageCtx.title ? `  Title:   ${pageCtx.title}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      // If the error is already enriched (from formatStepError), just log context and re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        logger.error(`[StepExecutor] ${stepInfo}`);
        throw error;
      }

      // Otherwise, wrap with step context
      const enrichedMessage = `Step failed: ${error.message}\n${stepInfo}`;
      logger.error(`[StepExecutor] ${enrichedMessage}`);
      const enrichedError = new Error(enrichedMessage);
      enrichedError.stack = error.stack;
      throw enrichedError;
    }
  }

  /**
   * Extract a human-readable action name for logging and screenshots.
   *
   * Truncates long action strings to prevent overly long log messages
   * and file names.
   *
   * @param action - The full action string
   * @returns Truncated action name (max 60 characters)
   */
  private getActionName(action: string): string {
    const maxLength = 60;
    if (action.length > maxLength) {
      return action.substring(0, maxLength) + '...';
    }
    return action;
  }

  // ===========================================================================
  // JSON / FUNCTION ACTIONS - Legacy support for JSON-style step definitions
  // ===========================================================================

  /**
   * Handle JSON-style action definitions.
   *
   * Supports legacy formats like:
   * - { "action": "goto", "value": "https://example.com" }
   * - { "function": "LoginPage.login", "functionValue": ["user", "pass"] }
   *
   * @param parsed - The parsed JSON object
   * @returns true if the action was handled, false otherwise
   */
  private async handleJsonActions(parsed: any): Promise<boolean> {
    // Handle navigation action
    if (parsed.action === 'goto') {
      const url = this.cleanUrl(parsed.value);
      // 🔒 Security: Validate origin before navigation
      validateNavigationOrigin(url);
      await this.page.goto(url);
      return true;
    }

    // Handle page function calls (e.g., LoginPage.login('user', 'pass'))
    if (parsed.function) {
      await this.handlePageFunctionCall(this.buildFunctionCallString(parsed.function, parsed.functionValue));
      return true;
    }

    return false;
  }

  /**
   * Clean URL by extracting from Jira/Confluence link format.
   *
   * Handles URLs in format: [Link Text|https://actual-url.com]
   *
   * @param url - The URL string (may contain link formatting)
   * @returns The clean URL
   */
  private cleanUrl(url: string): string {
    const match = /\[.*?\|(https?:\/\/[^\]]+)\]/.exec(url);
    return match?.[1] || url;
  }

  /**
   * Handle page function calls defined in the pageClassMap.
   *
   * Allows calling methods on page objects dynamically:
   * - "LoginPage.login('username', 'password')"
   * - "DashboardPage.selectOption('value')"
   *
   * @param action - The function call string
   * @throws Error if page class or method not found
   */
  private async handlePageFunctionCall(action: string) {
    try {
      // Parse the function call string
      // Example: "LoginPage.login('user', 'pass')" → ["LoginPage.login", "'user', 'pass'"]
      const [methodCall, argsString] = action.split('(');
      const [pageKey, methodName] = methodCall.split('.');

      // Parse arguments, removing quotes and whitespace
      const args = argsString
        .replace(/(\)$)/g, '') // Remove closing parenthesis
        .split(',')
        .map((arg) => arg.trim().replace(/(^['"]|['"]$)/g, '')); // Remove quotes

      // Look up the page class from the registry
      const PageClass = pageClassMap[pageKey];
      if (!PageClass) throw new Error(`Unknown page class: ${pageKey}`);

      // Create instance and invoke method
      const instance = new PageClass(this.page);
      if (typeof instance[methodName] !== 'function') {
        throw new Error(`Method '${methodName}' not found on '${pageKey}'`);
      }

      await instance[methodName](...args);
    } catch (error: any) {
      logger.error(`[StepExecutor] Error in handlePageFunctionCall: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build a function call string from function name and arguments.
   *
   * @param fn - The function name (e.g., "LoginPage.login")
   * @param args - Array of argument values
   * @returns Formatted function call string (e.g., "LoginPage.login('arg1','arg2')")
   */
  private buildFunctionCallString(fn: string, args: string[] = []): string {
    const argsString = args.map((a) => `'${a}'`).join(',');
    return `${fn}(${argsString})`;
  }

  /**
   * Resolve stored values using bracket notation.
   *
   * Variables stored during test execution can be referenced using [variableName].
   * This method looks up the stored value and returns it.
   *
   * @param input - The input string (may be [variableName] or plain value)
   * @returns The resolved value
   * @throws Error if variable not found in storage
   *
   * @example
   * ```typescript
   * // Store a value during test
   * storeValue('orderId', '12345');
   *
   * // Later, resolve it
   * const id = await executor.resolveData('[orderId]'); // Returns '12345'
   * ```
   */
  public async resolveData(input: string): Promise<string> {
    // Check if input matches bracket notation: [variableName]
    const bracketMatch = /^\[(.+?)\]$/.exec(input.trim());

    if (bracketMatch) {
      const varName = bracketMatch[1];
      const value = getValue(varName);

      if (value === undefined) {
        throw new Error(
          `No stored value found for variable '${varName}'. Make sure the value was stored in a previous test case.`
        );
      }

      logger.info(`[StepExecutor] Resolved variable [${varName}] to value: ${value}`);
      return String(value);
    }

    // Not a variable reference, return as-is
    return input;
  }
}
