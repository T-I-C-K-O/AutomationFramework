import { BaseActionHandler } from '../BaseActionHandler';
import { logger } from '../../helpers/logger';
import { PageContextManager } from '../../pages/PageContextManager';
import { formatStepError, getPageContext } from '../../helpers/StepErrorFormatter';

/**
 * SwitchPageActionHandler
 *
 * Manages navigation between multiple browser pages or tabs that were
 * opened during test execution. Works with PageContextManager to track
 * and switch between different page contexts.
 *
 * Supported Keywords: `switch`, `switchto`, `switch to`, `switchpage`
 *
 * Usage Examples:
 * | Action                    | Data | Expected Result                     |
 * |---------------------------|------|-------------------------------------|
 * | Switch to 'popup_1'       |      | Context switched to first popup     |
 * | SwitchTo 'page_2'         |      | Context switched to second page     |
 * | Switch to 'main'          |      | Context switched back to main page  |
 * | Switch to 'new_tab'       |      | Context switched to new tab         |
 *
 * Common Page Keys:
 * | Key Pattern     | Description                        |
 * |-----------------|------------------------------------|
 * | main            | The original/primary page          |
 * | popup_1, popup_2| Popup windows in order opened      |
 * | page_1, page_2  | Alternative page naming            |
 *
 * Key Features:
 * - Integrates with PageContextManager singleton for page tracking
 * - Updates handler's page context after switch
 * - Propagates new page reference via result object
 * - Supports popups opened via ClickActionHandler
 *
 * Notes:
 * - Page key must be quoted in action string
 * - Pages are registered by ClickActionHandler when popups are detected
 * - Use this after clicking links that open new tabs/windows
 *
 * @see PageContextManager for page context management
 * @see ClickActionHandler for popup detection and registration
 * @since 1.0.0
 */
export class SwitchPageActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    return /switch|switchto|switch.to|switchpage/i.test(action);
  }

  async execute(action: string, _data?: any, _result?: any, _step?: any): Promise<boolean> {
    try {
      // Extract page key from action: "Switch to 'popup_1'" or "SwitchTo 'page_2'"
      // Special case: "switch to new" defaults to 'popup_1'
      const pageKey = action.match(/[''']([^''']+)[''']/)?.[1] || null;
      if (!pageKey) {
        throw new Error(`No page key found in action: '${action}'`);
      }

      // Switch to the specified page using singleton
      const pageManager = PageContextManager.getInstance();
      const targetPage = pageManager.switchToPage(pageKey);
      if (!targetPage) {
        throw new Error(`Page with key '${pageKey}' not found in PageContextManager.`);
      }

      // Update the handler's page context
      this.updatePageContext(targetPage);

      logger.info(
        `[SwitchPageActionHandler] ✓ SwitchPageActionHandler completed. Switched to page '${pageKey}' (${targetPage.url()})`
      );
      return true;
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }

      // Enrich error with context
      const pageCtx = await getPageContext(this.page);
      throw formatStepError(error, {
        handler: 'SwitchPageActionHandler',
        action,
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }
}
