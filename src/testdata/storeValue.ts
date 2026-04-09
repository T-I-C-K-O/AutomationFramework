/**
 * Store Value Interface
 * 
 * Runtime storage for values captured during test execution.
 * Projects can extend or override this for custom storage needs.
 */

export interface StoreValueMap {
  [key: string]: string | number | boolean | object;
}

/**
 * Default store value - projects should use storeManager instead
 */
export const storeValue: StoreValueMap = {};

export default storeValue;
