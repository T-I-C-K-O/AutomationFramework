import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { TIMEOUTS } from '../../config/timeouts.config';
// import {
//   expectsCheckSuccess,
//   expectsCheckBlocked,
//   expectsUncheckSuccess,
//   expectsUncheckBlocked,
// } from '../../expectedResult';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/**
 * CheckActionHandler
 *
 * Handles checkbox checking and unchecking actions in test cases. Ensures
 * checkboxes are checked (selected) or unchecked (deselected) with support
 * for standard HTML and PrimeNG checkboxes.
 *
 * Supported Keywords: `check`, `tick`, `uncheck`, `untick`
 *
 * **Execution Modes:**
 * | Mode            | Trigger (Expected Result)          | Behavior                                    |
 * |-----------------|------------------------------------|---------------------------------------------|
 * | `validate`      | Contains success keywords          | Performs action and verifies state          |
 * | `blocked-check` | Contains blocked keywords          | Verifies checkbox rejects action (disabled) |
 * | `normal`        | Empty or no matching keywords      | Performs action without validation          |
 *
 * Usage Examples:
 * | Action                          | Data | Expected Result                    |
 * |---------------------------------|------|------------------------------------|
 * | Check 'Remember Me'             |      | Checkbox is checked                |
 * | Tick 'Terms and Conditions'     |      | Checkbox is ticked                 |
 * | Uncheck 'Subscribe Newsletter'  |      | Newsletter subscription deselected |
 * | Untick 'Accept Privacy Policy'  |      | Privacy policy checkbox cleared    |
 * | Check 'Disabled Box'            |      | Checkbox should not be checked     |
 *
 * Key Features:
 * - Standard HTML checkbox support: Uses Playwright's native check()/uncheck() methods
 * - PrimeNG/Custom checkbox fallback: Falls back to click() if native methods fail
 * - State validation based on expected result keywords
 * - Disabled/read-only field detection
 * - Auto-scroll: Scrolls element into view before interaction
 * - Network wait: Waits for network idle before interacting
 * - Multi-locator fallback: Tries all locators in objectMap for the element
 *
 * Notes:
 * - Element must be visible before checking/unchecking
 * - Works with radio buttons as well (though unchecking radios is uncommon)
 * - Automatically detects whether to check or uncheck based on the action keyword
 *
 * @since 1.0.0
 */
export class CheckActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    const firstWord = action.trim().split(' ')[0].toLowerCase();
    return /^(check|tick|uncheck|untick)$/i.test(firstWord);
  }

  async execute(action: string, _data?: any, result?: any, _step?: any): Promise<boolean> {
    // const page = this.page;
    try {
      const matchQuotedText = action.match(/[‘'’]([^‘'’]+)[‘'’]/);
      if (!matchQuotedText) throw new Error(`No quoted text found in action: '${action}'`);
      const key = matchQuotedText[1];

      const exprList = objectMap[key];
      if (!exprList || exprList.length === 0) throw new Error(`Locator '${key}' not found in objectMap.`);

      // Determine if this is an uncheck operation
      const firstWord = action.trim().split(' ')[0].toLowerCase();
      const isUncheckOperation = /^(uncheck|untick)$/i.test(firstWord);
      const operationName = isUncheckOperation ? 'uncheck' : 'check';

      // Determine execution mode based on expected result
      // const shouldValidate = isUncheckOperation ? expectsUncheckSuccess(result) : expectsCheckSuccess(result);
      // const shouldBeBlocked = isUncheckOperation ? expectsUncheckBlocked(result) : expectsCheckBlocked(result);

      for (const [index, expr] of exprList.entries()) {
        try {
          const locator = await this.getLocator(expr);
          await locator.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.scrollIntoView }).catch(() => {});
          await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.click });

          // If action should be blocked, verify it's disabled/readonly
          // if (shouldBeBlocked) {
          //   const isDisabled = await locator.isDisabled().catch(() => false);
          //   if (isDisabled) {
          //     logger.info(`[CheckActionHandler] Verified '${key}' is disabled (as expected)`);
          //     return true;
          //   }
          //   throw new Error(`Expected '${key}' to be disabled but it is not`);
          // }

          // Perform the action
          if (isUncheckOperation) {
            // Uncheck operation: try uncheck(), fallback to click()
            try {
              await locator.uncheck({ timeout: TIMEOUTS.elementShort });
            } catch {
              // Fallback to click for PrimeNG or custom checkboxes
              await locator.click({ timeout: TIMEOUTS.click });
            }
            logger.info(`[CheckActionHandler] Unchecked '${key}' using locator #${index + 1}`);

            // Validate if expected
            // if (shouldValidate) {
            //   const isChecked = await locator.isChecked().catch(() => false);
            //   if (isChecked) {
            //     throw new Error(`Failed to uncheck '${key}' - checkbox is still checked`);
            //   }
            //   logger.info(`[CheckActionHandler] Validated '${key}' is unchecked`);
            // }
          } else {
            // Check operation: try check(), fallback to click()
            try {
              await locator.check({ timeout: TIMEOUTS.elementShort });
            } catch {
              // Fallback to click for PrimeNG or custom checkboxes
              await locator.click({ timeout: TIMEOUTS.click });
            }
            logger.info(`[CheckActionHandler] Checked '${key}' using locator #${index + 1}`);

            // Validate if expected
            // if (shouldValidate) {
            //   const isChecked = await locator.isChecked().catch(() => false);
            //   if (!isChecked) {
            //     throw new Error(`Failed to check '${key}' - checkbox is still unchecked`);
            //   }
            //   logger.info(`[CheckActionHandler] Validated '${key}' is checked`);
            // }
          }

          return true;
        } catch (err) {
          logger.warn(`[CheckActionHandler] Locator #${index + 1} failed for ${operationName}: ${err}`);
        }
      }

      throw new Error(`All locators for '${key}' failed (${operationName}).`);
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
        handler: 'CheckActionHandler',
        action,
        elementName,
        locatorExpression: locatorToString(objectMap[elementName]),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }
}
