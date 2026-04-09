import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { expectsEnterSuccess, expectsEnterBlocked } from '../../expectedResult';
import { logger } from '../../helpers/logger';
import { StepExecutor } from '../StepExecutor';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/** Execution modes for the Enter action */
type EnterExecutionType = 'normal-fill' | 'blocked-fill' | 'validate-fill';
/**
 * EnterActionHandler
 *
 * Handles text input actions for form fields. Supports entering values into
 * input fields, textareas, and other editable elements with automatic
 * variable resolution and value verification.
 *
 * **Supported Keywords:** `enter`, `fill`
 *
 * **Execution Modes:**
 * | Mode            | Trigger (Expected Result)          | Behavior                                    |
 * |-----------------|------------------------------------|---------------------------------------------|
 * | `validate`      | Contains success keywords          | Enters value and verifies it was filled     |
 * | `readonly-check`| Contains blocked keywords          | Verifies field rejects input (read-only)    |
 * | `normal`        | Empty or no matching keywords      | Enters value without validation             |
 *
 * **Usage Examples:**
 *
 * 1. Single Field Entry:
 * | Action                          | Data              | Expected Result           |
 * |---------------------------------|-------------------|---------------------------|
 * | Enter 'Username'                | john.doe          |                           |
 * | Fill 'Email Address'            | test@example.com  | Email entered successfully|
 *
 * 2. Multiple Fields (comma-separated data):
 * | Action                                    | Data              | Expected Result |
 * |-------------------------------------------|-------------------|-----------------|
 * | Enter 'First Name' and 'Last Name'        | John, Doe         |                 |
 * | Fill 'City', 'State', 'Zip'               | Austin, TX, 78701 |                 |
 *
 * 3. Using Stored Variables:
 * | Action                          | Data              | Expected Result |
 * |---------------------------------|-------------------|-----------------|
 * | Enter 'Username'                | {{storedUser}}    |                 |
 * | Fill 'Order ID'                 | {{orderId}}       |                 |
 *
 * 4. Read-Only Field Validation:
 * | Action                          | Data              | Expected Result               |
 * |---------------------------------|-------------------|-------------------------------|
 * | Enter 'Locked Field'            | test              | Field should not be entered   |
 * | Fill 'Disabled Input'           | value             | Field is disabled             |
 *
 * **Data Format Options:**
 * | Format                | Example                    | Description                    |
 * |-----------------------|----------------------------|--------------------------------|
 * | Single value          | "John"                     | Fills single field             |
 * | Comma-separated       | "John, Doe, 30"            | Fills multiple fields in order |
 * | Semicolon-separated   | "John; Doe; 30"            | Alternative delimiter          |
 * | Pipe-separated        | "John \| Doe \| 30"        | Alternative delimiter          |
 * | Variable reference    | "{{variableName}}"         | Resolves stored variable       |
 *
 * **Key Features:**
 * - Variable resolution via `{{variableName}}` syntax
 * - Multi-field support with comma/semicolon/pipe delimiters
 * - Value verification based on expected result keywords
 * - Read-only/disabled field detection
 * - Network idle wait before entering text
 * - Multi-locator fallback from objectMap
 *
 * **Notes:**
 * - For dropdowns, use DropdownActionHandler
 * - For checkboxes, use CheckActionHandler
 * - Clears existing value before entering new value
 *
 * @see StoreActionHandler - for storing values to use later
 * @see DropdownActionHandler - for dropdown selections
 * @since 1.0.0
 */
export class EnterActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    const firstWord = action.trim().split(' ')[0].toLowerCase();
    // Exclude 'entergrid' which is handled by typeActionHandler
    if (firstWord === 'entergrid') return false;
    return /enter|fill/i.test(firstWord);
  }

  public customSplitRespectingQuotes(input: string): string[] {
    if (input === null) return [];
    const s = input.toString().trim();
    const regex = /"([^"\\]*(\\.[^"\\]*)*)"|'([^'\\]*(\\.[^'\\]*)*)'|[^,;|]+/g;
    const parts: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(s)) !== null) {
      if (m[1] !== undefined) {
        // double-quoted
        parts.push(m[1].replace(/\\(["\\])/g, '$1').trim());
      } else if (m[3] !== undefined) {
        // single-quoted
        parts.push(m[3].replace(/\\(['\\])/g, '$1').trim());
      } else {
        parts.push(m[0].trim());
      }
      // consume possible delimiter (regex already moves forward)
    }
    // filter out empty items
    return parts.map((p) => p.trim()).filter(Boolean);
  }

  async execute(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    // Track context for error formatting
    let elementNames: string[] = [];

    try {
      // Extract quoted field names like 'Minimum Temperature'
      const matches = [...action.matchAll(/[''']([^''']+)[''']/g)].map((m) => m[1]);
      if (matches.length === 0) {
        throw new Error(`No quoted text found in action: '${action}'`);
      }
      elementNames = matches;

      const stepExecutor = new StepExecutor(this.page);

      // Resolve data array based on input type
      const dataArray = await this.resolveDataArray(data, matches, step, stepExecutor);

      // Determine execution mode and fill fields
      const executionType = this.getExecutionTypeFromExpectedResult(result);
      await this.fillFields(matches, dataArray, executionType);

      return true;
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }

      // Enrich error with context
      const pageCtx = await getPageContext(this.page);
      throw formatStepError(error, {
        handler: 'EnterActionHandler',
        action,
        elementName: elementNames.join(', '),
        locatorExpression: elementNames.map((e) => locatorToString(objectMap[e])),
        inputData: typeof data === 'string' ? data : JSON.stringify(data),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }

  /**
   * Determines the fill mode based on the expected result string.
   * IMPORTANT: Check "blocked" conditions FIRST as they are more specific.
   * Example: "values should not be entered" contains both "entered" and "not be entered"
   * We must prioritize "not be entered" (readonly-check) over "entered" (validate).
   * @param result The expected result from the test case
   * @returns The fill mode to use
   */
  private getExecutionTypeFromExpectedResult(result: any): EnterExecutionType {
    // Check "blocked" FIRST - more specific condition takes priority
    if (expectsEnterBlocked(result)) return 'blocked-fill';
    // Then check for success keywords
    if (expectsEnterSuccess(result)) return 'validate-fill';
    return 'normal-fill';
  }

  /**
   * Unified method to fill fields based on the execution mode.
   * @param fields Array of field names
   * @param dataArray Array of data values
   * @param executionType The fill mode determining validation behavior
   */
  private async fillFields(fields: string[], dataArray: string[], executionType: EnterExecutionType): Promise<void> {
    logger.info(`[EnterActionHandler] fillFields starts with Mode: ${executionType}`);
    for (const [i, field] of fields.entries()) {
      await this.processSingleField(field, dataArray[i], executionType);
    }
    logger.info(`[EnterActionHandler] end with Mode: ${executionType}`);
  }

  /**
   * Resolves data array based on input type.
   * Orchestrates type-specific resolution methods.
   * @param data Input data (array, string, number, or object)
   * @param fields Field names to match
   * @param step Optional step object for fallback data
   * @param stepExecutor StepExecutor instance for variable resolution
   * @returns Resolved and normalized array of string values
   */
  private async resolveDataArray(
    data: any,
    fields: string[],
    step: any,
    stepExecutor: StepExecutor
  ): Promise<string[]> {
    let dataArray: string[] = [];

    if (Array.isArray(data)) {
      dataArray = await this.resolveFromArray(data, stepExecutor);
    } else if (typeof data === 'string' || typeof data === 'number') {
      dataArray = await this.resolveFromString(data.toString(), fields.length, stepExecutor);
    } else if (data && typeof data === 'object') {
      dataArray = await this.resolveFromObject(data, fields, stepExecutor);
    } else if (step?.result) {
      const resolved = await stepExecutor.resolveData(step.result.toString());
      dataArray = Array(fields.length).fill(resolved);
    }

    return this.normalizeDataArray(dataArray, fields.length);
  }

  /**
   * Resolves data from array input.
   * @param data Array of data values
   * @param stepExecutor StepExecutor for variable resolution
   * @returns Resolved array of string values
   */
  private async resolveFromArray(data: any[], stepExecutor: StepExecutor): Promise<string[]> {
    return Promise.all(data.map((d) => stepExecutor.resolveData(d.toString())));
  }

  /**
   * Resolves data from string input with delimiter support.
   * Supports comma, semicolon, or pipe as delimiters.
   * Respects quoted values like "hsf,hsgf" as single values.
   * @param dataStr The input string
   * @param fieldCount Number of fields to fill
   * @param stepExecutor StepExecutor for variable resolution
   * @returns Resolved array of string values
   */
  private async resolveFromString(dataStr: string, fieldCount: number, stepExecutor: StepExecutor): Promise<string[]> {
    const splitValues = this.customSplitRespectingQuotes(dataStr);

    if (splitValues.length === 0) {
      throw new Error(`No valid data found in string: '${dataStr}'`);
    }

    if (splitValues.length === fieldCount) {
      return Promise.all(splitValues.map((d) => stepExecutor.resolveData(d)));
    } else if (splitValues.length === 1) {
      const resolved = await stepExecutor.resolveData(splitValues[0]);
      return Array(fieldCount).fill(resolved);
    }

    throw new Error(`Data count (${splitValues.length}) does not match field count (${fieldCount})`);
  }

  /**
   * Resolves data from object input.
   * Supports objects with 'parameters' array or direct key-value pairs.
   * @param data The input object
   * @param fields The field names to match
   * @param stepExecutor StepExecutor for variable resolution
   * @returns Resolved array of string values
   */
  private async resolveFromObject(
    data: Record<string, any>,
    fields: string[],
    stepExecutor: StepExecutor
  ): Promise<string[]> {
    if (Array.isArray(data.parameters)) {
      return Promise.all(
        fields.map(async (key) => {
          const paramObj = data.parameters.find((p: any) => p.name === key);
          if (paramObj?.value !== undefined) {
            return stepExecutor.resolveData(paramObj.value.toString());
          }
          if (data[key] !== undefined) {
            return stepExecutor.resolveData(data[key].toString());
          }
          throw new Error(`No data found for field '${key}'`);
        })
      );
    }

    return Promise.all(
      fields.map((key) => {
        if (data[key] === undefined) {
          throw new Error(`No data found for field '${key}'`);
        }
        return stepExecutor.resolveData(data[key].toString());
      })
    );
  }

  /**
   * Normalizes data array to match field count.
   * If single value provided, expands it to fill all fields.
   * @param dataArray The resolved data array
   * @param fieldCount Number of fields to fill
   * @returns Normalized data array
   */
  private normalizeDataArray(dataArray: string[], fieldCount: number): string[] {
    if (dataArray.length < fieldCount) {
      if (dataArray.length === 1) {
        return Array(fieldCount).fill(dataArray[0]);
      }
      throw new Error(`Insufficient data provided. Expected ${fieldCount} but got ${dataArray.length}`);
    }
    return dataArray;
  }

  /**
   * Unified method to process a single field based on mode.
   * Handles locator resolution, network wait, and mode-specific fill/validation logic.
   *
   * @param key The field name (locator key)
   * @param value The value to enter or attempt
   * @param mode The fill mode determining behavior
   */
  private async processSingleField(key: string, value: string, mode: EnterExecutionType): Promise<void> {
    const exprList = objectMap[key];
    if (!exprList?.length) {
      throw new Error(`Locator '${key}' not found in objectMap.`);
    }

    for (const [index, expr] of exprList.entries()) {
      try {
        const locator = await this.getLocator(expr);
        // await this.page.waitForLoadState('networkidle');

        switch (mode) {
          case 'normal-fill':
            await this.executeNormalFill(locator, key, value);
            return;

          case 'validate-fill':
            await this.executeValidatedFill(locator, key, value);
            return;

          case 'blocked-fill':
            await this.executeReadOnlyCheck(locator, key, value);
            return;
        }
      } catch (err: any) {
        // For blocked-fill, some errors indicate success (field blocked input)
        if (mode === 'blocked-fill' && this.isReadOnlyPassError(err)) {
          logger.info(`[EnterActionHandler] Field '${key}' is not enterable: ${err.message} - PASS`);
          return;
        }

        logger.warn(`[EnterActionHandler] Locator #${index + 1} failed for '${key}': ${err.message}`);
        if (index === exprList.length - 1) {
          throw new Error(`All locators for '${key}' failed. Last error: ${err.message}`);
        }
      }
    }
  }

  /**
   * Executes normal fill without validation.
   */
  private async executeNormalFill(locator: any, key: string, value: string): Promise<void> {
    await locator.fill(value, { timeout: TIMEOUTS.fill });
    logger.info(`[EnterActionHandler] Entered value '${value}' into '${key}'`);
  }

  /**
   * Executes fill with post-validation to verify value was entered.
   */
  private async executeValidatedFill(locator: any, key: string, expectedValue: string): Promise<void> {
    // Fill and validate
    await locator.fill(expectedValue, { timeout: TIMEOUTS.fill });
    logger.info(`[EnterActionHandler] Entered value '${expectedValue}' into '${key}'`);

    const actualValue = await locator.inputValue();
    if (actualValue !== expectedValue) {
      const errorMsg =
        expectedValue !== '' && !actualValue
          ? `Value validation failed for field '${key}': expected '${expectedValue}', but field is empty`
          : `Value mismatch in field '${key}': expected '${expectedValue}', but found '${actualValue}'`;
      throw new Error(errorMsg);
    }
    logger.info(`[EnterActionHandler] Validated field '${key}' has correct value '${expectedValue}'`);
  }

  /**
   * Verifies field is read-only/disabled and does not accept input.
   */
  private async executeReadOnlyCheck(locator: any, key: string, valueToAttempt: string): Promise<void> {
    // Field appears editable - attempt to enter and verify it's blocked
    logger.info(`[EnterActionHandler] Field '${key}' appears editable - attempting to enter value to verify...`);
    const valueBefore = await locator.inputValue().catch(() => '');

    try {
      await locator.fill(valueToAttempt, { timeout: TIMEOUTS.fill });
    } catch {
      logger.info(`[EnterActionHandler] Field '${key}' blocked the entry attempt - PASS`);
      return;
    }

    // Check if value was actually entered
    const valueAfter = await locator.inputValue().catch(() => '');

    if (valueAfter === valueToAttempt) {
      await locator.clear().catch(() => {});
      throw new Error(`Field '${key}' accepted the value '${valueToAttempt}' but expected it NOT to be entered.`);
    }
    if (valueAfter === valueBefore) {
      logger.info(`[EnterActionHandler] Field '${key}' did not accept the value (unchanged) - PASS`);
      return;
    }

    await locator.clear().catch(() => {});
    throw new Error(
      `Field '${key}' accepted input (changed from '${valueBefore}' to '${valueAfter}'). Expected NOT to accept.`
    );
  }

  /**
   * Checks if an error indicates readonly behavior (which is a PASS for readonly-check mode).
   */
  private isReadOnlyPassError(err: any): boolean {
    if (!err.message) return false;
    // First check for intentional FAIL errors - these should NOT be treated as pass
    const isIntentionalFail =
      err.message.includes('accepted the value') ||
      err.message.includes('accepted input') ||
      err.message.includes('Expected NOT to accept');
    if (isIntentionalFail) return false;

    // Check for read-only indicators
    return (
      err.message.includes('Element is not an <input>') ||
      err.message.includes('not editable') ||
      err.message.includes('disabled') ||
      err.message.includes('readonly') ||
      err.message.includes('Cannot type into') ||
      err.message.includes('not an input element')
    );
  }
}
