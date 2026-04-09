import { BaseActionHandler } from '../BaseActionHandler';
import { BrowserContext } from '@playwright/test';
import { logger } from '../../helpers/logger';
import { validateNavigationOrigin } from '../../security/OriginValidator';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext } from '../../helpers/StepErrorFormatter';
import fs from 'fs';
import path from 'path';
/**
 * GotoActionHandler
 *
 * Handles navigation actions to URLs defined in the configuration. Navigates
 * the browser to specified URLs using property keys from the config file.
 *
 * Supported Keywords: `goto`, `navigate`, `open`, `login`
 *
 * Usage Examples:
 * | Action                          | Data | Expected Result |
 * |---------------------------------|------|-----------------|
 * | Goto HOYER                      |      |                 |
 * | Navigate DASHBOARD_URL          |      |                 |
 * | Open LOGIN_PAGE                 |      |                 |
 * | Login PORTAL                    |      |                 |
 * | Goto APPLICATION_URL            |      |                 |
 *
 * URL Configuration:
 * URLs must be defined in the config file (config/dev.config.ts or similar):
 * ```typescript
 * export const PROPERTIES = {
 *   HOYER: 'https://hoyer-app.example.com',
 *   DASHBOARD_URL: 'https://dashboard.example.com',
 *   LOGIN_PAGE: 'https://login.example.com',
 *   // ... more URLs
 * };
 * ```
 *
 * Key Features:
 * - Property-based URLs: URLs are referenced by keys, not hardcoded
 * - Environment support: Different configs for dev, staging, production
 * - Case-insensitive keywords: Works with GOTO, Goto, goto, etc.
 * - Automatic URL resolution: Extracts uppercase key from action text
 *
 * URL Key Format:
 * - Must be UPPERCASE with optional underscores
 * - Examples: HOYER, LOGIN_PAGE, DASHBOARD_URL, APP_HOME
 * - Key is extracted automatically from the action text
 *
 * Notes:
 * - URL keys must exist in PROPERTIES config object
 * - Navigation waits for page load by default
 * - For custom navigation behavior, extend this handler
 *
 * @see config/dev.config.ts for URL property definitions
 * @since 1.0.0
 */
export class GotoActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    const firstWord = action.trim().split(' ')[0].toLowerCase();
    return /goto|navigate|open|login/i.test(firstWord);
  }

  async execute(action: string): Promise<boolean> {
    const page = this.page;

    try {
      const userMatch = /as\s+(.+)$/i.exec(action);
      const userKey = userMatch ? userMatch[1].trim().replace(/\s+/g, '_') : 'auth-admin';
      // 🔹 Extract URL key (like HOYER, DASHBOARD_URL, etc.)
      const matchGoto = /\b([A-Z_]+)\b/.exec(action);
      const key = matchGoto ? matchGoto[1] : '';
      const url = process.env[key] || '';

      const storagePath = path.resolve(process.cwd(), `.auth/auth-${userKey}.json`);

      if (!fs.existsSync(storagePath)) {
        // throw new Error(`Storage state file not found: ${storagePath}`);
        logger.error(`[CustomGotoActionHandler]  Storage state file not found: ${storagePath}`);
      }

      if (!url) throw new Error(`No URL found for '${key}' in environment variables`);

      // 🔒 Security: Validate origin before navigation
      validateNavigationOrigin(url);

      const context: BrowserContext = page.context();
      await context.storageState({ path: `.auth/auth-${userKey}.json` });

      logger.info(`[CustomGotoActionHandler]  Navigating to URL: ${url} (user: ${userKey})`);
      //await page.setViewportSize({ width: 1920, height: 1080 });

      // 🔹 Safer navigation
      await page.goto(url, { timeout: TIMEOUTS.pageLoad });
      if (process.env.NETWORK_IDLE === 'true') {
        await page.waitForLoadState('networkidle');
      }
      logger.info(`[GotoActionHandler] ✅ Navigation successful → ${url}`);
      return true;
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }

      // Enrich error with context
      const pageCtx = await getPageContext(this.page);
      throw formatStepError(error, {
        handler: 'GotoActionHandler',
        action,
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }
}
