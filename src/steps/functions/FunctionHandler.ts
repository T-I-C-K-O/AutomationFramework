// src/core/customFunctionRegistry.ts
import { BaseActionHandler } from '../BaseActionHandler';
import { pageClassMap } from '../../pages/pageclassMap';
import { logger } from '../../helpers/logger';

/**
 * FunctionHandler enables dynamic invocation of page class methods based solely on the data field.
 *
 * Data format examples:
 *   LoginPage.login("user","pass")
 *   login("user","pass")             // method-only; auto-resolves owning class if unique.
 *
 * Resolution rules:
 * 1. If data contains ClassName.methodName(args) -> Class & method used directly.
 * 2. If only methodName(args) provided -> scans registered page classes for a single class whose prototype has that method.
 *    - Throws if none or if ambiguous (found in multiple classes).
 * 3. Applies alias map if direct method not found (currently only a placeholder self-alias).
 *
 * Argument parsing:
 * - Supports quoted arguments with commas inside quotes.
 * - Surrounding quotes stripped in final args list.
 *
 * Failure conditions return clear, actionable error messages for logging and test reporting.
 */
export class FunctionHandler extends BaseActionHandler {
  /**
   * Determines if this handler should process the step based on the action string.
   * Currently allows verbs like Execute or Perform but actual function resolution
   * relies exclusively on the data field.
   * @param action Raw action text from the step definition.
   */
  canHandle(action: string): boolean {
    return /Execute|Perform|Invoke/i.test(action);
  }

  /**
   * Executes a dynamic page class method determined from the data field.
   * @param action Ignored for method resolution (only used to pass handler routing).
   * @param data Fallback source for invocation string if step.data absent.
   * @param result Unused in current implementation (reserved for future chaining).
   * @param step Step metadata object containing .data string with invocation pattern.
   * @returns true when invocation succeeds; throws on any resolution or method failure.
   */
  async execute(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    // New behavior: ignore action pattern; parse invocation from data field.
    // Expected data formats:
    //   LoginPage.loginAs("user","pass","vendor")
    //   login("user","pass")  // implicit page class (defaults to LoginPage) + alias to loginAs
    // Parsing strategy: Extract function reference pattern: name(args...)

    const raw = (step?.data ?? data ?? '').toString().trim();
    if (!raw) {
      throw new Error('FunctionHandler: data field empty; cannot determine function to execute.');
    }

    const invocationMatch = raw.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*\((.*)\)$/);
    if (!invocationMatch) {
      throw new Error(`FunctionHandler: data '${raw}' not in expected form FunctionName(arg1, arg2, ...).`);
    }

    const fullName = invocationMatch[1];
    const argsPortion = invocationMatch[2];

    let className: string | undefined;
    let methodName: string;

    if (fullName.includes('.')) {
      const parts = fullName.split('.');
      className = parts.slice(0, -1).join('.');
      methodName = parts[parts.length - 1];
    } else {
      // Only method provided; attempt to locate uniquely across registered page classes
      methodName = fullName;
      const owningClasses = Object.entries(pageClassMap)
        .filter(
          ([_, PageCtor]: [string, { prototype?: any }]) => typeof PageCtor?.prototype?.[methodName] === 'function'
        )
        .map(([name]) => name);
      if (owningClasses.length === 0) {
        throw new Error(`FunctionHandler: No page class contains method '${methodName}'. Use ClassName.${methodName}.`);
      }
      if (owningClasses.length > 1) {
        throw new Error(
          `FunctionHandler: Ambiguous method '${methodName}' found in multiple classes: ${owningClasses.join(', ')}. Use ClassName.${methodName}.`
        );
      }
      className = owningClasses[0];
    }

    if (!className) {
      throw new Error('FunctionHandler: Could not resolve page class name.');
    }
    const PageClass = pageClassMap[className];
    if (!PageClass) {
      throw new Error(`FunctionHandler: Page class '${className}' not registered.`);
    }

    const pageInstance = new PageClass(this.page);

    const resolvedMethodName = (pageInstance as any)[methodName] ? methodName : methodName;

    if (typeof (pageInstance as any)[resolvedMethodName] !== 'function') {
      throw new Error(`FunctionHandler: Method '${resolvedMethodName}' not found on '${className}'.`);
    }

    // Split arguments respecting quotes – basic CSV split that handles quoted commas
    const args = this.parseArgs(argsPortion);
    logger.info(`[FunctionHandler] Invoking ${className}.${resolvedMethodName}(${args.join(', ')})`);

    try {
      const ret = await (pageInstance as any)[resolvedMethodName](...args);
      if (ret === false) throw new Error(`${className}.${resolvedMethodName} returned false.`);
      logger.info(`[FunctionHandler] Success: ${className}.${resolvedMethodName} executed.`);
      return true;
    } catch (err: any) {
      logger.error(
        `[FunctionHandler] FunctionHandler invocation failed for ${className}.${resolvedMethodName}: ${err.message || err}`
      );
      throw err;
    }
  }

  /**
   * Parses a comma-separated argument string supporting quoted segments.
   * Examples:
   *   "user","pass" -> [user, pass]
   *   "value with, comma",simple -> [value with, comma, simple]
   * @param argString Raw substring inside parentheses.
   * @returns Array of trimmed argument strings with surrounding quotes removed.
   */
  private parseArgs(argString: string): string[] {
    if (!argString.trim()) return [];
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar: string | null = null;

    for (let i = 0; i < argString.length; i++) {
      const ch = argString[i];
      if ((ch === '"' || ch === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = ch;
        continue;
      }
      if (inQuotes && ch === quoteChar) {
        inQuotes = false;
        quoteChar = null;
        continue;
      }
      if (!inQuotes && ch === ',') {
        args.push(current.trim());
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.length > 0) args.push(current.trim());
    // Remove surrounding quotes if any remain (robustness)
    return args.map((a) => a.replace(/^['"]|['"]$/g, ''));
  }
}
