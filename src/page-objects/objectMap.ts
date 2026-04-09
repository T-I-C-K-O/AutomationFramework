/**
 * Object Map Registry
 *
 * Provides a centralized registry for element locators that projects
 * can configure at runtime. This allows the core library to remain
 * generic while projects provide their own locator mappings.
 *
 * Usage in project-tests:
 * ```typescript
 * import { ObjectMapRegistry } from '@anthropic-poc/playwright-core';
 * import { myObjectMap } from './page-objects/objectMap';
 *
 * // Register your project's object map
 * ObjectMapRegistry.register(myObjectMap);
 * ```
 */

export interface ObjectMapType {
  [key: string]: string[];
}

/**
 * ObjectMapRegistry - Singleton registry for element locators
 *
 * Projects should register their objectMap during test setup/configuration.
 */
class ObjectMapRegistryClass {
  private static instance: ObjectMapRegistryClass;
  private _objectMap: ObjectMapType = {};

  private constructor() {}

  static getInstance(): ObjectMapRegistryClass {
    if (!ObjectMapRegistryClass.instance) {
      ObjectMapRegistryClass.instance = new ObjectMapRegistryClass();
    }
    return ObjectMapRegistryClass.instance;
  }

  /**
   * Register a project's object map
   * @param map - The object map containing element locators
   */
  register(map: ObjectMapType): void {
    this._objectMap = { ...this._objectMap, ...map };
  }

  /**
   * Get the current object map
   */
  get objectMap(): ObjectMapType {
    return this._objectMap;
  }

  /**
   * Get locators for a specific key
   * @param key - The element key
   * @returns Array of locator expressions or undefined
   */
  get(key: string): string[] | undefined {
    return this._objectMap[key];
  }

  /**
   * Check if a key exists in the object map
   * @param key - The element key
   */
  has(key: string): boolean {
    return key in this._objectMap;
  }

  /**
   * Clear the object map (useful for testing)
   */
  clear(): void {
    this._objectMap = {};
  }
}

export const ObjectMapRegistry = ObjectMapRegistryClass.getInstance();

/**
 * Proxy object that provides backward-compatible access to the registered object map.
 * This allows existing code using `objectMap[key]` to continue working.
 */
export const objectMap: ObjectMapType = new Proxy({} as ObjectMapType, {
  get(_, prop: string) {
    return ObjectMapRegistry.get(prop);
  },
  has(_, prop: string) {
    return ObjectMapRegistry.has(prop);
  },
  ownKeys() {
    return Object.keys(ObjectMapRegistry.objectMap);
  },
  getOwnPropertyDescriptor(_, prop: string) {
    if (ObjectMapRegistry.has(prop)) {
      return {
        enumerable: true,
        configurable: true,
        value: ObjectMapRegistry.get(prop),
      };
    }
    return undefined;
  },
});

export default objectMap;
