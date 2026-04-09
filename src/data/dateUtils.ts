/**
 * @fileoverview Date Utilities for Test Data Generation
 *
 * Provides comprehensive date manipulation and formatting utilities for test automation.
 * All functions return formatted date strings or Date objects as specified.
 *
 * @example
 * ```typescript
 * import { DateUtils } from './dateUtils';
 *
 * // Get today's date in various formats
 * DateUtils.today();                    // "2025-12-12"
 * DateUtils.today('MM/DD/YYYY');        // "12/12/2025"
 *
 * // Date arithmetic
 * DateUtils.addDays(5);                 // 5 days from today
 * DateUtils.subtractDays(3);            // 3 days ago
 * DateUtils.tomorrow();                 // Tomorrow's date
 * DateUtils.yesterday();                // Yesterday's date
 *
 * // Business dates
 * DateUtils.nextBusinessDay();          // Next weekday
 * DateUtils.addBusinessDays(5);         // 5 business days from today
 * ```
 *
 * @author Automation Framework Team
 * @since 1.0.0
 */

/**
 * Supported date format patterns
 */
export type DateFormat =
  | 'YYYY-MM-DD' // ISO format: 2025-12-12
  | 'MM/DD/YYYY' // US format: 12/12/2025
  | 'DD/MM/YYYY' // EU format: 12/12/2025
  | 'DD-MM-YYYY' // EU dash: 12-12-2025
  | 'YYYY/MM/DD' // Alternate ISO: 2025/12/12
  | 'MMM DD, YYYY' // Short month: Dec 12, 2025
  | 'MMMM DD, YYYY' // Full month: December 12, 2025
  | 'DD MMM YYYY' // EU short: 12 Dec 2025
  | 'YYYYMMDD' // Compact: 20251212
  | 'ISO'; // Full ISO: 2025-12-12T10:30:00.000Z

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Pads a number with leading zeros to achieve specified length
 * @param num - Number to pad
 * @param length - Desired string length
 * @returns Zero-padded string
 */
function padZero(num: number, length: number = 2): string {
  return num.toString().padStart(length, '0');
}

/**
 * Formats a Date object according to the specified format pattern
 * @param date - Date object to format
 * @param format - Format pattern (default: 'YYYY-MM-DD')
 * @returns Formatted date string
 */
function formatDate(date: Date, format: DateFormat = 'YYYY-MM-DD'): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  switch (format) {
    case 'YYYY-MM-DD':
      return `${year}-${padZero(month + 1)}-${padZero(day)}`;

    case 'MM/DD/YYYY':
      return `${padZero(month + 1)}/${padZero(day)}/${year}`;

    case 'DD/MM/YYYY':
      return `${padZero(day)}/${padZero(month + 1)}/${year}`;

    case 'DD-MM-YYYY':
      return `${padZero(day)}-${padZero(month + 1)}-${year}`;

    case 'YYYY/MM/DD':
      return `${year}/${padZero(month + 1)}/${padZero(day)}`;

    case 'MMM DD, YYYY':
      return `${MONTH_NAMES_SHORT[month]} ${padZero(day)}, ${year}`;

    case 'MMMM DD, YYYY':
      return `${MONTH_NAMES_FULL[month]} ${padZero(day)}, ${year}`;

    case 'DD MMM YYYY':
      return `${padZero(day)} ${MONTH_NAMES_SHORT[month]} ${year}`;

    case 'YYYYMMDD':
      return `${year}${padZero(month + 1)}${padZero(day)}`;

    case 'ISO':
      return date.toISOString();

    default:
      return `${year}-${padZero(month + 1)}-${padZero(day)}`;
  }
}

/**
 * Checks if a given date falls on a weekend (Saturday or Sunday)
 * @param date - Date to check
 * @returns true if weekend, false otherwise
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Date Utilities Class
 *
 * Provides static methods for date generation and manipulation in test automation.
 * All methods return formatted strings by default, with optional Date object return.
 */
export class DateUtils {
  /**
   * Returns today's date
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   *
   * @example
   * DateUtils.today();              // "2025-12-12"
   * DateUtils.today('MM/DD/YYYY');  // "12/12/2025"
   */
  static today(format: DateFormat = 'YYYY-MM-DD'): string {
    return formatDate(new Date(), format);
  }

  /**
   * Returns today's date as a Date object
   * @returns Date object for today
   */
  static todayAsDate(): Date {
    return new Date();
  }

  /**
   * Returns tomorrow's date
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   *
   * @example
   * DateUtils.tomorrow();              // "2025-12-13"
   * DateUtils.tomorrow('DD/MM/YYYY');  // "13/12/2025"
   */
  static tomorrow(format: DateFormat = 'YYYY-MM-DD'): string {
    return this.addDays(1, format);
  }

  /**
   * Returns yesterday's date
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   *
   * @example
   * DateUtils.yesterday();              // "2025-12-11"
   */
  static yesterday(format: DateFormat = 'YYYY-MM-DD'): string {
    return this.subtractDays(1, format);
  }

  /**
   * Adds specified number of days to today's date
   * @param days - Number of days to add
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @param fromDate - Optional starting date (default: today)
   * @returns Formatted date string
   *
   * @example
   * DateUtils.addDays(5);                // 5 days from today
   * DateUtils.addDays(30, 'MM/DD/YYYY'); // 30 days from today in US format
   */
  static addDays(days: number, format: DateFormat = 'YYYY-MM-DD', fromDate?: Date): string {
    const date = fromDate ? new Date(fromDate) : new Date();
    date.setDate(date.getDate() + days);
    return formatDate(date, format);
  }

  /**
   * Subtracts specified number of days from today's date
   * @param days - Number of days to subtract
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @param fromDate - Optional starting date (default: today)
   * @returns Formatted date string
   *
   * @example
   * DateUtils.subtractDays(7);           // 1 week ago
   * DateUtils.subtractDays(30);          // 30 days ago
   */
  static subtractDays(days: number, format: DateFormat = 'YYYY-MM-DD', fromDate?: Date): string {
    return this.addDays(-days, format, fromDate);
  }

  /**
   * Adds specified number of months to today's date
   * @param months - Number of months to add
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @param fromDate - Optional starting date (default: today)
   * @returns Formatted date string
   *
   * @example
   * DateUtils.addMonths(3);  // 3 months from today
   * DateUtils.addMonths(12); // 1 year from today
   */
  static addMonths(months: number, format: DateFormat = 'YYYY-MM-DD', fromDate?: Date): string {
    const date = fromDate ? new Date(fromDate) : new Date();
    date.setMonth(date.getMonth() + months);
    return formatDate(date, format);
  }

  /**
   * Subtracts specified number of months from today's date
   * @param months - Number of months to subtract
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @param fromDate - Optional starting date (default: today)
   * @returns Formatted date string
   */
  static subtractMonths(months: number, format: DateFormat = 'YYYY-MM-DD', fromDate?: Date): string {
    return this.addMonths(-months, format, fromDate);
  }

  /**
   * Adds specified number of years to today's date
   * @param years - Number of years to add
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @param fromDate - Optional starting date (default: today)
   * @returns Formatted date string
   */
  static addYears(years: number, format: DateFormat = 'YYYY-MM-DD', fromDate?: Date): string {
    const date = fromDate ? new Date(fromDate) : new Date();
    date.setFullYear(date.getFullYear() + years);
    return formatDate(date, format);
  }

  /**
   * Returns the first day of the current month
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   *
   * @example
   * DateUtils.firstDayOfMonth(); // "2025-12-01"
   */
  static firstDayOfMonth(format: DateFormat = 'YYYY-MM-DD'): string {
    const date = new Date();
    date.setDate(1);
    return formatDate(date, format);
  }

  /**
   * Returns the last day of the current month
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   *
   * @example
   * DateUtils.lastDayOfMonth(); // "2025-12-31"
   */
  static lastDayOfMonth(format: DateFormat = 'YYYY-MM-DD'): string {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // Last day of previous month
    return formatDate(date, format);
  }

  /**
   * Returns the first day of the current year
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   */
  static firstDayOfYear(format: DateFormat = 'YYYY-MM-DD'): string {
    const date = new Date();
    date.setMonth(0);
    date.setDate(1);
    return formatDate(date, format);
  }

  /**
   * Returns the last day of the current year
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   */
  static lastDayOfYear(format: DateFormat = 'YYYY-MM-DD'): string {
    const date = new Date();
    date.setMonth(11);
    date.setDate(31);
    return formatDate(date, format);
  }

  /**
   * Returns the next business day (skips weekends)
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @param fromDate - Optional starting date (default: today)
   * @returns Formatted date string
   *
   * @example
   * // If today is Friday
   * DateUtils.nextBusinessDay(); // Returns Monday's date
   */
  static nextBusinessDay(format: DateFormat = 'YYYY-MM-DD', fromDate?: Date): string {
    const date = fromDate ? new Date(fromDate) : new Date();
    date.setDate(date.getDate() + 1);

    while (isWeekend(date)) {
      date.setDate(date.getDate() + 1);
    }

    return formatDate(date, format);
  }

  /**
   * Adds specified number of business days (excluding weekends)
   * @param days - Number of business days to add
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @param fromDate - Optional starting date (default: today)
   * @returns Formatted date string
   *
   * @example
   * DateUtils.addBusinessDays(5);  // 5 working days from today
   * DateUtils.addBusinessDays(10); // 2 weeks of work days
   */
  static addBusinessDays(days: number, format: DateFormat = 'YYYY-MM-DD', fromDate?: Date): string {
    const date = fromDate ? new Date(fromDate) : new Date();
    let addedDays = 0;

    while (addedDays < days) {
      date.setDate(date.getDate() + 1);
      if (!isWeekend(date)) {
        addedDays++;
      }
    }

    return formatDate(date, format);
  }

  /**
   * Returns a random date within a specified range
   * @param startDaysFromNow - Start of range (days from today, can be negative)
   * @param endDaysFromNow - End of range (days from today)
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   *
   * @example
   * DateUtils.randomDate(-30, 30);  // Random date within ±30 days
   * DateUtils.randomDate(1, 365);   // Random date in next year
   */
  static randomDate(startDaysFromNow: number, endDaysFromNow: number, format: DateFormat = 'YYYY-MM-DD'): string {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() + startDaysFromNow);

    const endDate = new Date(today);
    endDate.setDate(today.getDate() + endDaysFromNow);

    const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
    const randomDate = new Date(randomTime);

    return formatDate(randomDate, format);
  }

  /**
   * Returns a random past date within specified days
   * @param maxDaysAgo - Maximum days in the past
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   *
   * @example
   * DateUtils.randomPastDate(365);  // Random date in past year
   */
  static randomPastDate(maxDaysAgo: number, format: DateFormat = 'YYYY-MM-DD'): string {
    return this.randomDate(-maxDaysAgo, -1, format);
  }

  /**
   * Returns a random future date within specified days
   * @param maxDaysAhead - Maximum days in the future
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   *
   * @example
   * DateUtils.randomFutureDate(90);  // Random date in next 90 days
   */
  static randomFutureDate(maxDaysAhead: number, format: DateFormat = 'YYYY-MM-DD'): string {
    return this.randomDate(1, maxDaysAhead, format);
  }

  /**
   * Returns current timestamp in milliseconds
   * @returns Timestamp number
   */
  static timestamp(): number {
    return Date.now();
  }

  /**
   * Returns current timestamp as a string (useful for unique identifiers)
   * @returns Timestamp string
   */
  static timestampString(): string {
    return Date.now().toString();
  }

  /**
   * Formats a Date object or date string to specified format
   * @param date - Date object or parseable date string
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   */
  static format(date: Date | string, format: DateFormat = 'YYYY-MM-DD'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return formatDate(dateObj, format);
  }

  /**
   * Calculates the difference in days between two dates
   * @param date1 - First date
   * @param date2 - Second date (default: today)
   * @returns Number of days difference (can be negative)
   */
  static daysBetween(date1: Date | string, date2?: Date | string): number {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = date2 ? (typeof date2 === 'string' ? new Date(date2) : date2) : new Date();

    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Checks if a date is in the past
   * @param date - Date to check
   * @returns true if date is before today
   */
  static isPast(date: Date | string): boolean {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj < new Date();
  }

  /**
   * Checks if a date is in the future
   * @param date - Date to check
   * @returns true if date is after today
   */
  static isFuture(date: Date | string): boolean {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj > new Date();
  }

  /**
   * Returns the start of the current week (Monday)
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   */
  static startOfWeek(format: DateFormat = 'YYYY-MM-DD'): string {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    date.setDate(diff);
    return formatDate(date, format);
  }

  /**
   * Returns the end of the current week (Sunday)
   * @param format - Output format (default: 'YYYY-MM-DD')
   * @returns Formatted date string
   */
  static endOfWeek(format: DateFormat = 'YYYY-MM-DD'): string {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() + (7 - day);
    date.setDate(diff);
    return formatDate(date, format);
  }

  /**
   * Returns current time in HH:MM:SS format
   * @param includeSeconds - Whether to include seconds (default: true)
   * @returns Time string
   */
  static currentTime(includeSeconds: boolean = true): string {
    const now = new Date();
    const hours = padZero(now.getHours());
    const minutes = padZero(now.getMinutes());
    const seconds = padZero(now.getSeconds());

    return includeSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
  }

  /**
   * Returns current datetime in ISO format
   * @returns ISO datetime string
   */
  static nowISO(): string {
    return new Date().toISOString();
  }
}

export default DateUtils;
