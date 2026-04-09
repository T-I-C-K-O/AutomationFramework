/**
 * Page Class Map Registry
 *
 * Provides a centralized registry for page classes that projects
 * can configure at runtime. This allows the core library to remain
 * generic while projects provide their own page class mappings.
 *
 * Usage in project-tests:
 * ```typescript
 * import { PageClassMapRegistry } from '@anthropic-poc/playwright-core';
 * import { myPageClassMap } from './pages/pageclassMap';
 *
 * // Register your project's page class map
 * PageClassMapRegistry.register(myPageClassMap);
 * ```
 */

export interface PageClassMapType {
  [key: string]: any;
}

/**
 * PageClassMapRegistry - Singleton registry for page classes
 *
 * Projects should register their pageClassMap during test setup/configuration.
 */
class PageClassMapRegistryClass {
  private static instance: PageClassMapRegistryClass;
  private _pageClassMap: PageClassMapType = {};

  private constructor() {}

  static getInstance(): PageClassMapRegistryClass {
    if (!PageClassMapRegistryClass.instance) {
      PageClassMapRegistryClass.instance = new PageClassMapRegistryClass();
    }
    return PageClassMapRegistryClass.instance;
  }

  /**
   * Register a project's page class map
   * @param map - The page class map containing page class mappings
   */
  register(map: PageClassMapType): void {
    this._pageClassMap = { ...this._pageClassMap, ...map };
  }

  /**
   * Get the current page class map
   */
  get pageClassMap(): PageClassMapType {
    return this._pageClassMap;
  }

  /**
   * Get a page class for a specific key
   * @param key - The page class key
   * @returns Page class or undefined
   */
  get(key: string): any {
    return this._pageClassMap[key];
  }

  /**
   * Check if a key exists in the page class map
   * @param key - The page class key
   */
  has(key: string): boolean {
    return key in this._pageClassMap;
  }

  /**
   * Clear the page class map (useful for testing)
   */
  clear(): void {
    this._pageClassMap = {};
  }
}

export const PageClassMapRegistry = PageClassMapRegistryClass.getInstance();

/**
 * Proxy object that provides backward-compatible access to the registered page class map.
 * This allows existing code using `pageClassMap[key]` to continue working.
 */
export const pageClassMap: PageClassMapType = new Proxy({} as PageClassMapType, {
  get(_, prop: string) {
    return PageClassMapRegistry.get(prop);
  },
  has(_, prop: string) {
    return PageClassMapRegistry.has(prop);
  },
  ownKeys() {
    return Object.keys(PageClassMapRegistry.pageClassMap);
  },
  getOwnPropertyDescriptor(_, prop: string) {
    if (PageClassMapRegistry.has(prop)) {
      return {
        enumerable: true,
        configurable: true,
        value: PageClassMapRegistry.get(prop),
      };
    }
    return undefined;
  },
});

export default pageClassMap;
