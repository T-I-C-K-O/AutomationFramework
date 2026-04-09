import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { TIMEOUTS } from '../../config/timeouts.config';
import { expectsHoverSuccess, expectsHoverBlocked } from '../../expectedResult';
import { SELECTORS } from '../../config/selectors.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/** Execution modes for the Hover action */
type HoverExecutionType = 'normal-hover' | 'blocked-hover' | 'validate-hover';

/**
 * HoverActionHandler
 *
 * Handles mouse hover actions on UI elements. Moves the mouse cursor over
 * the target element, triggering hover states, tooltips, and dropdown menus.
 *
 * Supported Keywords: `hover`
 *
 * Usage Examples:
 * | Action                          | Data | Expected Result |
 * |---------------------------------|------|-----------------|
 * | Hover 'User Menu'               |      |                 |
 * | Hover 'Help Icon'               |      |                 |
 * | Hover 'Navigation Item'         |      |                 |
 * | Hover 'Tooltip Trigger'         |      |                 |
 * | Hover 'Dropdown Menu'           |      |                 |
 *
 * Common Use Cases:
 * - Revealing dropdown/flyout menus
 * - Displaying tooltips or help text
 * - Triggering hover states on buttons/links
 * - Showing hidden elements on hover
 * - Activating CSS hover effects
 *
 * Key Features:
 * - Auto-scroll: Scrolls element into view before hovering
 * - Network wait: Waits for network idle before interaction
 * - Multi-locator fallback: Tries all locators in objectMap for the element
 * - Mouse positioning: Centers cursor on the element
 *
 * Notes:
 * - Hover state is maintained until another action moves the mouse
 * - For click actions, use ClickActionHandler
 * - For double-click, use DoubleClickActionHandler
 * - Element must be visible for hover to work
 *
 * **Execution Modes:**
 * | Mode            | Trigger (Expected Result)          | Behavior                                    |
 * |-----------------|------------------------------------|---------------------------------------------|
 * | `validate`      | Contains success keywords          | Hovers and verifies element is visible      |
 * | `blocked-check` | Contains blocked keywords          | Verifies element cannot be hovered          |
 * | `normal`        | Empty or no matching keywords      | Hovers without validation                   |
 *
 * @see ClickActionHandler for click functionality
 * @since 1.0.0
 */
export class HoverActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    const firstWord = action.trim().split(' ')[0].toLowerCase();
    return /hover/i.test(firstWord);
  }

  /**
   * Determines the hover mode based on the expected result string.
   * IMPORTANT: Check "blocked" conditions FIRST as they are more specific.
   * @param result The expected result from the test case
   * @returns The hover mode to use
   */
  private getExecutionTypeFromExpectedResult(result: any): HoverExecutionType {
    if (expectsHoverBlocked(result)) return 'blocked-hover';
    if (expectsHoverSuccess(result)) return 'validate-hover';
    return 'normal-hover';
  }

  private async isTextAvailable(locator: any): Promise<boolean> {
    try {
      const textContent = await locator.textContent();
      return textContent !== null && textContent.trim().length > 0;
    } catch {
      return false;
    }
  }

  private extractQuotedValues(result: string): string[] {
    const quotedMatches: RegExpMatchArray | null = result.match(/['"]([^'"]+)['"]/g);
    if (!quotedMatches) return [];
    return quotedMatches.map((match) => match.replace(/['"]/g, '').trim()).filter(Boolean);
  }

  private async validateExpectedResultsText(result: any, locator: any, key: string): Promise<void> {
    if (!result || typeof result !== 'string') return;
    const expectedValues = this.extractQuotedValues(result);
    if (expectedValues.length === 0) return;

    let textContent = '';
    try {
      textContent = (await locator.textContent()) ?? '';
      logger.info(` ${textContent}`);
    } catch (err: any) {
      throw new Error(
        `Expected result validation failed: unable to read text from hovered element '${key}' (${err?.message || err})`
      );
    }

    for (const expectedValue of expectedValues) {
      if (!textContent.includes(expectedValue)) {
        // Fallback: tooltip or hover content may appear in a different element/class
        try {
          const tooltipLocator = this.page.locator(SELECTORS.hover.PRIMENG_TOOLTIP.join(', '), {
            hasText: expectedValue,
          });
          if (await tooltipLocator.count()) {
            const isVisible = await tooltipLocator.first().isVisible();
            if (isVisible) {
              logger.info(
                `[HoverActionHandler] Validated expected result text in PrimeNG hover content: '${expectedValue}'`
              );
              continue;
            }
          }

          const textLocator = this.page.getByText(expectedValue, { exact: false });
          if ((await textLocator.count()) === 0) {
            throw new Error('No matching text nodes found');
          }
          if (!(await textLocator.first().isVisible())) {
            throw new Error('Matching text exists but is not visible');
          }
          logger.info(`[HoverActionHandler] Validated expected result text in hover content: '${expectedValue}'`);
          continue;
        } catch (err: any) {
          throw new Error(
            `Expected result validation failed: '${expectedValue}' not found in hovered element '${key}' or visible hover content (${err?.message || err})`
          );
        }
      }
      logger.info(`[HoverActionHandler] Validated expected result text: '${expectedValue}'`);
    }
  }

  /**
   * Checks if an element is hoverable (visible and enabled).
   * @param locator The locator to check
   * @returns true if element can be hovered
   */
  private async isElementHoverable(locator: any): Promise<boolean> {
    try {
      const isVisible = await locator.isVisible().catch(() => false);
      const isEnabled = await locator.isEnabled().catch(() => true);
      return isVisible && isEnabled;
    } catch {
      return false;
    }
  }

  async execute(action: string, data?: any, result?: any, _step?: any): Promise<boolean> {
    const page = this.page;
    try {
      const matchQuotedText = action.match(/[''']([^''']+)[''']/);
      if (!matchQuotedText) throw new Error(`No quoted text found in action: '${action}'`);
      const key = matchQuotedText[1];

      const exprList = objectMap[key];
      if (!exprList || exprList.length === 0) {
        throw new Error(`Locator '${key}' not found in objectMap.`);
      }

      // Determine execution mode based on expected result
      const executionType = this.getExecutionTypeFromExpectedResult(result);
      logger.info(`[HoverActionHandler] Execution mode: ${executionType}`);

      for (const [index, expr] of exprList.entries()) {
        try {
          const locator = await this.getLocator(expr);

          // Handle blocked-hover mode: verify element cannot be hovered
          if (executionType === 'blocked-hover') {
            const isHoverable = await this.isElementHoverable(locator);
            if (!isHoverable) {
              logger.info(`[HoverActionHandler] Element '${key}' is not hoverable as expected - PASS`);
              return true;
            }
            // Element is hoverable but shouldn't be - this is a VALIDATION FAILURE, not a locator failure
            const errorMsg = `Validation failed: Element '${key}' is hoverable but expected to be blocked/hidden`;
            logger.error(`[HoverActionHandler] ${errorMsg}`);
            throw new Error(errorMsg);
          }

          // Normal and validate modes: perform hover
          await locator.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.scrollIntoView }).catch(() => {});
          await page.waitForLoadState('networkidle');
          await locator.hover({ timeout: TIMEOUTS.hover });
          logger.info(`[HoverActionHandler] Hovered over '${key}' using locator #${index + 1}`);

          // Validate mode: verify hover effect
          if (executionType === 'validate-hover') {
            const isVisible = await locator.isVisible();
            if (!isVisible) {
              throw new Error(`Hover validation failed: Element '${key}' is not visible after hover`);
            }
            logger.info(`[HoverActionHandler] Validated: '${key}' is visible after hover - PASS`);
          }

          // Validate expected result text (quoted values) against hovered element
          await this.validateExpectedResultsText(result, locator, key);

          return true;
        } catch (err: any) {
          // Check if this is a validation failure (not a locator issue)
          if (err.message && err.message.includes('Validation failed:')) {
            // This is a test failure, not a locator failure - propagate immediately
            throw err;
          }

          // This is a locator failure - log and try next locator
          logger.warn(`[HoverActionHandler] Locator #${index + 1} failed: ${err.message || err}`);
        }
      }

      throw new Error(`All locators for '${key}' failed (hover).`);
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
        handler: 'HoverActionHandler',
        action,
        elementName,
        locatorExpression: locatorToString(objectMap[elementName]),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }
}
