import type { TestStep } from '../../../types';
/**
 * @fileoverview API Handler Module for Playwright Test Automation Framework
 *
 * This module provides comprehensive API request handling capabilities for automated testing.
 * It supports multiple HTTP methods, header processing, response parsing, and result extraction
 * with optimized performance and robust error handling.
 *
 * Key Features:
 * - HTTP method support: GET, POST, PUT, DELETE, PATCH, etc.
 * - Flexible header processing with case-insensitive detection
 * - Advanced response parsing for arrays, objects, and nested structures
 * - Result extraction and storage with quoted key format
 * - Comprehensive logging and error handling
 * - Performance-optimized for high-volume testing
 *
 * Usage:
 * ```typescript
 * import { handleAPIAction } from './apiHandler';
 *
 * const data = {
 *   URL: "https://api.example.com/users",
 *   Method: "GET",
 *   Header: { "Authorization": "Bearer token" }
 * };
 * await handleAPIAction(page, "Execute API", data, "'userId'", step);
 * ```
 *
 * @author Automation Framework Team
 * @since 1.0.0
 * @version 1.0.0
 */

import { APIRequestContext, Page, request } from '@playwright/test';
import { logger } from '../../../helpers/logger';
import { getValue, saveValue } from '../../../data/storeManager';

// Token caching (30 minutes TTL) with in-flight request de-duplication
// const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const tokenCache: { token: string; expiresAt: number } | null = null;
let tokenInFlight: Promise<string> | null = null;

/**
 * Shape of structured result processing configuration
 */
interface ResultConfig {
  StatusCode?: number;
  ValidateFields?: Record<string, 'notNull' | 'string' | 'number' | 'boolean' | 'timestamp'>;
  StoreFields?: Record<string, string>; // sourcePath -> storeKey
}

// ============================================================================
// CONFIGURATION VALIDATION UTILITIES
// ============================================================================

/**
 * Parses string input into object for ResultConfig validation
 * @param value - String value to parse
 * @returns Parsed object
 * @throws {Error} If parsing fails
 */
function parseResultConfigString(value: string): unknown {
  if (!value.trim()) {
    throw new Error('Result configuration cannot be an empty string.');
  }

  try {
    const unescaped = value.replace(/\\n/g, '\n');
    const parsed = JSON.parse(unescaped);
    logger.debug(`[APIHandler] Parsed JSON configuration:\n${JSON.stringify(parsed, null, 2)}`);
    return parsed;
  } catch (parseError: any) {
    const unescaped = value.replace(/\\n/g, '\n');
    logger.error(`[APIHandler] Failed to parse JSON configuration:\n${unescaped}`);
    throw new Error(`Invalid JSON format. Error: ${parseError.message}`);
  }
}

/**
 * Validates ResultConfig object structure and properties
 * @param config - Object to validate
 * @returns Array of validation errors (empty if valid)
 */
function validateResultConfigStructure(config: Record<string, unknown>): string[] {
  const errors: string[] = [];

  if (config.StatusCode !== undefined && typeof config.StatusCode !== 'number') {
    errors.push('StatusCode must be a number. Example: StatusCode: 200');
  }

  if (
    config.ValidateFields !== undefined &&
    (typeof config.ValidateFields !== 'object' ||
      Array.isArray(config.ValidateFields) ||
      config.ValidateFields === null)
  ) {
    errors.push('ValidateFields must be an object. Example: ValidateFields: {"sid": "notNull"}');
  }

  if (
    config.StoreFields !== undefined &&
    (typeof config.StoreFields !== 'object' || Array.isArray(config.StoreFields) || config.StoreFields === null)
  ) {
    errors.push('StoreFields must be an object. Example: StoreFields: {"sid": "sid"}');
  }

  if (!config.StatusCode && !config.ValidateFields && !config.StoreFields) {
    errors.push('Must contain at least one of: StatusCode, ValidateFields, or StoreFields.');
  }

  return errors;
}

/**
 * Type guard for structured result config with comprehensive exception handling
 * @param value - Input value to validate as ResultConfig
 * @returns true if valid ResultConfig, throws descriptive error otherwise
 */
function isResultConfig(value: unknown): value is ResultConfig {
  try {
    if (value === null) {
      throw new Error(
        'Result configuration cannot be null or undefined. Expected an object with StatusCode, ValidateFields, and/or StoreFields.'
      );
    }

    const parsedValue = typeof value === 'string' ? parseResultConfigString(value) : value;

    if (typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
      throw new Error('Expected an object with StatusCode, ValidateFields, and/or StoreFields properties.');
    }

    const errors = validateResultConfigStructure(parsedValue as Record<string, unknown>);

    if (errors.length > 0) {
      const errorMessage = `Your expected results are not in the proper format. ${errors.join(' ')} Please check your inputs.`;
      logger.error(`[APIHandler] Result config validation failed: ${errors.join('; ')}`);
      throw new Error(errorMessage);
    }

    return true;
  } catch (error: any) {
    if (error.message?.includes('expected results') || error.message?.includes('JSON format')) {
      throw error;
    }

    logger.error(`[APIHandler] Unexpected error in isResultConfig validation: ${error?.message || error}`);
    throw new Error(
      `Result configuration validation failed unexpectedly. ${error?.message || 'Unknown error occurred'} Please check your input format.`
    );
  }
}

// ============================================================================
// DATA EXTRACTION AND PROCESSING UTILITIES
// ============================================================================

/**
 * Extracts values from array items by searching for a specified key in each object
 *
 * @param {any[]} items - Array of objects to search through
 * @param {string} key - The property key to extract from each object
 * @returns {any[]} Array of extracted values from objects that contain the specified key
 *
 * @example
 * ```typescript
 * const users = [{ name: "John", age: 30 }, { name: "Jane", city: "NYC" }];
 * const names = extractFromArray(users, "name"); // Returns ["John", "Jane"]
 * ```
 *
 * @since 1.0.0
 */
function extractFromArray(items: any[], key: string): any[] {
  const results: any[] = [];
  for (const item of items) {
    if (item && typeof item === 'object' && key in item) {
      results.push(item[key]);
    }
  }
  return results;
}

/**
 * Applies structured result processing to a parsed API response.
 *
 * Behavior:
 * - StatusCode: If provided and the HTTP status mismatches, throws an Error.
 * - ValidateFields: Resolves each path via getValueByPath and validates by rule; throws aggregated Error on failures.
 * - StoreFields: Resolves values and stores them via saveValue; logs warnings for missing paths and does not throw.
 *
 * @param response Playwright Response object used for status code validation
 * @param root Parsed JSON root used for field resolution (often json.results if present, else full JSON)
 * @param cfg Structured result configuration with optional StatusCode, ValidateFields, and StoreFields
 * @throws {Error} When StatusCode mismatches or any ValidateFields rule fails
 * @since 1.0.0
 */
function processResultConfig(response: any, root: any, cfg: ResultConfig): void {
  try {
    if (typeof cfg.StatusCode === 'number' && response.status() !== cfg.StatusCode) {
      throw new Error(
        'Unexpected status code: expected ' +
          cfg.StatusCode +
          ', got ' +
          response.status() +
          ' reponse message will be: ' +
          root.MESSAGE
      );
    }
    if (cfg.ValidateFields) {
      validateFieldsSpec(root, cfg.ValidateFields);
      logger.info('[APIHandler] Validated ' + Object.keys(cfg.ValidateFields).length + ' field(s) successfully');
    }
    if (cfg.StoreFields) {
      storeFieldsSpec(root, cfg.StoreFields);
    }
  } catch (error: any) {
    // Add contextual logging but preserve original error semantics
    logger.error(`[APIHandler] processResultConfig failed: ${error?.message || error}`);
    throw error;
  }
}

/**
 * Extracts values from nested arrays within an object by searching for a specified key
 * Recursively searches through all array properties in the object
 *
 * @param {any} obj - Object containing nested arrays to search through
 * @param {string} key - The property key to extract from objects within nested arrays
 * @returns {any[]} Flattened array of all extracted values from nested arrays
 *
 * @example
 * ```typescript
 * const data = {
 *   users: [{ name: "John" }, { name: "Jane" }],
 *   admins: [{ name: "Admin1" }]
 * };
 * const names = extractFromNestedArrays(data, "name"); // Returns ["John", "Jane", "Admin1"]
 * ```
 *
 * @since 1.0.0
 */
function extractFromNestedArrays(obj: any, key: string): any[] {
  const results: any[] = [];
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      results.push(...extractFromArray(value, key));
    }
  }
  return results;
}

/**
 * Safely resolves nested properties using dot/bracket notation: a.b[0].c
 * Handles arrays by either direct numeric index access or attempting the same path on each element.
 */
function getValueByPath(obj: any, path: string): any {
  if (path === null || path.trim() === '') return obj;
  const normalized = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
  const parts = normalized.split('.').filter(Boolean);

  const walk = (value: any, i: number): any => {
    if (i >= parts.length) return value;
    if (value === null) return undefined;
    const seg = parts[i];
    if (Array.isArray(value)) {
      if (/^\d+$/.test(seg)) {
        const idx = Number(seg);
        if (idx < 0 || idx >= value.length) return undefined;
        return walk(value[idx], i + 1);
      }
      for (const item of value) {
        const res = walk(item, i);
        if (res !== undefined) return res;
      }
      return undefined;
    }
    // value is 'any', direct index is fine without assertion
    return walk(value[seg], i + 1);
  };
  return walk(obj, 0);
}

// Validate multiple fields according to ValidateFields spec; throws on failure
/**
 * Validates multiple response fields against a set of rules.
 *
 * @param jsonResponse Root object/array to resolve field paths from
 * @param validateSpec Map of path -> rule ('notNull' | 'string' | 'number' | 'boolean' | 'timestamp')
 * @throws {Error} Aggregated error when one or more validations fail
 * @since 1.0.0
 */
function validateFieldsSpec(jsonResponse: any, validateSpec: NonNullable<ResultConfig['ValidateFields']>): void {
  const failures: string[] = [];
  for (const [path, rule] of Object.entries(validateSpec)) {
    const value = getValueByPath(jsonResponse, path);
    const ok = isValidByRule(value, rule);
    if (!ok) {
      const valueSuffix = value !== undefined ? ' (value=' + JSON.stringify(value) + ')' : '';
      failures.push(path + ' failed rule ' + rule + valueSuffix);
    }
  }
  if (failures.length > 0) {
    const msg = 'Response validation failed: ' + failures.join('; ');
    logger.error(`[APIHandler] ${msg}`);
    throw new Error(msg);
  }
}

/**
 * Stores response fields into the store according to the provided mapping.
 *
 * @param jsonResponse Root object/array to resolve source paths from
 * @param storeSpec Map of sourcePath -> storeKey
 * @description Logs warnings for missing source paths; does not throw
 * @since 1.0.0
 */
function storeFieldsSpec(jsonResponse: any, storeSpec: NonNullable<ResultConfig['StoreFields']>): void {
  let stored = 0;
  for (const [sourcePath, storeKey] of Object.entries(storeSpec)) {
    const value = getValueByPath(jsonResponse, sourcePath);
    if (value === undefined) {
      logger.warn(`[APIHandler] StoreFields: source '${sourcePath}' not found in response`);
      continue;
    }
    saveValue(storeKey, value);
    stored++;
    logger.info(`[APIHandler] Stored field '${sourcePath}' as '${storeKey}' = ${JSON.stringify(value)}`);
  }
  if (stored === 0) {
    logger.warn('[APIHandler] No fields stored from StoreFields configuration');
  }
}

// ============================================================================
// FIELD VALIDATION UTILITIES
// ============================================================================

// Validates a value against a simple rule set
/**
 * Validates equals rule with support for runtime variables and static values
 * @param value - Actual value from API response
 * @param expectedValue - Expected value (may contain {{variable}} placeholders)
 * @returns true if values match, false otherwise
 */
function validateEqualsRule(value: any, expectedValue: string): boolean {
  // Check if it's a runtime variable (contains {{variableName}})
  if (expectedValue.includes('{{') && expectedValue.includes('}}')) {
    try {
      // Replace placeholders with actual values from store
      const resolvedValue = replacePlaceholders(expectedValue);
      return value === resolvedValue;
    } catch (error: any) {
      logger.warn(
        `[APIHandler] Failed to resolve placeholder in equals validation: ${expectedValue}. Error: ${error.message}`
      );
      return false;
    }
  } else {
    // Check if it's a runtime variable without {{}} (e.g., "equals:sid")
    try {
      const resolvedValue = getValue(expectedValue);
      if (resolvedValue !== undefined) {
        return value === resolvedValue;
      }
    } catch (error: any) {
      // If getValue fails, treat as static value
      logger.debug(
        `Variable '${expectedValue}' not found in store: ${error?.message || error}. Treating as static value`
      );
    }
    // Direct comparison for static values
    return value === expectedValue;
  }
}

/**
 * Validates contains rule with support for runtime variables and static values
 * @param value - Actual value from API response (must be string)
 * @param expectedValue - Expected substring (may contain {{variable}} placeholders or direct variable name)
 * @returns true if value contains expected substring, false otherwise
 */
function validateContainsRule(value: any, expectedValue: string): boolean {
  // Value must be a string for contains validation
  if (typeof value !== 'string') {
    logger.warn(`[APIHandler] Contains validation requires string value, got: ${typeof value}`);
    return false;
  }

  let searchValue: string;

  // Check if it's a runtime variable with {{}} (e.g., "contains:{{categoryName}}")
  if (expectedValue.includes('{{') && expectedValue.includes('}}')) {
    try {
      searchValue = replacePlaceholders(expectedValue);
    } catch (error: any) {
      logger.warn(
        `[APIHandler] Failed to resolve placeholder in contains validation: ${expectedValue}. Error: ${error.message}`
      );
      return false;
    }
  } else {
    // Check if it's a runtime variable without {{}} (e.g., "contains:categoryName")
    try {
      const resolvedValue = getValue(expectedValue);
      if (resolvedValue !== undefined) {
        searchValue = String(resolvedValue);
      } else {
        // Treat as static value
        searchValue = expectedValue;
      }
    } catch (error: any) {
      // If getValue fails, treat as static value
      logger.debug(
        `[APIHandler] Variable '${expectedValue}' not found in store: ${error?.message || error}. Treating as static value`
      );
      searchValue = expectedValue;
    }
  }

  return value.includes(searchValue);
}

/**
 * Validates timestamp rule for both number and string formats
 * @param value - Value to validate as timestamp
 * @returns true if valid timestamp, false otherwise
 */
function validateTimestampRule(value: any): boolean {
  if (typeof value === 'number') {
    const d = new Date(value);
    return !Number.isNaN(d.getTime());
  }
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return !Number.isNaN(t);
  }
  return false;
}

/**
 * Checks whether a value satisfies the given validation rule.
 *
 * @param value Value to validate from API response
 * @param rule Validation rule: 'notNull' | 'string' | 'number' | 'boolean' | 'timestamp' | 'equals:expectedValue' | 'contains:substring'
 * @returns true if the value satisfies the rule, otherwise false
 *
 * @example
 * ```typescript
 * // Basic type validation
 * isValidByRule("test", "string") // true
 * isValidByRule(123, "number") // true
 *
 * // Equals validation with runtime variables
 * isValidByRule("ABC123", "equals:{{sid}}") // true if getValue("sid") returns "ABC123"
 * isValidByRule("ABC123", "equals:sid") // true if getValue("sid") returns "ABC123"
 * isValidByRule("Intangible", "equals:Intangible") // true
 *
 * // Contains validation
 * isValidByRule("Intangible Asset", "contains:{{categoryName}}") // true if getValue("categoryName") returns "Intangible"
 * isValidByRule("Intangible Asset", "contains:categoryName") // true if getValue("categoryName") returns "Asset"
 * isValidByRule("Software License", "contains:License") // true
 * ```
 */
function isValidByRule(
  value: any,
  rule: ResultConfig['ValidateFields'] extends Record<string, infer T> ? T : string
): boolean {
  if (typeof rule !== 'string') {
    logger.warn(`[APIHandler] Invalid validation rule type: ${typeof rule}`);
    return false;
  }

  // Handle equals: validation rule
  if (rule.startsWith('equals:')) {
    const expectedValue = rule.substring(7); // Remove 'equals:' prefix
    return validateEqualsRule(value, expectedValue);
  }

  // Handle contains: validation rule
  if (rule.startsWith('contains:')) {
    const expectedValue = rule.substring(9); // Remove 'contains:' prefix
    return validateContainsRule(value, expectedValue);
  }

  // Original validation rules
  switch (rule) {
    case 'notNull':
      return value !== null && value !== undefined && value !== '';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'timestamp':
      return validateTimestampRule(value);
    default:
      logger.warn(`[APIHandler] Unknown validation rule: ${rule}`);
      return false;
  }
}

// ============================================================================
// RESPONSE PROCESSING AND EXTRACTION UTILITIES
// ============================================================================

/**
 * Extracts values from an API response based on a specified key with optimized performance
 * Supports multiple data structures: arrays, nested objects, and nested arrays
 *
 * @param {any} response - API response data (can be array, object, or primitive)
 * @param {string} key - The property key to extract from the response data
 * @returns {any[]} Array of extracted values, empty array if no matches found
 *
 * @example
 * ```typescript
 * // For array response
 * const response = [{ id: 1, name: "John" }, { id: 2, name: "Jane" }];
 * const ids = extractResults(response, "id"); // Returns [1, 2]
 *
 * // For nested object response
 * const response = { users: [{ name: "John" }], admins: [{ name: "Admin" }] };
 * const names = extractResults(response, "name"); // Returns ["John", "Admin"]
 * ```
 *
 * @throws {Error} If an error occurs during extraction (logged but not thrown)
 * @since 1.0.0
 */
function extractResults(response: any, key: string): any[] {
  if (!response || !key?.trim()) {
    return [];
  }

  const trimmedKey = key.trim();
  const results: any[] = [];

  try {
    if (Array.isArray(response)) {
      results.push(...extractFromArray(response, trimmedKey));
    } else if (typeof response === 'object') {
      // Direct key check
      if (trimmedKey in response) {
        results.push(response[trimmedKey]);
      }

      // Search nested arrays
      results.push(...extractFromNestedArrays(response, trimmedKey));
    }

    if (results.length > 0) {
      logger.info(`[APIHandler] Extracted ${results.length} values for key '${trimmedKey}'`);
    }

    return results;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[APIHandler] Result extraction failed for key '${trimmedKey}': ${error.message}`);
      throw new Error(`Result extraction failed: ${error.message}`);
    } else {
      logger.error(`[APIHandler] Result extraction failed for key '${trimmedKey}': ${String(error)}`);
      throw new Error(`Result extraction failed: ${String(error)}`);
    }
  }
}

/**
 * Prepares and validates headers for API requests with case-insensitive header detection
 * Supports multiple header property names and performs type validation
 *
 * @param {any} data - Request data object that may contain headers
 * @returns {Record<string, string>} Validated headers object with string values
 *
 * @example
 * ```typescript
 * const requestData = {
 *   Header: { "Content-Type": "application/json", "Authorization": "Bearer token123" },
 *   URL: "https://api.example.com",
 *   Method: "POST"
 * };
 * const headers = prepareAPIHeaders(requestData);
 * // Returns { "Content-Type": "application/json", "Authorization": "Bearer token123" }
 * ```
 *
 * @description
 * - Searches for headers in data.Header, data.headers, or data.HEADER
 * - Converts all header values to strings for API compatibility
 * - Returns empty object if no valid headers found
 * - Logs header count for debugging purposes
 *
 * @throws {Error} If header processing fails during conversion
 * @since 1.0.0
 */
function prepareAPIHeaders(data: any, token: string): Record<string, string> {
  if (!data) return {};

  const headerData = data.Header || data.headers || data.HEADER;
  if (!headerData || typeof headerData !== 'object') return {};

  const headers: Record<string, string> = {};
  let headerCount = 0;

  try {
    for (const [key, value] of Object.entries(headerData)) {
      if (!key?.trim() || value === null) continue;

      let stringValue: string;
      if (key === 'Authorization') {
        stringValue = 'Bearer ' + token;
      } else if (typeof value === 'string') {
        stringValue = value.trim();
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        stringValue = String(value);
      } else {
        continue; // Skip objects and other complex types
      }
      if (key === 'Cookie') {
        stringValue = token;
      }
      if (stringValue) {
        headers[key.trim()] = stringValue;
        headerCount++;
      }
    }

    if (headerCount > 0) {
      logger.info(`[APIHandler] Prepared ${headerCount} API headers`);
    }

    return headers;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[APIHandler] Header preparation failed: ${error.message}`);
      throw new Error(`Failed to prepare API headers: ${error.message}`);
    } else {
      logger.error(`[APIHandler] Header preparation failed: ${String(error)}`);
      throw new Error(`Failed to prepare API headers: ${String(error)}`);
    }
  }
}

/**
 * Processes API response with comprehensive error handling and result extraction
 * Supports two "result" modes:
 * 1) String with quoted key (e.g., "'sid'") for simple extraction
 * 2) Structured object with StatusCode, ValidateFields, and StoreFields
 *
 * @param {any} response - Playwright Response object from API call
 * @param {string | ResultConfig} result - Result instruction: quoted key or structured config
 * @returns {Promise<void>} Promise that resolves after processing response
 *
 * @example
 * // Mode 1: simple extraction
 * await processAPIResponse(response, "'sid'");
 *
 * // Mode 2: structured config
 * await processAPIResponse(response, {
 *   StatusCode: 200,
 *   ValidateFields: {
 *     sid: 'notNull',
 *     name: 'string',
 *     description: 'string',
 *     createdDate: 'timestamp'
 *   },
 *   StoreFields: {
 *     sid: 'sid',
 *     description: 'categoryDescription',
 *     createdDate: 'createdDate'
 *   }
 * });
 *
 * @description
 * - First checks if response is successful (response.ok()) or matches provided StatusCode
 * - For failed responses, delegates to handleErrorResponse
 * - For successful responses, parses JSON and applies validations + storage if configured
 * - Logs validation and storage outcomes
 *
 * @throws {Error} If response indicates failure, validations fail, or JSON parsing fails
 * @since 1.0.0
 */
// NOSONAR: function is intentionally orchestrating multiple concerns; helpers are extracted to reduce complexity
async function processAPIResponse(response: any, result: string | ResultConfig): Promise<void> {
  // Parse JSON once; do not catch validation/status exceptions here.
  let jsonResponse: any;
  try {
    jsonResponse = await response.json();
  } catch (jsonError: any) {
    // Fallback to text response for logging context
    try {
      const textResponse = await response.text();
      logger.info(`[APIHandler] API Response (text): ${textResponse.substring(0, 200)}...`);
    } catch {
      // If even text can't be read, propagate parsing error
      throw new Error(`Failed to read API response: ${jsonError?.message || 'unknown error'}`);
    }
    // If structured config was requested, we must fail because we can't validate without JSON
    if (isResultConfig(result)) {
      throw new Error(
        `Expected JSON response for structured result processing: ${jsonError?.message || 'invalid JSON'}`
      );
    }
    // For simple quoted-key result, we cannot extract from non-JSON text; just return after logging
    return;
  }

  // Choose root: prefer json.results when present, else the whole JSON
  let root: any = jsonResponse;
  const obj: any = jsonResponse;
  if (obj && typeof obj === 'object' && 'results' in obj) {
    root = obj.results;
  }

  // Handle structured config (may throw; let it bubble up)
  if (isResultConfig(result)) {
    processResultConfig(response, root, result);
  }
}

// ============================================================================
// AUTHENTICATION AND TOKEN MANAGEMENT
// ============================================================================

/**
 * Prepares and retrieves an authentication token using OAuth2 client credentials flow
 * Implements 30-minute caching with in-flight request de-duplication.
 * The first call fetches a new token; subsequent calls within 30 minutes reuse the cached token.
 * When the cache expires (> 30 minutes), a new token is fetched and cached again.
 *
 * @returns {Promise<string>} Promise resolving to the access token string
 *
 * @example
 * ```typescript
 * // First call fetches and caches the token
 * const token1 = await prepareAPIToken();
 * // Calls within 30 minutes reuse the cached token
 * const token2 = await prepareAPIToken(); // token2 === token1
 * ```
 *
 * @description
 * Authentication Flow:
 * - Uses OAuth2 client credentials grant type
 * - Sends POST request to PROPERTIES['AUTH_URL'] endpoint
 * - Includes client_id and client_secret from configuration
 * - Content-Type: application/x-www-form-urlencoded
 *
 * Caching Strategy:
 * - Cache TTL: 30 minutes from acquisition time
 * - If a token request is already in flight, concurrent callers await the same promise
 * - Logs cache hits, misses, and expiry timestamps
 *
 * @throws {Error} If authentication request fails (network, credentials, or response format)
 * @throws {Error} If access_token is missing from successful response
 * @since 1.0.0
 */
export async function prepareAPIToken(): Promise<string> {
  if (process.env.BEARER_TOKEN) {
    return process.env.BEARER_TOKEN;
  }

  if (process.env.COOKIE_TOKEN) {
    return process.env.COOKIE_TOKEN;
  }

  const now = Date.now();

  // Return cached token if valid
  if (tokenCache && now < tokenCache.expiresAt) {
    logger.info('[APIHandler] Using cached API token');
    return tokenCache.token;
  }

  // If a request is already in progress, share it
  if (tokenInFlight !== null) {
    logger.debug('[APIHandler] Awaiting in-flight token request');
    return tokenInFlight;
  }

  // Start a new token request
  tokenInFlight = (async () => {
    const apiContext: APIRequestContext = await request.newContext();
    try {
      const authUrl = process.env.AUTH_URL || '';
      const clientId = process.env.CLIENT_ID || '';
      const clientSecret = process.env.CLIENT_SECRET || '';

      const response = await apiContext.post(authUrl, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        form: {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        },
      });

      if (!response.ok()) {
        throw new Error(`Failed to fetch token: ${response.status()} ${response.statusText()}`);
      }

      const json = await response.json();

      if (!json.access_token) {
        throw new Error(`Token not found in response: ${JSON.stringify(json)}`);
      }
      return json.access_token;
    } finally {
      // Always cleanup context and reset in-flight state
      try {
        await apiContext.dispose();
      } catch (cleanupError: any) {
        logger.warn(`[APIHandler] Token API context cleanup warning: ${cleanupError.message}`);
      }
      tokenInFlight = null;
    }
  })();

  return tokenInFlight;
}

// ============================================================================
// PLACEHOLDER REPLACEMENT UTILITIES
// ============================================================================

/**
 * Recursively replaces placeholders in any data type: objects, arrays, strings, or primitives
 *
 * @param input - The input data (object, array, string, or primitive)
 * @returns The input with all placeholders replaced
 *
 * @example
 * ```typescript
 * // String
 * replacePlaceholders('Hello {{name}}') → 'Hello John'
 *
 * // Object
 * replacePlaceholders({sid: '{{sid}}', name: 'Test'}) → {sid: 'actual_value', name: 'Test'}
 *
 * // Array
 * replacePlaceholders(['{{id}}', 'static']) → ['123', 'static']
 *
 * // Nested
 * replacePlaceholders({users: [{id: '{{userId}}'}]}) → {users: [{id: 'actual_user_id'}]}
 * ```
 */
/**
 * Resolves a single placeholder key by checking the store first, then environment variables.
 *
 * @param key - The placeholder key to resolve (without curly braces)
 * @returns The resolved value from store or environment
 * @throws {Error} If the key is not found in either store or environment
 */
function resolvePlaceholderKey(key: string): string {
  // Step 1: Clean up the key by removing whitespace
  const trimmedKey = key.trim();

  // Step 2: Initialize value as undefined
  let value: string | undefined = undefined;

  // Step 3: Try to get value from the test data store
  try {
    value = getValue(trimmedKey);
  } catch {
    // Step 4: If getValue throws, value remains undefined
    value = undefined;
  }

  // Step 5: If not found in store, try environment variables
  if (value === undefined) {
    value = process.env[trimmedKey];
  }

  // Step 6: If still not found, throw a descriptive error
  if (value === undefined) {
    throw new Error(`[APIHandler] Placeholder '${trimmedKey}' not found in store or environment variables`);
  }

  // Step 7: Return the resolved value
  return value;
}

/**
 * Replaces all {{key}} placeholders in a string with their resolved values.
 *
 * @param input - The string containing placeholders
 * @returns The string with all placeholders replaced
 */
function replaceStringPlaceholders(input: string): string {
  // Step 1: Define the regex pattern to match {{key}} placeholders
  const placeholderRegex = /{{(.*?)}}/g;

  // Step 2: Replace each placeholder with its resolved value
  return input.replace(placeholderRegex, (_, key) => resolvePlaceholderKey(key));
}

/**
 * Replaces placeholders in an array by processing each element recursively.
 *
 * @param input - The array containing elements with potential placeholders
 * @returns A new array with all placeholders replaced
 */
function replaceArrayPlaceholders(input: any[]): any[] {
  return input.map((item) => replacePlaceholders(item));
}

/**
 * Replaces placeholders in an object by processing each property recursively.
 *
 * @param input - The object containing properties with potential placeholders
 * @returns A new object with all placeholders replaced
 */
function replaceObjectPlaceholders(input: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    result[key] = replacePlaceholders(value);
  }
  return result;
}

/**
 * Recursively replaces placeholders in any data type: objects, arrays, strings, or primitives
 *
 * @param input - The input data (object, array, string, or primitive)
 * @returns The input with all placeholders replaced
 *
 * @example
 * ```typescript
 * // String
 * replacePlaceholders('Hello {{name}}') → 'Hello John'
 *
 * // Object
 * replacePlaceholders({sid: '{{sid}}', name: 'Test'}) → {sid: 'actual_value', name: 'Test'}
 *
 * // Array
 * replacePlaceholders(['{{id}}', 'static']) → ['123', 'static']
 *
 * // Nested
 * replacePlaceholders({users: [{id: '{{userId}}'}]}) → {users: [{id: 'actual_user_id'}]}
 * ```
 */
function replacePlaceholders(input: any): any {
  // Step 1: Handle null or undefined input
  if (input === null || input === undefined) {
    return input;
  }

  // Step 2: Handle string input - replace placeholders
  if (typeof input === 'string') {
    return replaceStringPlaceholders(input);
  }

  // Step 3: Handle array input - process each element
  if (Array.isArray(input)) {
    return replaceArrayPlaceholders(input);
  }

  // Step 4: Handle object input - process each property
  if (typeof input === 'object') {
    return replaceObjectPlaceholders(input);
  }

  // Step 5: For primitives (number, boolean, etc.), return as-is
  return input;
}

// ============================================================================
// MAIN API HANDLER - ENTRY POINT
// ============================================================================

/**
 * Handles API action execution for all HTTP methods (GET, POST, PUT, DELETE, etc.)
 * Main entry point for API operations with comprehensive request/response handling
 *
 * @param {Page} page - Playwright Page object (not used but required for interface compatibility)
 * @param {string} action - Action string that must start with Execute|Trigger|Hit|Fire
 * @param {any} data - Request data object containing URL, Method, Header, and optional Body
 * @param {string} result - Optional result parameter for data extraction (quoted key format)
 * @param {TestStep} step - Test step object containing action details
 * @returns {Promise<boolean>} Promise resolving to true if action was handled, false if not applicable
 *
 * @example
 * ```typescript
 * const data = {
 *   URL: "https://api.example.com/users",
 *   Method: "GET",
 *   Header: { "Authorization": "Bearer token123" }
 * };
 * const handled = await handleAPIAction(page, "Execute API", data, "'userId'", step);
 * // Returns true and extracts userId from response
 * ```
 *
 * @description
 * Action Recognition:
 * - Only processes actions starting with: Execute, Trigger, Hit, Fire (case-insensitive)
 * - Returns false for non-API actions to allow other handlers
 *
 * Request Processing:
 * - Validates required data.URL and data.Method properties
 * - Prepares headers using prepareAPIHeaders function
 * - Creates new API context for isolated request handling
 * - Supports request body for POST/PUT operations
 *
 * Response Handling:
 * - Delegates response processing to processAPIResponse
 * - Handles both success and error scenarios
 * - Extracts and stores results if specified
 * - Comprehensive logging throughout execution
 *
 * @throws {Error} If data validation fails or API request processing fails
 * @since 1.0.0
 */
export async function handleAPIAction(page: Page, action: string, data: any, step: TestStep): Promise<boolean> {
  const firstWord = action.trim().split(/\s+/)[0];
  if (!/Trigger|Hit|Fire/i.test(firstWord)) {
    return false;
  }
  data = JSON.parse(data);
  if (!data?.URL || !data?.Method) {
    throw new Error('Invalid API data: Missing URL or Method');
  }

  // const hostURL = data.URL;
  let requestUrl = data.URL;
  let apiContext: APIRequestContext | null = null;
  try {
    requestUrl = replacePlaceholders(data.URL);
    // if (requestUrl.startsWith('{{url}}') || requestUrl.startsWith('{{URL}}')) {
    //   const baseUrl = process.env.BASE_URL || process.env.URL || '';
    //   requestUrl = hostURL.replace('{{url}}', baseUrl) || hostURL.replace('{{URL}}', baseUrl);
    //   requestUrl = replacePlaceholders(requestUrl);
    // }

    logger.info(`[APIHandler] API ${data.Method} ${data.URL}`);
    const token = await prepareAPIToken();

    apiContext = await request.newContext();
    const headers = prepareAPIHeaders(data, token);

    const updatedData = replacePlaceholders(data.Body);
    const response = await apiContext.fetch(requestUrl, {
      method: data.Method,
      headers,
      data: updatedData,
    });

    await processAPIResponse(response, step.result ?? {});
    logger.info(`[APIHandler] API ${data.Method} completed successfully`);

    return true;
  } catch (error: any) {
    logger.error(`[APIHandler] API Action Failed: ${error.message}`);
    throw error;
  } finally {
    if (apiContext) {
      try {
        await apiContext.dispose();
      } catch (cleanupError: any) {
        logger.warn(`[APIHandler] API context cleanup warning: ${cleanupError.message}`);
      }
    }
  }
}
