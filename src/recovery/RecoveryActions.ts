/**
 * @fileoverview Recovery Actions for Playwright Test Automation Framework
 *
 * Provides conditional recovery strategies for common failure scenarios.
 * These actions are executed between retry attempts to increase the chance
 * of success on subsequent attempts.
 *
 * ## Recovery Strategies
 *
 * | Strategy              | When Used                                  | Action                        |
 * |-----------------------|--------------------------------------------|-------------------------------|
 * | dismissDialogs        | Unexpected alert/dialog blocking           | Accept or dismiss dialogs     |
 * | waitForStability      | Page still loading/transitioning           | Wait for network idle         |
 * | scrollToElement       | Element not in viewport                    | Scroll element into view      |
 * | refreshPage           | Stale DOM or navigation issue              | Reload the page               |
 * | clearOverlays         | Modal/overlay blocking element             | Remove blocking overlays      |
 * | waitAndRetry          | Timing issue                               | Simple wait before retry      |
 *
 * ## Usage
 *
 * ```typescript
 * import { RecoveryActions } from '../recovery/RecoveryActions';
 *
 * const recovery = new RecoveryActions(page);
 *
 * // Use with RetryHandler
 * await retryHandler.executeWithRetry(
 *   async () => await element.click(),
 *   'Click Button',
 *   { recoveryAction: () => recovery.dismissDialogs() }
 * );
 *
 * // Or use smart recovery that picks the right strategy
 * await recovery.smartRecovery(error);
 * ```
 *
 * @since 1.0.0
 * @version 1.0.0
 */

import { Page, Locator } from '@playwright/test';
import { logger } from '../helpers/logger';
import { TIMEOUTS } from '../config/timeouts.config';

/**
 * Configuration for recovery actions
 */
export interface RecoveryConfig {
  /** Maximum time to wait for page stability (default: 5000) */
  stabilityTimeout?: number;

  /** Whether to capture screenshot after recovery (default: false) */
  screenshotAfterRecovery?: boolean;

  /** Custom overlay selectors to clear (default: common modal selectors) */
  overlaySelectors?: string[];

  /** Whether to log detailed recovery info (default: true) */
  verboseLogging?: boolean;
}

/**
 * Result of a recovery action
 */
export interface RecoveryResult {
  /** Whether recovery was attempted */
  attempted: boolean;

  /** Whether recovery succeeded */
  success: boolean;

  /** Type of recovery action executed */
  actionType: string;

  /** Any error that occurred during recovery */
  error?: Error;

  /** Time taken for recovery in milliseconds */
  duration: number;
}

/**
 * Error patterns mapped to recovery strategies
 */
const ERROR_RECOVERY_MAP: Array<{
  patterns: string[];
  recoveryType: keyof RecoveryActions;
  priority: number;
}> = [
  {
    patterns: ['element is not attached', 'element was detached', 'execution context was destroyed'],
    recoveryType: 'waitForStability',
    priority: 1,
  },
  {
    patterns: ['element is not visible', 'element is outside of the viewport'],
    recoveryType: 'scrollToElement',
    priority: 2,
  },
  {
    patterns: ['element is not stable', 'element is being animated'],
    recoveryType: 'waitForStability',
    priority: 1,
  },
  {
    patterns: ['strict mode violation', 'locator resolved to'],
    recoveryType: 'waitForStability',
    priority: 1,
  },
  {
    patterns: ['dialog', 'alert', 'confirm', 'prompt'],
    recoveryType: 'dismissDialogs',
    priority: 3,
  },
  {
    patterns: ['overlay', 'modal', 'backdrop', 'intercept'],
    recoveryType: 'clearOverlays',
    priority: 2,
  },
  {
    patterns: ['timeout', 'TimeoutError', 'waiting for'],
    recoveryType: 'waitForStability',
    priority: 1,
  },
  {
    patterns: ['net::ERR_', 'navigation'],
    recoveryType: 'refreshPage',
    priority: 4,
  },
];

/**
 * RecoveryActions - Provides recovery strategies for common test failures
 *
 * @example
 * ```typescript
 * const recovery = new RecoveryActions(page);
 *
 * // Dismiss any blocking dialogs
 * await recovery.dismissDialogs();
 *
 * // Wait for page to stabilize
 * await recovery.waitForStability();
 *
 * // Smart recovery based on error
 * await recovery.smartRecovery(error, element);
 * ```
 */
export class RecoveryActions {
  private page: Page;
  private config: Required<RecoveryConfig>;
  private dialogDismissed: boolean = false;

  /** Common overlay/modal selectors that might block interactions */
  private static readonly DEFAULT_OVERLAY_SELECTORS = [
    '[class*="overlay"]',
    '[class*="modal-backdrop"]',
    '[class*="dialog-backdrop"]',
    '.backdrop',
    '[class*="loading-overlay"]',
    '[class*="spinner-overlay"]',
    '[role="dialog"][aria-hidden="true"]',
  ];

  constructor(page: Page, config: RecoveryConfig = {}) {
    this.page = page;
    this.config = {
      stabilityTimeout: config.stabilityTimeout ?? 5000,
      screenshotAfterRecovery: config.screenshotAfterRecovery ?? false,
      overlaySelectors: config.overlaySelectors ?? RecoveryActions.DEFAULT_OVERLAY_SELECTORS,
      verboseLogging: config.verboseLogging ?? true,
    };

    // Set up dialog handler
    this.setupDialogHandler();
  }

  /**
   * Update page reference
   */
  public updatePage(page: Page): void {
    this.page = page;
    this.setupDialogHandler();
  }

  /**
   * Set up automatic dialog dismissal
   */
  private setupDialogHandler(): void {
    this.page.on('dialog', async (dialog) => {
      try {
        logger.info(`[RecoveryActions] Auto-dismissing ${dialog.type()} dialog: "${dialog.message()}"`);
        await dialog.dismiss();
        this.dialogDismissed = true;
      } catch {
        // Dialog may already be handled
      }
    });
  }

  /**
   * Smart recovery - automatically selects the best recovery strategy based on error
   */
  public async smartRecovery(error: Error | string, targetLocator?: Locator): Promise<RecoveryResult> {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const lowerMessage = errorMessage.toLowerCase();

    // Find matching recovery strategy
    const matchedStrategy = ERROR_RECOVERY_MAP.find((strategy) =>
      strategy.patterns.some((pattern) => lowerMessage.includes(pattern.toLowerCase()))
    );

    if (!matchedStrategy) {
      // Default to wait for stability
      this.log('No specific recovery strategy matched. Using default: waitForStability');
      return this.waitForStability();
    }

    this.log(`Matched recovery strategy: ${matchedStrategy.recoveryType}`);

    switch (matchedStrategy.recoveryType) {
      case 'dismissDialogs':
        return this.dismissDialogs();
      case 'waitForStability':
        return this.waitForStability();
      case 'scrollToElement':
        if (targetLocator) {
          return this.scrollToElement(targetLocator);
        }
        return this.waitForStability();
      case 'clearOverlays':
        return this.clearOverlays();
      case 'refreshPage':
        return this.refreshPage();
      default:
        return this.waitAndRetry();
    }
  }

  /**
   * Dismiss any open dialogs (alert, confirm, prompt)
   */
  public async dismissDialogs(): Promise<RecoveryResult> {
    const startTime = Date.now();
    this.dialogDismissed = false;

    try {
      // Give a moment for any pending dialog to appear
      await this.page.waitForTimeout(300);

      // The dialog handler will auto-dismiss, but we can also try to interact with page
      // to trigger any dialogs that might be pending
      try {
        // Override native dialogs to prevent blocking - runs in browser context
        await this.page.evaluate(`
          window.alert = function() {};
          window.confirm = function() { return true; };
          window.prompt = function() { return null; };
        `);
      } catch {
        // Ignore errors - page might not be ready
      }

      this.log('Dialog dismissal recovery executed');

      return {
        attempted: true,
        success: true,
        actionType: 'dismissDialogs',
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        attempted: true,
        success: false,
        actionType: 'dismissDialogs',
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Wait for page to reach a stable state
   */
  public async waitForStability(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      this.log('Waiting for page stability...');

      // Wait for network to be idle
      await Promise.race([
        this.page.waitForLoadState('networkidle', { timeout: this.config.stabilityTimeout }),
        this.page.waitForTimeout(this.config.stabilityTimeout),
      ]).catch(() => {});

      // Wait for DOM to settle
      await this.page.waitForTimeout(TIMEOUTS.recoveryDelay);

      // Wait for any animations to complete
      try {
        // This runs in browser context - use string evaluation to avoid TS DOM type issues
        await this.page.evaluate(`
          new Promise((resolve) => {
            const animations = document.getAnimations ? document.getAnimations() : [];
            if (animations.length === 0) {
              resolve();
              return;
            }
            Promise.all(animations.map(a => a.finished)).then(() => resolve());
            setTimeout(resolve, 1000);
          });
        `);
      } catch {
        // Ignore - not all pages support getAnimations
      }

      this.log('Page stability achieved');

      return {
        attempted: true,
        success: true,
        actionType: 'waitForStability',
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        attempted: true,
        success: false,
        actionType: 'waitForStability',
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Scroll an element into view
   */
  public async scrollToElement(locator: Locator): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      this.log('Scrolling element into view...');

      await locator.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.scrollIntoView });

      // Small delay after scroll
      await this.page.waitForTimeout(TIMEOUTS.smallDelay);

      this.log('Element scrolled into view');

      return {
        attempted: true,
        success: true,
        actionType: 'scrollToElement',
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        attempted: true,
        success: false,
        actionType: 'scrollToElement',
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Clear blocking overlays/modals
   */
  public async clearOverlays(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      this.log('Attempting to clear blocking overlays...');

      let overlaysCleared = 0;

      for (const selector of this.config.overlaySelectors) {
        try {
          const overlays = await this.page.$$(selector);
          for (const overlay of overlays) {
            const isVisible = await overlay.isVisible();
            if (isVisible) {
              await this.page.evaluate((el) => {
                // In browser context, el is an HTMLElement
                (el as unknown as { style: { display: string } }).style.display = 'none';
              }, overlay);
              overlaysCleared++;
            }
          }
        } catch {
          // Selector might not match anything
        }
      }

      // Also try to click any visible close buttons
      const closeButtonSelectors = [
        '[aria-label="Close"]',
        '[aria-label="Dismiss"]',
        'button.close',
        '.modal-close',
        '[class*="close-button"]',
        '[data-dismiss="modal"]',
      ];

      for (const selector of closeButtonSelectors) {
        try {
          const closeBtn = this.page.locator(selector).first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click({ timeout: 1000 }).catch(() => {});
            overlaysCleared++;
          }
        } catch {
          // Button might not exist
        }
      }

      this.log(`Cleared ${overlaysCleared} overlay(s)`);

      return {
        attempted: true,
        success: overlaysCleared > 0,
        actionType: 'clearOverlays',
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        attempted: true,
        success: false,
        actionType: 'clearOverlays',
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Refresh the page (use sparingly - can lose state)
   */
  public async refreshPage(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      this.log('Refreshing page...');

      await this.page.reload({ waitUntil: 'networkidle', timeout: TIMEOUTS.pageLoad });

      this.log('Page refreshed successfully');

      return {
        attempted: true,
        success: true,
        actionType: 'refreshPage',
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        attempted: true,
        success: false,
        actionType: 'refreshPage',
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Simple wait before retry (fallback strategy)
   */
  public async waitAndRetry(delay: number = TIMEOUTS.recoveryDelay): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      this.log(`Waiting ${delay}ms before retry...`);
      await this.page.waitForTimeout(delay);

      return {
        attempted: true,
        success: true,
        actionType: 'waitAndRetry',
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        attempted: true,
        success: false,
        actionType: 'waitAndRetry',
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Focus the page (bring to front)
   */
  public async focusPage(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      this.log('Bringing page to front...');
      await this.page.bringToFront();

      return {
        attempted: true,
        success: true,
        actionType: 'focusPage',
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        attempted: true,
        success: false,
        actionType: 'focusPage',
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Escape key press (dismiss dropdowns, close popovers)
   */
  public async pressEscape(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      this.log('Pressing Escape key...');
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(TIMEOUTS.smallDelay);

      return {
        attempted: true,
        success: true,
        actionType: 'pressEscape',
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        attempted: true,
        success: false,
        actionType: 'pressEscape',
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Click elsewhere on the page (dismiss popovers, deselect elements)
   */
  public async clickAway(): Promise<RecoveryResult> {
    const startTime = Date.now();

    try {
      this.log('Clicking away from current element...');
      await this.page.click('body', { position: { x: 1, y: 1 } });
      await this.page.waitForTimeout(TIMEOUTS.smallDelay);

      return {
        attempted: true,
        success: true,
        actionType: 'clickAway',
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        attempted: true,
        success: false,
        actionType: 'clickAway',
        error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Compose multiple recovery actions
   */
  public async composeRecovery(actions: Array<keyof RecoveryActions>): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];

    for (const actionName of actions) {
      const action = (this as any)[actionName];
      if (typeof action === 'function') {
        const result = await action.call(this);
        results.push(result);
        if (!result.success) {
          break; // Stop on first failure
        }
      }
    }

    return results;
  }

  /**
   * Internal logging helper
   */
  private log(message: string): void {
    if (this.config.verboseLogging) {
      logger.debug(`[RecoveryActions] ${message}`);
    }
  }
}

/**
 * Factory function to create recovery action chains
 */
export const createRecoveryChain = (page: Page) => {
  const recovery = new RecoveryActions(page);

  return {
    /**
     * Basic recovery chain for most scenarios
     */
    basic: async (): Promise<void> => {
      await recovery.dismissDialogs();
      await recovery.waitForStability();
    },

    /**
     * Aggressive recovery chain for stubborn elements
     */
    aggressive: async (): Promise<void> => {
      await recovery.pressEscape();
      await recovery.clearOverlays();
      await recovery.waitForStability();
      await recovery.dismissDialogs();
    },

    /**
     * Recovery chain for overlay issues
     */
    overlay: async (): Promise<void> => {
      await recovery.pressEscape();
      await recovery.clearOverlays();
      await recovery.clickAway();
    },

    /**
     * Recovery for focus/visibility issues
     */
    visibility: async (locator?: Locator): Promise<void> => {
      await recovery.focusPage();
      if (locator) {
        await recovery.scrollToElement(locator);
      }
      await recovery.waitForStability();
    },

    /**
     * Smart recovery based on error
     */
    smart: async (error: Error, locator?: Locator): Promise<RecoveryResult> => {
      return recovery.smartRecovery(error, locator);
    },
  };
};
