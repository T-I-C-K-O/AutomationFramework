import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { saveValue } from '../../data/storeManager';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/**
 * StoreActionHandler
 *
 * Extracts and stores element values for later use in test cases. Captures
 * text or input values from elements and saves them to the store manager
 * for use in subsequent test steps.
 *
 * Supported Keywords: `store`, `save`, `get`
 *
 * Usage Examples:
 * | Action                                      | Data | Expected Result                    |
 * |---------------------------------------------|------|------------------------------------|
 * | Store 'Product Id' as ProductId             |      | Value stored in ProductId variable |
 * | Store the 'Order Number' as orderNum        |      | Value stored in orderNum variable  |
 * | Store value of 'Total Price' as totalAmount |      | Value stored in totalAmount        |
 * | Save 'Customer Name' as custName            |      | Value stored in custName variable  |
 * | Get 'Reference Code' as refCode             |      | Value stored in refCode variable   |
 *
 * Value Extraction by Element Type:
 * | Element Type | Extraction Method |
 * |-------------|-------------------|
 * | input       | Uses inputValue() |
 * | textarea    | Uses inputValue() |
 * | select      | Uses inputValue() |
 * | Other       | Uses textContent() |
 *
 * Key Features:
 * - Supports multiple locator fallback (tries all locators in objectMap)
 * - Automatically detects element type for appropriate value extraction
 * - Stores values in storeManager for cross-step access
 * - Values are trimmed before storage
 * - Waits for element visibility before extraction
 *
 * Notes:
 * - Variable names should be alphanumeric (no spaces)
 * - Stored values can be accessed using {{variableName}} syntax in subsequent steps
 * - Uses saveValue from storeManager to persist values
 *
 * @see UncheckActionHandler for unchecking functionality
 * @since 1.0.0
 */
export class StoreActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    const firstWord = action.trim().split(' ')[0].toLowerCase();
    return /store|store|get/i.test(firstWord);
  }

  async execute(action: string, data?: any, _result?: any, _step?: any): Promise<boolean> {
    const page = this.page;

    try {
      //  Match any of these:
      // "Store 'Product Id' as ProductId"
      // "Store the 'Product Id' as ProductId"
      // "Store value of 'Product Id' as 'ProductId'"
      const match = /store\s+(?:the\s+|value\s+of\s+)?[‘'’]([^‘'’]+)[‘'’]\s+as\s+[‘'’]?([^‘'’\s]+)[‘'’]?/i.exec(action);

      if (!match) throw new Error(`Invalid store syntax in action: '${action}'`);

      const [, sourceKey, targetKey] = match;

      const exprList = objectMap[sourceKey];
      if (!exprList || exprList.length === 0) throw new Error(`Locator '${sourceKey}' not found in objectMap.`);

      let storedValue: string | null = null;

      for (const [index, expr] of exprList.entries()) {
        try {
          const locator = await this.getLocator(expr);
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(TIMEOUTS.storeValue); // configurable wait

          await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.elementVisible });

          const tagName = await locator.evaluate((el) => el.tagName.toLowerCase());
          if (['input', 'textarea', 'select'].includes(tagName)) {
            storedValue = await locator.inputValue();
          } else {
            storedValue = (await locator.textContent())?.trim() || '';
          }

          if (!storedValue) {
            logger.warn(
              `[StoreActionHandler] No value found for '${sourceKey}' (locator index ${index + 1}). Trying next...`
            );
            continue;
          }

          await new Promise((res) => setTimeout(res, TIMEOUTS.mediumDelay));
          saveValue(targetKey, storedValue.trim());
          // configurable delay
          logger.info(`[StoreActionHandler] Stored value '${storedValue.trim()}' into variable '${targetKey}'`);
          return true;
        } catch (err: any) {
          logger.warn(`[StoreActionHandler] Locator #${index + 1} failed for '${sourceKey}': ${err.message || err}`);
        }
      }

      throw new Error(`All locators for '${sourceKey}' failed (store).`);
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
        handler: 'StoreActionHandler',
        action,
        elementName,
        locatorExpression: locatorToString(objectMap[elementName]),
        inputData: typeof data === 'string' ? data : JSON.stringify(data),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }
}
