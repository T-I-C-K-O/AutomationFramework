import { BaseActionHandler } from '../BaseActionHandler';
import { logger } from '../../helpers/logger';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext } from '../../helpers/StepErrorFormatter';

/**
 * AlertActionHandler
 *
 * Handles JavaScript dialog interactions (alert, confirm, prompt).
 * Supports accepting, dismissing, and providing input to dialogs.
 *
 * Usage Examples:
 * | Action                                    | Data              | Expected Result            |
 * |-------------------------------------------|-------------------|----------------------------|
 * | Accept alert                              |                   | Alert accepted             |
 * | Dismiss alert                             |                   | Alert dismissed            |
 * | Accept confirm                            |                   | Confirm dialog accepted    |
 * | Dismiss confirm                           |                   | Confirm dialog cancelled   |
 * | Accept prompt                             | My input text     | Prompt accepted with text  |
 * | Dismiss prompt                            |                   | Prompt cancelled           |
 * | Handle alert with accept                  |                   | Accept the alert           |
 * | Handle dialog and dismiss                 |                   | Dismiss the dialog         |
 * | Wait for alert                            |                   | Wait for alert to appear   |
 *
 * @since 1.0.0
 */
export class AlertActionHandler extends BaseActionHandler {
  // Default timeout for waiting for dialogs (configurable)
  private readonly DEFAULT_DIALOG_TIMEOUT = TIMEOUTS.dialog;

  // Store the last dialog message for assertions
  private lastDialogMessage: string | null = null;
  private lastDialogType: string | null = null;

  canHandle(action: string): boolean {
    const lowerAction = action.toLowerCase().trim();
    return (
      lowerAction.includes('alert') ||
      lowerAction.includes('confirm') ||
      lowerAction.includes('prompt') ||
      lowerAction.includes('dialog')
    );
  }

  async execute(action: string, data?: any, _result?: any, _step?: any): Promise<boolean> {
    const lowerAction = action.toLowerCase();

    try {
      // Handle wait for dialog
      if (this.isWaitForDialog(lowerAction)) {
        return await this.handleWaitForDialog(action, data);
      }

      // Handle accept/dismiss actions
      if (this.isAcceptAction(lowerAction)) {
        return await this.handleAcceptDialog(action, data);
      }

      if (this.isDismissAction(lowerAction)) {
        return await this.handleDismissDialog(action);
      }

      // Default: accept the dialog
      logger.warn(`[AlertActionHandler] Unrecognized dialog action: '${action}'. Defaulting to accept.`);
      return await this.handleAcceptDialog(action, data);
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }

      // Enrich error with context
      const pageCtx = await getPageContext(this.page);
      throw formatStepError(error, {
        handler: 'AlertActionHandler',
        action,
        inputData: typeof data === 'string' ? data : JSON.stringify(data),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }

  /**
   * Check if action is an accept action
   */
  private isAcceptAction(action: string): boolean {
    return (
      action.includes('accept') ||
      action.includes('ok') ||
      action.includes('confirm') ||
      (action.includes('click') && action.includes('ok'))
    );
  }

  /**
   * Check if action is a dismiss/cancel action
   */
  private isDismissAction(action: string): boolean {
    return (
      action.includes('dismiss') || action.includes('cancel') || action.includes('close') || action.includes('reject')
    );
  }

  /**
   * Check if action is waiting for dialog
   */
  private isWaitForDialog(action: string): boolean {
    return action.includes('wait');
  }

  /**
   * Handle accepting a dialog (alert, confirm, prompt)
   */
  private async handleAcceptDialog(action: string, data?: any): Promise<boolean> {
    const promptText = data ? String(data).trim() : undefined;

    // Set up dialog handler
    const dialogPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for dialog after ${this.DEFAULT_DIALOG_TIMEOUT}ms`));
      }, this.DEFAULT_DIALOG_TIMEOUT);

      this.page.once('dialog', async (dialog) => {
        clearTimeout(timeout);
        this.lastDialogMessage = dialog.message();
        this.lastDialogType = dialog.type();

        logger.info(`[AlertActionHandler] Dialog appeared - Type: ${dialog.type()}, Message: "${dialog.message()}"`);

        try {
          if (dialog.type() === 'prompt' && promptText !== undefined) {
            await dialog.accept(promptText);
            logger.info(`[AlertActionHandler] Prompt accepted with text: "${promptText}"`);
          } else {
            await dialog.accept();
            logger.info(`[AlertActionHandler] Dialog accepted`);
          }
          resolve();
        } catch (err: any) {
          reject(err);
        }
      });
    });

    // If dialog already triggered by previous action, wait for it
    // Otherwise, this will be used for upcoming dialog
    try {
      await dialogPromise;
      return true;
    } catch (error: any) {
      // If timeout, the dialog handler is still set up for next dialog
      if (error.message.includes('Timeout')) {
        logger.info('[AlertActionHandler] No immediate dialog. Handler set for next dialog event.');
        return true;
      }
      throw error;
    }
  }

  /**
   * Handle dismissing a dialog (alert, confirm, prompt)
   */
  private async handleDismissDialog(_action: string): Promise<boolean> {
    const dialogPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for dialog after ${this.DEFAULT_DIALOG_TIMEOUT}ms`));
      }, this.DEFAULT_DIALOG_TIMEOUT);

      this.page.once('dialog', async (dialog) => {
        clearTimeout(timeout);
        this.lastDialogMessage = dialog.message();
        this.lastDialogType = dialog.type();

        logger.info(`[AlertActionHandler] Dialog appeared - Type: ${dialog.type()}, Message: "${dialog.message()}"`);

        try {
          await dialog.dismiss();
          logger.info(`[AlertActionHandler] Dialog dismissed`);
          resolve();
        } catch (err: any) {
          reject(err);
        }
      });
    });

    try {
      await dialogPromise;
      return true;
    } catch (error: any) {
      if (error.message.includes('Timeout')) {
        logger.info('[AlertActionHandler] No immediate dialog. Handler set for next dialog event.');
        return true;
      }
      throw error;
    }
  }

  /**
   * Wait for dialog to appear
   */
  private async handleWaitForDialog(action: string, data?: any): Promise<boolean> {
    const timeout = data && !isNaN(Number(data)) ? Number(data) : this.DEFAULT_DIALOG_TIMEOUT;

    const dialogPromise = new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for dialog after ${timeout}ms`));
      }, timeout);

      this.page.once('dialog', async (dialog) => {
        clearTimeout(timeoutId);
        this.lastDialogMessage = dialog.message();
        this.lastDialogType = dialog.type();

        logger.info(`[AlertActionHandler] Dialog detected - Type: ${dialog.type()}, Message: "${dialog.message()}"`);

        // Determine action based on dialog type and action text
        const lowerAction = action.toLowerCase();
        if (lowerAction.includes('dismiss') || lowerAction.includes('cancel')) {
          await dialog.dismiss();
          logger.info('[AlertActionHandler] Dialog dismissed');
        } else {
          await dialog.accept();
          logger.info('[AlertActionHandler] Dialog accepted');
        }
        resolve();
      });
    });

    try {
      await dialogPromise;
      return true;
    } catch (error: any) {
      logger.error(`[AlertActionHandler] Wait for dialog error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the last dialog message (for external reference)
   */
  public getLastDialogMessage(): string | null {
    return this.lastDialogMessage;
  }

  /**
   * Get the last dialog type (for external reference)
   */
  public getLastDialogType(): string | null {
    return this.lastDialogType;
  }
}
