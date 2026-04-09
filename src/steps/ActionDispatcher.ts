import { Page } from '@playwright/test';
import { BaseActionHandler } from './BaseActionHandler';
import { GotoActionHandler } from './actions/GotoActionHandler';
import { ClickActionHandler } from './actions/ClickActionHandler';
import { SwitchPageActionHandler } from './actions/SwitchPageActionHandler';
import { EnterActionHandler } from './actions/EnterActionHandler';
import { DoubleClickActionHandler } from './actions/DoubleClickActionHandler';
import { HoverActionHandler } from './actions/HoverActionHandler';
import { CheckActionHandler } from './actions/CheckActionHandler';
import { StoreActionHandler } from './actions/StoreActionHandler';
import { ValidationAssertActionHandler } from './actions/ValidationAssertActionHandler';
import { DropdownActionHandler } from './actions/DropdownActionHandler';
import { AssertActionHandler } from './actions/AssertActionHandler';
import { APIActionHandler } from './API/APIActionHandler';
import { FunctionHandler } from './functions/FunctionHandler';
import { WaitActionHandler } from './actions/WaitActionHandler';
import { AlertActionHandler } from './actions/AlertActionHandler';
import { ScrollActionHandler } from './actions/ScrollActionHandler';
import { DragDropActionHandler } from './actions/DragDropActionHandler';
import { UploadActionHandler } from './actions/UploadActionHandler';
import { DownloadActionHandler } from './actions/DownloadActionHandler';
import { IFrameActionHandler } from './actions/IFrameActionHandler';
import { LocatorResolver } from './LocatorResolver';
import { logger } from '../helpers/logger';
import { TypeActionHandler } from './actions/TypeActionHandler';

/**
 * ActionDispatcher
 *
 * Central routing hub that maps test actions to their corresponding handlers.
 * Implements the Chain of Responsibility pattern to find and execute the
 * appropriate handler for each action keyword.
 *
 * Architecture:
 * ```
 * TestStep --> ActionDispatcher --> [Handler1, Handler2, ...] --> Execute
 *                  ↓
 *              canHandle() check on each handler
 *                  ↓
 *              First matching handler executes
 * ```
 *
 * Registered Handlers (in priority order):
 * | Handler                | Keywords                              |
 * |------------------------|---------------------------------------|
 * | GotoActionHandler      | goto, navigate, open, login           |
 * | ClickActionHandler     | click                                 |
 * | EnterActionHandler     | enter, fill, type                     |
 * | DoubleClickActionHandler | double-click, doubleclick           |
 * | HoverActionHandler     | hover                                 |
 * | DropdownActionHandler  | select, choose, dropdown              |
 * | CheckActionHandler     | check, tick, uncheck, untick          |
 * | StoreActionHandler     | store, save, get                      |
 * | AssertActionHandler    | assert, verify, check                 |
 * | WaitActionHandler      | wait                                  |
 * | AlertActionHandler     | alert, confirm, prompt, dialog        |
 * | ScrollActionHandler    | scroll                                |
 * | DragDropActionHandler  | drag                                  |
 * | UploadActionHandler    | upload, attach file                   |
 * | DownloadActionHandler  | download                              |
 * | APIActionHandler       | api, request, call                    |
 * | FunctionHandler        | function calls                        |
 * | SwitchPageActionHandler| switch, switchto, switchpage          |
 *
 * Key Features:
 * - Priority-based handler matching (first match wins)
 * - Automatic handler instantiation with page context
 * - Logging of handler selection for debugging
 * - Extensible: Add new handlers by adding to the handlers array
 *
 * Usage:
 * ```typescript
 * const dispatcher = new ActionDispatcher(page, locatorResolver);
 * await dispatcher.dispatch('Click \'Submit Button\'', null, null, step);
 * ```
 *
 * @see BaseActionHandler for the handler interface
 * @see StepExecutor for the orchestrating class
 * @since 1.0.0
 */

export class ActionDispatcher {
  private handlers: BaseActionHandler[];

  constructor(page: Page, locatorResolver: LocatorResolver) {
    this.handlers = [
      new GotoActionHandler(page, locatorResolver),
      new ClickActionHandler(page, locatorResolver),
      new EnterActionHandler(page, locatorResolver),
      new TypeActionHandler(page, locatorResolver),
      new DoubleClickActionHandler(page, locatorResolver),
      new HoverActionHandler(page, locatorResolver),
      new DropdownActionHandler(page, locatorResolver),
      new CheckActionHandler(page, locatorResolver),
      new ValidationAssertActionHandler(page, locatorResolver),
      new StoreActionHandler(page, locatorResolver),
      new AssertActionHandler(page, locatorResolver),
      new WaitActionHandler(page, locatorResolver),
      new AlertActionHandler(page, locatorResolver),
      new ScrollActionHandler(page, locatorResolver),
      new DragDropActionHandler(page, locatorResolver),
      new UploadActionHandler(page, locatorResolver),
      new DownloadActionHandler(page, locatorResolver),
      new IFrameActionHandler(page, locatorResolver),
      new APIActionHandler(page, locatorResolver),
      new FunctionHandler(page, locatorResolver),
      new SwitchPageActionHandler(page, locatorResolver),
    ];
  }

  /**
   * Finds and executes a matching action handler
   */
  public async dispatch(action: string, data?: any, result?: any, step?: any): Promise<boolean> {
    for (const handler of this.handlers) {
      if (handler.canHandle(action)) {
        logger.info(`[ActionDispatcher] 🟢 Dispatching to ${handler.constructor.name}`);
        return await handler.execute(action, data, result, step);
      }
    }

    logger.warn(`[ActionDispatcher] ⚠️ No matching handler found for action: ${action}`);
    return false;
  }
}
