import { BaseActionHandler } from '../BaseActionHandler';
import { Page, Locator } from '@playwright/test';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { LocatorResolver } from '../LocatorResolver';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';
import { getValue } from '../../data/storeManager';

// Custom error classes for better error handling
class AssertionError extends Error {
  constructor(
    message: string,
    public readonly key?: string,
    public readonly assertionType?: AssertionType
  ) {
    super(message);
    this.name = 'AssertionError';
  }
}

class LocatorNotFoundError extends Error {
  constructor(key: string) {
    super(`Locator '${key}' not found in objectMap`);
    this.name = 'LocatorNotFoundError';
  }
}

type VerifyOptions = {
  exact?: boolean;
  caseSensitive?: boolean;
  match?: 'contains' | 'equals';
  itemSelector?: string;
  mode?: 'auto' | 'message' | 'value';
  visibleTimeoutMs?: number;
  attachedTimeoutMs?: number;
};

type AssertionType =
  | 'visible'
  | 'hidden'
  | 'enabled'
  | 'disabled'
  | 'clickable'
  | 'unclickable'
  | 'checked'
  | 'unchecked';

// Regex pattern for extracting quoted text (supports various quote types)
const QUOTED_TEXT_REGEX = /[‘'’"“”]([^‘'’"“”]+)[‘'’"“”]/g;

/**
 * ValidationAssertActionHandler
 *
 * Combined handler for both validation and assertion operations.
 * Supports content validation (ValidateActionHandler) and state assertions (AssertActionHandler).
 *
 * Supported Keywords: `validate`, `assert`, `verify`, `check`
 *
 * == ROUTING LOGIC ==
 * - If Data field contains a value → Uses VALIDATION mode (content/value checking)
 * - If Data field is empty/null → Uses ASSERTION mode (element state checking)
 *
 * == VALIDATION MODE (when Data field has a value) ==
 * Validates element text content, input values, or messages against expected values.
 * Supports flexible matching options including exact, contains, and case-sensitive comparisons.
 *
 * Validation Usage Examples:
 * | Action                              | Data                        | Expected Result                      |
 * |-------------------------------------|-----------------------------|------------------------------------||
 * | Validate 'Success Message'          | Order placed successfully   | Text matches expected message        |
 * | Assert 'Total Price'                | $150.00                     | Price value is validated             |
 * | Check 'Error Message'               | {{expectedError}}           | Validates against stored value       |
 * | Verify 'Item 1' and 'Item 2'        | Apple, Orange               | Multiple fields validated            |
 * | Validate 'Dropdown Value'           | Option A; Option B          | Validates dropdown selections        |
 * | Validate mandatory 'Username'       | john.doe                    | Throws error if validation fails     |
 *
 * Validation Behavior:
 * - Without 'mandatory': Validation failures log warnings and test continues
 * - With 'mandatory': Validation failures throw errors and fail the test
 * - Supports multi-locator fallback for reliability
 * - Handles complex data structures (arrays, objects, parameters)
 * - Flexible value parsing with quote preservation
 *
 * == ASSERTION MODE (when Data field is empty) ==
 * Handles assertion/verification actions in test cases. Validates element states
 * and content to ensure expected conditions are met.
 *
 * Assertion Behavior:
 * - Without 'mandatory': Assertion failures log warnings and test continues
 * - With 'mandatory': Assertion failures throw errors and fail the test
 * - Supports multi-locator fallback for reliability
 * - Enhanced error messages with element context
 *
 * Assertion Types:
 * | Type        | Keywords Detected                                      | Description                          |
 * |-------------|---------------------------------------------------------|--------------------------------------|
 * | visible     | `visible`, `displayed`, `shown`, `present`             | Element is visible on page (default) |
 * | hidden      | `hidden`, `not displayed`, `not visible`, `invisible`  | Element is not visible               |
 * | enabled     | `enabled`, `active`                                     | Element is enabled                   |
 * | disabled    | `disabled`, `inactive`                                  | Element is disabled                  |
 * | clickable   | `clickable`, `interactive`                              | Element is both visible AND enabled  |
 * | unclickable | `unclickable`, `not clickable`, `non-interactive`      | Element is NOT clickable             |
 * | checked     | `checked`, `selected`, `ticked`                         | Checkbox/radio is checked            |
 * | unchecked   | `unchecked`, `not checked`, `unselected`, `unticked`   | Checkbox/radio is unchecked          |
 *
 * Assertion Usage Examples:
 * | Action                          | Data | Expected Result |
 * |---------------------------------|------|-----------------|
 * | Assert 'Submit Button'          |      | visible         |
 * | Verify 'Login Form'             |      | displayed       |
 * | Check 'Delete Button'           |      | disabled        |
 * | Validate 'Continue Button'      |      | clickable       |
 * | Assert 'Loading Spinner'        |      | hidden          |
 * | Verify 'Remember Me Checkbox'   |      | checked         |
 * | Check 'Terms Checkbox'          |      | unchecked       |
 * | Assert mandatory 'Submit Button'|      | visible         |
 * | Verify mandatory 'Login Form'   |      | displayed       |
 *
 * **Note**: If the expectation doesn't match any keywords, it defaults to 'visible' with a warning log.
 *
 * == ERROR HANDLING ==
 * - **Validation Failures**: Controlled by 'mandatory' keyword
 *   - Mandatory: Throws errors, fails test
 *   - Non-mandatory: Logs warnings, test continues
 * - **Assertion Failures**: Controlled by 'mandatory' keyword
 *   - Mandatory: Throws errors, fails test
 *   - Non-mandatory: Logs warnings, test continues
 * - **Element Validation**: Checks if elements support required properties (disabled, checked)
 * - **Locator Fallbacks**: Multi-locator support with detailed error reporting
 *
 * == KEY FEATURES ==
 * - Unified handler for both validation and assertion operations
 * - Intelligent routing based on data presence (not keywords)
 * - Maintains full backward compatibility with existing ValidateActionHandler and AssertActionHandler
 * - Comprehensive logging with handler-specific prefixes
 * - Multi-locator fallback for reliability
 * - Flexible data parsing and resolution
 * - Enhanced error messages with context
 * - Property validation for element compatibility
 * - Warning system for unrecognized expectations
 *
 * @since 1.0.0
 */
export class ValidationAssertActionHandler extends BaseActionHandler {
  private dataResolver: DataResolver;
  private locatorManager: LocatorManager;

  constructor(page: Page, locatorResolver: LocatorResolver) {
    super(page, locatorResolver);
    this.dataResolver = new DataResolver(ValidationAssertActionHandler.resolveData);
    this.locatorManager = new LocatorManager(this.page, locatorResolver);
  }

  /**
   * Lightweight data resolver that replaces the StepExecutor dependency.
   * Resolves bracket-notation variables like [orderId] from the store,
   * or returns the input as-is.
   */
  private static async resolveData(input: string): Promise<string> {
    const bracketMatch = /^\[(.+?)\]$/.exec(input.trim());
    if (bracketMatch) {
      const varName = bracketMatch[1];
      const value = getValue(varName);
      if (value === undefined) {
        throw new Error(
          `No stored value found for variable '${varName}'. ` +
          `Make sure the value was stored in a previous test case.`
        );
      }
      logger.info(`[ValidationAssertActionHandler] Resolved variable [${varName}] → ${value}`);
      return String(value);
    }
    return input;
  }
  /**
   * Determines if this handler can process the given action based on supported keywords.
   *
   * This handler supports validation and assertion actions that start with specific keywords.
   * It checks the first word of the action string against the supported action types.
   *
   * @param action - The action string to evaluate
   * @returns boolean - True if the action starts with a supported keyword, false otherwise
   *
   * @example
   * canHandle('validate "field" contains') // returns true
   * canHandle('assert "button" is visible') // returns true
   * canHandle('click "button"') // returns false
   */
  canHandle(action: string): boolean {
    const firstWord = action.trim().split(' ')[0].toLowerCase();
    return firstWord === 'validate' || firstWord === 'assert' || firstWord === 'verify' || firstWord === 'check';
  }

  /**
   * Main execution method that routes actions to appropriate handlers based on keywords and data presence.
   *
   * This method supports multiple keywords (validate, assert, verify, check) and routes to either
   * validation (content checking) or assertion (state checking) based on whether data is provided.
   * When data is present, it performs content validation. When no data is provided, it performs
   * state assertions (visible, enabled, etc.).
   *
   * @param action - The action string starting with validate/assert/verify/check keyword
   * @param data - Optional data for content validation (when present, triggers validation mode)
   * @param result - Optional result data (used for assertion type resolution)
   * @param step - Optional step context object
   * @returns Promise<boolean> - Returns true on success, throws on failure
   * @throws {Error} When unsupported action keyword is used
   *
   * @example
   * // Validation mode (with data) - checks content
   * await execute('validate "username" contains', 'john.doe');
   *
   * @example
   * // Assertion mode (no data) - checks state
   * await execute('assert "loginButton" should be visible');
   */
  async execute(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    const firstWord = action.trim().split(' ')[0].toLowerCase();

    // Check if action starts with supported keywords
    if (['assert', 'verify', 'check', 'validate'].includes(firstWord)) {
      // Route based on whether data contains a value
      const hasData = data !== undefined && data !== null && data !== '';
      if (hasData) {
        return this.executeValidation(action, data, result, step);
      } else {
        return this.executeAssertion(action, data, result, step);
      }
    }

    throw new Error(`Unsupported action keyword: ${firstWord}`);
  }

  // ===== VALIDATION LOGIC (from ValidateActionHandler) =====

  /**
   * Check if the action contains 'mandatory' keyword.
   * If mandatory is present, validation failures will throw errors and fail the test.
   * If mandatory is NOT present, validation failures will only log warnings.
   */
  /**
   * Determines if an action contains the 'mandatory' keyword for strict assertion behavior.
   *
   * When mandatory is present, assertion failures will throw errors and fail the test.
   * When mandatory is absent, assertion failures are logged as warnings and the test continues.
   *
   * @param action - The action string to check for the mandatory keyword
   * @returns boolean - True if 'mandatory' keyword is found (case-insensitive), false otherwise
   *
   * @example
   * isMandatory('"button" should be visible mandatory') // returns true
   * isMandatory('"button" should be visible') // returns false
   * isMandatory('"button" should be visible MANDATORY') // returns true
   */
  private isMandatory(action: string): boolean {
    return /\bmandatory\b/i.test(action);
  }

  /**
   * Execute validation operations (content/value checking).
   *
   * This method handles validation of element content against expected values.
   * It supports multiple validation modes (message, value) and flexible data parsing.
   *
   * @param action - The full action string containing locator keys and keywords
   * @param data - Expected data to validate against (can be string, array, or object)
   * @param result - Step result data (used as fallback for expected values)
   * @param step - Complete step object for context
   * @returns Promise<boolean> - True if validation passes, false if fails (based on mandatory flag)
   *
   * @throws {Error} When mandatory validation fails
   * @throws {LocatorNotFoundError} When locator keys are not found in objectMap
   * @throws {Error} For configuration errors or unexpected failures
   */
  private async executeValidation(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    const page = this.page;
    const isMandatory = this.isMandatory(action);

    /**
     * Handle validation failure based on whether 'mandatory' keyword is present.
     * - If mandatory: throw error to fail the test
     * - If not mandatory: log warning and return false (test continues)
     */
    const handleValidationFailure = (message: string): boolean => {
      if (isMandatory) {
        throw new Error(message);
      } else {
        logger.warn(`[ValidationAssertActionHandler] [VALIDATION WARNING] ${message}`);
        logger.warn(
          `[ValidationAssertActionHandler] [VALIDATION WARNING] Data mismatch detected but test continues as 'mandatory' keyword is not specified hence skipping the field `
        );
        return false;
      }
    };
    try {
      // 1) extract quoted locator keys (supports multiple quoted keys)
      const keys = [...action.matchAll(/[‘'’"“”]([^‘'’"“”]+)[‘'’"“”]/g)].map((m) => m[1]);
      if (keys.length === 0) {
        throw new Error(`No quoted locator key found in action: '${action}'`);
      }

      let expectedRaw: string[] = [];
      const options: VerifyOptions = {};
      options.visibleTimeoutMs = options.visibleTimeoutMs ?? TIMEOUTS.elementVisible;
      options.attachedTimeoutMs = options.attachedTimeoutMs ?? TIMEOUTS.elementAttached;

      // 2) Resolve expected messages/values from data (flexible)
      expectedRaw = await this.dataResolver.resolveExpectedData(data, step);

      if (!expectedRaw.length) {
        throw new Error(`No expected messages/values provided in data/step for action: '${action}'`);
      }

      // 3) Decide mode
      const modePref = options.mode || 'auto';
      let mode: 'message' | 'value' = 'message';

      const looksLikeValueMap = (() => {
        if (!expectedRaw || expectedRaw.length === 0) return false;
        if (expectedRaw.length === keys.length) return true;
        // single key + multiple expected => list/value mode
        if (keys.length === 1 && expectedRaw.length > 1) return true;
        return false;
      })();

      if (modePref === 'value') mode = 'value';
      else if (modePref === 'message') mode = 'message';
      else mode = looksLikeValueMap ? 'value' : 'message';

      // helpers
      const normalize = (s: string) => (s || '').toString().replace(/\s+/g, ' ').trim();
      const toComparable = (s: string) => (options.caseSensitive ? s : s.toLowerCase());
      const equalsMatch = (a: string, b: string) => a === b;
      const containsMatch = (hay: string, needle: string) => hay.includes(needle);
      const matcherFn = options.match === 'equals' ? equalsMatch : containsMatch;

      const ensureVisible = async (locator: any) => {
        await this.locatorManager.ensureVisible(locator, options);
      };

      // Collect UI texts from objectMap keys (message mode)
      const collectUITextsForKeys = async (): Promise<string[]> => {
        const collected: string[] = [];

        for (const key of keys) {
          const exprList = objectMap[key];
          if (!exprList || exprList.length === 0) {
            logger.warn(
              `[ValidationAssertActionHandler] Locator key '${key}' not found in objectMap - will attempt page-wide and label fallback.`
            );
            continue; // don't throw yet; try page-wide
          }

          let successForKey = false;
          for (const [index, expr] of exprList.entries()) {
            try {
              const baseLocator = await this.getLocator(expr);
              await ensureVisible(baseLocator).catch(() => {});
              await page.waitForLoadState('networkidle').catch(() => {});

              if (options.itemSelector) {
                const items = baseLocator.locator(options.itemSelector);
                const count = await items.count();
                for (let i = 0; i < count; i++) {
                  const t = await this.locatorManager.getTextContent(items.nth(i));
                  if (t) {
                    const lines = (t as string)
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    collected.push(...lines);
                  }
                }
              } else {
                const t = await this.locatorManager.getTextContent(baseLocator);
                if (t) {
                  const lines = (t as string)
                    .split(/\r?\n/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  collected.push(...lines);
                }
              }

              successForKey = true;
              break;
            } catch (err) {
              logger.warn(
                `[ValidationAssertActionHandler] Error locator #${index + 1} for key '${key}' failed: ${err}`
              );
              if (index === exprList.length - 1) {
                logger.warn(
                  `[ValidationAssertActionHandler] All locators for '${key}' failed (but will continue with fallback search).`
                );
              }
            }
          }
          if (!successForKey) {
            // continue to next key but do not throw; we will try page-wide fallback later
            continue;
          }
        }

        return collected;
      };

      // Value collection (supports single-key list mode and multi-key pairwise mode)
      const collectValuesForKeys = async (): Promise<string[]> => {
        const collectedVals: string[] = [];

        // If single key but multiple expected values -> list gathering
        if (keys.length === 1 && expectedRaw.length > 1) {
          const key = keys[0];
          const exprList = objectMap[key];
          if (!exprList || exprList.length === 0) {
            logger.warn(
              `[ValidationAssertActionHandler] Locator key '${key}' not found in objectMap - attempting label-based / page fallback for list items.`
            );
            // fallback: find elements by searching inside the container for expected texts
            // Try page-wide text search to collect occurrences (best-effort)
            for (const ex of expectedRaw) {
              const norm = normalize(ex);
              const loc = page.locator(`text="${norm}"`);
              const cnt = await loc.count().catch(() => 0);
              if (cnt > 0) {
                for (let i = 0; i < cnt; i++) {
                  const t = await loc
                    .nth(i)
                    .innerText()
                    .catch(() => '');
                  if (t) collectedVals.push(normalize(t));
                }
              }
            }
            return collectedVals;
          }

          // try each expr until we succeed finding list-like children
          for (const expr of exprList) {
            try {
              const baseLocator = await this.getLocator(expr);

              // First check if the base locator itself returns multiple elements (multi-element XPath/locator)
              let directCount = 0;
              try {
                directCount = await baseLocator.count();
              } catch {
                // If strict mode error, that's fine - we'll handle it below
                directCount = 0;
              }

              // If the locator directly matches multiple elements, collect all of them
              if (directCount > 1) {
                logger.info(
                  `[ValidationAssertActionHandler] Base locator '${expr}' matches ${directCount} elements. Collecting all texts/values.`
                );

                const temp: string[] = [];

                for (let i = 0; i < directCount; i++) {
                  try {
                    const item = baseLocator.nth(i);

                    // Wait for it to be attached & visible safely
                    await item.waitFor({ state: 'attached', timeout: TIMEOUTS.elementShort }).catch(() => {});
                    await item.waitFor({ state: 'visible', timeout: TIMEOUTS.elementShort }).catch(() => {});

                    // --- UNIVERSAL TEXT EXTRACTOR ---
                    // Note: The callback runs in browser context where HTMLElement, document, NodeFilter exist
                    const t = await item.evaluate((el: any) => {
                      if (!el) return '';

                      // Prefer visible text - works for Angular/React
                      const visibleText = el.innerText?.trim();
                      if (visibleText) return visibleText;

                      // Fallback: full DOM text
                      const fullText = el.textContent?.trim();
                      if (fullText) return fullText;

                      // If element contains nested spans/divs (common in PrimeNG picklist)
                      // el.ownerDocument is the document object in browser context
                      const walker = el.ownerDocument.createTreeWalker(el, 0x4 /* NodeFilter.SHOW_TEXT */);
                      const parts: string[] = [];
                      let node;
                      while ((node = walker.nextNode())) {
                        const s = node.textContent?.trim();
                        if (s) parts.push(s);
                      }
                      if (parts.length > 0) return parts.join(' ');

                      // Final fallback: value attribute
                      if (el.value) return el.value.toString().trim();

                      return '';
                    });

                    if (t && t.trim().length > 0) {
                      const cleaned = normalize(t);
                      temp.push(cleaned);
                      logger.info(`[ValidationAssertActionHandler] Collected text from element ${i}: '${cleaned}'`);
                    } else {
                      logger.warn(
                        `[ValidationAssertActionHandler] Empty text collected from element ${i} of '${expr}'.`
                      );
                    }
                  } catch (err) {
                    logger.warn(
                      `[ValidationAssertActionHandler] Failed to collect text from element ${i} of '${expr}': ${err}`
                    );
                  }
                }

                if (temp.length > 0) {
                  logger.info(
                    `[ValidationAssertActionHandler] Successfully collected ${temp.length} values from multi-element locator: ${JSON.stringify(temp)}`
                  );

                  // Store collected values as a list
                  collectedVals.push(...temp);
                  break;
                } else {
                  logger.error(
                    `[ValidationAssertActionHandler] Collected 0 values from multi-element locator '${expr}'`
                  );
                }
              }

              // Skip child selector search if we already collected values from multi-element locator
              if (collectedVals.length > 0) {
                break;
              }

              // If single element or count check failed, try ensuring visible and then child selectors
              await ensureVisible(baseLocator).catch(() => {});

              // prefer an itemSelector if provided
              const selectorsToTry = [
                options.itemSelector,
                'app-rt-grid-cell',
                '.rt-grid__cell',
                'tr td',
                'td',
                'div',
              ].filter(Boolean) as string[];

              let foundChildren: string[] = [];
              for (const sel of selectorsToTry) {
                try {
                  const items = baseLocator.locator(sel);
                  const count = await items.count();
                  if (count === 0) continue;
                  const temp: string[] = [];
                  for (let i = 0; i < count; i++) {
                    const t = await this.locatorManager.getTextContent(items.nth(i));
                    if (t) temp.push(normalize(t));
                  }
                  if (temp.length >= expectedRaw.length || temp.length > 0) {
                    foundChildren = temp;
                    break;
                  }
                } catch {
                  continue;
                }
              }

              if (!foundChildren.length) {
                // fallback: read whole container and split by separators
                const whole = await this.locatorManager.getTextContent(baseLocator);
                if (whole) {
                  const parts = (whole as string)
                    .split(/[,;|]\s*/)
                    .map((s) => normalize(s))
                    .filter(Boolean);
                  if (parts.length) foundChildren = parts;
                }
              }

              if (foundChildren.length) {
                // if more than expected, trim; if less, still return what we have (best-effort)
                for (const t of foundChildren.slice(0, expectedRaw.length)) collectedVals.push(t);
                break;
              }
            } catch (err) {
              logger.warn(
                `[ValidationAssertActionHandler] Value retrieval attempt for '${key}' using expr '${expr}' failed: ${err}`
              );
              continue;
            }
          }

          return collectedVals;
        }

        // Pairwise (one value per key)
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const exprList = objectMap[key];
          let got = false;

          if (!exprList || exprList.length === 0) {
            logger.warn(
              `[ValidationAssertActionHandler] Locator key '${key}' not found in objectMap - trying label-based lookup for value.`
            );
            // try label-based: find label text and then nearby value element
            try {
              const labelLocator = page.locator(`label:has-text("${key}")`);
              if ((await labelLocator.count()) > 0) {
                const lbl = labelLocator.first();
                // attempt sibling/input following the label
                const nearby = lbl.locator('xpath=..').locator('input,span,div,textarea,select').first();
                if ((await nearby.count()) > 0) {
                  await ensureVisible(nearby).catch(() => {});
                  const t = await nearby
                    .evaluate((el: any) => el?.value ?? el?.innerText ?? el?.textContent ?? '')
                    .catch(() => '');
                  collectedVals.push(normalize(String(t ?? '')));
                  got = true;
                }
              }
            } catch (err) {
              logger.warn(`[ValidationAssertActionHandler] Label-based lookup for '${key}' failed: ${err}`);
            }

            // last fallback: page-wide search for the expected text itself
            if (!got) {
              const maybe = expectedRaw[i] ?? expectedRaw[0];
              if (maybe) {
                const loc = page.locator(`text="${normalize(maybe)}"`);
                if ((await loc.count()) > 0) {
                  collectedVals.push(
                    normalize(
                      await loc
                        .first()
                        .innerText()
                        .catch(() => '')
                    )
                  );
                  got = true;
                }
              }
            }

            if (!got) {
              // push empty so indices match
              collectedVals.push('');
              continue;
            } else continue;
          }

          // try configured expressions for this key
          for (const expr of exprList) {
            try {
              const locator = await this.getLocator(expr);
              await ensureVisible(locator);
              const val = await locator
                .evaluate((el: any) => {
                  if (!el) return '';
                  if ('value' in el && el.value !== undefined && el.value !== null) return el.value;
                  const child = el.querySelector && el.querySelector('input,textarea,select');
                  if (child && child.value !== undefined) return child.value;
                  if (el.checked !== undefined) return el.checked ? 'true' : 'false';
                  if (el.getAttribute) {
                    const aria =
                      el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('aria-valuetext');
                    if (aria) return aria;
                  }
                  return el.innerText || el.textContent || '';
                })
                .catch(() => '');
              collectedVals.push(normalize(String(val ?? '')));
              got = true;
              break;
            } catch (err) {
              logger.warn(
                `[ValidationAssertActionHandler] Value retrieval failed for locator '${expr}' of '${key}': ${err}`
              );
              continue;
            }
          }

          if (!got) {
            // push empty to maintain alignment
            collectedVals.push('');
          }
        }

        return collectedVals;
      };

      // normalize expected for comparison
      const expectedNorm = expectedRaw.map(normalize).filter(Boolean);
      const expectedComp = expectedNorm.map(toComparable);

      if (mode === 'message') {
        // try collecting messages from configured locators
        const collectedTexts = await collectUITextsForKeys().catch((err) => {
          logger.warn(`[ValidationAssertActionHandler] Configured-locators collection threw: ${err}`);
          return [] as string[];
        });

        // fallback page-wide search for each expected message
        if (!collectedTexts.length) {
          for (const e of expectedRaw) {
            const eNorm = normalize(e);
            if (!eNorm) continue;
            try {
              const loc = page.locator(`text="${eNorm}"`);
              const count = await loc.count().catch(() => 0);
              if (count > 0) {
                for (let i = 0; i < count; i++) {
                  const t = await loc
                    .nth(i)
                    .innerText()
                    .catch(() => '');
                  if (t) {
                    const lines = (t as string)
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    collectedTexts.push(...lines);
                  }
                }
              }
            } catch (err) {
              logger.warn(`[ValidationAssertActionHandler] Fallback text search for '${eNorm}' threw: ${err}`);
            }
          }
        }

        if (!collectedTexts.length) {
          // if shape suggests values, switch to value mode
          if (looksLikeValueMap) {
            logger.warn(
              `[ValidationAssertActionHandler] No UI error text found; switching to 'value' mode due to expected shape.`
            );
            mode = 'value';
          } else {
            return handleValidationFailure(`No UI error text collected from keys: [${keys.join(', ')}].`);
          }
        } else {
          const uiSetRaw = collectedTexts.map(normalize).filter(Boolean);
          const uiSet = uiSetRaw.map(toComparable);

          const missing: string[] = [];
          const unexpected: string[] = [];
          for (let i = 0; i < expectedComp.length; i++) {
            const e = expectedComp[i];
            const ok = uiSet.some((u) => matcherFn(u, e));
            if (!ok) missing.push(expectedNorm[i]);
          }

          if (options.exact) {
            for (let i = 0; i < uiSet.length; i++) {
              const u = uiSet[i];
              const ok = expectedComp.some((e) => matcherFn(u, e));
              if (!ok) unexpected.push(uiSetRaw[i]);
            }
          }

          if (missing.length || unexpected.length) {
            const details = [
              missing.length ? `Missing:\n- ${missing.join('\n- ')}` : '',
              unexpected.length ? `Unexpected in UI:\n- ${unexpected.join('\n- ')}` : '',
              `UI Collected (${uiSetRaw.length}):\n- ${uiSetRaw.join('\n- ')}`,
            ]
              .filter(Boolean)
              .join('\n\n');

            return handleValidationFailure(`Error message verification failed.\n${details}`);
          }

          logger.info(
            `[ValidationAssertActionHandler] Verified ${isMandatory ? 'mandatory ' : ''}error messages successfully. Expected (${expectedNorm.length}):\n- ${expectedNorm.join('\n- ')}`
          );
          return true;
        }
      }

      // value mode
      if (mode === 'value') {
        if (!expectedRaw.length) {
          throw new Error(`No expected values provided for value-verification for keys: [${keys.join(', ')}]`);
        }

        // normalize expectedValues to match keys shape or list-mode
        let expectedValues: string[] = [];
        if (expectedRaw.length === 1 && keys.length > 1) {
          expectedValues = Array(keys.length).fill(expectedRaw[0]);
        } else if (keys.length === 1 && expectedRaw.length > 1) {
          expectedValues = expectedRaw.slice(0);
        } else if (expectedRaw.length === keys.length) {
          expectedValues = expectedRaw.slice(0, keys.length);
        } else {
          if (expectedRaw.length === 1) {
            expectedValues = Array(keys.length).fill(expectedRaw[0]);
          } else {
            throw new Error(
              `Expected value count (${expectedRaw.length}) does not match locator key count (${keys.length}).`
            );
          }
        }

        const uiValues = await collectValuesForKeys();

        if (!uiValues.length) {
          return handleValidationFailure(`No UI values collected for keys: [${keys.join(', ')}]`);
        }

        // Single key with single expected value - direct comparison (most common case)
        if (keys.length === 1 && expectedValues.length === 1 && uiValues.length === 1) {
          const exp = normalize(expectedValues[0] ?? '');
          const got = normalize(uiValues[0] ?? '');
          const ok = matcherFn(toComparable(got), toComparable(exp));
          if (!ok) {
            return handleValidationFailure(
              `Value verification failed for '${keys[0]}': expected='${exp}' got='${got}'`
            );
          }
          logger.info(
            `[ValidationAssertActionHandler] Verified field value successfully for key '${keys[0]}'. UI Value: '${got}'`
          );
          return true;
        }

        // list-mode compare (single key -> multiple expected items)
        if (keys.length === 1 && expectedValues.length > 1) {
          const missing: string[] = [];
          for (let i = 0; i < expectedValues.length; i++) {
            const exp = normalize(expectedValues[i] ?? '');
            const got = normalize(uiValues[i] ?? '');
            const ok = matcherFn(toComparable(got), toComparable(exp));
            if (!ok) missing.push(`index ${i}: expected='${exp}' got='${got}'`);
          }
          if (missing.length) {
            return handleValidationFailure(`List value verification failed:\n- ${missing.join('\n- ')}`);
          }
          logger.info(
            `[ValidationAssertActionHandler] Verified list values successfully for key '${keys[0]}'. UI Values: ${JSON.stringify(uiValues)}`
          );
          return true;
        }

        // pairwise compare
        const missing: string[] = [];
        for (let i = 0; i < expectedValues.length; i++) {
          const key = keys[i] ?? `index_${i}`;
          const uiRaw = normalize(uiValues[i] ?? '');
          const expectedRawVal = normalize(expectedValues[i] ?? '');
          const uiComp = toComparable(uiRaw);
          const expectedCompVal = toComparable(expectedRawVal);
          const ok = matcherFn(uiComp, expectedCompVal);
          if (!ok) missing.push(`'${key}': expected='${expectedRawVal}' got='${uiRaw}'`);
        }

        if (missing.length) {
          return handleValidationFailure(`Value verification failed for fields:\n- ${missing.join('\n- ')}`);
        }

        logger.info(
          `Verified field values successfully for keys: [${keys.join(', ')}]. UI Values: ${JSON.stringify(uiValues)}`
        );
        return true;
      }

      throw new Error('Unable to determine verification mode.');
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
        handler: 'ValidationAssertActionHandler',
        action,
        elementName: elementNames.join(', '),
        locatorExpression: elementNames.map((e) => locatorToString(objectMap[e])),
        inputData: typeof data === 'string' ? data : JSON.stringify(data),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }

  // ===== ASSERTION LOGIC (from AssertActionHandler) =====

  /**
   * Resolve assertion type from expected result string.
   * Supports comprehensive keyword matching with logging for unrecognized inputs.
   */
  /**
   * Resolves the assertion type from a natural language expectation string.
   *
   * This method parses various synonyms and keywords to determine the intended assertion type.
   * It supports comprehensive keyword matching for different element states and provides
   * fallback behavior with logging when unrecognized expectations are encountered.
   *
   * @param expectation - The expectation string to parse (case-insensitive)
   * @returns AssertionType - The resolved assertion type, defaults to 'visible' if unrecognized
   *
   * @example
   * resolveAssertionType('should be visible') // returns 'visible'
   * resolveAssertionType('is displayed') // returns 'visible'
   * resolveAssertionType('not visible') // returns 'hidden'
   * resolveAssertionType('enabled') // returns 'enabled'
   * resolveAssertionType('can be clicked') // returns 'clickable'
   * resolveAssertionType('is checked') // returns 'checked'
   */
  private resolveAssertionType(expectation: string): AssertionType {
    const normalized = expectation.toLowerCase().trim();

    // Comprehensive keyword matching with synonyms
    if (
      normalized.includes('visible') ||
      normalized.includes('displayed') ||
      normalized.includes('shown') ||
      normalized.includes('present')
    ) {
      return 'visible';
    }
    if (
      normalized.includes('hidden') ||
      normalized.includes('not displayed') ||
      normalized.includes('not visible') ||
      normalized.includes('invisible')
    ) {
      return 'hidden';
    }
    if (normalized.includes('enabled') || normalized.includes('active')) {
      return 'enabled';
    }
    if (normalized.includes('disabled') || normalized.includes('inactive')) {
      return 'disabled';
    }
    if (normalized.includes('clickable') || normalized.includes('interactive')) {
      return 'clickable';
    }
    if (
      normalized.includes('unclickable') ||
      normalized.includes('not clickable') ||
      normalized.includes('non-interactive')
    ) {
      return 'unclickable';
    }
    if (normalized.includes('checked') || normalized.includes('selected') || normalized.includes('ticked')) {
      return 'checked';
    }
    if (
      normalized.includes('unchecked') ||
      normalized.includes('not checked') ||
      normalized.includes('unselected') ||
      normalized.includes('unticked')
    ) {
      return 'unchecked';
    }

    // Log warning when defaulting to visible
    logger.warn(
      `[ValidationAssertActionHandler] Unrecognized assertion expectation "${expectation}" - defaulting to 'visible'. Supported keywords: visible, hidden, enabled, disabled, clickable, unclickable, checked, unchecked`
    );
    return 'visible';
  }

  /**
   * Asserts a locator based on the specified assertion type with comprehensive validation.
   *
   * This method performs different types of assertions on a Playwright locator, including
   * visibility, interaction state, and checked state. Each assertion type includes appropriate
   * waiting and validation logic with detailed error messages.
   *
   * @param locator - The Playwright locator to assert on
   * @param assertionType - The type of assertion to perform
   * @param key - The locator key for error reporting context
   * @throws {AssertionError} When the assertion fails with enhanced error context
   * @throws {Error} When an unknown assertion type is provided
   *
   * @example
   * await assertLocator(locator, 'visible', 'submitButton');
   * await assertLocator(locator, 'enabled', 'inputField');
   * await assertLocator(locator, 'checked', 'checkbox');
   */
  private async assertLocator(locator: Locator, assertionType: AssertionType, key: string): Promise<void> {
    try {
      switch (assertionType) {
        case 'visible':
          await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.elementVisible });
          break;

        case 'hidden':
          await locator.waitFor({ state: 'hidden', timeout: TIMEOUTS.elementVisible });
          break;

        case 'enabled':
          // First ensure element is visible
          await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.elementVisible });

          // Then check if it's enabled (not disabled)
          await locator.evaluate((el: any) => {
            // Check if element supports disabled property
            if (el.disabled === undefined) {
              throw new Error(`Element does not support 'disabled' property - not applicable for 'enabled' assertion`);
            }
            if (el.disabled) {
              throw new Error('Element is disabled');
            }
          });
          break;

        case 'disabled':
          // First ensure element is visible
          await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.elementVisible });

          // Then check if it's disabled
          await locator.evaluate((el: any) => {
            // Check if element supports disabled property
            if (el.disabled === undefined) {
              throw new Error(`Element does not support 'disabled' property - not applicable for 'disabled' assertion`);
            }
            if (!el.disabled) {
              throw new Error('Element is not disabled');
            }
          });
          break;

        case 'clickable':
          // Element must be both visible AND enabled
          await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.elementVisible });

          await locator.evaluate((el: any) => {
            // Check if element supports disabled property
            if (el.disabled !== undefined && el.disabled) {
              throw new Error('Element is disabled');
            }
          });
          break;

        case 'unclickable':
          // Element must be visible but disabled (or not supporting disabled but we check anyway)
          await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.elementVisible });

          await locator.evaluate((el: any) => {
            // Check if element supports disabled property and is actually disabled
            if (el.disabled === undefined) {
              throw new Error(`Element does not support 'disabled' property - cannot be 'unclickable'`);
            }
            if (!el.disabled) {
              throw new Error('Element is not disabled');
            }
          });
          break;

        case 'checked':
          await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.elementVisible });

          await locator.evaluate((el: any) => {
            // Check if element supports checked property
            if (el.checked === undefined) {
              throw new Error(`Element does not support 'checked' property - not applicable for 'checked' assertion`);
            }
            if (!el.checked) {
              throw new Error('Element is not checked');
            }
          });
          break;

        case 'unchecked':
          await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.elementVisible });

          await locator.evaluate((el: any) => {
            // Check if element supports checked property
            if (el.checked === undefined) {
              throw new Error(`Element does not support 'checked' property - not applicable for 'unchecked' assertion`);
            }
            if (el.checked) {
              throw new Error('Element is checked');
            }
          });
          break;

        default:
          throw new Error(`Unknown assertion type: ${assertionType}`);
      }
    } catch (error: any) {
      // Enhance error messages with context
      const enhancedMessage = `Assertion failed for '${key}' (${assertionType}): ${error.message}`;
      logger.error(`[ValidationAssertActionHandler] ${enhancedMessage}`);
      throw new AssertionError(enhancedMessage, key, assertionType);
    }
  }

  /**
   * Checks if the actual value contains the expected value (case-insensitive substring match).
   *
   * This method performs a case-insensitive search to determine if the expected string
   * is contained within the actual string. Used for value/content assertions.
   *
   * @param actual - The actual value from the element
   * @param expected - The expected substring to find
   * @returns boolean - True if the expected string is found (case-insensitive), false otherwise
   *
   * @example
   * valueContains('Hello World', 'world') // returns true
   * valueContains('Hello World', 'WORLD') // returns true
   * valueContains('Hello World', 'foo') // returns false
   */
  private valueContains(actual: string, expected: string): boolean {
    return actual.toLowerCase().includes(expected.toLowerCase());
  }

  /**
   * Executes an assertion on one or more locators based on the provided action string.
   *
   * This method handles both state assertions (e.g., visible, enabled, checked) and value assertions
   * (content validation). It supports multiple locators per key and fails over to the next locator
   * if the first one fails. The behavior on assertion failure depends on whether the 'mandatory'
   * keyword is present in the action.
   *
   * @param action - The action string containing locator keys in quotes and optional 'mandatory' keyword
   * @param data - Optional data containing value expectations for content validation
   * @param result - Optional result string used to determine assertion type
   * @param step - Optional step object containing additional context (result, data fields)
   * @returns Promise<boolean> - Returns true if all assertions pass, false if non-mandatory assertion fails
   * @throws {Error} When mandatory assertion fails or critical errors occur (no locators, invalid assertion type)
   * @throws {Error} When locator resolution fails
   * @throws {AssertionError} When assertion logic fails
   *
   * @example
   * // State assertion - check if element is visible
   * await executeAssertion('"loginButton" should be visible');
   *
   * @example
   * // Value assertion - check element contains specific text
   * await executeAssertion('"username" should be visible', 'john.doe');
   *
   * @example
   * // Mandatory assertion - will throw error if fails
   * await executeAssertion('"loginButton" should be visible mandatory');
   */
  private async executeAssertion(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    const page = this.page;
    const isMandatory = this.isMandatory(action);

    /**
     * Handle assertion failure based on whether 'mandatory' keyword is present.
     * - If mandatory: throw error to fail the test
     * - If not mandatory: log warning and return false (test continues)
     */
    const handleAssertionFailure = (message: string): boolean => {
      if (isMandatory) {
        throw new Error(message);
      } else {
        logger.warn(`[ValidationAssertActionHandler] [ASSERTION WARNING] ${message}`);
        logger.warn(
          `[ValidationAssertActionHandler] [ASSERTION WARNING] Assertion failed but test continues as 'mandatory' keyword is not specified hence skipping the assertion`
        );
        return false;
      }
    };

    const locatorKeys = [...action.matchAll(QUOTED_TEXT_REGEX)].map((m) => m[1]);
    if (locatorKeys.length === 0) {
      return handleAssertionFailure(`No quoted locator key found in action: '${action}'`);
    }

    const expectationRaw = (step?.result ?? result ?? '').toString().trim();
    const assertionType = this.resolveAssertionType(expectationRaw);
    logger.info(
      `[ValidationAssertActionHandler] Assertion expectation resolved to '${assertionType}'${expectationRaw ? ` from "${expectationRaw}"` : ''}.`
    );

    // Determine if we have a value/content expectation (data field)
    const valueExpectationRaw = (step?.data ?? data ?? '').toString().trim();
    const hasValueExpectation = valueExpectationRaw.length > 0;
    if (hasValueExpectation) {
      logger.info(
        `[ValidationAssertActionHandler] Value expectation detected -> will assert element content contains: "${valueExpectationRaw}"`
      );
    }

    for (const key of locatorKeys) {
      const exprList = objectMap[key];
      if (!exprList || exprList.length === 0) {
        return handleAssertionFailure(`Locator '${key}' not found in objectMap.`);
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
            const actualValue = await this.locatorManager.getLocatorValue(locator);
            if (!this.valueContains(actualValue, valueExpectationRaw)) {
              throw new Error(
                `Value/content mismatch for '${key}'. Expected to contain "${valueExpectationRaw}" but actual was "${actualValue}"`
              );
            }
            logger.info(
              `[ValidationAssertActionHandler] ✅ Value assertion passed — '${key}' content contains expected substring.`
            );
          }

          logger.info(
            `[ValidationAssertActionHandler] ✅ State assertion passed — '${key}' satisfies '${assertionType}'.`
          );
          asserted = true;
          break; // stop at first success for this key
        } catch (err: any) {
          const message = err?.message || String(err);
          logger.warn(
            `[ValidationAssertActionHandler] Locator #${index + 1} failed for '${key}' (${assertionType}): ${message}`
          );
          errors.push(`#${index + 1}: ${message}`);
        }
      }

      if (!asserted) {
        return handleAssertionFailure(
          `All locators for '${key}' failed (assertion: ${assertionType}). Details: ${errors.join(' | ')}`
        );
      }
    }

    return true;
  }
}

/**
 * Utility class for resolving and parsing test data
 */
class DataResolver {
  constructor(private resolveData: (input: string) => Promise<string>) {}

  async resolveExpectedData(data?: any, step?: any): Promise<string[]> {
    let expectedRaw: string[] = [];

    // 2) Resolve expected messages/values from data (flexible)
    if (Array.isArray(data)) {
      const raw = [...data];
      if (raw.length && typeof raw[raw.length - 1] === 'object' && !Array.isArray(raw[raw.length - 1])) {
        raw.pop(); // Remove options object if present
      }
      expectedRaw = await Promise.all(raw.map((d) => this.resolveData(String(d))));
    } else if (typeof data === 'string' || typeof data === 'number') {
      // preserve quoted fragments
      const parsed = this.parseValuesPreserveQuotes(String(data));
      expectedRaw = await Promise.all(parsed.map((p) => this.resolveData(p)));
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.messages)) {
        expectedRaw = await Promise.all(data.messages.map((d: any) => this.resolveData(String(d))));
      } else if (typeof data.messages === 'string' || typeof data.messages === 'number') {
        const parsed = this.parseValuesPreserveQuotes(String(data.messages));
        expectedRaw = await Promise.all(parsed.map((p) => this.resolveData(p)));
      } else if (Array.isArray(data.parameters) && data.parameters.length) {
        const vals: string[] = [];
        for (const p of data.parameters) {
          if (p?.value !== undefined) vals.push(await this.resolveData(String(p.value)));
        }
        expectedRaw = vals;
      }
    } else if (step?.result) {
      expectedRaw = [await this.resolveData(String(step.result))];
    }

    return expectedRaw;
  }

  /**
   * Parse a raw string into values while preserving quoted fragments.
   */
  private parseValuesPreserveQuotes(raw: string): string[] {
    if (!raw) return [];
    // First check: if no semicolon or pipe, treat the whole thing as a single value
    const hasSemicolonOrPipe = /[;|]/.test(raw);
    if (!hasSemicolonOrPipe) {
      // Single value - preserve commas as decimal separators
      const trimmed = raw.trim();
      if (!trimmed) return [];
      // Strip surrounding quotes if any
      if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return [trimmed.slice(1, -1).trim()];
      }
      return [trimmed];
    }

    // Multiple values: split by semicolon or pipe only (not comma)
    const out: string[] = [];
    let cur = '';
    let inQuote: string | null = null;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"' || ch === "'") {
        if (!inQuote) {
          inQuote = ch;
          continue;
        } else if (inQuote === ch) {
          inQuote = null;
          continue;
        }
      }

      if (!inQuote && (ch === ';' || ch === '|')) {
        const trimmed = cur.trim();
        if (trimmed) out.push(trimmed);
        cur = '';
        continue;
      }

      cur += ch;
    }

    const last = cur.trim();
    if (last) out.push(last);

    // Strip surrounding quotes if any
    return out
      .map((v) => {
        const t = v.trim();
        if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
          return t.slice(1, -1).trim();
        }
        return t;
      })
      .filter(Boolean);
  }
}

/**
 * Utility class for managing locator operations and fallbacks
 */
class LocatorManager {
  constructor(
    private page: Page,
    private locatorResolver: LocatorResolver
  ) {}

  async ensureVisible(locator: Locator, options: VerifyOptions = {}): Promise<void> {
    const attachedTimeout = options.attachedTimeoutMs ?? TIMEOUTS.elementAttached;
    const visibleTimeout = options.visibleTimeoutMs ?? TIMEOUTS.elementVisible;
    await locator.waitFor({ state: 'attached', timeout: attachedTimeout }).catch(() => {});
    await locator.waitFor({ state: 'visible', timeout: visibleTimeout });
  }

  async getLocatorValue(locator: Locator): Promise<string> {
    return await locator.evaluate((el: any) => {
      // Try value attribute first (for inputs)
      if (el.value !== undefined) return el.value;

      // Try innerText
      if (el.innerText) return el.innerText.trim();

      // Try textContent
      if (el.textContent) return el.textContent.trim();

      // Try aria-label or other attributes
      if (el.getAttribute) {
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;

        const title = el.getAttribute('title');
        if (title) return title;
      }

      return '';
    });
  }

  /**
   * Extract text content from a locator element.
   * Returns innerText or textContent, whichever is available.
   */
  async getTextContent(locator: Locator): Promise<string> {
    return await locator.evaluate((el: any) => el?.innerText || el?.textContent || '').catch(() => '');
  }

  async findLocatorByKey(key: string): Promise<Locator> {
    const exprList = objectMap[key];
    if (!exprList || exprList.length === 0) {
      throw new LocatorNotFoundError(key);
    }

    for (const expr of exprList) {
      try {
        const locator = await this.locatorResolver.resolve(expr);
        await locator.waitFor({ state: 'attached', timeout: TIMEOUTS.elementAttached }).catch(() => {});
        return locator;
      } catch (err) {
        logger.warn(`[LocatorManager] Locator '${expr}' for key '${key}' failed: ${err}`);
        continue;
      }
    }

    throw new Error(`All locators for '${key}' failed to initialize.`);
  }
}
