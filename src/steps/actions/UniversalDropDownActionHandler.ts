import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { Locator, Page } from '@playwright/test';

/**
 * All known dropdown-panel / overlay selectors across frameworks.
 * Used both to detect open panels and to wait for them to close.
 */
const PANEL_SELECTORS = [
  // Angular CDK / Material
  '.cdk-overlay-container .cdk-overlay-pane',
  '.mat-select-panel',
  '.mat-autocomplete-panel',
  '.mat-mdc-select-panel',
  '.mat-mdc-autocomplete-panel',
  // PrimeNG
  '.p-dropdown-panel',
  '.p-autocomplete-panel',
  '.p-multiselect-panel',
  '.p-overlay',
  // Ant Design
  '.ant-select-dropdown',
  '.ant-cascader-dropdown',
  // Generic
  '[role="listbox"]',
].join(',');

export class UniversalDropdownActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    return /^(select|choose|selectgrid|selectandenter)\b/i.test(action.trim());
  }

  async execute(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    const page = this.page;

    const keyMatch = action.match(/[‘'’"“”]([^‘'’"“”]+)[‘'’"“”]/);
    if (!keyMatch) throw new Error(`Invalid dropdown action: ${action}`);

    const key = keyMatch[1];
    const locatorExpr = objectMap[key];

    if (!locatorExpr) throw new Error(`Locator not found for ${key}`);

    const locator = await this.getLocator(locatorExpr);
    const values = await this.resolveValues(data, step);

    logger.info(`[Dropdown] Selecting [${values.join(', ')}] from '${key}'`);

    const strategies = [
      this.selectNative.bind(this),
      this.selectOverlayDropdown.bind(this),
      this.selectAutocomplete.bind(this),
      this.selectSearchDropdown.bind(this),
      this.selectStaticDropdown.bind(this),
      this.selectMultiSelect.bind(this),
      this.fallbackSelection.bind(this),
    ];

    const errors: string[] = [];

    for (const strategy of strategies) {
      try {
        const success = await strategy(locator, values, page);
        if (success) {
          // ── Critical: commit the selection before returning ──
          await this.commitSelection(locator, page, values);
          return true;
        }
      } catch (err: any) {
        errors.push(err.message);
      }
    }

    throw new Error(`Dropdown selection failed for '${key}':\n${errors.join('\n')}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Resolve values
  // ═══════════════════════════════════════════════════════════════════════════

  private async resolveValues(data: any, step?: any): Promise<string[]> {
    let rawValues: string[] = [];

    if (Array.isArray(data)) rawValues = data;
    else if (typeof data === 'string') rawValues = data.split(/[,;|]/);
    else if (data?.messages) rawValues = data.messages.split(/[,;|]/);
    else if (step?.result) rawValues = [step.result];

    return rawValues.map((v) => v.trim()).filter(Boolean);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1️⃣ Native <select>
  // ═══════════════════════════════════════════════════════════════════════════

  private async selectNative(locator: Locator, values: string[], _page: Page) {
    const tag = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    if (tag !== 'select') return false;

    await locator.selectOption(values.map((v) => ({ label: v })));

    // Native selects fire 'change' synchronously — dispatch it explicitly
    // in case the framework wraps the native element.
    await locator.dispatchEvent('change');

    logger.info(`[Dropdown] Native select success`);
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2️⃣ Overlay dropdown (Angular Material / Ant / PrimeNG)
  // ═══════════════════════════════════════════════════════════════════════════

  private async selectOverlayDropdown(locator: Locator, values: string[], page: Page) {
    await locator.click();

    const panel = page.locator(PANEL_SELECTORS).last();
    if (!(await panel.count())) return false;
    await panel.waitFor({ state: 'visible', timeout: 4000 });

    for (const value of values) {
      const option = panel.locator(`[role="option"]:has-text("${value}")`).first();
      if (await option.count()) {
        await option.scrollIntoViewIfNeeded().catch(() => {});
        await option.click();
        logger.info(`[Dropdown] Overlay selected '${value}'`);
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3️⃣ Autocomplete
  // ═══════════════════════════════════════════════════════════════════════════

  private async selectAutocomplete(locator: Locator, values: string[], page: Page) {
    const input = locator.locator('input').first();
    if (!(await input.count())) return false;

    for (const value of values) {
      await input.fill('');
      await input.type(value, { delay: 60 });

      const suggestionPanel = page.locator(PANEL_SELECTORS).last();
      await suggestionPanel.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      const option = suggestionPanel.locator(`text="${value}"`).first();
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();

      // Verify the value stuck in the input
      await this.verifyInputValue(input, value);

      logger.info(`[Dropdown] Autocomplete selected '${value}'`);
    }
    return true;
  }

  /**
   * After autocomplete selection, verify that the value stuck in the input.
   * If it didn't, press Enter as a secondary commit mechanism.
   */
  private async verifyInputValue(input: Locator, value: string) {
    try {
      await input.waitFor({ state: 'visible', timeout: 2000 });
      const current = await input.inputValue().catch(() => '');
      if (!current.includes(value)) {
        logger.warn(`[Dropdown] Value '${value}' not confirmed in input — pressing Enter`);
        await input.press('Enter').catch(() => {});
        await input.page().waitForTimeout(300);
      }
    } catch {
      // input may have been removed after selection — safe to continue
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4️⃣ Search dropdown
  // ═══════════════════════════════════════════════════════════════════════════

  private async selectSearchDropdown(locator: Locator, values: string[], page: Page) {
    await locator.click();
    const search = page.locator('input[type="search"],input[role="combobox"],input[aria-autocomplete]').first();
    if (!(await search.count())) return false;
    for (const value of values) {
      // Clear any previous value
      await search.fill('');
      // Type at a natural pace — fast enough to not be painfully slow,
      // slow enough that per-keystroke handlers (input/keyup) fire properly.
      await search.pressSequentially(value, { delay: 80 });
      // ── Wait for the search results to render ──
      // After typing, most apps: debounce (300-500ms) → API call → render.
      // We wait for the full network roundtrip to complete before looking
      // for the option in the DOM.
      await page.waitForLoadState('networkidle').catch(() => {});
      // Additionally wait a beat for the framework to render the response
      await page.waitForTimeout(500);
      // Build a broad option locator that covers multiple common patterns:
      //  - [role="option"] (ARIA listbox items)
      //  - .p-autocomplete-item, .mat-option, .ant-select-item (framework-specific)
      //  - li elements inside known panels
      //  - any element whose text matches the value
      const optionSelectors = [
        `[role="option"]:has-text("${value}")`,
        `.p-autocomplete-item:has-text("${value}")`,
        `.mat-option:has-text("${value}")`,
        `.ant-select-item:has-text("${value}")`,
        `li:has-text("${value}")`,
      ].join(',');

      const option = page.locator(optionSelectors).first();
      // Retry loop: the API response + render may still be in-flight.
      // Poll up to 10 seconds total, checking every 500ms.
      let found = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        if ((await option.count()) > 0 && (await option.isVisible().catch(() => false))) {
          found = true;
          break;
        }
        await page.waitForTimeout(500);
      }
      if (!found) {
        throw new Error(`[Dropdown] Search option '${value}' did not appear after typing into search field`);
      }
      await option.scrollIntoViewIfNeeded().catch(() => {});
      await option.click();
      logger.info(`[Dropdown] Search dropdown selected '${value}'`);
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5️⃣ Static dropdown
  // ═══════════════════════════════════════════════════════════════════════════

  private async selectStaticDropdown(locator: Locator, values: string[], page: Page) {
    await locator.click();

    const items = page.locator('[role="option"],li');
    await items
      .first()
      .waitFor({ state: 'visible', timeout: 3000 })
      .catch(() => {});

    for (const value of values) {
      const option = items.filter({ hasText: value }).first();
      if (await option.count()) {
        await option.click();
        logger.info(`[Dropdown] Static dropdown selected '${value}'`);
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6️⃣ Multi select
  // ═══════════════════════════════════════════════════════════════════════════

  private async selectMultiSelect(locator: Locator, values: string[], page: Page) {
    await locator.click();

    for (const value of values) {
      const option = page.locator(`[role="option"]:has-text("${value}")`).first();
      if (await option.count()) {
        await option.click();
        logger.info(`[Dropdown] Multiselect selected '${value}'`);
        // Let the framework register each pick before the next click
        await page.waitForTimeout(400);
      }
    }

    // Close any remaining panel explicitly
    await page.keyboard.press('Escape').catch(() => {});
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7️⃣ Fallback
  // ═══════════════════════════════════════════════════════════════════════════

  private async fallbackSelection(_locator: Locator, values: string[], page: Page) {
    for (const value of values) {
      const option = page.locator(`text=${value}`).first();
      if (await option.count()) {
        await option.click();
        logger.warn(`[Dropdown] Fallback used for '${value}'`);
        return true;
      }
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STABILISATION — the core fix for "value reverts on focus change"
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Central post-selection stabilisation sequence.
   * Called **once** after a strategy succeeds, before returning to
   * the orchestrator — ensures the value is *committed* to the
   * framework model so it won't revert when the next action steals focus.
   *
   * Steps:
   *  1. Wait for any overlay panel to disappear.
   *  2. Blur the dropdown trigger so change / focusout events fire —
   *     many frameworks (Angular, React, Vue) commit the model value
   *     only on blur.
   *  3. Flush framework change detection (microtasks, zone.js,
   *     React batched updates) so the model update is synchronous
   *     from the test's perspective.
   *  4. Short network + spinner wait.
   *  5. (Best-effort) Verify the selected value is still visible
   *     in the trigger element — catches silent reverts.
   */
  private async commitSelection(locator: Locator, page: Page, values: string[]): Promise<void> {
    // 1. Ensure panels are gone
    await this.waitForPanelClose(page);

    // 2. Blur the dropdown so change / focusout events fire
    await this.blurDropdown(locator, page);

    // 3. Flush framework change detection
    await this.flushFrameworkUpdates(page);

    // 4. Standard UI stability wait
    await this.waitForUIUpdate(page);

    // 5. Best-effort: verify value didn't revert
    await this.verifyValueStuck(locator, page, values);
  }

  /**
   * Explicitly blurs the dropdown trigger so that the browser fires
   * focusout → blur → change events. Many frameworks (Angular, React)
   * commit the model value only on blur.
   */
  private async blurDropdown(locator: Locator, page: Page): Promise<void> {
    try {
      // Dispatch change + blur directly on the element
      await locator.evaluate((el: any) => {
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        if (typeof el.blur === 'function') el.blur();
      });
    } catch {
      // Element may have been replaced by the framework — fall through
    }

    // Click <body> as a secondary guarantee — puts focus somewhere neutral
    // so the dropdown's focusout handler fires even if dispatchEvent was swallowed
    await page
      .locator('body')
      .click({ position: { x: 0, y: 0 }, force: true })
      .catch(() => {});
  }

  /**
   * Flushes framework-level async update queues:
   *  - Microtask queue   (Angular zone.js, Promises)
   *  - requestAnimationFrame (React 18 batched updates)
   *  - setTimeout(0)     (Vue nextTick, generic framework flush)
   *
   * By the time this resolves, any pending reactive model update
   * triggered by our click/blur will have been applied to the DOM.
   */
  private async flushFrameworkUpdates(page: Page): Promise<void> {
    // The function body runs inside the browser (page.evaluate).
    // We pass it as a string to avoid Node-side type-checking of
    // browser-only globals like `window` and `requestAnimationFrame`.
    await page.evaluate(`
      new Promise(resolve => {
        Promise.resolve()
          .then(() => new Promise(r => {
            if (typeof requestAnimationFrame === 'function') {
              requestAnimationFrame(() => r());
            } else {
              r();
            }
          }))
          .then(() => new Promise(r => setTimeout(r, 100)))
          .then(resolve);
      })
    `);
  }

  /**
   * Best-effort check that the selected value is still displayed
   * inside the dropdown trigger. Logs a warning but does NOT throw,
   * because some components render the chosen value in a child element
   * that isn't the trigger locator itself.
   */
  private async verifyValueStuck(locator: Locator, _page: Page, values: string[]): Promise<void> {
    try {
      const displayedText = await locator.innerText({ timeout: 1500 }).catch(async () => {
        // Might be an <input>-based trigger
        return await locator.inputValue({ timeout: 1500 }).catch(() => '');
      });

      const lastValue = values[values.length - 1];
      if (displayedText && displayedText.includes(lastValue)) {
        logger.info(`[Dropdown] ✅ Verified '${lastValue}' is committed`);
      } else {
        logger.warn(
          `[Dropdown] ⚠️ Could not confirm '${lastValue}' in trigger ` +
            `(displayed: '${displayedText?.slice(0, 80)}'). ` +
            `The value may be rendered elsewhere — continuing.`
        );
      }
    } catch {
      // Locator may have been detached — safe to continue
    }
  }

  // ---------------------------------------------------------
  // Wait for dropdown panel / overlay to close
  // ---------------------------------------------------------

  private async waitForPanelClose(page: Page): Promise<void> {
    try {
      await page.waitForSelector(PANEL_SELECTORS, { state: 'hidden', timeout: 4000 });
    } catch {
      // Already gone or never appeared — safe to continue
    }
  }

  // ---------------------------------------------------------
  // UI Wait Handler
  // ---------------------------------------------------------

  private async waitForUIUpdate(page: Page): Promise<void> {
    await Promise.all([
      page.waitForLoadState('networkidle').catch(() => {}),
      page
        .waitForSelector('.loading,.spinner,.loader,.progress', {
          state: 'hidden',
          timeout: 3000,
        })
        .catch(() => {}),
      page.waitForTimeout(300),
    ]);
  }
}
