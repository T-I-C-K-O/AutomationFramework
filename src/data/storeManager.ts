/**
 * @fileoverview Store Manager Module for Playwright Test Automation Framework
 *
 * Provides simple key/value persistence across test steps and files by writing
 * to a TypeScript module and reading it back at runtime.
 *
 * Key Features:
 * - Persist cross-step values (e.g., tokens, IDs) into a TS export file
 * - Read values on demand during test execution
 * - Pretty-printed JSON for easy diffs and troubleshooting
 *
 * Usage:
 * ```typescript
 * import { saveValue, getValue } from './utils/storeManager';
 *
 * saveValue('sid', 'ABC123');
 * const sid = getValue('sid'); // 'ABC123'
 * ```
 *
 * Notes:
 * - Persistence format in `testdata/storeValue.ts` is an exported object.
 * - Writes overwrite the full object; avoid concurrent writes from multiple processes.
 * - Reads load the module on demand.
 *
 * @since 1.0.0
 * @version 1.0.0
 */
import * as fs from 'fs';
import * as path from 'path';
import { storeValue } from '../testdata/storeValue'; // adjust the path as needed
import { logger } from '../helpers/logger';

const key = 'sid'; // or any key you want
const value = storeValue[key];
console.log(value); // Output: 2d361193-ad82-48cb-a543-ec43372cfb57

/** Absolute path to the file backing the persisted key/value store. */
const storeFilePath = path.join(process.cwd(), 'testdata/storeValue.ts');

/**
 * Persist a key/value pair to the shared store file.
 *
 * Behavior:
 * - Reads the existing exported object (when present), merges/updates the key,
 *   and rewrites the module export with pretty-printed JSON.
 * - If the file doesn't exist, it initializes an empty export.
 *
 * Caution: Parsing of the existing file uses a lightweight extraction of the
 * object literal via RegExp and `eval`. This assumes the file adheres to the
 * expected format written by this function.
 *
 * @param {string} key - The key to persist.
 * @param {any} value - The value to associate with the key. Must be JSON-serializable.
 * @throws {Error} If the store file cannot be written.
 * @example
 * ```typescript
 * saveValue('token', 'xyz');
 * ```
 * @since 1.0.0
 */
export function saveValue(key: string, value: any) {
  let content: string;

  // If file exists, import its current content
  if (fs.existsSync(storeFilePath)) {
    content = fs.readFileSync(storeFilePath, 'utf-8');
  } else {
    content = `export const storeValue: Record<string, any> = {};\n`;
  }

  // Parse existing values
  const regex = /export const storeValue: Record<string, any> = ({[\s\S]*});/;
  const match = regex.exec(content);
  let current: Record<string, any> = {};

  if (match) {
    try {
      current = eval('(' + match[1] + ')');
    } catch {
      current = {};
    }
  }

  // Add/Update value
  current[key] = value;
  logger.info(`[StoreManager] Persisted key '${key}' with value: ${JSON.stringify(value)}`);

  // Rewrite file
  const newContent = `export const storeValue: Record<string, any> = ${JSON.stringify(current, null, 2)};\n`;
  fs.writeFileSync(storeFilePath, newContent, 'utf-8');
}

/**
 * Retrieve a previously persisted value by key.
 *
 * Implementation details:
 * - Reads the store file directly to get fresh values (avoids module caching issues).
 * - Returns `undefined` when the store has not been initialized or the key is missing.
 *
 * @param {string} key - The key to look up.
 * @returns {any} The stored value, or `undefined` if the key doesn't exist.
 * @example
 * ```typescript
 * const token = getValue('token');
 * ```
 * @since 1.0.0
 */
export function getValue(key: string): any {
  // Read fresh values from file to avoid module caching issues
  if (!fs.existsSync(storeFilePath)) {
    logger.warn(`[StoreManager] Store file not found: ${storeFilePath}`);
    return undefined;
  }

  try {
    const content = fs.readFileSync(storeFilePath, 'utf-8');
    const regex = /export const storeValue: Record<string, any> = ({[\s\S]*});/;
    const match = regex.exec(content);

    if (match) {
      const current = eval('(' + match[1] + ')');
      const value = current[key];
      logger.info(`[StoreManager] Retrieved key '${key}' with value: ${JSON.stringify(value)}`);
      return value;
    }
  } catch (error: any) {
    logger.error(`[StoreManager] Error reading store file: ${error.message}`);
  }

  return undefined;
}
