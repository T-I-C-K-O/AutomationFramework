import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/**
 * IFrameActionHandler
 *
 * Handles iframe interactions in test cases. Supports:
 * - Switch to iframe: "Switch to iframe 'Frame Name'"
 * - Switch to iframe by URL: "Switch to iframe containing 'url-pattern'"
 * - Switch back to main page: "Switch to main frame"
 * - Switch to parent frame: "Switch to parent frame"
 *
 * Usage Examples:
 * | Action                                    | Data              | Expected Result            |
 * |-------------------------------------------|-------------------|----------------------------|
 * | Switch to iframe 'Payment Frame'          |                   | Context switched to iframe |
 * | Switch to iframe containing 'payment'     |                   | Switched to iframe by URL  |
 * | Switch to main frame                      |                   | Back to main page          |
 * | Switch to parent frame                    |                   | Back to parent frame       |
 *
 * @since 1.0.0
 */
export class IFrameActionHandler extends BaseActionHandler {
  // Default timeout for iframe operations (configurable)
  private readonly DEFAULT_IFRAME_TIMEOUT = TIMEOUTS.iframe;

  // Track current frame context
  private currentFrameLocator: any = null;

  canHandle(action: string): boolean {
    const lowerAction = action.toLowerCase().trim();
    return (
      (lowerAction.includes('iframe') || lowerAction.includes('frame')) &&
      (lowerAction.includes('switch') || lowerAction.startsWith('switch'))
    );
  }

  async execute(action: string, data?: any, _result?: any, _step?: any): Promise<boolean> {
    const lowerAction = action.toLowerCase();

    try {
      // 1. Switch to main/default frame: "Switch to main frame" or "Switch to default content"
      if (this.isSwitchToMain(lowerAction)) {
        return await this.handleSwitchToMain();
      }

      // 2. Switch to parent frame: "Switch to parent frame"
      if (this.isSwitchToParent(lowerAction)) {
        return await this.handleSwitchToParent();
      }

      // 3. Switch to iframe by URL pattern: "Switch to iframe containing 'pattern'"
      if (this.isSwitchByUrl(lowerAction)) {
        return await this.handleSwitchByUrl(action);
      }

      // 4. Switch to iframe by element: "Switch to iframe 'Frame Name'"
      if (this.isSwitchByElement(action)) {
        return await this.handleSwitchByElement(action);
      }

      // 5. Switch to iframe by index: "Switch to iframe 0" or data contains index
      if (this.isSwitchByIndex(lowerAction, data)) {
        return await this.handleSwitchByIndex(action, data);
      }

      throw new Error(
        `Unrecognized iframe action: '${action}'. Use formats like "Switch to iframe 'Frame Name'", "Switch to main frame", or "Switch to iframe containing 'url-pattern'".`
      );
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
        handler: 'IFrameActionHandler',
        action,
        elementName,
        locatorExpression: elementName ? locatorToString(objectMap[elementName]) : undefined,
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }

  /**
   * Check if action is switch to main frame
   */
  private isSwitchToMain(action: string): boolean {
    return (
      action.includes('main') ||
      action.includes('default') ||
      action.includes('top') ||
      (action.includes('switch') && action.includes('page') && !action.includes('iframe'))
    );
  }

  /**
   * Check if action is switch to parent frame
   */
  private isSwitchToParent(action: string): boolean {
    return action.includes('parent');
  }

  /**
   * Check if action is switch by URL pattern
   */
  private isSwitchByUrl(action: string): boolean {
    return action.includes('containing') || action.includes('with url') || action.includes('url contains');
  }

  /**
   * Check if action is switch by element
   */
  private isSwitchByElement(action: string): boolean {
    return /[''']([^''']+)[''']/.test(action);
  }

  /**
   * Check if action is switch by index
   */
  private isSwitchByIndex(action: string, data?: any): boolean {
    // Check if action or data contains a number
    if (data && !isNaN(Number(data))) return true;
    return /iframe\s+\d+/.test(action);
  }

  /**
   * Handle switch to main/default frame
   */
  private async handleSwitchToMain(): Promise<boolean> {
    logger.info('[IFrameActionHandler] Switching to main frame (default content)');

    // In Playwright, switching to main frame means using the page directly
    // Reset any frame context tracking
    this.currentFrameLocator = null;

    // Update the locator resolver to use main page
    this.updatePageContext(this.page, null, 'main');

    logger.info('[IFrameActionHandler] Switched to main frame successfully');
    return true;
  }

  /**
   * Handle switch to parent frame
   */
  private async handleSwitchToParent(): Promise<boolean> {
    logger.info('[IFrameActionHandler] Switching to parent frame');

    // In Playwright, we need to track the frame hierarchy
    // For now, switching to parent means going to main frame
    this.currentFrameLocator = null;
    this.updatePageContext(this.page, null, 'parent');

    logger.info('[IFrameActionHandler] Switched to parent frame successfully');
    return true;
  }

  /**
   * Handle switch to iframe by URL pattern
   */
  private async handleSwitchByUrl(action: string): Promise<boolean> {
    // Extract URL pattern
    const patternMatch = action.match(/[''']([^''']+)[''']/);
    if (!patternMatch) {
      throw new Error(`No URL pattern found in action: '${action}'. Use: Switch to iframe containing 'url-pattern'`);
    }

    const urlPattern = patternMatch[1];
    logger.info(`[IFrameActionHandler] Switching to iframe containing URL pattern: '${urlPattern}'`);

    // Get all iframes on the page
    const frames = this.page.frames();

    for (const frame of frames) {
      const frameUrl = frame.url();
      if (frameUrl.includes(urlPattern)) {
        logger.info(`[IFrameActionHandler] Found iframe with URL: ${frameUrl}`);

        // Create frame locator (Playwright approach)
        // We'll use the frame directly
        // const frameElement = await frame.frameElement();
        this.currentFrameLocator = frame;

        // Note: In Playwright, we work directly with frames, not switching context
        logger.info(`[IFrameActionHandler] Switched to iframe containing '${urlPattern}'`);
        return true;
      }
    }

    throw new Error(`No iframe found containing URL pattern: '${urlPattern}'`);
  }

  /**
   * Handle switch to iframe by element name
   */
  private async handleSwitchByElement(action: string): Promise<boolean> {
    const elementMatch = action.match(/[''']([^''']+)[''']/);
    if (!elementMatch) {
      throw new Error(`No iframe element name found in action: '${action}'`);
    }

    const iframeName = elementMatch[1];
    const exprList = objectMap[iframeName];

    if (!exprList || exprList.length === 0) {
      throw new Error(`Iframe locator '${iframeName}' not found in objectMap.`);
    }

    logger.info(`[IFrameActionHandler] Switching to iframe: '${iframeName}'`);

    for (const [index, expr] of exprList.entries()) {
      try {
        const locator = await this.getLocator(expr);

        // Wait for iframe to be available
        await locator.waitFor({ state: 'attached', timeout: this.DEFAULT_IFRAME_TIMEOUT });

        // Get the frame using Playwright's frameLocator
        const frameLocator = this.page.frameLocator(expr);

        // Verify frame is accessible by trying to get its content
        // We'll update the page context to work within this frame
        this.currentFrameLocator = frameLocator;

        logger.info(`[IFrameActionHandler] Switched to iframe '${iframeName}' using locator #${index + 1}`);
        return true;
      } catch (err: any) {
        logger.warn(`[IFrameActionHandler] Locator #${index + 1} for iframe '${iframeName}' failed: ${err.message}`);
        if (index === exprList.length - 1) {
          throw new Error(`Failed to switch to iframe '${iframeName}'. All locators failed.`);
        }
      }
    }

    return false;
  }

  /**
   * Handle switch to iframe by index
   */
  private async handleSwitchByIndex(action: string, data?: any): Promise<boolean> {
    // Parse index from data or action
    let index: number;

    if (data && !isNaN(Number(data))) {
      index = Number(data);
    } else {
      const indexMatch = action.match(/iframe\s+(\d+)/i);
      if (indexMatch) {
        index = parseInt(indexMatch[1], 10);
      } else {
        throw new Error(`Could not parse iframe index from action or data: '${action}'`);
      }
    }

    logger.info(`[IFrameActionHandler] Switching to iframe at index: ${index}`);

    // Get all iframes
    const frames = this.page.frames();

    if (index < 0 || index >= frames.length) {
      throw new Error(`Iframe index ${index} is out of range. Available frames: ${frames.length}`);
    }

    // Get the frame at the specified index
    const targetFrame = frames[index];
    this.currentFrameLocator = targetFrame;

    logger.info(`[IFrameActionHandler] Switched to iframe at index ${index}`);
    return true;
  }

  /**
   * Get the current frame locator (if any)
   */
  public getCurrentFrameLocator(): any {
    return this.currentFrameLocator;
  }

  /**
   * Check if currently in an iframe
   */
  public isInIFrame(): boolean {
    return this.currentFrameLocator !== null;
  }
}
