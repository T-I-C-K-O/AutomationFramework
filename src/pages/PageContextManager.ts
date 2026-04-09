/**
 * Page Context Manager
 *
 * Manages multiple page contexts for multi-tab/window scenarios.
 */

import { Page, BrowserContext } from '@playwright/test';

export class PageContextManager {
  private static instance: PageContextManager;
  private pages: Map<string, Page> = new Map();
  private currentPage: Page | null = null;
  private context: BrowserContext | null = null;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): PageContextManager {
    if (!PageContextManager.instance) {
      PageContextManager.instance = new PageContextManager();
    }
    return PageContextManager.instance;
  }

  /**
   * Set the browser context
   */
  setContext(context: BrowserContext): void {
    this.context = context;
  }

  /**
   * Get the current active page
   */
  getCurrentPage(): Page | null {
    return this.currentPage;
  }

  /**
   * Set the current active page
   */
  setCurrentPage(page: Page): void {
    this.currentPage = page;
  }

  /**
   * Register a page with a name (alias for addPage)
   */
  registerPage(name: string, page: Page): void {
    this.pages.set(name, page);
  }

  /**
   * Add a page with a name
   */
  addPage(name: string, page: Page): void {
    this.pages.set(name, page);
    if (!this.currentPage) {
      this.currentPage = page;
    }
  }

  /**
   * Get a page by name
   */
  getPage(name: string): Page | undefined {
    return this.pages.get(name);
  }

  /**
   * Switch to a page by name
   */
  switchToPage(name: string): Page | undefined {
    const page = this.pages.get(name);
    if (page) {
      this.currentPage = page;
    }
    return page;
  }

  /**
   * Get all registered page names
   */
  getPageNames(): string[] {
    return Array.from(this.pages.keys());
  }

  /**
   * Get all pages
   */
  getAllPages(): Map<string, Page> {
    return this.pages;
  }

  /**
   * Clear all registered pages
   */
  clear(): void {
    this.pages.clear();
    this.currentPage = null;
  }

  /**
   * Reset instance (for testing)
   */
  static resetInstance(): void {
    PageContextManager.instance = new PageContextManager();
  }
}

export const pageContextManager = PageContextManager.getInstance();
export default PageContextManager;
