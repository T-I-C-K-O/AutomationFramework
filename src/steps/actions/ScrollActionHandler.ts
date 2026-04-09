import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/**
 * ScrollActionHandler
 *
 * Handles scroll actions in test cases. Supports:
 * - Scroll to element: "Scroll to 'Element Name'"
 * - Scroll by direction: "Scroll down", "Scroll up", "Scroll left", "Scroll right"
 * - Scroll by pixels: "Scroll down 500 pixels", "Scroll up 200px"
 * - Scroll to position: "Scroll to top", "Scroll to bottom"
 * - Scroll within container: "Scroll 'Container' down"
 *
 * Usage Examples:
 * | Action                                    | Data              | Expected Result            |
 * |-------------------------------------------|-------------------|----------------------------|
 * | Scroll to 'Submit Button'                 |                   | Element scrolled into view |
 * | Scroll down                               |                   | Page scrolled down         |
 * | Scroll up 300 pixels                      |                   | Page scrolled up 300px     |
 * | Scroll to top                             |                   | Page scrolled to top       |
 * | Scroll to bottom                          |                   | Page scrolled to bottom    |
 * | Scroll 'Results List' down                |                   | Container scrolled down    |
 * | Scroll 'Table Container' to bottom        |                   | Container scrolled to end  |
 *
 * @since 1.0.0
 */
export class ScrollActionHandler extends BaseActionHandler {
  // Default scroll amount in pixels
  private readonly DEFAULT_SCROLL_AMOUNT = 300;

  // Default timeout for scroll operations (configurable)
  private readonly DEFAULT_SCROLL_TIMEOUT = TIMEOUTS.scroll;

  canHandle(action: string): boolean {
    const lowerAction = action.toLowerCase().trim();
    return lowerAction.startsWith('scroll');
  }

  async execute(action: string, data?: any, _result?: any, _step?: any): Promise<boolean> {
    const lowerAction = action.toLowerCase();

    try {
      // Parse scroll amount from data column if provided
      const scrollAmount = this.parseScrollAmount(data) ?? this.DEFAULT_SCROLL_AMOUNT;

      // 1. Scroll to element: "Scroll to 'Element Name'" or "Scroll 'Element' into view"
      if (this.isScrollToElement(action)) {
        return await this.handleScrollToElement(action);
      }

      // 2. Scroll within container: "Scroll 'Container' down/up"
      if (this.isContainerScroll(action)) {
        return await this.handleContainerScroll(action, scrollAmount);
      }

      // 3. Scroll to position: "Scroll to top", "Scroll to bottom"
      if (this.isScrollToPosition(lowerAction)) {
        return await this.handleScrollToPosition(lowerAction);
      }

      // 4. Scroll by direction: "Scroll down", "Scroll up", "Scroll left", "Scroll right"
      if (this.isDirectionalScroll(lowerAction)) {
        return await this.handleDirectionalScroll(lowerAction, scrollAmount);
      }

      // Default: scroll down
      logger.warn(`[ScrollActionHandler] Unrecognized scroll action: '${action}'. Defaulting to scroll down.`);
      return await this.handleDirectionalScroll('scroll down', scrollAmount);
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }

      // Extract element name for error context (if any)
      const matchQuotedText = action.match(/['''']([^''']+)[''']/);
      const elementName = matchQuotedText ? matchQuotedText[1] : undefined;

      // Enrich error with context
      const pageCtx = await getPageContext(this.page);
      throw formatStepError(error, {
        handler: 'ScrollActionHandler',
        action,
        elementName,
        locatorExpression: elementName ? locatorToString(objectMap[elementName]) : undefined,
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }

  /**
   * Parse scroll amount from data or action string
   */
  private parseScrollAmount(data?: any): number | undefined {
    if (!data) return undefined;

    const dataStr = String(data).trim();
    const match = dataStr.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return undefined;
  }

  /**
   * Extract pixels from action string (e.g., "scroll down 500 pixels")
   */
  private extractPixelsFromAction(action: string): number | undefined {
    const match = action.match(/(\d+)\s*(pixels?|px)?/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return undefined;
  }

  /**
   * Check if action is scroll to element
   */
  private isScrollToElement(action: string): boolean {
    const lowerAction = action.toLowerCase();
    return (
      (lowerAction.includes('scroll to') || lowerAction.includes('scroll into view')) &&
      /[''']([^''']+)[''']/.test(action)
    );
  }

  /**
   * Check if action is container scroll
   */
  private isContainerScroll(action: string): boolean {
    const lowerAction = action.toLowerCase();
    // Pattern: "Scroll 'Container' down" - element name followed by direction
    const hasElement = /[''']([^''']+)[''']/.test(action);
    const hasDirection =
      lowerAction.includes('down') ||
      lowerAction.includes('up') ||
      lowerAction.includes('left') ||
      lowerAction.includes('right') ||
      lowerAction.includes('top') ||
      lowerAction.includes('bottom');

    // If it has element but NOT "scroll to", it's a container scroll
    return hasElement && hasDirection && !lowerAction.includes('scroll to');
  }

  /**
   * Check if action is scroll to position
   */
  private isScrollToPosition(action: string): boolean {
    return (
      action.includes('to top') ||
      action.includes('to bottom') ||
      action.includes('to start') ||
      action.includes('to end')
    );
  }

  /**
   * Check if action is directional scroll
   */
  private isDirectionalScroll(action: string): boolean {
    return action.includes('down') || action.includes('up') || action.includes('left') || action.includes('right');
  }

  /**
   * Handle scroll to element
   */
  private async handleScrollToElement(action: string): Promise<boolean> {
    const elementMatch = action.match(/[''']([^''']+)[''']/);
    if (!elementMatch) {
      throw new Error(`No element name found in action: '${action}'`);
    }

    const elementName = elementMatch[1];
    const exprList = objectMap[elementName];

    if (!exprList || exprList.length === 0) {
      throw new Error(`Locator '${elementName}' not found in objectMap.`);
    }

    logger.info(`[ScrollActionHandler] Scrolling to element: '${elementName}'`);

    for (const [index, expr] of exprList.entries()) {
      try {
        const locator = await this.getLocator(expr);
        await locator.scrollIntoViewIfNeeded({ timeout: this.DEFAULT_SCROLL_TIMEOUT });
        logger.info(`[ScrollActionHandler] Scrolled to '${elementName}' using locator #${index + 1}`);
        return true;
      } catch (err: any) {
        logger.warn(`[ScrollActionHandler] Locator #${index + 1} for '${elementName}' failed: ${err.message}`);
        if (index === exprList.length - 1) {
          throw new Error(`Failed to scroll to '${elementName}'. All locators failed.`);
        }
      }
    }

    return false;
  }

  /**
   * Handle container scroll
   */
  private async handleContainerScroll(action: string, scrollAmount: number): Promise<boolean> {
    const elementMatch = action.match(/[''']([^''']+)[''']/);
    if (!elementMatch) {
      throw new Error(`No container element found in action: '${action}'`);
    }

    const elementName = elementMatch[1];
    const exprList = objectMap[elementName];

    if (!exprList || exprList.length === 0) {
      throw new Error(`Locator '${elementName}' not found in objectMap.`);
    }

    const lowerAction = action.toLowerCase();

    // Determine scroll direction and amount
    let scrollX = 0;
    let scrollY = 0;

    if (lowerAction.includes('down') || lowerAction.includes('bottom')) {
      scrollY = lowerAction.includes('bottom') ? 999999 : scrollAmount;
    } else if (lowerAction.includes('up') || lowerAction.includes('top')) {
      scrollY = lowerAction.includes('top') ? -999999 : -scrollAmount;
    } else if (lowerAction.includes('right') || lowerAction.includes('end')) {
      scrollX = lowerAction.includes('end') ? 999999 : scrollAmount;
    } else if (lowerAction.includes('left') || lowerAction.includes('start')) {
      scrollX = lowerAction.includes('start') ? -999999 : -scrollAmount;
    }

    // Extract pixels from action if specified
    const actionPixels = this.extractPixelsFromAction(action);
    if (actionPixels) {
      if (scrollY !== 0) scrollY = scrollY > 0 ? actionPixels : -actionPixels;
      if (scrollX !== 0) scrollX = scrollX > 0 ? actionPixels : -actionPixels;
    }

    logger.info(`[ScrollActionHandler] Scrolling container '${elementName}' by (${scrollX}, ${scrollY})`);

    for (const [index, expr] of exprList.entries()) {
      try {
        const locator = await this.getLocator(expr);

        // Use evaluate to scroll within the container
        await locator.evaluate(
          (element, { x, y }) => {
            element.scrollBy({ left: x, top: y, behavior: 'smooth' });
          },
          { x: scrollX, y: scrollY }
        );

        // Wait for scroll to complete
        await this.page.waitForTimeout(300);

        logger.info(`[ScrollActionHandler] Scrolled container '${elementName}' successfully`);
        return true;
      } catch (err: any) {
        logger.warn(`[ScrollActionHandler] Locator #${index + 1} for '${elementName}' failed: ${err.message}`);
        if (index === exprList.length - 1) {
          throw new Error(`Failed to scroll container '${elementName}'. All locators failed.`);
        }
      }
    }

    return false;
  }

  /**
   * Handle scroll to position (top, bottom, start, end)
   */
  private async handleScrollToPosition(action: string): Promise<boolean> {
    let scrollScript: string;

    if (action.includes('top') || action.includes('start')) {
      scrollScript = 'window.scrollTo({ top: 0, behavior: "smooth" })';
      logger.info('[ScrollActionHandler] Scrolling to top of page');
    } else if (action.includes('bottom') || action.includes('end')) {
      scrollScript = 'window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })';
      logger.info('[ScrollActionHandler] Scrolling to bottom of page');
    } else {
      throw new Error(`Unrecognized scroll position: '${action}'`);
    }

    await this.page.evaluate(scrollScript);

    // Wait for scroll animation to complete
    await this.page.waitForTimeout(500);

    logger.info('[ScrollActionHandler] Scroll to position completed');
    return true;
  }

  /**
   * Handle directional scroll (up, down, left, right)
   */
  private async handleDirectionalScroll(action: string, scrollAmount: number): Promise<boolean> {
    let scrollX = 0;
    let scrollY = 0;

    // Extract pixels from action if specified
    const actionPixels = this.extractPixelsFromAction(action);
    const amount = actionPixels ?? scrollAmount;

    if (action.includes('down')) {
      scrollY = amount;
    } else if (action.includes('up')) {
      scrollY = -amount;
    } else if (action.includes('right')) {
      scrollX = amount;
    } else if (action.includes('left')) {
      scrollX = -amount;
    }

    logger.info(`[ScrollActionHandler] Scrolling page by (${scrollX}, ${scrollY})`);

    // Note: window is a browser global available in evaluate context
    await this.page.evaluate(
      ({ x, y }) => {
        (globalThis as any).scrollBy({ left: x, top: y, behavior: 'smooth' });
      },
      { x: scrollX, y: scrollY }
    );

    // Wait for scroll animation to complete
    await this.page.waitForTimeout(300);

    logger.info('[ScrollActionHandler] Directional scroll completed');
    return true;
  }
}
