import { logger } from '../helpers/logger';
import { storeValue } from '../testdata/storeValue';
import { resolveRuntimeData } from '../data/runtimeDataResolver';

export interface TestStep {
  action: string;
  data?: string | Record<string, any>;
  result?: string;
}

/**
 * StepParser
 * ----------
 * Handles:
 *  - Parsing of raw JSON / string test steps
 *  - Variable substitution (${variable})
 *  - Xray / Wiki link cleanup
 *  - Input validation
 */
export class StepParser {
  /**
   * Parses a raw step input — could be a stringified JSON or object.
   */
  public parse(rawStep: TestStep | string): TestStep {
    if (typeof rawStep === 'string') {
      return this.parseFromString(rawStep);
    }
    return this.stepSanityCheck(rawStep);
  }

  /**
   * Replaces ${variable} or ${object.variable} placeholders in step fields.
   * Also resolves {{dynamicFunction}} placeholders for runtime data generation.
   *
   * Supported placeholder patterns:
   * - ${paramName} - Parameter from Excel iteration data
   * - {{today}} - Today's date
   * - {{uuid}} - Generated UUID
   * - {{addDays(5)}} - Date arithmetic
   * - {{randomEmail}} - Random email
   * - {{storedVariable}} - Value from storeManager
   *
   * @see utils/dataGenerators/runtimeDataResolver for all available placeholders
   */
  public replaceParameters(step: TestStep, iterationData: any): TestStep {
    const parameters = iterationData?.parameters || iterationData?.excelParameters || [];

    let { action, data, result } = step;

    // Step 1: Replace ${variable} placeholders from iteration parameters
    if (Array.isArray(parameters) && parameters.length > 0) {
      for (const param of parameters) {
        const safeName = param.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const pattern = new RegExp(`\\$\\{(?:[a-zA-Z0-9_]+\\.)?(?:"${safeName}"|${safeName})\\}`, 'g');

        if (typeof action === 'string') action = action.replace(pattern, param.value);
        if (typeof data === 'string') data = data.replace(pattern, param.value);
        if (typeof result === 'string') result = result.replace(pattern, param.value);
      }
    }

    // Step 2: Resolve {{dynamicFunction}} placeholders (dates, UUIDs, random data, stored values)
    try {
      if (typeof action === 'string' && action.includes('{{')) {
        action = resolveRuntimeData(action);
      }
      if (typeof data === 'string' && data.includes('{{')) {
        data = resolveRuntimeData(data);
      } else if (typeof data === 'object' && data !== null) {
        data = resolveRuntimeData(data);
      }
      if (typeof result === 'string' && result.includes('{{')) {
        result = resolveRuntimeData(result);
      }
    } catch (error: any) {
      logger.warn(`[StepParser] Failed to resolve runtime placeholders: ${error.message}`);
      // Continue with unresolved placeholders - they might be handled later or be stored values
    }

    return { action, data, result };
  }

  /**
   * Parses the `data` field if it's a valid JSON object.
   */
  public parseData(data: string): any {
    try {
      return JSON.parse(this.cleanXrayWikiLinks(data));
    } catch (err) {
      logger.error(`[StepParser] ❌ Invalid JSON in step data: ${data}`);
      throw err;
    }
  }

  /**
   * Parses a raw step JSON string.
   */
  private parseFromString(raw: string): TestStep {
    try {
      const cleaned = this.cleanXrayWikiLinks(raw);
      return JSON.parse(cleaned);
    } catch (err) {
      logger.error(`[StepParser] ❌ Failed to parse step string: ${raw}`);
      throw err;
    }
  }

  /**
   * Validates that required fields are present.
   */
  private stepSanityCheck(step: TestStep): TestStep {
    if (!step.action) {
      throw new Error(`Missing 'action' in step: ${JSON.stringify(step)}`);
    }
    return step;
  }

  /**
   * Replaces Xray wiki-style `[text|https://link]` patterns with plain URLs.
   */
  private cleanXrayWikiLinks(raw: string): string {
    return raw.replace(/\[(.*?)\|(https?:\/\/[^\]]+)\]/g, '"$2"');
  }

  /**
   * Cleans URLs extracted from wiki patterns.
   */
  public cleanUrl(url: string): string {
    const match = /\[.*?\|(https?:\/\/[^\]]+)\]/.exec(url);
    return match?.[1] || url;
  }

  /**
   * Resolves a `[storedValue]` style variable from storeValue.
   */
  public async resolveData(input: string): Promise<string> {
    const bracketMatch = /^\[(.+?)\]$/.exec(input.trim());
    if (bracketMatch) {
      const varName = bracketMatch[1];
      if (!storeValue.hasOwnProperty(varName)) {
        throw new Error(`No stored value found for variable '${varName}'`);
      }
      return String(storeValue[varName]);
    }
    return input;
  }
}
