import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { StepExecutor } from '../StepExecutor';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

type VerifyOptions = {
  exact?: boolean;
  caseSensitive?: boolean;
  match?: 'contains' | 'equals';
  itemSelector?: string;
  mode?: 'auto' | 'message' | 'value';
  visibleTimeoutMs?: number;
  attachedTimeoutMs?: number;
};

/**
 * ValidateActionHandler
 *
 * Validates element text content, input values, or messages against expected
 * values. Supports flexible matching options including exact, contains, and
 * case-sensitive comparisons.
 *
 * Supported Keywords: `validate`
 *
 * Usage Examples:
 * | Action                              | Data                        | Expected Result                      |
 * |-------------------------------------|-----------------------------|------------------------------------||
 * | Validate 'Success Message'          | Order placed successfully   | Text matches expected message        |
 * | Validate 'Total Price'              | $150.00                     | Price value is validated             |
 * | Validate 'Error Message'            | {{expectedError}}           | Validates against stored value       |
 * | Validate 'Item 1' and 'Item 2'      | Apple, Orange               | Multiple fields validated            |
 * | Validate 'Dropdown Value'           | Option A; Option B          | Validates dropdown selections        |
 *
 * Verification Options:
 * | Option            | Type    | Default    | Description                           |
 * |-------------------|---------|------------|---------------------------------------|
 * | exact             | boolean | false      | Require exact text match              |
 * | caseSensitive     | boolean | false      | Enable case-sensitive comparison      |
 * | match             | string  | 'contains' | Match type: 'contains' or 'equals'    |
 * | mode              | string  | 'auto'     | 'auto', 'message', or 'value'         |
 * | visibleTimeoutMs  | number  | 5000       | Timeout for visibility check          |
 * | attachedTimeoutMs | number  | 3000       | Timeout for attached check            |
 *
 * Data Format Support:
 * | Format          | Example               | Description                         |
 * |-----------------|-----------------------|-------------------------------------|
 * | Single value    | Order placed          | Validates single field              |
 * | Comma-separated | Apple, Orange         | Maps values to fields in order      |
 * | Semicolon       | Value1; Value2        | Alternative separator               |
 * | Pipe            | Value1 | Value2       | Alternative separator               |
 * | Store reference | {{variableName}}      | Uses stored value                   |
 *
 * Key Features:
 * - Multiple field validation in single action
 * - Quote-aware parsing preserves separators in quoted strings
 * - Dynamic data resolution with {{variables}}
 * - Flexible matching modes (contains, equals, exact)
 * - Auto-detects element type for value extraction
 * - Multi-locator fallback for reliability
 *
 * Notes:
 * - Field names must be quoted in action string
 * - Use 'and' to separate multiple field names
 * - For state assertions (visible, enabled), use AssertActionHandler
 *
 * @see AssertActionHandler for state assertions
 * @see StepExecutor for data resolution
 * @since 1.0.0
 */
export class ValidateActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    const firstWord = action.trim().split(' ')[0].toLowerCase();
    return /validate/i.test(firstWord);
  }

  /**
   * Check if the action contains 'mandatory' keyword.
   * If mandatory is present, validation failures will throw errors and fail the test.
   * If mandatory is NOT present, validation failures will only log warnings.
   */
  private isMandatory(action: string): boolean {
    return /\bmandatory\b/i.test(action);
  }

  /**
   * Parse a raw string into values while preserving quoted fragments.
   * Supports separators: semicolon (;) and pipe (|).
   * Comma is used as decimal separator for single values (European format).
   * For multiple values, use semicolon or pipe as separator.
   * Example: `"32,22"` => ["32,22"] (single value with decimal)
   * Example: `"apple; banana"` => ["apple", "banana"] (multiple values)
   * Example: `"32,22; 45,67"` => ["32,22", "45,67"] (multiple decimals)
   */
  private parseValuesPreserveQuotes(raw: string): string[] {
    if (!raw) return [];
    // First check: if no semicolon or pipe, treat the whole thing as a single value
    // This preserves comma as decimal separator for single values
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
        // toggle quote state
        if (!inQuote) {
          inQuote = ch;
          continue;
        } else if (inQuote === ch) {
          inQuote = null;
          continue;
        } // else different quote inside quoted area - treat as normal char
      }

      // Only split on semicolon or pipe (comma preserved for decimals)
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

  async execute(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
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
        logger.warn(`[ValidateActionHandler] [VALIDATION WARNING] ${message}`);
        logger.warn(
          `[ValidateActionHandler] [VALIDATION WARNING] Data mismatch detected but test continues as 'mandatory' keyword is not specified hence skipping the field `
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

      const stepExecutor = new StepExecutor(this.page);
      let expectedRaw: string[] = [];
      let options: VerifyOptions = {};
      options.visibleTimeoutMs = options.visibleTimeoutMs ?? TIMEOUTS.elementVisible;
      options.attachedTimeoutMs = options.attachedTimeoutMs ?? TIMEOUTS.elementAttached;

      // 2) Resolve expected messages/values from data (flexible)
      if (Array.isArray(data)) {
        const raw = [...data];
        if (raw.length && typeof raw[raw.length - 1] === 'object' && !Array.isArray(raw[raw.length - 1])) {
          options = { ...options, ...(raw.pop() as VerifyOptions) };
        }
        expectedRaw = await Promise.all(raw.map((d) => stepExecutor.resolveData(String(d))));
      } else if (typeof data === 'string' || typeof data === 'number') {
        // preserve quoted fragments
        const parsed = this.parseValuesPreserveQuotes(String(data));
        expectedRaw = await Promise.all(parsed.map((p) => stepExecutor.resolveData(p)));
      } else if (data && typeof data === 'object') {
        if (data.options && typeof data.options === 'object') {
          options = { ...options, ...data.options };
        }
        if (Array.isArray(data.messages)) {
          expectedRaw = await Promise.all(data.messages.map((d: any) => stepExecutor.resolveData(String(d))));
        } else if (typeof data.messages === 'string' || typeof data.messages === 'number') {
          const parsed = this.parseValuesPreserveQuotes(String(data.messages));
          expectedRaw = await Promise.all(parsed.map((p) => stepExecutor.resolveData(p)));
        } else if (Array.isArray(data.parameters) && data.parameters.length) {
          const vals: string[] = [];
          for (const p of data.parameters) {
            if (p?.value !== undefined) vals.push(await stepExecutor.resolveData(String(p.value)));
          }
          expectedRaw = vals;
        } else {
          // treat object as key->value mapping if keys present
          if (keys.length > 0) {
            const vals: string[] = [];
            for (const k of keys) {
              if (data[k] !== undefined) {
                const v = data[k];
                if (typeof v === 'string') {
                  const parsed = this.parseValuesPreserveQuotes(v);
                  vals.push(...(await Promise.all(parsed.map((p) => stepExecutor.resolveData(p)))));
                } else {
                  vals.push(await stepExecutor.resolveData(String(v)));
                }
              }
            }
            if (vals.length) expectedRaw = vals;
          }
        }
      } else if (step?.result) {
        expectedRaw = [await stepExecutor.resolveData(String(step.result))];
      }

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
        const attachedTimeout = options.attachedTimeoutMs ?? TIMEOUTS.elementAttached;
        const visibleTimeout = options.visibleTimeoutMs ?? TIMEOUTS.elementVisible;
        await locator.waitFor({ state: 'attached', timeout: attachedTimeout }).catch(() => {});
        await locator.waitFor({ state: 'visible', timeout: visibleTimeout });
      };

      // Collect UI texts from objectMap keys (message mode)
      const collectUITextsForKeys = async (): Promise<string[]> => {
        const collected: string[] = [];

        for (const key of keys) {
          const exprList = objectMap[key];
          if (!exprList || exprList.length === 0) {
            logger.warn(
              `[ValidateActionHandler] Locator key '${key}' not found in objectMap - will attempt page-wide and label fallback.`
            );
            continue; // don't throw yet; try page-wide
          }

          let successForKey = false;
          for (const [index, expr] of exprList.entries()) {
            try {
              const baseLocator = await this.getLocator(expr);
              await ensureVisible(baseLocator).catch(() => {});
              await page.waitForLoadState('networkidle').catch(() => {});
              await page.waitForTimeout(200);

              if (options.itemSelector) {
                const items = baseLocator.locator(options.itemSelector);
                const count = await items.count();
                for (let i = 0; i < count; i++) {
                  const t = await items
                    .nth(i)
                    .evaluate((el: any) => el?.innerText || el?.textContent || '')
                    .catch(() => '');
                  if (t) {
                    const lines = (t as string)
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    collected.push(...lines);
                  }
                }
              } else {
                const t = await baseLocator
                  .evaluate((el: any) => el?.innerText || el?.textContent || '')
                  .catch(() => '');
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
              logger.warn(`[ValidateActionHandler] Error locator #${index + 1} for key '${key}' failed: ${err}`);
              if (index === exprList.length - 1) {
                logger.warn(
                  `[ValidateActionHandler] All locators for '${key}' failed (but will continue with fallback search).`
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
              `[ValidateActionHandler] Locator key '${key}' not found in objectMap - attempting label-based / page fallback for list items.`
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
                  `[ValidateActionHandler] Base locator '${expr}' matches ${directCount} elements. Collecting all texts/values.`
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
                      logger.info(`[ValidateActionHandler] Collected text from element ${i}: '${cleaned}'`);
                    } else {
                      logger.warn(`[ValidateActionHandler] Empty text collected from element ${i} of '${expr}'.`);
                    }
                  } catch (err) {
                    logger.warn(
                      `[ValidateActionHandler] Failed to collect text from element ${i} of '${expr}': ${err}`
                    );
                  }
                }

                if (temp.length > 0) {
                  logger.info(
                    `[ValidateActionHandler] Successfully collected ${temp.length} values from multi-element locator: ${JSON.stringify(temp)}`
                  );

                  // Store collected values as a list
                  collectedVals.push(...temp);
                  break;
                } else {
                  logger.error(`[ValidateActionHandler] Collected 0 values from multi-element locator '${expr}'`);
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
                    const t = await items
                      .nth(i)
                      .evaluate((el: any) => el?.innerText || el?.textContent || '')
                      .catch(() => '');
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
                const whole = await baseLocator
                  .evaluate((el: any) => el?.innerText || el?.textContent || '')
                  .catch(() => '');
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
                `[ValidateActionHandler] Value retrieval attempt for '${key}' using expr '${expr}' failed: ${err}`
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
              `[ValidateActionHandler] Locator key '${key}' not found in objectMap - trying label-based lookup for value.`
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
              logger.warn(`[ValidateActionHandler] Label-based lookup for '${key}' failed: ${err}`);
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
              logger.warn(`[ValidateActionHandler] Value retrieval failed for locator '${expr}' of '${key}': ${err}`);
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
          logger.warn(`[ValidateActionHandler] Configured-locators collection threw: ${err}`);
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
                    const lines = t
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    collectedTexts.push(...lines);
                  }
                }
              }
            } catch (err) {
              logger.warn(`[ValidateActionHandler] Fallback text search for '${eNorm}' threw: ${err}`);
            }
          }
        }

        if (!collectedTexts.length) {
          // if shape suggests values, switch to value mode
          if (looksLikeValueMap) {
            logger.warn(
              `[ValidateActionHandler] No UI error text found; switching to 'value' mode due to expected shape.`
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
            `[ValidateActionHandler] Verified ${isMandatory ? 'mandatory ' : ''}error messages successfully. Expected (${expectedNorm.length}):\n- ${expectedNorm.join('\n- ')}`
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
            `[ValidateActionHandler] Verified field value successfully for key '${keys[0]}'. UI Value: '${got}'`
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
            `[ValidateActionHandler] Verified list values successfully for key '${keys[0]}'. UI Values: ${JSON.stringify(uiValues)}`
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
        handler: 'ValidateActionHandler',
        action,
        elementName: elementNames.join(', '),
        locatorExpression: elementNames.map((e) => locatorToString(objectMap[e])),
        inputData: typeof data === 'string' ? data : JSON.stringify(data),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }
}
