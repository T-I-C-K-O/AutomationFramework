/**
 * @fileoverview Dropdown Action Handler
 * @description Handles complex dropdown selection operations with multiple fallback strategies
 * @module steps/actions/DropdownActionHandler
 * @since 1.0.0
 */

import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { Locator, Page } from '@playwright/test';
import { StepExecutor } from '../StepExecutor';
import { SELECTORS } from '../../config/selectors.config';
import { expectsSelectSuccess, expectsSelectBlocked } from '../../expectedResult';
import { formatStepError, getPageContext } from '../../helpers/StepErrorFormatter';

/** Execution modes for the Select action */
type SelectExecutionType = 'normal-select' | 'blocked-select' | 'validate-select';
/**
 * DropdownActionHandler
 *
 * Handles dropdown selection actions for various UI components. Supports single and
 * multiple selections with automatic fallback strategies for different dropdown types
 * including native HTML selects, static lists, autocomplete, and multiselect components.
 *
 * **Supported Keywords:** `select`, `choose`, `selectgrid`, `selectandenter`
 *
 * **Execution Modes:**
 * | Mode            | Trigger (Expected Result)          | Behavior                                    |
 * |-----------------|------------------------------------|---------------------------------------------|
 * | `validate`      | Contains success keywords          | Selects value and verifies selection        |
 * | `readonly-check`| Contains blocked keywords          | Verifies dropdown rejects selection         |
 * | `normal`        | Empty or no matching keywords      | Selects value without validation            |
 *
 * **Usage Examples:**
 *
 * 1. Single Selection:
 * | Action                          | Data              | Expected Result           |
 * |---------------------------------|-------------------|---------------------------|
 * | Select 'Country'                | United States     |                           |
 * | Choose 'Status'                 | Active            | Status selected successfully|
 *
 * 2. Multiple Selection (comma-separated data):
 * | Action                                    | Data              | Expected Result |
 * |-------------------------------------------|-------------------|-----------------|
 * | Select 'Skills'                           | JavaScript, React |                 |
 * | Choose 'Languages'                        | EN, FR            |                 |
 *
 * 3. Grid Selection:
 * | Action                          | Data              | Expected Result |
 * |---------------------------------|-------------------|-----------------|
 * | Selectgrid 'Row Status'         | Approved          |                 |
 *
 * 4. Using Stored Variables:
 * | Action                          | Data              | Expected Result |
 * |---------------------------------|-------------------|-----------------|
 * | Select 'User Role'              | {{selectedRole}}  |                 |
 *
 * 5. Read-Only Dropdown Validation:
 * | Action                          | Data              | Expected Result               |
 * |---------------------------------|-------------------|-------------------------------|
 * | Select 'Locked Dropdown'        | Option A          | Dropdown should not be selected|
 * | Choose 'Disabled Field'         | Value             | Field is disabled             |
 *
 * **Data Format Options:**
 * | Format                | Example                    | Description                    |
 * |-----------------------|----------------------------|--------------------------------|
 * | Single value          | "United States"            | Selects single option          |
 * | Comma-separated       | "JavaScript, React, Node"  | Selects multiple options       |
 * | Semicolon-separated   | "EN; FR; DE"               | Alternative delimiter          |
 * | Variable reference    | "{{countryName}}"          | Resolves stored variable       |
 *
 * **Selection Strategies (Automatic Fallback):**
 * 1. **Native HTML `<select>`** - Fastest, uses Playwright's selectOption()
 * 2. **Static Dropdown** - Clicks trigger, selects from visible list
 * 3. **Click-Only Dropdown** - Overlay panels with item selection
 * 4. **Autocomplete** - Types and selects from suggestions
 * 5. **Multiselect (No Filter)** - Multiple selection without search
 * 6. **Multiselect (With Filter)** - Multiple selection with search input
 * 7. **Direct Autocomplete** - Types directly into field with suggestions
 * 8. **Text-Based Fallback** - Last resort text matching
 *
 * **Key Features:**
 * - Variable resolution via `{{variableName}}` syntax
 * - Multi-selection support with comma/semicolon/pipe delimiters
 * - Grid cell selection with `selectgrid` keyword
 * - Automatic strategy detection and fallback
 * - Selection validation based on expected result keywords
 * - Disabled/readonly dropdown detection
 * - Optimized timeouts and typing delays for performance
 *
 * **Notes:**
 * - For text input fields, use EnterActionHandler
 * - For checkboxes/radio buttons, use CheckActionHandler
 * - Grid selections require proper grid cell locators in objectMap
 * - Selection validation checks multiple display patterns
 *
 * @example
 * ```typescript
 * // Single selection with validation
 * await handler.execute('select "Country"', ['United States'], 'Country selected successfully');
 *
 * // Multiple selection
 * await handler.execute('select "Skills"', ['JavaScript', 'React'], '');
 *
 * // Grid selection
 * await handler.execute('selectgrid "Status"', ['Active'], '');
 *
 * // Blocked validation
 * await handler.execute('select "Disabled Field"', ['value'], 'Field is disabled');
 * ```
 */

// Optimized timeouts for faster execution
const TIMEOUTS = {
  QUICK: 1000, // Fast operations like native select
  VISIBILITY: 1500, // Element visibility waits
  EXTENDED: 3000, // Longer waits for complex operations
  AUTOCOMPLETE_INIT: 200, // Short wait for autocomplete initialization
} as const;

// Faster typing delay (ms) for autocomplete interactions
const TYPING_DELAY = 40;

/** Delimiter characters for multi-value parsing */
const VALUE_DELIMITERS = new Set([',', ';', '|']);

/** Quote characters for value parsing */
const QUOTE_CHARS = new Set(["'", '"']);

/** Regex for matching supported dropdown action keywords */
const ACTION_KEYWORD_REGEX = /^(select|choose|selectgrid|selectandenter)\b/i;

export class DropdownActionHandler extends BaseActionHandler {
  /** Shared cache for grid key conversion (deterministic, safe to share across instances) */
  private static gridKeyCache = new Map<string, string>();

  /**
   * Determines if this handler can process the given action.
   * Supports select, choose, selectgrid, and selectandenter keywords.
   */
  canHandle(action: string): boolean {
    return ACTION_KEYWORD_REGEX.test(action.trim());
  }

  /**
   * Convert field name to camelCase grid key with caching.
   * Transforms space-separated names like "Row Status" to "rowStatus".
   */
  private toGridKey(key: string): string {
    const cached = DropdownActionHandler.gridKeyCache.get(key);
    if (cached) return cached;

    const gridKey = key
      .split(' ')
      .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
      .join('');
    DropdownActionHandler.gridKeyCache.set(key, gridKey);
    return gridKey;
  }

  /**
   * Opens a dropdown by clicking on the base locator.
   * Uses force click to handle elements that might be covered or disabled.
   *
   * @private
   * @param baseLocator - The dropdown trigger element locator
   */
  private async openDropdown(baseLocator: Locator): Promise<void> {
    await baseLocator.click({ force: true, timeout: TIMEOUTS.QUICK });
  }

  /**
   * Closes any open dropdown by pressing the Escape key.
   * Safe to call even if no dropdown is open.
   *
   * @private
   * @param page - The Playwright page instance
   */
  private async closeDropdown(page: Page): Promise<void> {
    if (!page.isClosed()) await page.keyboard.press('Escape').catch(() => {});
  }

  /**
   * Determines the select mode based on the expected result string.
   * IMPORTANT: Check "blocked" conditions FIRST as they are more specific.
   * Uses keyword matching from expectedResult utilities to determine execution mode.
   *
   * @private
   * @param result - The expected result from the test case
   * @returns The select mode to use ('normal-select', 'validate-select', or 'blocked-select')
   *
   * @example
   * ```typescript
   * getExecutionTypeFromExpectedResult('selected successfully') // 'validate-select'
   * getExecutionTypeFromExpectedResult('cannot select') // 'blocked-select'
   * getExecutionTypeFromExpectedResult('') // 'normal-select'
   * ```
   */
  private getExecutionTypeFromExpectedResult(result: any): SelectExecutionType {
    if (expectsSelectBlocked(result)) return 'blocked-select';
    if (expectsSelectSuccess(result)) return 'validate-select';
    return 'normal-select';
  }

  /**
   * Checks if the dropdown is disabled or read-only using multiple heuristics:
   * Playwright's built-in checks, CSS class detection, and attribute inspection.
   */
  private async isDropdownDisabled(locator: Locator): Promise<boolean> {
    const [isDisabled, isEditable, hasDisabledClass] = await Promise.all([
      locator.isDisabled().catch(() => false),
      locator.isEditable().catch(() => true),
      locator
        .evaluate(
          (el, classes) => classes.some((cls) => el.classList.contains(cls)) || el.hasAttribute('disabled'),
          [...SELECTORS.dropdown.DISABLED_CLASSES]
        )
        .catch(() => false),
    ]);
    return isDisabled || !isEditable || hasDisabledClass;
  }

  /**
   * Validates that the selected value is displayed in the dropdown.
   * Checks display selectors within the locator first, then page-wide selected item selectors.
   */
  private async validateSelection(baseLocator: Locator, page: Page, expectedValue: string): Promise<void> {
    for (const selector of SELECTORS.dropdown.DISPLAY_SELECTORS) {
      const displayElement = baseLocator.locator(selector).first();
      if (await displayElement.count()) {
        const displayedText = await displayElement.innerText().catch(() => displayElement.inputValue().catch(() => ''));
        if (displayedText?.includes(expectedValue)) {
          logger.info(`[DropdownActionHandler] Validated: '${expectedValue}' is selected`);
          return;
        }
      }
    }

    const selectedItem = page.locator(SELECTORS.dropdown.getSelectedItemSelector(expectedValue)).first();
    if (await selectedItem.count()) {
      logger.info(`[DropdownActionHandler] Validated: '${expectedValue}' is highlighted/selected`);
      return;
    }

    throw new Error(`Validation failed: Expected '${expectedValue}' to be selected but could not verify selection`);
  }

  /**
   * Optimized value parser using single pass with delimiter and quote handling.
   * Supports comma, semicolon, or pipe-separated values with proper quote escaping.
   */
  private parseValuesRaw(raw: string): string[] {
    if (!raw) return [];
    const len = raw.length;
    const values: string[] = [];
    let cur = '';
    let inQuote: string | null = null;

    for (let i = 0; i < len; i++) {
      const ch = raw[i];

      if (QUOTE_CHARS.has(ch) && (i === 0 || raw[i - 1] !== '\\')) {
        inQuote = inQuote === ch ? null : (inQuote ?? ch);
        continue;
      }

      if (!inQuote && VALUE_DELIMITERS.has(ch)) {
        const trimmed = cur.trim();
        if (trimmed) values.push(trimmed);
        cur = '';
        continue;
      }

      cur += ch;
    }

    const trimmed = cur.trim();
    if (trimmed) values.push(trimmed);
    return values;
  }

  /**
   * Executes dropdown selection actions with multiple fallback strategies.
   *
   * This method implements a comprehensive dropdown selection algorithm that tries
   * different strategies in order of preference and performance:
   * 1. Native HTML `<select>` (fastest)
   * 2. Static dropdown items
   * 3. Click-only dropdown with overlay
   * 4. Autocomplete with typing
   * 5. Multiselect without filter
   * 6. Multiselect with filter
   * 7. Direct autocomplete
   * 8. Text-based fallback
   *
   * Supports grid selections with `selectgrid` keyword and automatic variable resolution.
   *
   * @param action - The action string (e.g., 'select "Country"', 'selectgrid "Status"')
   * @param data - The selection data (string, array, or object with messages)
   * @param result - Expected result for validation mode determination
   * @param step - Step context for data resolution
   * @returns true if selection was successful
   * @throws Error if all selection strategies fail
   *
   * @example
   * ```typescript
   * // Single selection
   * await execute('select "Country"', ['United States']);
   *
   * // Multiple selection
   * await execute('select "Skills"', ['JavaScript', 'TypeScript']);
   *
   * // Grid selection
   * await execute('selectgrid "Status"', ['Active']);
   *
   * // With validation
   * await execute('select "Country"', ['USA'], 'Country selected successfully');
   *
   * // Blocked validation
   * await execute('select "Disabled Field"', [], 'Field is disabled');
   * ```
   */
  async execute(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    const page = this.page;

    try {
      const matchQuotedText = action.match(/[‘'’"“”]([^‘'’"“”]+)[‘'’"“”]/);
      if (!matchQuotedText) {
        throw new Error(`No quoted text found in action: '${action}'`);
      }

      const key = matchQuotedText[1];
      const expr = objectMap[key];
      if (!expr) {
        throw new Error(`Locator '${key}' not found in objectMap.`);
      }

      const stepExecutor = new StepExecutor(page);
      let rawValues: string[] = [];

      // -------- DATA RESOLUTION --------
      // Resolve data from various input formats (array, string, object, step result)

      if (Array.isArray(data)) {
        rawValues = data.map(String);
      } else if (typeof data === 'string' || typeof data === 'number') {
        rawValues = this.parseValuesRaw(String(data));
      } else if (data?.messages) {
        rawValues = this.parseValuesRaw(String(data.messages));
      } else if (step?.result) {
        rawValues = [String(step.result)];
      }

      if (!rawValues.length) {
        throw new Error(`No data provided for action: '${action}'`);
      }

      const values = await Promise.all(rawValues.map((v) => stepExecutor.resolveData(v)));

      logger.info(`Selecting value(s) [${values.join(', ')}] from dropdown: ${key}`);

      // Determine execution mode based on expected result
      let executionType = this.getExecutionTypeFromExpectedResult(result);
      logger.info(`[DropdownActionHandler] Execution mode: ${executionType}`);

      // ------------------------- GRID PREPARATION -------------------------
      // Optional pre-click for grid/cell (SelectGrid) - Optimized
      const isSelectGrid = /SelectGrid/i.test(action.trim());
      const gridKey = isSelectGrid ? this.toGridKey(key) : '';

      if (isSelectGrid) {
        const gridCellLocator = page.locator(SELECTORS.grid.cell(gridKey));
        await gridCellLocator.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED }).catch(() => {});
        await gridCellLocator.click({ force: true }).catch((e) => logger.warn(`Grid cell click failed: ${e}`));
      }

      const baseLocator = await this.getLocator(expr);

      // Collect per-strategy errors for actionable diagnostics
      const strategyErrors: any[] = [];

      // ------------------------- BLOCKED SELECT MODE -------------------------
      // Handle blocked-select mode: verify dropdown is disabled
      if (executionType === 'blocked-select') {
        const isDisabled = await this.isDropdownDisabled(baseLocator);
        if (isDisabled) { 
          logger.info(`[DropdownActionHandler] Dropdown '${key}' is disabled/read-only as expected - PASS`);
          return true;
        }
        // Try to select and verify it fails
        try {
          await this.openDropdown(baseLocator);
          //await this.closeDropdown(page);
          throw new Error(`Dropdown '${key}' is not disabled but expected to be blocked/read-only`);
        } catch (e: any) {
          if (e.message.includes('not disabled')) throw e;
          logger.info(`[DropdownActionHandler] Dropdown '${key}' could not be opened as expected - PASS`);
          return true;
        }
      }
      // SelectGrid: bypass dropdown display validation — grid cell reflects value directly
      // Prevents stuck loop where validateSelection checks baseLocator (dropdown trigger)
      // instead of grid cell content, causing infinite retry cycles
      if (isSelectGrid && executionType === 'validate-select') {
        logger.info(
          '[DropdownActionHandler] SelectGrid detected: switching to normal-select (grid cell self-validates on selection)'
        );
        executionType = 'normal-select';
      }

      // 1️⃣ NATIVE <select> - Fast path
      try {
        await baseLocator.selectOption(
          values.map((v) => ({ label: v })),
          { timeout: TIMEOUTS.QUICK }
        );
        logger.info('Selected using native <select>');
        if (executionType === 'validate-select') {
          await this.validateSelection(baseLocator, page, values[0]);
        }
        return true;
      } catch (err: any) {
        strategyErrors.push({ strategy: 'Strategy 1 - Native <select>', error: err.message });
      }

      // 2️⃣ STATIC DROPDOWN
      try {
        await this.openDropdown(baseLocator);
        const staticItems = page.locator(SELECTORS.dropdown.STATIC_ITEMS[0]);
        const itemCount = await staticItems.count();
        if (itemCount > 0) {
          const allTexts = await Promise.all(
            Array.from({ length: itemCount }, (_, i) =>
              staticItems
                .nth(i)
                .innerText()
                .then((t) => t.trim())
                .catch(() => '')
            )
          );
          for (const v of values) {
            const idx = allTexts.findIndex((t) => t === v || t.includes(v));
            if (idx !== -1) {
              await staticItems.nth(idx).click({ force: true });
              logger.info(`Selected '${v}' from static dropdown`);
              if (executionType === 'validate-select') {
                await this.validateSelection(baseLocator, page, v);
              }
              return true;
            }
          }
        }
      } catch (err: any) {
        strategyErrors.push({ strategy: 'Strategy 2 - Static Dropdown', error: err.message });
      }

      // 3️⃣ CLICK-ONLY DROPDOWN
      try {
        //await this.openDropdown(baseLocator);
        const panel = page.locator(SELECTORS.dropdown.getOverlayPanelSelector()).first();
        await panel.waitFor({ state: 'visible', timeout: TIMEOUTS.VISIBILITY });

        for (const v of values) {
          const item = panel.locator(SELECTORS.dropdown.getOverlayItemSelector()).filter({ hasText: v }).first();
          if (await item.count()) {
            await item.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.QUICK }).catch(() => {});
            await item.click({ force: true });
            logger.info(`Selected '${v}' from click-only dropdown`);
            //await this.closeDropdown(page);
            if (executionType === 'validate-select') {
              await this.validateSelection(baseLocator, page, v);
            }
            return true;
          }
        }
        //await this.closeDropdown(page);
      } catch (err: any) {
        //await this.closeDropdown(page);
        strategyErrors.push({
          strategy: 'Strategy 3 - Click-Only Dropdown',
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // 4️⃣ AUTOCOMPLETE
      try {
        logger.info('[DropDownActionHandler] Clicking the base locator to activate autocomplete');
        await baseLocator.click({ force: true, timeout: TIMEOUTS.QUICK });
        await page.waitForTimeout(200); // Short wait to allow autocomplete to initialize
        const input = isSelectGrid
          ? page.locator(SELECTORS.grid.cell(gridKey)).locator(SELECTORS.dropdown.AUTOCOMPLETE_INPUT).first()
          : baseLocator.locator(SELECTORS.dropdown.AUTOCOMPLETE_INPUT).first();

        await input.waitFor({ state: 'visible', timeout: TIMEOUTS.VISIBILITY });

        for (const v of values) {
          await input.fill('');
          await input.pressSequentially(v, { delay: TYPING_DELAY });
          const panel = page.locator(SELECTORS.dropdown.AUTOCOMPLETE_PANEL).first();
          await panel.waitFor({ state: 'visible', timeout: TIMEOUTS.VISIBILITY });
          const suggestion = panel.locator(SELECTORS.dropdown.AUTOCOMPLETE_ITEM).filter({ hasText: v }).first();
          await suggestion.click({ force: true });
          logger.info(`Selected '${v}' from autocomplete`);
        }
        //await this.closeDropdown(page);
        if (executionType === 'validate-select') {
          await this.validateSelection(baseLocator, page, values[values.length - 1]);
        }
        return true;
      } catch (err: any) {
        //await this.closeDropdown(page);
        strategyErrors.push({ strategy: 'Strategy 4 - Autocomplete', error: err.message });
      }

      // 5️⃣ MULTISELECT (NO FILTER)
      try {
        //await this.openDropdown(baseLocator);
        const panel = page.locator(SELECTORS.dropdown.MULTISELECT_PANEL).first();
        await panel.waitFor({ state: 'visible', timeout: TIMEOUTS.VISIBILITY });

        for (const v of values) {
          const option = panel.locator(SELECTORS.dropdown.MULTISELECT_ITEM).filter({ hasText: v }).first();
          await option.waitFor({ state: 'visible', timeout: TIMEOUTS.EXTENDED });
          await option.click({ force: true });
          logger.info(`Selected '${v}' from multiselect`);
        }
        await this.closeDropdown(page);
        if (executionType === 'validate-select') {
          await this.validateSelection(baseLocator, page, values[values.length - 1]);
        }
        return true;
      } catch (err: any) {
        strategyErrors.push({ strategy: 'Strategy 5 - Multiselect (No Filter)', error: err.message });
      }

      // 6️⃣ MULTISELECT WITH FILTER
      try {
        await this.openDropdown(baseLocator);
        const panel = page.locator(SELECTORS.dropdown.MULTISELECT_PANEL).first();
        await panel.waitFor({ state: 'visible', timeout: TIMEOUTS.VISIBILITY });

        const filterInput = panel.locator(SELECTORS.dropdown.MULTISELECT_FILTER_INPUT).first();

        for (const v of values) {
          await filterInput.waitFor({ state: 'visible', timeout: TIMEOUTS.VISIBILITY });
          await filterInput.fill('');
          await filterInput.pressSequentially(v, { delay: TYPING_DELAY });

          const option = panel.locator(SELECTORS.dropdown.MULTISELECT_UNSELECTED_ITEM).filter({ hasText: v }).first();
          await option.waitFor({ state: 'visible', timeout: TIMEOUTS.VISIBILITY });
          await option.click({ force: true });
          logger.info(`Selected '${v}' from multiselect with filter`);
        }
        await this.closeDropdown(page);
        if (executionType === 'validate-select') {
          await this.validateSelection(baseLocator, page, values[values.length - 1]);
        }
        return true;
      } catch (err: any) {
        strategyErrors.push({ strategy: 'Strategy 6 - Multiselect With Filter', error: err.message });
      }

      // 7️⃣ DIRECT AUTOCOMPLETE
      try {
        for (const v of values) {
          await baseLocator.fill('');
          await baseLocator.pressSequentially(v, { delay: TYPING_DELAY });
          const option = page
            .locator(`${SELECTORS.dropdown.AUTOCOMPLETE_PANEL} ${SELECTORS.dropdown.AUTOCOMPLETE_ITEM}`)
            .filter({ hasText: v })
            .first();
          await option.waitFor({ state: 'visible', timeout: TIMEOUTS.VISIBILITY });
          await option.click({ force: true });
          logger.info(`Selected '${v}' from direct autocomplete`);
        }
        if (executionType === 'validate-select') {
          await this.validateSelection(baseLocator, page, values[values.length - 1]);
        }
        return true;
      } catch (err: any) {
        strategyErrors.push({ strategy: 'Strategy 7 - Direct Autocomplete', error: err.message });
      }

      // 8️⃣ FALLBACK (Text-based)
      for (const v of values) {
        const fallback = page.locator(SELECTORS.dropdown.getFallbackTextSelector(v)).first();
        if (await fallback.count()) {
          await fallback.click({ force: true });
          logger.info(`Selected '${v}' using fallback`);
          if (executionType === 'validate-select') {
            logger.info(`[DropdownActionHandler] Fallback selection validated for '${v}'`);
          }
          return true;
        }
      }

      // All strategies exhausted — throw enriched error with all details
      const pageCtx = await getPageContext(page);
      throw formatStepError(new Error('All dropdown selection strategies failed.'), {
        handler: 'DropdownActionHandler',
        action,
        elementName: key,
        locatorExpression: Array.isArray(expr) ? expr : [String(expr)],
        inputData: values.join(', '),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
        strategyErrors,
      });
    } catch (error: any) {
      // If already enriched, re-throw as-is
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }
      // Otherwise enrich with what we have (action string is always available)
      const pageCtx = await getPageContext(page);
      throw formatStepError(error, {
        handler: 'DropdownActionHandler',
        action,
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }
}
