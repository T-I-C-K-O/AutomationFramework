/**
 * @fileoverview Random Data Generators for Test Data Generation
 *
 * Provides utilities for generating random strings, numbers, UUIDs, and other
 * dynamic data for test automation purposes.
 *
 * @example
 * ```typescript
 * import { RandomUtils } from './randomUtils';
 *
 * // UUIDs
 * RandomUtils.uuid();                    // "550e8400-e29b-41d4-a716-446655440000"
 * RandomUtils.shortId();                 // "a1b2c3d4"
 *
 * // Strings
 * RandomUtils.string(10);                // "aBcDeFgHiJ"
 * RandomUtils.alphanumeric(8);           // "Ab3Cd5Ef"
 *
 * // Numbers
 * RandomUtils.number(1, 100);            // 42
 * RandomUtils.decimal(0, 100, 2);        // 45.67
 * ```
 *
 * @author Automation Framework Team
 * @since 1.0.0
 */

import * as crypto from 'crypto';

/**
 * Generate a v4 UUID using native Node.js crypto
 * Compatible with CommonJS and ESM
 */
const uuidv4 = (): string => {
  return crypto.randomUUID();
};

/**
 * Generate a v1-like UUID (time-based) using native Node.js crypto
 * Note: This is a simplified v1-like implementation, not a true v1 UUID
 */
const uuidv1 = (): string => {
  const timestamp = Date.now().toString(16).padStart(12, '0');
  const random = crypto.randomBytes(10).toString('hex');
  // Format: xxxxxxxx-xxxx-1xxx-xxxx-xxxxxxxxxxxx (v1-like)
  return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-1${random.slice(0, 3)}-${random.slice(3, 7)}-${random.slice(7, 19)}`;
};

// Character sets for random string generation
const CHARS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  special: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  alphanumeric: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  hex: '0123456789abcdef',
};

/**
 * Random Utilities Class
 *
 * Provides static methods for generating random data including UUIDs, strings,
 * numbers, and specialized formats for test automation.
 */
export class RandomUtils {
  // ============================================================================
  // UUID GENERATORS
  // ============================================================================

  /**
   * Generates a UUID v4 (random-based)
   * @returns UUID string in format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   *
   * @example
   * RandomUtils.uuid(); // "550e8400-e29b-41d4-a716-446655440000"
   */
  static uuid(): string {
    return uuidv4();
  }

  /**
   * Generates a UUID v1 (timestamp-based)
   * @returns UUID string with timestamp component
   *
   * @example
   * RandomUtils.uuidV1(); // "6c84fb90-12c4-11e1-840d-7b25c5ee775a"
   */
  static uuidV1(): string {
    return uuidv1();
  }

  /**
   * Generates a short unique identifier (8 characters)
   * @returns Short alphanumeric ID
   *
   * @example
   * RandomUtils.shortId(); // "a1b2c3d4"
   */
  static shortId(): string {
    return uuidv4().substring(0, 8);
  }

  /**
   * Generates a unique identifier with custom length
   * @param length - Desired length of the ID
   * @returns Unique alphanumeric ID
   *
   * @example
   * RandomUtils.uniqueId(12); // "a1b2c3d4e5f6"
   */
  static uniqueId(length: number = 8): string {
    const uuid = uuidv4().replace(/-/g, '');
    return uuid.substring(0, Math.min(length, 32));
  }

  /**
   * Generates a timestamp-based unique identifier
   * Useful for sortable unique IDs
   * @param prefix - Optional prefix for the ID
   * @returns Timestamp-based unique ID
   *
   * @example
   * RandomUtils.timestampId();          // "1702396800000_a1b2"
   * RandomUtils.timestampId('TEST');    // "TEST_1702396800000_a1b2"
   */
  static timestampId(prefix?: string): string {
    const timestamp = Date.now();
    const random = this.shortId().substring(0, 4);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
  }

  // ============================================================================
  // STRING GENERATORS
  // ============================================================================

  /**
   * Generates a random string with mixed case letters
   * @param length - Length of the string (default: 10)
   * @returns Random alphabetic string
   *
   * @example
   * RandomUtils.string(10); // "aBcDeFgHiJ"
   */
  static string(length: number = 10): string {
    return this.fromCharset(CHARS.alpha, length);
  }

  /**
   * Generates a random alphanumeric string
   * @param length - Length of the string (default: 10)
   * @returns Random alphanumeric string
   *
   * @example
   * RandomUtils.alphanumeric(8); // "Ab3Cd5Ef"
   */
  static alphanumeric(length: number = 10): string {
    return this.fromCharset(CHARS.alphanumeric, length);
  }

  /**
   * Generates a random lowercase string
   * @param length - Length of the string (default: 10)
   * @returns Random lowercase string
   *
   * @example
   * RandomUtils.lowercase(8); // "abcdefgh"
   */
  static lowercase(length: number = 10): string {
    return this.fromCharset(CHARS.lowercase, length);
  }

  /**
   * Generates a random uppercase string
   * @param length - Length of the string (default: 10)
   * @returns Random uppercase string
   *
   * @example
   * RandomUtils.uppercase(8); // "ABCDEFGH"
   */
  static uppercase(length: number = 10): string {
    return this.fromCharset(CHARS.uppercase, length);
  }

  /**
   * Generates a random numeric string (digits only)
   * @param length - Length of the string (default: 10)
   * @returns Random numeric string
   *
   * @example
   * RandomUtils.numericString(6); // "123456"
   */
  static numericString(length: number = 10): string {
    return this.fromCharset(CHARS.digits, length);
  }

  /**
   * Generates a random hexadecimal string
   * @param length - Length of the string (default: 10)
   * @returns Random hex string
   *
   * @example
   * RandomUtils.hex(8); // "a1b2c3d4"
   */
  static hex(length: number = 10): string {
    return this.fromCharset(CHARS.hex, length);
  }

  /**
   * Generates a random string from a custom character set
   * @param charset - String of characters to choose from
   * @param length - Length of the output string
   * @returns Random string from the specified charset
   *
   * @example
   * RandomUtils.fromCharset('ABC123', 6); // "A1BC23"
   */
  static fromCharset(charset: string, length: number): string {
    let result = '';
    const charsetLength = charset.length;
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charsetLength));
    }
    return result;
  }

  /**
   * Generates a random password with mixed characters
   * @param length - Length of the password (default: 12)
   * @param includeSpecial - Include special characters (default: true)
   * @returns Random password string
   *
   * @example
   * RandomUtils.password(16);        // "aB3$dE5!gH7@jK9#"
   * RandomUtils.password(12, false); // "aB3cD5eF7gH9"
   */
  static password(length: number = 12, includeSpecial: boolean = true): string {
    const charset = includeSpecial ? CHARS.alphanumeric + CHARS.special : CHARS.alphanumeric;
    return this.fromCharset(charset, length);
  }

  /**
   * Generates a random slug-friendly string (lowercase with hyphens)
   * @param wordCount - Number of word segments (default: 3)
   * @param wordLength - Length of each word segment (default: 4)
   * @returns Slug string
   *
   * @example
   * RandomUtils.slug(3, 4); // "abcd-efgh-ijkl"
   */
  static slug(wordCount: number = 3, wordLength: number = 4): string {
    const words: string[] = [];
    for (let i = 0; i < wordCount; i++) {
      words.push(this.lowercase(wordLength));
    }
    return words.join('-');
  }

  // ============================================================================
  // NUMBER GENERATORS
  // ============================================================================

  /**
   * Generates a random integer within a range (inclusive)
   * @param min - Minimum value (default: 0)
   * @param max - Maximum value (default: 100)
   * @returns Random integer
   *
   * @example
   * RandomUtils.number(1, 100);  // 42
   * RandomUtils.number(0, 10);   // 7
   */
  static number(min: number = 0, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Alias for number() - generates random integer
   * @param min - Minimum value
   * @param max - Maximum value
   * @returns Random integer
   */
  static integer(min: number = 0, max: number = 100): number {
    return this.number(min, max);
  }

  /**
   * Generates a random decimal number within a range
   * @param min - Minimum value (default: 0)
   * @param max - Maximum value (default: 100)
   * @param decimals - Number of decimal places (default: 2)
   * @returns Random decimal number
   *
   * @example
   * RandomUtils.decimal(0, 100, 2);  // 45.67
   * RandomUtils.decimal(1, 10, 3);   // 5.234
   */
  static decimal(min: number = 0, max: number = 100, decimals: number = 2): number {
    const value = Math.random() * (max - min) + min;
    return Number(value.toFixed(decimals));
  }

  /**
   * Alias for decimal() - generates random float
   * @param min - Minimum value
   * @param max - Maximum value
   * @param decimals - Number of decimal places
   * @returns Random float
   */
  static float(min: number = 0, max: number = 100, decimals: number = 2): number {
    return this.decimal(min, max, decimals);
  }

  /**
   * Generates a random percentage (0-100)
   * @param decimals - Number of decimal places (default: 0)
   * @returns Random percentage
   *
   * @example
   * RandomUtils.percentage();    // 75
   * RandomUtils.percentage(2);   // 75.42
   */
  static percentage(decimals: number = 0): number {
    return decimals === 0 ? this.number(0, 100) : this.decimal(0, 100, decimals);
  }

  /**
   * Generates a random price/currency value
   * @param min - Minimum value (default: 1)
   * @param max - Maximum value (default: 1000)
   * @returns Price with 2 decimal places
   *
   * @example
   * RandomUtils.price(10, 500); // 234.56
   */
  static price(min: number = 1, max: number = 1000): number {
    return this.decimal(min, max, 2);
  }

  // ============================================================================
  // BOOLEAN AND SELECTION GENERATORS
  // ============================================================================

  /**
   * Generates a random boolean value
   * @param trueWeight - Probability of true (0-1, default: 0.5)
   * @returns Random boolean
   *
   * @example
   * RandomUtils.boolean();      // true or false (50/50)
   * RandomUtils.boolean(0.8);   // 80% chance of true
   */
  static boolean(trueWeight: number = 0.5): boolean {
    return Math.random() < trueWeight;
  }

  /**
   * Selects a random item from an array
   * @param items - Array of items to choose from
   * @returns Random item from the array
   *
   * @example
   * RandomUtils.pick(['red', 'green', 'blue']); // "green"
   * RandomUtils.pick([1, 2, 3, 4, 5]);          // 3
   */
  static pick<T>(items: T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Selects multiple unique random items from an array
   * @param items - Array of items to choose from
   * @param count - Number of items to select
   * @returns Array of unique random items
   *
   * @example
   * RandomUtils.pickMultiple(['a', 'b', 'c', 'd', 'e'], 3); // ["b", "d", "a"]
   */
  static pickMultiple<T>(items: T[], count: number): T[] {
    if (count > items.length) {
      throw new Error('Count cannot exceed array length');
    }

    const shuffled = [...items].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Selects a random enum value
   * @param enumObj - Enum object to choose from
   * @returns Random enum value
   *
   * @example
   * enum Status { Active, Inactive, Pending }
   * RandomUtils.enumValue(Status); // Status.Active
   */
  static enumValue<T extends object>(enumObj: T): T[keyof T] {
    const values = Object.values(enumObj);
    return this.pick(values);
  }

  // ============================================================================
  // SPECIALIZED GENERATORS
  // ============================================================================

  /**
   * Generates a random email address
   * @param domain - Email domain (default: random)
   * @returns Random email address
   *
   * @example
   * RandomUtils.email();                    // "abcd1234@example.com"
   * RandomUtils.email('company.com');       // "xyz789@company.com"
   */
  static email(domain?: string): string {
    const username = this.alphanumeric(8).toLowerCase();
    const emailDomain = domain || this.pick(['example.com', 'test.com', 'mail.com', 'demo.org']);
    return `${username}@${emailDomain}`;
  }

  /**
   * Generates a random phone number
   * @param format - Phone format with # as digit placeholder (default: '###-###-####')
   * @returns Formatted phone number
   *
   * @example
   * RandomUtils.phone();                    // "555-123-4567"
   * RandomUtils.phone('+1 (###) ###-####'); // "+1 (555) 123-4567"
   */
  static phone(format: string = '###-###-####'): string {
    return format.replace(/#/g, () => this.number(0, 9).toString());
  }

  /**
   * Generates a random IP address (IPv4)
   * @returns IP address string
   *
   * @example
   * RandomUtils.ipAddress(); // "192.168.1.42"
   */
  static ipAddress(): string {
    return `${this.number(1, 255)}.${this.number(0, 255)}.${this.number(0, 255)}.${this.number(1, 255)}`;
  }

  /**
   * Generates a random MAC address
   * @returns MAC address string
   *
   * @example
   * RandomUtils.macAddress(); // "A1:B2:C3:D4:E5:F6"
   */
  static macAddress(): string {
    const parts: string[] = [];
    for (let i = 0; i < 6; i++) {
      parts.push(this.hex(2).toUpperCase());
    }
    return parts.join(':');
  }

  /**
   * Generates a random URL
   * @param options - URL generation options
   * @returns Random URL string
   *
   * @example
   * RandomUtils.url();                           // "https://abcdefgh.com/path123"
   * RandomUtils.url({ protocol: 'http' });       // "http://abcdefgh.com/path123"
   */
  static url(options?: { protocol?: 'http' | 'https'; includePort?: boolean }): string {
    const protocol = options?.protocol || 'https';
    const domain = `${this.lowercase(8)}.${this.pick(['com', 'org', 'net', 'io'])}`;
    const path = this.alphanumeric(6).toLowerCase();
    const port = options?.includePort ? `:${this.number(3000, 9000)}` : '';
    return `${protocol}://${domain}${port}/${path}`;
  }

  /**
   * Generates a random color in hex format
   * @returns Hex color string
   *
   * @example
   * RandomUtils.hexColor(); // "#A1B2C3"
   */
  static hexColor(): string {
    return `#${this.hex(6).toUpperCase()}`;
  }

  /**
   * Generates a random RGB color
   * @returns RGB color object
   *
   * @example
   * RandomUtils.rgbColor(); // { r: 161, g: 178, b: 195 }
   */
  static rgbColor(): { r: number; g: number; b: number } {
    return {
      r: this.number(0, 255),
      g: this.number(0, 255),
      b: this.number(0, 255),
    };
  }

  /**
   * Generates a random credit card number (for testing only - not valid)
   * @param type - Card type prefix
   * @returns Fake credit card number
   *
   * @example
   * RandomUtils.creditCard();         // "4123456789012345"
   * RandomUtils.creditCard('5');      // "5123456789012345" (Mastercard-like)
   */
  static creditCard(type: '4' | '5' | '3' = '4'): string {
    return type + this.numericString(15);
  }

  /**
   * Generates a random SSN format (for testing only - not valid)
   * @returns Fake SSN string
   *
   * @example
   * RandomUtils.ssn(); // "123-45-6789"
   */
  static ssn(): string {
    return `${this.numericString(3)}-${this.numericString(2)}-${this.numericString(4)}`;
  }

  /**
   * Generates a random zip code
   * @param extended - Include extended format (default: false)
   * @returns Zip code string
   *
   * @example
   * RandomUtils.zipCode();       // "12345"
   * RandomUtils.zipCode(true);   // "12345-6789"
   */
  static zipCode(extended: boolean = false): string {
    const base = this.numericString(5);
    return extended ? `${base}-${this.numericString(4)}` : base;
  }
}

export default RandomUtils;
