import { Page, Locator } from '@playwright/test';
import { logger } from '../helpers/logger';
import { LocatorResolver } from './LocatorResolver'; // adjust path if needed
import { PageContextManager } from '../pages/PageContextManager';
import { formatStepError, getPageContext, StepErrorContext } from '../helpers/StepErrorFormatter';

/**
 * BaseActionHandler
 *
 * Abstract base for all action handlers (Click, Assert, Enter, etc.).
 * Automatically registers with PageContextManager to stay synced with the active page.
 * When page context switches, all handlers update their page reference transparently.
 */
export abstract class BaseActionHandler {
  protected page: Page;
  protected locatorResolver: LocatorResolver;
  // Removed pageContextChangeListener: PageContextChangeListener;

  constructor(page: Page, locatorResolver: LocatorResolver) {
    this.page = page;
    this.locatorResolver = locatorResolver;

    // Register parent page in PageContextManager if not already registered
    const pageContextManager = PageContextManager.getInstance();

    // If no pages are registered, register the parent page
    if (pageContextManager.getPageNames().length === 0) {
      pageContextManager.addPage('parent', page);
      pageContextManager.switchToPage('parent');
    }

    // PageContextManager does not support page context change listeners in this implementation
    // logger.debug(`[BaseActionHandler] ${this.constructor.name} registered for page context changes.`);
  }

  /**
   * Determines if this handler should process the given action.
   */
  abstract canHandle(action: string): boolean;

  /**
   * Performs the action.
   */
  abstract execute(action: string, data?: any, result?: any, step?: any): Promise<boolean>;

  /**
   * Utility: Extract text within single quotes
   */
  protected extractQuotedText(action: string): string | null {
    const match = action.match(/[‘'’]([^‘'’]+)[‘'’]/);
    return match ? match[1] : null;
  }

  /**
   * Resolve a locator using LocatorResolver
   */
  protected async getLocator(expr: string | string[]): Promise<Locator> {
    return await this.locatorResolver.resolve(expr);
  }

  /**
   * Update page and locator resolver when switching to a new page/tab
   */
  protected updatePageContext(newPage: Page, oldPageKey: string | null = null, newPageKey: string = ''): void {
    const oldUrl = this.page?.url() ?? 'unknown';
    this.page = newPage;
    this.locatorResolver = new LocatorResolver(newPage);
    logger.info(
      `[${this.constructor.name}] Page context updated: '${oldPageKey}' (${oldUrl}) → '${newPageKey}' (${newPage.url()})`
    );
  }

  /**
   * Cleanup: unregister page context change listener when handler is disposed.
   * Call this in test teardown if handlers are long-lived across multiple page contexts.
   */
  public dispose(): void {
    // No-op: removePageContextChangeListener does not exist in this implementation
    logger.debug(`[BaseActionHandler] ${this.constructor.name} disposed.`);
  }

  /**
   * Wait for network and DOM stability (optional use for all handlers)
   */
  protected async waitForStablePage(timeout = 1000) {
    try {
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(timeout);
    } catch (e: any) {
      logger.warn(`[BaseActionHandler] Timeout waiting for page stability: ${e.message}`);
    }
  }

  protected async ensurePageIsAlive(page: any) {
    if (page.isClosed()) {
      throw new Error('Page already closed. Aborting action execution.');
    }
  }

  /**
   * Creates an enriched error with full step context for debugging.
   * Use this in action handler catch blocks for consistent, actionable error messages.
   *
   * @param error - The original error (from Playwright or handler logic)
   * @param context - Partial context to include (handler name is auto-filled)
   * @returns Enriched Error with context, suggestions, and original stack
   *
   * @example
   * ```typescript
   * catch (err) {
   *   throw await this.createActionError(err, {
   *     action: "Enter 'Username'",
   *     elementName: 'Username',
   *     locatorExpression: '//input[@id="user"]',
   *     inputData: 'testuser',
   *   });
   * }
   * ```
   */
  protected async createActionError(
    error: unknown,
    context: Omit<StepErrorContext, 'handler'> & { handler?: string }
  ): Promise<Error> {
    const pageCtx = await getPageContext(this.page);
    return formatStepError(error, {
      handler: context.handler ?? this.constructor.name,
      pageUrl: context.pageUrl ?? pageCtx.url,
      pageTitle: context.pageTitle ?? pageCtx.title,
      ...context,
    });
  }
}
