import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { expectsTypeSuccess, expectsTypeBlocked } from '../../expectedResult';
import { logger } from '../../helpers/logger';
import { StepExecutor } from '../StepExecutor';
import { TIMEOUTS } from '../../config/timeouts.config';
import { SELECTORS } from '../../config/selectors.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/** Execution modes for the Type action */
type TypeExecutionType = 'normal-type' | 'blocked-type' | 'validate-type';

/**
 * TypeActionHandler
 *
 *
 * Handles keyboard typing actions for input fields. Supports single and
 * multiple field entry with various data formats including arrays, strings,
 * and object parameters.
 *
 * Supported Keywords: `type`, `entergrid`
 *
 * **Execution Modes:**
 * | Mode            | Trigger (Expected Result)          | Behavior                                    |
 * |-----------------|------------------------------------|---------------------------------------------|
 * | `validate`      | Contains success keywords          | Types value and verifies it was typed       |
 * | `readonly-check`| Contains blocked keywords          | Verifies field rejects input (read-only)    |
 * | `normal`        | Empty or no matching keywords      | Types value without validation              |
 *
 * Usage Examples:
 * | Action                                           | Data                    | Expected Result                          |
 * |--------------------------------------------------|-------------------------|------------------------------------------|
 * | Type 'Username'                                  | john.doe                | Text typed into Username field           |
 * | Type 'Email'                                     | {{email}}               | Stored value typed into Email field      |
 * | Type 'First Name' and 'Last Name'                | John, Doe               | Values typed into respective fields      |
 *
 * | Type 'Min Temp' and 'Max Temp'                   | "10,20", "30,40"        | Quoted values preserve commas            |
 * | Type 'Search'                                    | [random:email]          | Random email generated and typed         |
 *
 * Data Format Support:
 * | Format          | Example                    | Description                              |
 * |-----------------|----------------------------|------------------------------------------|
 * | Single value    | john.doe                   | Types same value to all fields           |
 * | Comma-separated | John, Doe                  | Maps values to fields in order           |
 * | Quoted values   | "a,b", "c,d"               | Preserves commas within quotes           |
 * | Array           | ["val1", "val2"]           | Maps array items to fields               |
 * | Store reference | {{variableName}}           | Uses stored value from storeManager      |
 * | Random data     | [random:email]             | Generates random data                    |
 *
 * Key Features:
 * - Multi-field support: Type into multiple fields in one action
 * - Quote-aware parsing: Commas inside quotes are preserved
 * - Dynamic data resolution: Supports {{variables}} and [random:type]
 * - PrimeNG support: Handles custom autocomplete/chips components
 * - Auto-clear: Clears existing value before typing
 * - Multi-locator fallback: Tries all locators in objectMap
 *
 * Notes:
 * - Field names must be quoted in action string
 * - Use 'and' to separate multiple field names
 * - For special keys (Enter, Tab), use EnterActionHandler
 *
 * @see EnterActionHandler for text entry with Enter key
 * @see StepExecutor for data resolution
 * @since 1.0.0
 */
export class TypeActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    const firstWord = action.trim().split(' ')[0].toLowerCase();
    return /type|entergrid/i.test(firstWord);
  }

  /**
   * Split a string into parts by comma/semicolon/pipe but respect quoted substrings.
   * Supports single and double quotes. Trims whitespace around unquoted parts.
   *
   * Examples:
   *  - '"a,b","c"' => ['a,b','c']
   *  - "one,two" => ['one','two']
   */
  private customSplitRespectingQuotes(input: string): string[] {
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
    // const page = this.page;

    try {
      // Extract quoted field names like ‘Minimum Temperature’
      const matches = [...action.matchAll(/[‘'’]([^‘'’]+)[‘'’]/g)].map((m) => m[1]);
      if (matches.length === 0) {
        throw new Error(`No quoted text found in action: '${action}'`);
      }

      const stepExecutor = new StepExecutor(this.page);

      // Resolve data array based on input type
      const dataArray = await this.resolveDataArray(data, matches, step, stepExecutor);

      // Determine execution mode based on expected result
      const executionType = this.getExecutionTypeFromExpectedResult(result);

      // Check for EnterGrid action (click grid cell before typing)
      const isClickAndEnter = /EnterGrid/i.test(action.trim());
      if (isClickAndEnter) {
        await this.handleEnterGridClick(matches[0]);
      }

      // Type into each field
      await this.typeFields(matches, dataArray, executionType);

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
        handler: 'TypeActionHandler',
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
   * Determines the type mode based on the expected result string.
   * IMPORTANT: Check "blocked" conditions FIRST as they are more specific.
   * Example: "values should not be typed" contains both "typed" and "not be typed"
   * We must prioritize "not be typed" (readonly-check) over "typed" (validate).
   * @param result The expected result from the test case
   * @returns The type mode to use
   */
  private getExecutionTypeFromExpectedResult(result: any): TypeExecutionType {
    // Check "blocked" FIRST - more specific condition takes priority
    if (expectsTypeBlocked(result)) return 'blocked-type';
    // Then check for success keywords
    if (expectsTypeSuccess(result)) return 'validate-type';
    return 'normal-type';
  }

  /**
   * Unified method to type into fields based on the execution mode.
   * @param fields Array of field names
   * @param dataArray Array of data values
   * @param executionType The type mode determining validation behavior
   */
  private async typeFields(fields: string[], dataArray: string[], executionType: TypeExecutionType): Promise<void> {
    logger.info(`[TypeActionHandler] typeFields starts with Mode: ${executionType}`);
    for (const [i, field] of fields.entries()) {
      await this.processSingleField(field, dataArray[i], executionType);
    }
    logger.info(`[TypeActionHandler] typeFields end with Mode: ${executionType}`);
  }

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
   */
  private async resolveFromArray(data: any[], stepExecutor: StepExecutor): Promise<string[]> {
    return Promise.all(data.map((d) => stepExecutor.resolveData(d.toString())));
  }

  /**
   * Resolves data from string input with delimiter support.
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
   * Handles EnterGrid action - clicks grid cell before typing.
   */
  private async handleEnterGridClick(fieldName: string): Promise<void> {
    logger.info('[TypeActionHandler] Action identified as EnterGrid - will click grid cell before entering data');

    // Convert to col-id format → chemicalDescription ecNumber
    const gridKey = fieldName
      .split(' ')
      .map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1)))
      .join('');

    const cellLocator = this.page.locator(SELECTORS.grid.cell(gridKey)).first();
    logger.info(`[TypeActionHandler] Created specific locator for EnterGrid: ${SELECTORS.grid.cell(gridKey)}`);

    try {
      await cellLocator.waitFor({ state: 'attached', timeout: 5000 });
      await cellLocator.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await this.ensureVisible(cellLocator, 3000, 5000);

      // Double-click to activate edit mode (some grids require double-click)
      await cellLocator.dblclick({ timeout: TIMEOUTS.type }).catch(async () => {
        await cellLocator.click({ timeout: TIMEOUTS.type });
      });

      // Wait for input to become available after click
      const inputLocator = this.page.locator(SELECTORS.grid.cellInput(gridKey)).first();
      await inputLocator.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {
        logger.warn(
          `[TypeActionHandler] Input inside grid cell '${gridKey}' not found, continuing with objectMap locator`
        );
      });

      await this.page.waitForTimeout(500);
      logger.info(`[TypeActionHandler] Clicked grid cell '${gridKey}' successfully`);
    } catch (err) {
      logger.warn(`[TypeActionHandler] Click on grid cell '${gridKey}' failed: ${err}`);
    }
  }

  /**
   * Ensures locator is visible/attached before interacting.
   */
  private async ensureVisible(locator: any, timeoutAttached = 3000, timeoutVisible = 5000): Promise<void> {
    try {
      await locator.waitFor({ state: 'attached', timeout: timeoutAttached }).catch(() => {});
      await locator.waitFor({ state: 'visible', timeout: timeoutVisible });
    } catch (err) {
      throw new Error(`Element not visible/attached within ${timeoutVisible}ms: ${err}`);
    }
  }

  /**
   * Unified method to process a single field based on mode.
   * Handles locator resolution, network wait, and mode-specific type/validation logic.
   */
  private async processSingleField(key: string, value: string, mode: TypeExecutionType): Promise<void> {
    const exprList = objectMap[key];
    if (!exprList?.length) {
      throw new Error(`Locator '${key}' not found in objectMap.`);
    }

    for (const [index, expr] of exprList.entries()) {
      try {
        const locator = await this.getLocator(expr);
        await this.page.waitForLoadState('networkidle').catch(() => {});

        switch (mode) {
          case 'normal-type':
            await this.executeNormalType(locator, key, value);
            return;

          case 'validate-type':
            await this.executeValidatedType(locator, key, value);
            return;

          case 'blocked-type':
            await this.executeReadOnlyCheck(locator, key, value);
            return;
        }
      } catch (err: any) {
        // For blocked-type, some errors indicate success (field blocked input)
        if (mode === 'blocked-type' && this.isReadOnlyPassError(err)) {
          logger.info(`[TypeActionHandler] Field '${key}' is not typable: ${err.message} - PASS`);
          return;
        }

        // Check if this is a validation error (not a locator error) - throw immediately
        if (this.isValidationError(err)) {
          throw err;
        }

        // Locator-related error - try next locator if available
        logger.warn(`[TypeActionHandler] Locator #${index + 1} failed for '${key}': ${err.message}`);
        if (index === exprList.length - 1) {
          throw new Error(`All locators for '${key}' failed. Last error: ${err.message}`);
        }
      }
    }
  }

  /**
   * Checks if an error is a validation error (not a locator resolution error).
   * Validation errors should be thrown immediately without trying other locators.
   */
  private isValidationError(err: any): boolean {
    if (!err.message) return false;
    return (
      err.message.includes('accepted the value') ||
      err.message.includes('accepted input') ||
      err.message.includes('Expected NOT to accept') ||
      err.message.includes('Value validation failed') ||
      err.message.includes('Value mismatch') ||
      err.message.includes('is read-only/disabled but expected to type')
    );
  }

  /**
   * Executes normal type without validation.
   * Types each character one by one for visual feedback.
   */
  private async executeNormalType(locator: any, key: string, value: string): Promise<void> {
    try {
      await this.ensureVisible(locator, 2000, 3000);
    } catch (e) {
      logger.warn(`[TypeActionHandler] Locator '${key}' not visible in expected time: ${e}`);
    }

    try {
      await locator.click({ timeout: TIMEOUTS.click });
    } catch (clickErr) {
      logger.warn(`[TypeActionHandler] Click attempt on locator for '${key}' failed: ${clickErr}`);
    }

    await locator.clear({ timeout: TIMEOUTS.type });
    for (const char of value) {
      await locator.pressSequentially(char, { delay: 100, timeout: TIMEOUTS.type });
    }

    logger.info(`[TypeActionHandler] Typed value '${value}' into '${key}'`);
  }

  /**
   * Executes type with post-validation to verify value was typed.
   */
  private async executeValidatedType(locator: any, key: string, expectedValue: string): Promise<void> {
    // Check if field is editable
    const isFieldReadOnly = await this.isFieldReadOnly(locator);
    if (isFieldReadOnly) {
      throw new Error(`Field '${key}' is read-only/disabled but expected to type value '${expectedValue}'`);
    }

    // Type and validate
    await this.executeNormalType(locator, key, expectedValue);

    const actualValue = await locator.inputValue();
    if (actualValue !== expectedValue) {
      const errorMsg =
        expectedValue !== '' && !actualValue
          ? `Value validation failed for field '${key}': expected '${expectedValue}', but field is empty`
          : `Value mismatch in field '${key}': expected '${expectedValue}', but found '${actualValue}'`;
      throw new Error(errorMsg);
    }
    logger.info(`[TypeActionHandler] Validated field '${key}' has correct value '${expectedValue}'`);
  }

  /**
   * Verifies field is read-only/disabled and does not accept input.
   */
  private async executeReadOnlyCheck(locator: any, key: string, valueToAttempt: string): Promise<void> {
    // Check if obviously read-only
    const isFieldReadOnly = await this.isFieldReadOnly(locator);
    if (isFieldReadOnly) {
      logger.info(`[TypeActionHandler] Field '${key}' is read-only/disabled - value cannot be typed - PASS`);
      return;
    }

    // Field appears editable - attempt to type and verify it's blocked
    logger.info(`[TypeActionHandler] Field '${key}' appears editable - attempting to type value to verify...`);
    const valueBefore = await locator.inputValue().catch(() => '');

    try {
      await locator.clear({ timeout: TIMEOUTS.type });
      for (const char of valueToAttempt) {
        await locator.pressSequentially(char, { delay: 100, timeout: TIMEOUTS.type });
      }
    } catch {
      logger.info(`[TypeActionHandler] Field '${key}' blocked the type attempt - PASS`);
      return;
    }

    // Check if value was actually typed
    const valueAfter = await locator.inputValue().catch(() => '');

    if (valueAfter === valueToAttempt) {
      await locator.clear().catch(() => {});
      throw new Error(`Field '${key}' accepted the value '${valueToAttempt}' but expected it NOT to be typed.`);
    }
    if (valueAfter === valueBefore) {
      logger.info(`[TypeActionHandler] Field '${key}' did not accept the value (unchanged) - PASS`);
      return;
    }

    await locator.clear().catch(() => {});
    throw new Error(
      `Field '${key}' accepted input (changed from '${valueBefore}' to '${valueAfter}'). Expected NOT to accept.`
    );
  }

  /**
   * Checks if a field is read-only or disabled.
   */
  private async isFieldReadOnly(locator: any): Promise<boolean> {
    const isDisabled = await locator.isDisabled().catch(() => false);
    const isEditable = await locator.isEditable().catch(() => true);
    return isDisabled || !isEditable;
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
