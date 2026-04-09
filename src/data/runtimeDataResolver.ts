/**
 * @fileoverview Runtime Data Resolver for Dynamic Placeholder Replacement
 *
 * Provides runtime resolution of dynamic placeholders in test data. Supports both
 * stored values (via storeManager) and dynamic data generation functions.
 *
 * Supported Placeholder Patterns:
 *
 * **Date Functions:**
 * | Pattern                    | Example Output        | Description                    |
 * |----------------------------|-----------------------|--------------------------------|
 * | `{{today}}`                | "2025-12-12"          | Today's date (YYYY-MM-DD)      |
 * | `{{today:MM/DD/YYYY}}`     | "12/12/2025"          | Today with custom format       |
 * | `{{tomorrow}}`             | "2025-12-13"          | Tomorrow's date                |
 * | `{{yesterday}}`            | "2025-12-11"          | Yesterday's date               |
 * | `{{addDays(5)}}`           | "2025-12-17"          | 5 days from today              |
 * | `{{addDays(-3)}}`          | "2025-12-09"          | 3 days ago                     |
 * | `{{addMonths(1)}}`         | "2026-01-12"          | 1 month from today             |
 * | `{{addYears(1)}}`          | "2026-12-12"          | 1 year from today              |
 * | `{{addBusinessDays(5)}}`   | "2025-12-19"          | 5 business days from today     |
 * | `{{nextBusinessDay}}`      | "2025-12-13"          | Next weekday                   |
 * | `{{firstDayOfMonth}}`      | "2025-12-01"          | First day of current month     |
 * | `{{lastDayOfMonth}}`       | "2025-12-31"          | Last day of current month      |
 * | `{{timestamp}}`            | "1702396800000"       | Current timestamp (ms)         |
 *
 * **Random/ID Functions:**
 * | Pattern                    | Example Output        | Description                    |
 * |----------------------------|-----------------------|--------------------------------|
 * | `{{uuid}}`                 | "550e8400-e29b-..."   | UUID v4                        |
 * | `{{shortId}}`              | "a1b2c3d4"            | 8-character unique ID          |
 * | `{{uniqueId(12)}}`         | "a1b2c3d4e5f6"        | Custom length unique ID        |
 * | `{{timestampId}}`          | "1702396800_a1b2"     | Timestamp-based ID             |
 * | `{{timestampId(PREFIX)}}`  | "PREFIX_1702396800"   | Prefixed timestamp ID          |
 *
 * **Random Data Functions:**
 * | Pattern                    | Example Output        | Description                    |
 * |----------------------------|-----------------------|--------------------------------|
 * | `{{randomString(10)}}`     | "aBcDeFgHiJ"          | Random 10-char string          |
 * | `{{randomNumber(1,100)}}`  | "42"                  | Random number in range         |
 * | `{{randomEmail}}`          | "abc123@example.com"  | Random email address           |
 * | `{{randomPhone}}`          | "555-123-4567"        | Random phone number            |
 * | `{{randomAlphanumeric(8)}}` | "Ab3Cd5Ef"           | Random alphanumeric string     |
 *
 * **Stored Values:**
 * | Pattern                    | Description                                |
 * |----------------------------|--------------------------------------------|
 * | `{{storedVariable}}`       | Value from storeManager                    |
 * | `{{userId}}`               | Previously stored userId                   |
 *
 * @example
 * ```typescript
 * import { resolveRuntimeData } from './runtimeDataResolver';
 *
 * // String with placeholders
 * const result = resolveRuntimeData('User created on {{today}} with ID {{uuid}}');
 * // "User created on 2025-12-12 with ID 550e8400-e29b-41d4-a716-446655440000"
 *
 * // Object with placeholders
 * const data = resolveRuntimeData({
 *   name: 'Test User',
 *   email: '{{randomEmail}}',
 *   createdAt: '{{today}}',
 *   expiresAt: '{{addDays(30)}}'
 * });
 *
 * // Nested objects and arrays
 * const complex = resolveRuntimeData({
 *   users: [{ id: '{{uuid}}', name: 'User 1' }],
 *   metadata: { timestamp: '{{timestamp}}' }
 * });
 * ```
 *
 * @author Automation Framework Team
 * @since 1.0.0
 */

import { DateUtils, DateFormat } from './dateUtils';
import { RandomUtils } from './randomUtils';
import { getValue } from './storeManager';
import { logger } from '../helpers/logger';

// ============================================================================
// DYNAMIC FUNCTION REGISTRY
// ============================================================================

/**
 * Registry of dynamic functions that can be called via placeholders.
 * Each function takes optional arguments and returns a string value.
 */
const DYNAMIC_FUNCTIONS: Record<string, (...args: string[]) => string> = {
  // ---- Date Functions ----
  today: (format?: string) => DateUtils.today((format as DateFormat) || 'YYYY-MM-DD'),
  tomorrow: (format?: string) => DateUtils.tomorrow((format as DateFormat) || 'YYYY-MM-DD'),
  yesterday: (format?: string) => DateUtils.yesterday((format as DateFormat) || 'YYYY-MM-DD'),
  addDays: (days: string, format?: string) =>
    DateUtils.addDays(parseInt(days, 10), (format as DateFormat) || 'YYYY-MM-DD'),
  subtractDays: (days: string, format?: string) =>
    DateUtils.subtractDays(parseInt(days, 10), (format as DateFormat) || 'YYYY-MM-DD'),
  addMonths: (months: string, format?: string) =>
    DateUtils.addMonths(parseInt(months, 10), (format as DateFormat) || 'YYYY-MM-DD'),
  subtractMonths: (months: string, format?: string) =>
    DateUtils.subtractMonths(parseInt(months, 10), (format as DateFormat) || 'YYYY-MM-DD'),
  addYears: (years: string, format?: string) =>
    DateUtils.addYears(parseInt(years, 10), (format as DateFormat) || 'YYYY-MM-DD'),
  addBusinessDays: (days: string, format?: string) =>
    DateUtils.addBusinessDays(parseInt(days, 10), (format as DateFormat) || 'YYYY-MM-DD'),
  nextBusinessDay: (format?: string) => DateUtils.nextBusinessDay((format as DateFormat) || 'YYYY-MM-DD'),
  firstDayOfMonth: (format?: string) => DateUtils.firstDayOfMonth((format as DateFormat) || 'YYYY-MM-DD'),
  lastDayOfMonth: (format?: string) => DateUtils.lastDayOfMonth((format as DateFormat) || 'YYYY-MM-DD'),
  firstDayOfYear: (format?: string) => DateUtils.firstDayOfYear((format as DateFormat) || 'YYYY-MM-DD'),
  lastDayOfYear: (format?: string) => DateUtils.lastDayOfYear((format as DateFormat) || 'YYYY-MM-DD'),
  startOfWeek: (format?: string) => DateUtils.startOfWeek((format as DateFormat) || 'YYYY-MM-DD'),
  endOfWeek: (format?: string) => DateUtils.endOfWeek((format as DateFormat) || 'YYYY-MM-DD'),
  timestamp: () => DateUtils.timestamp().toString(),
  timestampString: () => DateUtils.timestampString(),
  currentTime: (includeSeconds?: string) => DateUtils.currentTime(includeSeconds !== 'false'),
  nowISO: () => DateUtils.nowISO(),
  randomPastDate: (maxDaysAgo: string, format?: string) =>
    DateUtils.randomPastDate(parseInt(maxDaysAgo, 10), (format as DateFormat) || 'YYYY-MM-DD'),
  randomFutureDate: (maxDaysAhead: string, format?: string) =>
    DateUtils.randomFutureDate(parseInt(maxDaysAhead, 10), (format as DateFormat) || 'YYYY-MM-DD'),

  // ---- UUID/ID Functions ----
  uuid: () => RandomUtils.uuid(),
  uuidV1: () => RandomUtils.uuidV1(),
  shortId: () => RandomUtils.shortId(),
  uniqueId: (length?: string) => RandomUtils.uniqueId(length ? parseInt(length, 10) : 8),
  timestampId: (prefix?: string) => RandomUtils.timestampId(prefix),

  // ---- Random String Functions ----
  randomString: (length?: string) => RandomUtils.string(length ? parseInt(length, 10) : 10),
  randomAlphanumeric: (length?: string) => RandomUtils.alphanumeric(length ? parseInt(length, 10) : 10),
  randomLowercase: (length?: string) => RandomUtils.lowercase(length ? parseInt(length, 10) : 10),
  randomUppercase: (length?: string) => RandomUtils.uppercase(length ? parseInt(length, 10) : 10),
  randomNumericString: (length?: string) => RandomUtils.numericString(length ? parseInt(length, 10) : 10),
  randomHex: (length?: string) => RandomUtils.hex(length ? parseInt(length, 10) : 10),
  randomPassword: (length?: string, includeSpecial?: string) =>
    RandomUtils.password(length ? parseInt(length, 10) : 12, includeSpecial !== 'false'),
  randomSlug: (wordCount?: string, wordLength?: string) =>
    RandomUtils.slug(wordCount ? parseInt(wordCount, 10) : 3, wordLength ? parseInt(wordLength, 10) : 4),

  // ---- Random Number Functions ----
  randomNumber: (min?: string, max?: string) =>
    RandomUtils.number(min ? parseInt(min, 10) : 0, max ? parseInt(max, 10) : 100).toString(),
  randomInteger: (min?: string, max?: string) =>
    RandomUtils.integer(min ? parseInt(min, 10) : 0, max ? parseInt(max, 10) : 100).toString(),
  randomDecimal: (min?: string, max?: string, decimals?: string) =>
    RandomUtils.decimal(
      min ? parseFloat(min) : 0,
      max ? parseFloat(max) : 100,
      decimals ? parseInt(decimals, 10) : 2
    ).toString(),
  randomPercentage: (decimals?: string) => RandomUtils.percentage(decimals ? parseInt(decimals, 10) : 0).toString(),
  randomPrice: (min?: string, max?: string) =>
    RandomUtils.price(min ? parseFloat(min) : 1, max ? parseFloat(max) : 1000).toString(),

  // ---- Random Contact Functions ----
  randomEmail: (domain?: string) => RandomUtils.email(domain),
  randomPhone: (format?: string) => RandomUtils.phone(format),
  randomIpAddress: () => RandomUtils.ipAddress(),
  randomMacAddress: () => RandomUtils.macAddress(),
  randomUrl: () => RandomUtils.url(),
  randomHexColor: () => RandomUtils.hexColor(),

  // ---- Random Format Functions ----
  randomZipCode: (extended?: string) => RandomUtils.zipCode(extended === 'true'),
  randomSsn: () => RandomUtils.ssn(),
  randomCreditCard: (type?: string) => RandomUtils.creditCard((type as '4' | '5' | '3') || '4'),
};

// ============================================================================
// PLACEHOLDER PARSING AND RESOLUTION
// ============================================================================

/**
 * Pattern to match placeholders: {{functionName}} or {{functionName(arg1, arg2)}} or {{name:format}}
 * Groups:
 * - Full match: {{today}} or {{addDays(5)}} or {{today:MM/DD/YYYY}}
 * - Group 1: Function name (today, addDays, etc.)
 * - Group 2: Arguments in parentheses (5) or format after colon (MM/DD/YYYY)
 */
const PLACEHOLDER_PATTERN = /{{([a-zA-Z_][a-zA-Z0-9_]*)(?:\(([^)]*)\)|:([^}]+))?}}/g;

/**
 * Parses function arguments from a comma-separated string
 * Handles quoted strings and trims whitespace
 *
 * @param argsString - Comma-separated arguments string
 * @returns Array of parsed argument values
 *
 * @example
 * parseArguments('5, "hello"') // ['5', 'hello']
 * parseArguments('10') // ['10']
 */
function parseArguments(argsString: string): string[] {
  if (!argsString || argsString.trim() === '') {
    return [];
  }

  // Split by comma, but respect quoted strings
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (const char of argsString) {
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ',' && !inQuotes) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  // Remove surrounding quotes from arguments
  return args.map((arg) => {
    const trimmed = arg.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  });
}

/**
 * Resolves a single placeholder to its runtime value
 *
 * Resolution order:
 * 1. Check if it's a registered dynamic function
 * 2. Check if it's a stored value in storeManager
 * 3. Throw error if not found
 *
 * @param functionName - Name of the function or stored variable
 * @param args - Arguments for the function (if any)
 * @returns Resolved string value
 * @throws Error if placeholder cannot be resolved
 */
function resolvePlaceholder(functionName: string, args: string[]): string {
  // Check dynamic functions first
  if (functionName in DYNAMIC_FUNCTIONS) {
    try {
      const result = DYNAMIC_FUNCTIONS[functionName](...args);
      logger.debug(`[RuntimeResolver] Resolved {{${functionName}}} to: ${result}`);
      return result;
    } catch (error: any) {
      logger.error(`[RuntimeResolver] Error executing {{${functionName}}}: ${error.message}`);
      throw new Error(`Failed to execute dynamic function '${functionName}': ${error.message}`);
    }
  }

  // Check stored values
  const storedValue = getValue(functionName);
  if (storedValue !== undefined) {
    logger.debug(`[RuntimeResolver] Resolved {{${functionName}}} from store: ${storedValue}`);
    return String(storedValue);
  }

  // Not found
  logger.warn(
    `[RuntimeResolver] Placeholder '${functionName}' not found in dynamic functions or store, keeping original`
  );
  return `{{${functionName}${args.length > 0 ? `(${args.join(', ')})` : ''}}}`;
}

/**
 * Resolves a string containing placeholders to their runtime values
 *
 * @param input - String with placeholders
 * @returns String with all placeholders replaced
 */
function resolveString(input: string): string {
  return input.replace(PLACEHOLDER_PATTERN, (match, functionName, argsString, formatString) => {
    try {
      // If format string is provided (e.g., {{today:MM/DD/YYYY}}), use it as the first argument
      const args = formatString ? [formatString] : parseArguments(argsString || '');
      return resolvePlaceholder(functionName, args);
    } catch (error: any) {
      logger.error(`[RuntimeResolver] Failed to resolve ${match}: ${error.message}`);
      throw error;
    }
  });
}

// ============================================================================
// MAIN EXPORT - RUNTIME DATA RESOLVER
// ============================================================================

/**
 * Resolves runtime placeholders in any data type: strings, objects, arrays, or primitives
 *
 * This is the main entry point for runtime data resolution. It recursively processes
 * the input and replaces all `{{placeholder}}` patterns with their resolved values.
 *
 * @param input - The input data (string, object, array, or primitive)
 * @returns The input with all placeholders resolved
 *
 * @example
 * ```typescript
 * // Simple string
 * resolveRuntimeData('Today is {{today}}');
 * // "Today is 2025-12-12"
 *
 * // Object with placeholders
 * resolveRuntimeData({
 *   id: '{{uuid}}',
 *   name: 'Test User',
 *   createdAt: '{{today}}',
 *   expiresAt: '{{addDays(30)}}'
 * });
 * // { id: "550e8400-...", name: "Test User", createdAt: "2025-12-12", expiresAt: "2026-01-11" }
 *
 * // With custom date format
 * resolveRuntimeData('Date: {{today:MM/DD/YYYY}}');
 * // "Date: 12/12/2025"
 *
 * // Nested structures
 * resolveRuntimeData({
 *   users: [{ id: '{{uuid}}', email: '{{randomEmail}}' }],
 *   metadata: { created: '{{timestamp}}' }
 * });
 * ```
 */
export function resolveRuntimeData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    // Only process if string contains placeholders
    if (input.includes('{{') && input.includes('}}')) {
      return resolveString(input) as T;
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveRuntimeData(item)) as T;
  }

  if (typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = resolveRuntimeData(value);
    }
    return result as T;
  }

  // For primitives (number, boolean, etc.), return as-is
  return input;
}

/**
 * Checks if a string contains any runtime placeholders
 *
 * @param input - String to check
 * @returns true if the string contains placeholders
 *
 * @example
 * hasPlaceholders('Hello {{name}}'); // true
 * hasPlaceholders('Hello World');     // false
 */
export function hasPlaceholders(input: string): boolean {
  return PLACEHOLDER_PATTERN.test(input);
}

/**
 * Lists all available dynamic functions
 *
 * @returns Array of available function names
 */
export function getAvailableFunctions(): string[] {
  return Object.keys(DYNAMIC_FUNCTIONS);
}

/**
 * Registers a custom dynamic function
 *
 * @param name - Function name (used in placeholders as {{name}})
 * @param fn - Function implementation
 *
 * @example
 * ```typescript
 * registerFunction('customId', (prefix) => `${prefix || 'ID'}-${Date.now()}`);
 * resolveRuntimeData('{{customId(USER)}}'); // "USER-1702396800000"
 * ```
 */
export function registerFunction(name: string, fn: (...args: string[]) => string): void {
  if (DYNAMIC_FUNCTIONS[name]) {
    logger.warn(`[RuntimeResolver] Overwriting existing function: ${name}`);
  }
  DYNAMIC_FUNCTIONS[name] = fn;
  logger.info(`[RuntimeResolver] Registered custom function: ${name}`);
}

export default resolveRuntimeData;
