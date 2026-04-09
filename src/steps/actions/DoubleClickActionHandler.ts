import { Locator } from '@playwright/test';
import { BaseActionHandler } from '../BaseActionHandler';
import { PageContextManager } from '../../pages/PageContextManager';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/**
 * DoubleClickActionHandler
 *
 * Handles double-click actions on UI elements. Performs two rapid clicks
 * on the target element, commonly used for editing table cells, selecting
 * text, or activating edit modes.
 *
 * Supported Keywords: `double-click`, `double click`, `doubleclick`
 *
 * Usage Examples:
 *
 * 1. Basic Double-Click:
 * | Action                              | Data | Expected Result |
 * |-------------------------------------|------|-----------------|
 * | Double-click 'Table Cell'           |      |                 |
 * | Double click 'Editable Field'       |      |                 |
 * | Doubleclick 'File Name'             |      |                 |
 * | Double-click 'List Item'            |      |                 |
 *
 * 2. Double-Click with New Tab/Popup (Result field stores page reference):
 * | Action                              | Data | Expected Result     |
 * |-------------------------------------|------|---------------------|
 * | Double-click 'Open New Window'      |      | 'New Window Page'   |
 * | Double-click 'External Link'        |      | 'External Site'     |
 * | Double-click 'View Details'         |      | 'Details Page'      |
 *
 * Key Features:
 * - Flexible keyword matching: Supports hyphenated, spaced, and combined formats
 * - Auto-scroll: Scrolls element into view before double-clicking
 * - Popup detection: Automatically detects new tabs/popups opened by double-click
 * - Page registration: Registers new pages in PageContextManager for later use
 * - Multi-locator fallback: Tries all locators in objectMap for the element
 * - Expected result validation: Validates presence of elements mentioned in expected results
 *
 * Popup/New Tab Handling:
 * - When a double-click opens a new tab, the Expected Result field should contain
 *   the page key in quotes (e.g., 'Details Page')
 * - The new page is registered in PageContextManager with this key
 * - Use SwitchPageActionHandler to switch to the new page later
 *
 * Common Use Cases:
 * - Editing inline table cells
 * - Selecting text/words in text fields
 * - Opening files or folders
 * - Activating edit mode on form fields
 * - Expanding/collapsing tree nodes
 *
 * Notes:
 * - For single click, use ClickActionHandler
 * - For hover actions, use HoverActionHandler
 * - Element must be visible and actionable
 *
 * @see ClickActionHandler for single-click functionality
 * @see SwitchPageActionHandler for switching between pages
 * @since 1.0.0
 */
export class DoubleClickActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    const lowerAction = action.toLowerCase().trim();
    return /^double[-\s]?click\b/i.test(lowerAction);
  }

  /**
   * Executes a double-click action on the specified UI element.
   * Handles popup detection, element visibility, scrolling, and expected result validation.
   *
   * @param action - The action string (e.g., "Double-click 'Table Cell'")
   * @param data - Optional data for the action
   * @param result - Optional expected result string for validation
   * @param step - Optional step metadata
   * @returns Promise<boolean> - Resolves true if double-click and validation succeed
   * @throws Error if locator is not found, double-click fails, or expected result validation fails
   */
  async execute(action: string, data?: string, result?: any, step?: any): Promise<boolean> {
    try {
      const matchQuotedText = action.match(/[''']([^''']+)[''']/);
      if (!matchQuotedText) throw new Error(`No quoted text found in action: '${action}'`);
      const key = matchQuotedText[1];
      const exprList = objectMap[key];
      if (!exprList || exprList.length === 0) throw new Error(`Locator '${key}' not found in objectMap.`);

      for (const [index, expr] of exprList.entries()) {
        try {
          const locator: Locator = await this.getLocator(expr);
          // Wait for element to be visible (UI rendered)
          await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.doubleClick });
          // Scroll into view if needed
          await locator.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.scrollIntoView }).catch(() => {});

          // Start popup detection and click simultaneously
          const [popup] = await Promise.all([
            this.page.waitForEvent('popup', { timeout: TIMEOUTS.popupDetection }).catch(() => null),
            locator.dblclick({ timeout: TIMEOUTS.doubleClick }),
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
              logger.info(`[DoubleClickActionHandler] New tab stored in PageContextManager with key: '${pageDetails}'`);
            } catch (resultError: any) {
              throw new Error(resultError.message || 'Failed to register popup page');
            }
          }
          logger.info(`[DoubleClickActionHandler] Double-clicked on '${key}' using locator #${index + 1}`);
          // Validate expected results if they contain quoted elements to check
          await this.validateExpectedResults(result);
          return true;
        } catch (err) {
          logger.warn(`[DoubleClickActionHandler] Locator #${index + 1} failed for double click: ${err}`);
        }
      }

      throw new Error(`All locators for '${key}' failed (double click).`);
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }

      // Extract element name for error context
      const matchQuotedText = action.match(/['''']([^''']+)[''']/);
      const elementName = matchQuotedText ? matchQuotedText[1] : 'unknown';

      // Enrich error with context
      const pageCtx = await getPageContext(this.page);
      throw formatStepError(error, {
        handler: 'DoubleClickActionHandler',
        action,
        elementName,
        locatorExpression: locatorToString(objectMap[elementName]),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }

  /**
   * Validates expected results after a double-click action.
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
        logger.info(`[DoubleClickActionHandler] Validated expected result: '${elementName}'`);
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
      throw new Error(`Locator '${elementName}' not found in objectMap.`);
    }
    // Try each locator in the objectMap
    for (const [index, expr] of locator.entries()) {
      try {
        const elementLocator = await this.getLocator(expr);
        // Wait for element to be visible with a reasonable timeout
        await elementLocator.waitFor({ state: 'visible', timeout: TIMEOUTS.doubleClick });
        return; // Success with this locator
      } catch (err: unknown) {
        logger.warn(`[DoubleClickActionHandler] Locator #${index + 1} failed validation for '${elementName}': ${err}`);
        if (index === locator.length - 1) {
          throw new Error(`All locators failed validation for '${elementName}'`);
        }
      }
    }
  }
}
