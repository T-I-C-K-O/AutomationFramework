import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/**
 * WaitActionHandler
 *
 * Handles explicit wait actions in test cases. Supports:
 * - Time-based waits: "Wait 5 seconds", "Wait for 3000 milliseconds"
 * - Element waits: "Wait for 'Element Name'", "Wait until 'Element Name' is visible"
 * - Page state waits: "Wait for page to load", "Wait for network idle"
 *
 * Usage Examples:
 * | Action                                    | Data    | Expected Result        |
 * |-------------------------------------------|---------|------------------------|
 * | Wait 5 seconds                            |         | Waits for 5 seconds    |
 * | Wait for 3000 milliseconds                |         | Waits for 3 seconds    |
 * | Wait for 'Submit Button'                  |         | Element is visible     |
 * | Wait for 'Loading Spinner' to disappear   |         | Element is hidden      |
 * | Wait until 'Success Message' is visible   |         | Element becomes visible|
 * | Wait for page to load                     |         | Page fully loaded      |
 * | Wait for network idle                     |         | No pending requests    |
 *
 * @since 1.0.0
 */
export class WaitActionHandler extends BaseActionHandler {
  // Default timeout for element waits (configurable)
  private readonly DEFAULT_ELEMENT_TIMEOUT = TIMEOUTS.elementDefault;

  // Default timeout for page state waits (configurable)
  private readonly DEFAULT_PAGE_TIMEOUT = TIMEOUTS.pageLoad;

  canHandle(action: string): boolean {
    const lowerAction = action.toLowerCase().trim();
    return lowerAction.startsWith('wait');
  }

  async execute(action: string, data?: any, _result?: any, _step?: any): Promise<boolean> {
    const lowerAction = action.toLowerCase();

    // Parse custom timeout from data column (e.g., "timeout=30s" or "30000")
    const customTimeout = this.parseTimeout(data);

    try {
      // 1. Time-based wait: "Wait 5 seconds" or "Wait for 3000 milliseconds"
      if (this.isTimeBased(lowerAction)) {
        return await this.handleTimeWait(action, data);
      }

      // 2. URL wait: "Wait for URL to contain 'dashboard'"
      if (this.isUrlWait(lowerAction)) {
        return await this.handleUrlWait(action, customTimeout);
      }

      // 3. Page state wait: "Wait for page to load" or "Wait for network idle"
      if (this.isPageStateWait(lowerAction)) {
        return await this.handlePageStateWait(action, customTimeout);
      }

      // 4. Element-based wait: "Wait for 'Element Name'" or "Wait until 'Element' is visible"
      if (this.isElementWait(action)) {
        return await this.handleElementWait(action, data, customTimeout);
      }

      // Fallback: treat as a simple time wait if data contains a number
      if (data && !isNaN(Number(data))) {
        const ms = Number(data);
        logger.info(`[WaitActionHandler] Waiting for ${ms}ms (from data field)`);
        await this.page.waitForTimeout(ms);
        return true;
      }

      throw new Error(
        `Unrecognized wait action: '${action}'. Use formats like 'Wait 5 seconds', 'Wait for \\'Element\\'', or 'Wait for network idle'.`
      );
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }

      // Extract element name for error context (if any)
      const matchQuotedText = action.match(/['''']([^''']+)[''']/);
      const elementName = matchQuotedText ? matchQuotedText[1] : undefined;

      // Enrich error with context
      const pageCtx = await getPageContext(this.page);
      throw formatStepError(error, {
        handler: 'WaitActionHandler',
        action,
        elementName,
        locatorExpression: elementName ? locatorToString(objectMap[elementName]) : undefined,
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }

  /**
   * Parse custom timeout from data column
   * Supports: "timeout=30s", "timeout=5000", "timeout=1m", or just a number
   */
  private parseTimeout(data?: any): number | undefined {
    if (!data) return undefined;

    const dataStr = String(data).trim();

    // Parse "timeout=Xs" or "timeout=Xms" or "timeout=Xm"
    const timeoutMatch = dataStr.match(/timeout\s*=\s*(\d+)\s*(s|ms|m|seconds?|milliseconds?|minutes?)?/i);
    if (timeoutMatch) {
      const value = parseInt(timeoutMatch[1], 10);
      const unit = (timeoutMatch[2] || 'ms').toLowerCase();

      if (unit.startsWith('m') && !unit.startsWith('ms') && !unit.startsWith('millisecond')) {
        return value * 60 * 1000; // minutes
      } else if (unit === 's' || unit.startsWith('second')) {
        return value * 1000; // seconds
      }
      return value; // milliseconds
    }

    return undefined;
  }

  /**
   * Check if action is time-based wait
   */
  private isTimeBased(action: string): boolean {
    return (
      /wait\s+(\d+)\s*(seconds?|secs?|s|milliseconds?|ms|minutes?|mins?|m)/i.test(action) ||
      /wait\s+for\s+(\d+)\s*(seconds?|secs?|s|milliseconds?|ms|minutes?|mins?|m)/i.test(action)
    );
  }

  /**
   * Check if action is URL-based wait
   */
  private isUrlWait(action: string): boolean {
    return /wait\s+(for\s+)?url/i.test(action);
  }

  /**
   * Check if action is page state wait
   */
  private isPageStateWait(action: string): boolean {
    return /wait\s+(for\s+)?(page|network|dom|load)/i.test(action);
  }

  /**
   * Check if action is element-based wait
   */
  private isElementWait(action: string): boolean {
    return /[''']([^''']+)[''']/.test(action);
  }

  /**
   * Handle time-based waits
   * Supports: seconds, milliseconds, minutes
   */
  private async handleTimeWait(action: string, _data?: any): Promise<boolean> {
    // Extract number and unit from action
    const match = action.match(/(\d+)\s*(seconds?|secs?|s|milliseconds?|ms|minutes?|mins?|m)?/i);

    if (!match) {
      throw new Error(`Could not parse time from action: '${action}'`);
    }

    const value = parseInt(match[1], 10);
    const unit = (match[2] || 'seconds').toLowerCase();

    let milliseconds: number;

    if (unit.startsWith('ms') || unit.startsWith('millisecond')) {
      milliseconds = value;
    } else if (unit.startsWith('m') && !unit.startsWith('ms') && !unit.startsWith('millisecond')) {
      // Minutes
      milliseconds = value * 60 * 1000;
    } else {
      // Default to seconds
      milliseconds = value * 1000;
    }

    logger.info(`[WaitActionHandler] Waiting for ${milliseconds}ms (${value} ${unit})`);
    await this.page.waitForTimeout(milliseconds);
    logger.info(`[WaitActionHandler] Wait completed: ${value} ${unit}`);

    return true;
  }

  /**
   * Handle page state waits
   * Supports: page load, network idle, DOM content loaded
   */
  private async handlePageStateWait(action: string, customTimeout?: number): Promise<boolean> {
    const lowerAction = action.toLowerCase();
    const timeout = customTimeout ?? this.DEFAULT_PAGE_TIMEOUT;

    if (lowerAction.includes('network') && lowerAction.includes('idle')) {
      logger.info('[WaitActionHandler] Waiting for network idle...');
      await this.page.waitForLoadState('networkidle', { timeout });
      logger.info('[WaitActionHandler] Network is idle');
      return true;
    }

    if (lowerAction.includes('dom')) {
      logger.info('[WaitActionHandler] Waiting for DOM content loaded...');
      await this.page.waitForLoadState('domcontentloaded', { timeout });
      logger.info('[WaitActionHandler] DOM content loaded');
      return true;
    }

    if (lowerAction.includes('load') || lowerAction.includes('page')) {
      logger.info('[WaitActionHandler] Waiting for page to fully load...');
      await this.page.waitForLoadState('load', { timeout });
      logger.info('[WaitActionHandler] Page fully loaded');
      return true;
    }

    throw new Error(`Unrecognized page state wait: '${action}'`);
  }

  /**
   * Handle URL-based waits
   * Supports: Wait for URL to contain 'text', Wait for URL to match 'pattern'
   */
  private async handleUrlWait(action: string, customTimeout?: number): Promise<boolean> {
    const timeout = customTimeout ?? this.DEFAULT_PAGE_TIMEOUT;

    // Extract the URL pattern from quotes
    const patternMatch = action.match(/[''']([^''']+)[''']/);
    if (!patternMatch) {
      throw new Error(`No URL pattern found in action: '${action}'. Use: Wait for URL to contain 'pattern'`);
    }

    const pattern = patternMatch[1];
    const lowerAction = action.toLowerCase();

    if (lowerAction.includes('match') || lowerAction.includes('regex')) {
      // Regex match
      logger.info(`[WaitActionHandler] Waiting for URL to match regex: ${pattern}`);
      await this.page.waitForURL(new RegExp(pattern), { timeout });
    } else {
      // Contains (default)
      logger.info(`[WaitActionHandler] Waiting for URL to contain: ${pattern}`);
      await this.page.waitForURL(`**/*${pattern}*`, { timeout });
    }

    logger.info(`[WaitActionHandler] URL condition met: ${this.page.url()}`);
    return true;
  }

  /**
   * Handle element-based waits
   * Supports: visible, hidden, enabled, disabled, attached, detached, text content
   */
  private async handleElementWait(action: string, data?: any, customTimeout?: number): Promise<boolean> {
    const lowerAction = action.toLowerCase();
    const timeout = customTimeout ?? this.DEFAULT_ELEMENT_TIMEOUT;

    // Extract element name from quotes
    const elementMatch = action.match(/[''']([^''']+)[''']/);
    if (!elementMatch) {
      throw new Error(`No element name found in action: '${action}'`);
    }

    const elementName = elementMatch[1];
    const exprList = objectMap[elementName];

    if (!exprList || exprList.length === 0) {
      throw new Error(`Locator '${elementName}' not found in objectMap.`);
    }

    // Determine wait state
    let state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible';

    if (
      lowerAction.includes('disappear') ||
      lowerAction.includes('hidden') ||
      lowerAction.includes('not visible') ||
      lowerAction.includes('invisible')
    ) {
      state = 'hidden';
    } else if (lowerAction.includes('detach') || lowerAction.includes('removed')) {
      state = 'detached';
    } else if (lowerAction.includes('attach') || lowerAction.includes('exist')) {
      state = 'attached';
    }

    // Check if waiting for specific text content
    const waitingForText = lowerAction.includes('to have text') || lowerAction.includes('to contain text');
    const expectedText = waitingForText && data ? String(data).trim() : null;

    logger.info(
      `[WaitActionHandler] Waiting for '${elementName}' to be ${state}${expectedText ? ` with text '${expectedText}'` : ''}...`
    );

    // Try each locator until one succeeds
    for (const [index, expr] of exprList.entries()) {
      try {
        const locator = await this.getLocator(expr);

        if (expectedText) {
          // Wait for element with specific text
          if (lowerAction.includes('to contain')) {
            await locator.filter({ hasText: expectedText }).waitFor({ state: 'visible', timeout });
          } else {
            await locator.filter({ hasText: new RegExp(`^${expectedText}$`) }).waitFor({ state: 'visible', timeout });
          }
        } else {
          // Wait for element state
          await locator.waitFor({ state, timeout });
        }

        logger.info(`[WaitActionHandler] Element '${elementName}' condition met`);
        return true;
      } catch (err: any) {
        logger.warn(`[WaitActionHandler] Locator #${index + 1} for '${elementName}' failed: ${err.message}`);
        if (index === exprList.length - 1) {
          throw new Error(`Timeout waiting for '${elementName}' to be ${state}. All locators failed.`);
        }
      }
    }

    return false;
  }
}
