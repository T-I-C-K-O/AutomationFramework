/**
 * @fileoverview Data Generation Utilities - Main Export
 *
 * Centralized module for all test data generation utilities including:
 * - **DateUtils**: Date manipulation and formatting (today, tomorrow, addDays, etc.)
 * - **RandomUtils**: Random strings, numbers, UUIDs, and specialized formats
 *
 * @example
 * ```typescript
 * import { DateUtils, RandomUtils, DataGen } from '@coreLibraries/data/dataGenerators';
 *
 * // Date utilities
 * const today = DateUtils.today();                    // "2025-12-12"
 * const nextWeek = DateUtils.addDays(7);              // "2025-12-19"
 * const nextBusinessDay = DateUtils.nextBusinessDay(); // Skips weekends
 *
 * // Random utilities
 * const uuid = RandomUtils.uuid();                    // "550e8400-e29b-41d4-a716-446655440000"
 * const id = RandomUtils.shortId();                   // "a1b2c3d4"
 * const randomNum = RandomUtils.number(1, 100);       // 42
 * const email = RandomUtils.email();                  // "abc123@example.com"
 *
 * // Quick access via DataGen
 * const today = DataGen.today();
 * const uuid = DataGen.uuid();
 * ```
 *
 * @author Automation Framework Team
 * @since 1.0.0
 */

// Date Utilities
export { DateUtils } from './dateUtils';
export type { DateFormat } from './dateUtils';

// Random Data Utilities (UUID, strings, numbers)
export { RandomUtils } from './randomUtils';

// Runtime Data Resolver (placeholder replacement at runtime)
export { resolveRuntimeData, hasPlaceholders, getAvailableFunctions, registerFunction } from './runtimeDataResolver';

// ============================================================================
// QUICK REFERENCE - COMMONLY USED FUNCTIONS
// ============================================================================

/**
 * Quick Reference - Date Functions:
 *
 * | Function                    | Example Output           | Description                    |
 * |-----------------------------|--------------------------|--------------------------------|
 * | DateUtils.today()           | "2025-12-12"             | Current date                   |
 * | DateUtils.tomorrow()        | "2025-12-13"             | Tomorrow's date                |
 * | DateUtils.yesterday()       | "2025-12-11"             | Yesterday's date               |
 * | DateUtils.addDays(5)        | "2025-12-17"             | 5 days from today              |
 * | DateUtils.subtractDays(3)   | "2025-12-09"             | 3 days ago                     |
 * | DateUtils.addMonths(1)      | "2026-01-12"             | 1 month from today             |
 * | DateUtils.addYears(1)       | "2026-12-12"             | 1 year from today              |
 * | DateUtils.nextBusinessDay() | "2025-12-13"             | Next weekday                   |
 * | DateUtils.addBusinessDays(5)| "2025-12-19"             | 5 working days from today      |
 * | DateUtils.firstDayOfMonth() | "2025-12-01"             | First day of current month     |
 * | DateUtils.lastDayOfMonth()  | "2025-12-31"             | Last day of current month      |
 * | DateUtils.randomDate(-30,30)| "2025-12-05"             | Random date within range       |
 * | DateUtils.timestamp()       | 1702396800000            | Current timestamp (ms)         |
 * | DateUtils.today('MM/DD/YYYY')| "12/12/2025"            | Custom format                  |
 */

/**
 * Quick Reference - Random Functions:
 *
 * | Function                    | Example Output           | Description                    |
 * |-----------------------------|--------------------------|--------------------------------|
 * | RandomUtils.uuid()          | "550e8400-e29b-..."      | UUID v4                        |
 * | RandomUtils.shortId()       | "a1b2c3d4"               | 8-char unique ID               |
 * | RandomUtils.uniqueId(12)    | "a1b2c3d4e5f6"           | Custom length ID               |
 * | RandomUtils.timestampId()   | "1702396800_a1b2"        | Sortable unique ID             |
 * | RandomUtils.string(10)      | "aBcDeFgHiJ"             | Random letters                 |
 * | RandomUtils.alphanumeric(8) | "Ab3Cd5Ef"               | Letters + numbers              |
 * | RandomUtils.numericString(6)| "123456"                 | Digits only                    |
 * | RandomUtils.number(1, 100)  | 42                       | Random integer                 |
 * | RandomUtils.decimal(0,100,2)| 45.67                    | Random decimal                 |
 * | RandomUtils.boolean()       | true                     | Random true/false              |
 * | RandomUtils.pick(['a','b']) | "b"                      | Random from array              |
 * | RandomUtils.email()         | "abc123@example.com"     | Random email                   |
 * | RandomUtils.phone()         | "555-123-4567"           | Random phone                   |
 * | RandomUtils.password(16)    | "aB3$dE5!gH7@"           | Random password                |
 */

// ============================================================================
// CONVENIENCE ALIASES FOR COMMON OPERATIONS
// ============================================================================

import { DateUtils } from './dateUtils';
import { RandomUtils } from './randomUtils';

/**
 * Quick generation functions for the most common use cases.
 * These are convenience wrappers for frequently used operations.
 */
export const DataGen = {
  // ---- Date shortcuts ----
  /** Get today's date in YYYY-MM-DD format */
  today: () => DateUtils.today(),

  /** Get tomorrow's date */
  tomorrow: () => DateUtils.tomorrow(),

  /** Get yesterday's date */
  yesterday: () => DateUtils.yesterday(),

  /** Add days to today */
  addDays: (days: number) => DateUtils.addDays(days),

  /** Get next business day */
  nextBusinessDay: () => DateUtils.nextBusinessDay(),

  /** Get current timestamp */
  timestamp: () => DateUtils.timestamp(),

  // ---- ID shortcuts ----
  /** Generate UUID v4 */
  uuid: () => RandomUtils.uuid(),

  /** Generate short 8-char ID */
  shortId: () => RandomUtils.shortId(),

  /** Generate timestamp-based ID */
  timestampId: (prefix?: string) => RandomUtils.timestampId(prefix),

  // ---- Random data shortcuts ----
  /** Generate random string */
  string: (length?: number) => RandomUtils.string(length),

  /** Generate random number in range */
  number: (min?: number, max?: number) => RandomUtils.number(min, max),

  /** Generate random email */
  email: () => RandomUtils.email(),

  /** Generate random phone */
  phone: () => RandomUtils.phone(),

  /** Generate random password */
  password: (length?: number) => RandomUtils.password(length),

  /** Pick random item from array */
  pick: <T>(items: T[]) => RandomUtils.pick(items),

  /** Generate random boolean */
  boolean: () => RandomUtils.boolean(),
};

export default DataGen;
