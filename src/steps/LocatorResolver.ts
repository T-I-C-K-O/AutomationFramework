import { Page, Locator } from '@playwright/test';
import { objectMap } from '../page-objects/objectMap';
import { getValue } from '../data/storeManager';
import { logger } from '../helpers/logger';

/**
 * LocatorResolver handles resolving element locators dynamically.
 * It supports:
 *  - objectMap lookups
 *  - variable substitution from storeValue (e.g. ${username})
 *  - xpath, css, text=, id=, or custom locators
 */
export class LocatorResolver {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Resolve a locator key (from objectMap or direct expression)
   * @param key The name of the locator (e.g. 'Sign_In_Button' or xpath/css)
   */
  public async resolve(key: string | string[]): Promise<Locator> {
    try {
      if (Array.isArray(key)) {
        if (key.length === 0) throw new Error(`Locator array empty for key`);
        if (key.length > 1) {
          logger.warn(`[LocatorResolver] ⚠️ Multiple locator candidates detected for '${key[0]}'. Using the first.`);
        }
        key = key[0];
      }

      let expr = key;

      // If locator is stored in objectMap
      if (objectMap[key as string]) {
        const locators = objectMap[key as string];
        if (!locators || locators.length === 0) throw new Error(`No locator entry found in objectMap for '${key}'`);
        expr = locators[0];
      }

      return this.resolveExpression(expr);
    } catch (error: any) {
      logger.error(`[LocatorResolver] ❌ : Failed to resolve '${key}': ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle locator expression logic and variable substitution
   * @param expr The locator expression string
   */
  public async resolveExpression(expr: string): Promise<Locator> {
    expr = expr.trim();

    // Replace ${variable} with storeValue variable (read fresh from file)
    expr = expr.replace(/\$\{(\w+)\}/g, (_, varName) => {
      const value = getValue(varName);
      if (value !== undefined) return value;
      throw new Error(`Variable '${varName}' not found in storeValue`);
    });

    // XPath
    if (expr.startsWith('//') || expr.startsWith('/') || expr.startsWith('(')) {
      return this.page.locator(`xpath=${expr}`);
    }

    // CSS, ID, text= locators (Playwright style)
    if (expr.startsWith('css=') || expr.startsWith('id=') || expr.startsWith('text=')) {
      return this.page.locator(expr);
    }

    // If the locator string matches a property from page object model
    if (/^locator\(/i.test(expr) || expr.includes('getBy')) {
      try {
        const locator = eval(`this.page.${expr}`);
        return locator;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err: any) {
        throw new Error(`Invalid locator expression: ${expr}`);
      }
    }

    // If not recognized, assume it's a selector
    return this.page.locator(expr);
  }

  /**
   * Try multiple locators until one works (fallback mechanism)
   */
  public async resolveBestMatch(key: string): Promise<Locator> {
    const exprList = objectMap[key];
    if (!exprList || exprList.length === 0) {
      throw new Error(`Locator '${key}' not found in objectMap.`);
    }

    for (const [index, expr] of exprList.entries()) {
      try {
        const locator = await this.resolveExpression(expr);
        const isVisible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) return locator;
      } catch (err) {
        logger.warn(`[LocatorResolver] ⚠️ Locator candidate #${index + 1} failed for '${key}': ${err}`);
      }
    }

    throw new Error(`No valid locator found for '${key}'`);
  }
}
