import { BaseActionHandler } from '../BaseActionHandler';
import { PageContextManager } from '../../pages/PageContextManager';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext } from '../../helpers/StepErrorFormatter';

/**
 * ClickActionHandler
 *
 * Handles click actions on UI elements. Supports single clicks with automatic
 * popup/new tab detection and registration.
 *
 * Supported Keywords: click
 *
 * Usage Examples:
 *
 * 1. Basic Click:
 * | Action                          | Data | Expected Result |
 * |---------------------------------|------|-----------------|
 * | Click 'Submit Button'           |      |                 |
 * | Click 'Login'                   |      |                 |
 * | Click 'Menu Item'               |      |                 |
 * | Click 'Close Icon'              |      |                 |
 *
 * 2. Multiple Clicks (click several elements sequentially):
 * | Action                                    | Data | Expected Result |
 * |-------------------------------------------|------|-----------------|
 * | Click 'Sign In' and 'Menu'                |      |                 |
 * | Click 'Accept' and 'Continue' and 'Done'  |      |                 |
 *
 * 3. Click with New Tab/Popup (Result field stores page reference):
 * | Action                          | Data | Expected Result     |
 * |---------------------------------|------|---------------------|
 * | Click 'Open New Window'         |      | 'New Window Page'   |
 * | Click 'External Link'           |      | 'External Site'     |
 * | Click 'View Details'            |      | 'Details Page'      |
 *
 * Key Features:
 * - Network wait: Waits for network idle before clicking (30s timeout)
 * - Visibility check: Waits for element to be visible (30s timeout)
 * - Auto-scroll: Scrolls element into view before clicking
 * - Popup detection: Automatically detects new tabs/popups opened by click
 * - Page registration: Registers new pages in PageContextManager for later use
 * - Multi-locator fallback: Tries all locators in objectMap for the element
 *
 * Popup/New Tab Handling:
 * - When a click opens a new tab, the Expected Result field should contain
 *   the page key in quotes (e.g., 'Details Page')
 * - The new page is registered in PageContextManager with this key
 * - Use SwitchPageActionHandler to switch to the new page later
 *
 * Notes:
 * - For double-click, use DoubleClickActionHandler
 * - For right-click, use context menu specific handlers
 * - For hover, use HoverActionHandler
 *
 * @see DoubleClickActionHandler for double-click functionality
 * @see SwitchPageActionHandler for switching between pages
 * @since 1.0.0
 */
export class ClickActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    const firstWord = action.trim().split(' ')[0].toLowerCase();
    return /click/i.test(firstWord);
  }

  /**
   * Executes a click action on one or more UI elements.
   * Supports single click (e.g., "Click 'Submit'") and multiple clicks
   * (e.g., "Click 'Sign In' and 'Menu'"). Each quoted element is clicked
   * sequentially in the order they appear.
   *
   * Handles popup detection, element visibility, scrolling, and expected result validation.
   *
   * @param action - The action string (e.g., "Click 'Submit Button'" or "Click 'Sign In' and 'Menu'")
   * @param data - Optional data for the action
   * @param result - Optional expected result string for validation
   * @param step - Optional step metadata
   * @returns Promise<boolean> - Resolves true if all clicks and validation succeed
   * @throws Error if locator is not found, click fails, or expected result validation fails
   */
  async execute(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    try {
      // Extract all quoted element names from the action string
      const allMatches = action.match(/[''']([^''']+)[''']/g);
      if (!allMatches || allMatches.length === 0) {
        throw new Error(`No quoted text found in action: '${action}'`);
      }

      const keys = allMatches.map((m) => m.replace(/[''']/g, ''));
      logger.info(`[ClickActionHandler] Found ${keys.length} element(s) to click: ${keys.join(', ')}`);

      // Click each element sequentially
      let popupDetected = false;
      for (const key of keys) {
        const hasPopup = await this.clickElement(key, action, result, step);
        if (hasPopup) popupDetected = true;
      }

      // Validate expected results after all clicks are completed (skip if popup was detected)
      if (!popupDetected) {
        await this.validateExpectedResults(result);
      }
      return true;
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }
      logger.error(`[ClickActionHandler] Error in ClickActionHandler: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clicks a single element by its objectMap key.
   * Tries all locators defined for the element and handles popup detection.
   *
   * @param key - The objectMap key for the element (e.g., 'Sign In')
   * @param action - The original action string (for error context)
   * @param result - Optional expected result string
   * @param step - Optional step metadata
   * @throws Error if no locator succeeds for the element
   */
  private async clickElement(key: string, action: string, result?: any, step?: any): Promise<boolean> {
    const exprList = objectMap[key];

    if (!exprList || exprList.length === 0) {
      throw new Error(`Locator '${key}' not found in objectMap.`);
    }

    for (const [index, expr] of exprList.entries()) {
      try {
        const locator = await this.getLocator(expr);
        // Wait for element to be visible (UI rendered)
        await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.click });
        // Scroll into view if needed
        await locator.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.scrollIntoView }).catch(() => {});
        // Start popup detection and click simultaneously
        const [popup] = await Promise.all([
          this.page.waitForEvent('popup', { timeout: TIMEOUTS.popupDetection }).catch(() => null),
          locator.click({ timeout: TIMEOUTS.click }),
        ]);

        if (popup) {
          await popup.waitForLoadState('domcontentloaded').catch(() => {});
          const pageManager = PageContextManager.getInstance();

          try {
            const pageDetails = step.result.match(/[''']([^''']+)[''']/)?.[1];
            if (!pageDetails) {
              throw new Error('Check the test cases expected results. It should contain a value in quoted format');
            }
            pageManager.addPage(pageDetails, popup);
            logger.info(`[ClickActionHandler] New tab stored in PageContextManager with key: '${pageDetails}'`);
          } catch (resultError: any) {
            throw new Error(resultError.message || 'Failed to register popup page');
          }
        }
        logger.info(`[ClickActionHandler] Clicked on '${key}' using locator #${index + 1}`);
        return !!popup; // Success — return whether popup was detected
      } catch (err: any) {
        // If it's a step result validation error, throw immediately
        if (err.message.includes('Check the test cases expected results')) {
          throw err;
        }

        logger.warn(`[ClickActionHandler] Locator #${index + 1} failed for '${key}': ${err.message}`);
        if (index === exprList.length - 1) {
          const pageCtx = await getPageContext(this.page);
          throw formatStepError(err, {
            handler: 'ClickActionHandler',
            action,
            elementName: key,
            locatorExpression: exprList,
            pageUrl: pageCtx.url,
            pageTitle: pageCtx.title,
          });
        }
      }
    }

    throw new Error(`No locator succeeded for '${key}'.`);
  }


  /**
   * Validates expected results after a click action.
   * Extracts quoted element names from the result string and checks their presence.
   *
   * @param result - The expected result string containing quoted element names
   * @throws Error if any expected element is not found or not visible
   */
  async validateExpectedResults(result: string): Promise<void> {
    if (!result || typeof result !== 'string') {
      return; // No validation needed for generic results
    }
    // Extract quoted elements from expected results
    const quotedMatches: RegExpMatchArray | null = result.match(/[''']([^''']+)[''']/g);
    if (!quotedMatches) {
      return; // No quoted elements to validate
    }
    for (const quotedMatch of quotedMatches) {
      const elementName = quotedMatch.replace(/[''']/g, '');
      try {
        await this.validateElementPresence(elementName);
        logger.info(`[ClickActionHandler] Validated expected result: '${elementName}'`);
      } catch (validationError) {
        throw new Error(`Expected result validation failed for '${elementName}': ${validationError}`);
      }
    }
  }

  /**
   * Validates the presence and visibility of a specific element.
   *
   * @param elementName - The name of the element to validate
   * @throws Error if the element is not found or not visible
   */
  async validateElementPresence(elementName: string): Promise<void> {
    const locator: string[] | undefined = objectMap[elementName];
    if (!locator || locator.length === 0) {
      // If not in objectMap, check for common UI patterns
      throw new Error(`Locator '${elementName}' not found in objectMap.`);
    }
    // Try each locator in the objectMap
    for (const [index, expr] of locator.entries()) {
      try {
        const elementLocator = await this.getLocator(expr);
        // Wait for element to be visible with a reasonable timeout
        await elementLocator.waitFor({ state: 'visible', timeout: TIMEOUTS.click });
        return; // Success with this locator
      } catch (err: unknown) {
        logger.warn(`[ClickActionHandler] Locator #${index + 1} failed validation for '${elementName}': ${err}`);
        if (index === locator.length - 1) {
          const errMsg = err instanceof Error ? err.message : String(err);
          throw new Error(`All locators failed validation for '${elementName}'. Last error: ${errMsg}`);
        }
      }
    }
  }
}