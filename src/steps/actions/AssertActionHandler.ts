import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

// Quoted locator key(s) pattern supporting straight & curly quotes
const QUOTED_TEXT_REGEX = /[''']([^''']+)[''']/g;

type AssertionType =
  | 'visible'
  | 'hidden'
  | 'enabled'
  | 'disabled'
  | 'clickable'
  | 'unclickable'
  | 'checked'
  | 'unchecked';

/**
 * AssertActionHandler
 *
 * Handles assertion/verification actions in test cases. Validates element states
 * and content to ensure expected conditions are met.
 *
 * Supported Keywords: `assert`, `verify`, `check`
 *
 * Assertion Types:
 * | Type        | Keywords in Result                       | Description                          |
 * |-------------|------------------------------------------|--------------------------------------|
 * | visible     | `visible`, `displayed`                   | Element is visible on page (default) |
 * | hidden      | `hidden`, `not displayed`, `not visible` | Element is not visible               |
 * | enabled     | `enabled`                                | Element is enabled                   |
 * | disabled    | `disabled`                               | Element is disabled                  |
 * | clickable   | `clickable`                              | Element is both visible AND enabled  |
 * | unclickable | `unclickable`, `not clickable`           | Element is NOT clickable             |
 * | checked     | `checked`                                | Checkbox/radio is checked            |
 * | unchecked   | `unchecked`, `not checked`               | Checkbox/radio is unchecked          |
 *
 * Usage Examples:
 *
 * 1. State Assertions (using Result field):
 * | Action                          | Data              | Expected Result |
 * |---------------------------------|-------------------|-----------------|
 * | Assert 'Submit Button'          |                   | visible         |
 * | Verify 'Login Form'             |                   | displayed       |
 * | Assert 'Delete Button'          |                   | disabled        |
 * | Verify 'Continue Button'        |                   | clickable       |
 * | Assert 'Loading Spinner'        |                   | hidden          |
 * | Assert 'Remember Me Checkbox'   |                   | checked         |
 * | Verify 'Terms Checkbox'         |                   | unchecked       |
 *
 * 2. Value/Content Assertions (using Data field):
 * | Action                          | Data               | Expected Result |
 * |---------------------------------|--------------------|-----------------|
 * | Assert 'Welcome Message'        | Hello, John        | visible         |
 * | Verify 'Error Message'          | Invalid credentials| displayed       |
 * | Assert 'Total Price'            | $99.99             |                 |
 *
 * 3. Multiple Elements:
 * | Action                                       | Data | Expected Result |
 * |----------------------------------------------|------|-----------------|
 * | Assert 'Username Field' and 'Password Field' |      | enabled         |
 *
 * 4. Default Behavior (no result = visible):
 * | Action                          | Data | Expected Result |
 * |---------------------------------|------|-----------------|
 * | Assert 'Dashboard Header'       |      |                 |
 *
 * Key Features:
 * - Multi-locator fallback: Tries all locators in objectMap for the element
 * - Value assertion: Can verify element content contains expected text
 * - Case-insensitive: Both keywords and value matching are case-insensitive
 * - Network wait: Waits for `networkidle` before assertions
 * - Multiple elements: Supports asserting multiple quoted elements in one action
 *
 * @since 1.0.0
 */
export class AssertActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    return /assert|verify/i.test(action);
  }

  async execute(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    const page = this.page;

    try {
      const locatorKeys = [...action.matchAll(QUOTED_TEXT_REGEX)].map((m) => m[1]);
      if (locatorKeys.length === 0) {
        throw new Error(`No quoted locator key found in action: '${action}'`);
      }

      const expectationRaw = (step?.result ?? result ?? '').toString().trim();
      const assertionType = this.resolveAssertionType(expectationRaw);
      logger.info(
        `Assertion expectation resolved to '${assertionType}'${expectationRaw ? ` from "${expectationRaw}"` : ''}.`
      );

      // Determine if we have a value/content expectation (data field)
      const valueExpectationRaw = (step?.data ?? data ?? '').toString().trim();
      const hasValueExpectation = valueExpectationRaw.length > 0;
      if (hasValueExpectation) {
        logger.info(
          `[AssertActionHandler] Value expectation detected -> will assert element content contains: "${valueExpectationRaw}"`
        );
      }

      for (const key of locatorKeys) {
        const exprList = objectMap[key];
        if (!exprList || exprList.length === 0) {
          throw new Error(`Locator '${key}' not found in objectMap.`);
        }

        let asserted = false;
        const errors: string[] = [];

        for (const [index, expr] of exprList.entries()) {
          try {
            const locator = await this.getLocator(expr);
            // retain requested network idle wait
            await page.waitForLoadState('networkidle');
            await this.assertLocator(locator, assertionType, key);

            if (hasValueExpectation) {
              const actualValue = await this.getLocatorValue(locator);
              if (!this.valueContains(actualValue, valueExpectationRaw)) {
                throw new Error(
                  `Value/content mismatch for '${key}'. Expected to contain "${valueExpectationRaw}" but actual was "${actualValue}"`
                );
              }
              logger.info(
                `[AssertActionHandler] ✅ Value assertion passed — '${key}' content contains expected substring.`
              );
            }

            logger.info(`[AssertActionHandler] ✅ State assertion passed — '${key}' satisfies '${assertionType}'.`);
            asserted = true;
            break; // stop at first success for this key
          } catch (err: any) {
            const message = err?.message || String(err);
            logger.warn(
              `[AssertActionHandler] Locator #${index + 1} failed for '${key}' (${assertionType}): ${message}`
            );
            errors.push(`#${index + 1}: ${message}`);
          }
        }

        if (!asserted) {
          throw new Error(
            `All locators for '${key}' failed (assertion: ${assertionType}). Details: ${errors.join(' | ')}`
          );
        }
      }

      return true;
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }

      // Extract element names for error context
      const quotedMatches = action.match(/['''']([^''']+)[''']/g);
      const elementNames = quotedMatches ? quotedMatches.map((m) => m.replace(/[''']/g, '')) : [];

      // Enrich error with context
      const pageCtx = await getPageContext(this.page);
      throw formatStepError(error, {
        handler: 'AssertActionHandler',
        action,
        elementName: elementNames.join(', '),
        locatorExpression: elementNames.map((e) => locatorToString(objectMap[e])),
        inputData: typeof data === 'string' ? data : JSON.stringify(data),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }

  private resolveAssertionType(expectation: string): AssertionType {
    const normalized = expectation.toLowerCase();

    if (normalized.match(/unclickable|not clickable/)) return 'unclickable';
    if (normalized.includes('clickable')) return 'clickable';
    if (normalized.includes('enabled')) return 'enabled';
    if (normalized.includes('disabled')) return 'disabled';
    if (normalized.match(/hidden|not displayed|not visible/)) return 'hidden';
    if (normalized.match(/displayed|visible/)) return 'visible';
    if (normalized.match(/unchecked|not checked/)) return 'unchecked';
    if (normalized.includes('checked')) return 'checked';

    // Default behavior: element should be visible
    return 'visible';
  }

  private async assertLocator(locator: any, assertionType: AssertionType, elementKey: string): Promise<void> {
    switch (assertionType) {
      case 'enabled':
        if (!(await locator.isEnabled())) throw new Error(`Element '${elementKey}' is not enabled.`);
        break;
      case 'disabled':
        if (!(await locator.isDisabled())) throw new Error(`Element '${elementKey}' is not disabled.`);
        break;
      case 'clickable': {
        const [visible, enabled] = await Promise.all([locator.isVisible(), locator.isEnabled()]);
        if (!visible || !enabled) {
          throw new Error(`Element '${elementKey}' not clickable (visible=${visible}, enabled=${enabled}).`);
        }
        break;
      }
      case 'unclickable': {
        const [visible, enabled] = await Promise.all([locator.isVisible(), locator.isEnabled()]);
        if (visible && enabled) throw new Error(`Element '${elementKey}' clickable (expected unclickable).`);
        break;
      }
      case 'visible':
        if (!(await locator.isVisible())) throw new Error(`Element '${elementKey}' not visible.`);
        break;
      case 'hidden':
        if (await locator.isVisible()) throw new Error(`Element '${elementKey}' visible (expected hidden).`);
        break;
      case 'checked':
        if (!(await locator.isChecked())) throw new Error(`Element '${elementKey}' not checked.`);
        break;
      case 'unchecked':
        if (await locator.isChecked()) throw new Error(`Element '${elementKey}' checked (expected unchecked).`);
        break;
      default:
        throw new Error(`Unknown assertion type '${assertionType}'.`);
    }
  }

  private async getLocatorValue(locator: any): Promise<string> {
    // Try common properties: value attribute, input value, innerText, textContent
    try {
      // Note: The callback runs in browser context where Element exists
      const tagName = await locator.evaluate?.((el: any) => el.tagName.toLowerCase()).catch(() => undefined);
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        const val = await locator.inputValue().catch(() => undefined);
        if (val !== undefined) return val.trim();
      }
    } catch {
      /* ignore */
    }

    // Fallback to innerText
    try {
      const innerText = await locator.innerText().catch(() => undefined);
      if (innerText) return innerText.trim();
    } catch {
      /* ignore */
    }

    // Fallback to textContent
    try {
      const textContent = await locator.textContent().catch(() => undefined);
      if (textContent) return textContent.trim();
    } catch {
      /* ignore */
    }

    return '';
  }

  private valueContains(actual: string, expectedSub: string): boolean {
    return actual.toLowerCase().includes(expectedSub.toLowerCase());
  }
}
