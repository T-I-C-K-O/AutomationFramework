/**
 * @fileoverview Step-Level Retry Handler for Playwright Test Automation Framework
 *
 * Provides robust retry logic for flaky element interactions with:
 * - Configurable retry attempts and delays
 * - Exponential backoff support
 * - Screenshot capture before each retry attempt
 * - Conditional recovery actions between retries
 * - Detailed logging for debugging
 *
 * ## Features
 *
 * | Feature                  | Description                                          |
 * |--------------------------|------------------------------------------------------|
 * | Step-level retry         | Retry individual steps without failing entire test   |
 * | Screenshot on failure    | Capture evidence before each retry attempt           |
 * | Exponential backoff      | Increasing delay between retries                     |
 * | Recovery actions         | Execute cleanup actions before retry                 |
 * | Error classification     | Identify retryable vs non-retryable errors          |
 *
 * ## Usage
 *
 * ```typescript
 * import { RetryHandler } from '../recovery/RetryHandler';
 *
 * const retryHandler = new RetryHandler(page, {
 *   maxRetries: 3,
 *   retryDelay: 1000,
 *   exponentialBackoff: true,
 *   screenshotOnRetry: true
 * });
 *
 * await retryHandler.executeWithRetry(
 *   async () => await element.click(),
 *   'Click Submit Button'
 * );
 * ```
 *
 * @since 1.0.0
 * @version 1.0.0
 */

import { Page } from '@playwright/test';
import { logger } from '../helpers/logger';
import { EvidenceCapture } from '../evidence/EvidenceCapture';
import { TIMEOUTS } from '../config/timeouts.config';

/**
 * Configuration options for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 2) */
  maxRetries?: number;

  /** Base delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;

  /** Whether to use exponential backoff for delays (default: true) */
  exponentialBackoff?: boolean;

  /** Backoff multiplier for exponential delay (default: 2) */
  backoffMultiplier?: number;

  /** Maximum delay cap in milliseconds (default: 10000) */
  maxDelay?: number;

  /** Whether to capture screenshot before each retry (default: true) */
  screenshotOnRetry?: boolean;

  /** Custom recovery action to execute before retry */
  recoveryAction?: () => Promise<void>;

  /** Test case key for screenshot naming */
  testCaseKey?: string;

  /** Current iteration number for screenshot naming */
  iteration?: number;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation ultimately succeeded */
  success: boolean;

  /** The result value if successful */
  result?: T;

  /** Total number of attempts made */
  attempts: number;

  /** Error if all attempts failed */
  error?: Error;

  /** Screenshots captured during retry attempts */
  screenshots: Array<{ base64Data: string; filename: string }>;

  /** Whether recovery actions were executed */
  recoveryExecuted: boolean;
}

/**
 * Error types that are considered retryable
 */
export const RETRYABLE_ERRORS = [
  'element is not attached',
  'element is detached',
  'element is not visible',
  'element is not stable',
  'element is outside of the viewport',
  'element was detached from the DOM',
  'waiting for selector',
  'timeout',
  'TimeoutError',
  'net::ERR_CONNECTION',
  'net::ERR_NETWORK',
  'net::ERR_TIMED_OUT',
  'net::ERR_EMPTY_RESPONSE',
  'navigation timeout',
  'page crashed',
  'frame was detached',
  'execution context was destroyed',
  'Protocol error',
  'Target closed',
  'element handle is not available',
  'strict mode violation',
  'locator resolved to',
];

/**
 * Error types that should NOT be retried
 */
export const NON_RETRYABLE_ERRORS = [
  'assertion failed',
  'expect(',
  'Expected',
  'toBe',
  'toEqual',
  'toContain',
  'toHaveText',
  'Authentication failed',
  'Invalid credentials',
  'Permission denied',
  '403 Forbidden',
  '401 Unauthorized',
  'Invalid JSON',
  'SyntaxError',
];

/**
 * RetryHandler - Provides step-level retry functionality with recovery support
 *
 * @example
 * ```typescript
 * const handler = new RetryHandler(page, {
 *   maxRetries: 3,
 *   screenshotOnRetry: true
 * });
 *
 * const result = await handler.executeWithRetry(
 *   async () => {
 *     await page.click('#submit');
 *     return 'clicked';
 *   },
 *   'Click Submit'
 * );
 *
 * if (!result.success) {
 *   console.log(`Failed after ${result.attempts} attempts`);
 * }
 * ```
 */
export class RetryHandler {
  private page: Page;
  private config: Required<RetryConfig>;

  constructor(page: Page, config: RetryConfig = {}) {
    this.page = page;
    // All retry values come from TIMEOUTS (timeouts.config.ts)
    // Can be overridden per-instance via config parameter
    this.config = {
      maxRetries: config.maxRetries ?? TIMEOUTS.retryMaxAttempts,
      retryDelay: config.retryDelay ?? TIMEOUTS.retryDelay,
      exponentialBackoff: config.exponentialBackoff ?? true,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      maxDelay: config.maxDelay ?? TIMEOUTS.retryMaxDelay,
      screenshotOnRetry: config.screenshotOnRetry ?? true,
      recoveryAction: config.recoveryAction ?? (async () => {}),
      testCaseKey: config.testCaseKey ?? 'unknown',
      iteration: config.iteration ?? 1,
    };
  }

  /**
   * Update page reference (e.g., after navigation or popup)
   */
  public updatePage(page: Page): void {
    this.page = page;
  }

  /**
   * Update configuration dynamically
   */
  public updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Execute an action with retry logic
   *
   * @param action - The async function to execute
   * @param actionName - Human-readable name for logging
   * @param overrideConfig - Optional config overrides for this specific action
   * @returns RetryResult with success status, attempts, and any captured screenshots
   *
   * @example
   * ```typescript
   * const result = await retryHandler.executeWithRetry(
   *   async () => await page.locator('#btn').click(),
   *   'Click Login Button'
   * );
   * ```
   */
  public async executeWithRetry<T>(
    action: () => Promise<T>,
    actionName: string,
    overrideConfig?: Partial<RetryConfig>
  ): Promise<RetryResult<T>> {
    const config = { ...this.config, ...overrideConfig };
    const screenshots: Array<{ base64Data: string; filename: string }> = [];
    let lastError: Error | undefined;
    let recoveryExecuted = false;
    let attempt = 0;

    const maxAttempts = config.maxRetries + 1; // +1 for initial attempt

    while (attempt < maxAttempts) {
      attempt++;

      try {
        logger.debug(`[RetryHandler] Attempt ${attempt}/${maxAttempts} for: ${actionName}`);
        const result = await action();

        if (attempt > 1) {
          logger.info(`[RetryHandler] ✅ ${actionName} succeeded on attempt ${attempt}/${maxAttempts}`);
        }

        return {
          success: true,
          result,
          attempts: attempt,
          screenshots,
          recoveryExecuted,
        };
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;

        logger.warn(
          `[RetryHandler] ❌ Attempt ${attempt}/${maxAttempts} failed for "${actionName}": ${errorMessage.split('\n')[0]}`
        );

        // Check if error is non-retryable
        if (this.isNonRetryableError(errorMessage)) {
          logger.error(`[RetryHandler] Non-retryable error detected. Failing immediately.`);
          break;
        }

        // Check if error is retryable
        if (!this.isRetryableError(errorMessage) && attempt > 1) {
          logger.warn(`[RetryHandler] Error not classified as retryable. Stopping retry.`);
          break;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= maxAttempts) {
          break;
        }

        // Capture screenshot before retry
        if (config.screenshotOnRetry) {
          const screenshot = await this.captureRetryScreenshot(actionName, attempt);
          if (screenshot) {
            screenshots.push(screenshot);
          }
        }

        // Execute recovery action
        if (config.recoveryAction) {
          try {
            logger.debug(`[RetryHandler] Executing recovery action before retry...`);
            await config.recoveryAction();
            recoveryExecuted = true;
          } catch (recoveryError: any) {
            logger.warn(`[RetryHandler] Recovery action failed: ${recoveryError.message}`);
          }
        }

        // Calculate delay with optional exponential backoff
        const delay = this.calculateDelay(attempt, config);
        logger.debug(`[RetryHandler] Waiting ${delay}ms before retry ${attempt + 1}...`);
        await this.sleep(delay);
      }
    }

    // All attempts failed
    logger.error(
      `[RetryHandler] ❌ "${actionName}" failed after ${attempt} attempt(s): ${lastError?.message.split('\n')[0]}`
    );

    return {
      success: false,
      attempts: attempt,
      error: lastError,
      screenshots,
      recoveryExecuted,
    };
  }

  /**
   * Execute action with automatic error throwing on failure
   * (Use this when you want the step to fail if all retries are exhausted)
   */
  public async executeWithRetryOrThrow<T>(
    action: () => Promise<T>,
    actionName: string,
    overrideConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const result = await this.executeWithRetry(action, actionName, overrideConfig);

    if (!result.success) {
      const error = result.error || new Error(`Action "${actionName}" failed after ${result.attempts} attempts`);
      throw error;
    }

    return result.result as T;
  }

  /**
   * Check if an error message indicates a retryable condition
   */
  public isRetryableError(errorMessage: string): boolean {
    const lowerMessage = errorMessage.toLowerCase();
    return RETRYABLE_ERRORS.some((pattern) => lowerMessage.includes(pattern.toLowerCase()));
  }

  /**
   * Check if an error message indicates a non-retryable condition
   */
  public isNonRetryableError(errorMessage: string): boolean {
    const lowerMessage = errorMessage.toLowerCase();
    return NON_RETRYABLE_ERRORS.some((pattern) => lowerMessage.includes(pattern.toLowerCase()));
  }

  /**
   * Capture screenshot before retry attempt
   */
  private async captureRetryScreenshot(
    actionName: string,
    attempt: number
  ): Promise<{ base64Data: string; filename: string } | null> {
    try {
      const safeActionName = actionName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
      const key = `${this.config.testCaseKey}_retry${attempt}_${safeActionName}`;

      const result = await EvidenceCapture.captureScreenshot(this.page, key, this.config.iteration);

      if (result) {
        logger.debug(`[RetryHandler] 📸 Screenshot captured: ${result.filename}`);
        return result;
      }
    } catch (error: any) {
      logger.warn(`[RetryHandler] Failed to capture retry screenshot: ${error.message}`);
    }
    return null;
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number, config: Required<RetryConfig>): number {
    if (!config.exponentialBackoff) {
      return config.retryDelay;
    }

    const delay = config.retryDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<RetryConfig> {
    return { ...this.config };
  }
}

/**
 * Factory function to create a RetryHandler with common presets
 */
export const createRetryHandler = {
  /**
   * Standard retry configuration for most UI interactions
   */
  standard: (page: Page, testCaseKey?: string): RetryHandler =>
    new RetryHandler(page, {
      maxRetries: 2,
      retryDelay: 1000,
      exponentialBackoff: true,
      screenshotOnRetry: true,
      testCaseKey,
    }),

  /**
   * Aggressive retry for flaky elements
   */
  aggressive: (page: Page, testCaseKey?: string): RetryHandler =>
    new RetryHandler(page, {
      maxRetries: 4,
      retryDelay: 500,
      exponentialBackoff: true,
      backoffMultiplier: 1.5,
      screenshotOnRetry: true,
      testCaseKey,
    }),

  /**
   * Minimal retry for quick failures
   */
  minimal: (page: Page, testCaseKey?: string): RetryHandler =>
    new RetryHandler(page, {
      maxRetries: 1,
      retryDelay: 500,
      exponentialBackoff: false,
      screenshotOnRetry: true,
      testCaseKey,
    }),

  /**
   * No retry - just screenshot on failure
   */
  noRetry: (page: Page, testCaseKey?: string): RetryHandler =>
    new RetryHandler(page, {
      maxRetries: 0,
      screenshotOnRetry: true,
      testCaseKey,
    }),
};
