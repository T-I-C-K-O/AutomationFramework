/**
 * @fileoverview Evidence Capture Module for Playwright Test Automation Framework
 *
 * Provides utilities to capture screenshots and other evidence during test execution and
 * persist them under a standardized folder structure, returning the Base64-encoded
 * data along with generated filenames for reporting integrations.
 *
 * Key Features:
 * - Creates a `test-results/screenshots` folder if missing
 * - Generates filesystem-safe filenames based on the testcase key and iteration
 * - Captures full-page screenshots and returns Base64 data for embedding
 * - Robust error handling with centralized logging
 * - Extensible for future evidence types (videos, logs, attachments)
 *
 * Usage:
 * ```typescript
 * import { EvidenceCapture } from './utils/execution/EvidenceCapture';
 *
 * const result = await EvidenceCapture.captureScreenshot(page, 'TC-1234', 1);
 * if (result) {
 *   console.log(result.filename, result.base64Data);
 * }
 * ```
 *
 * @since 1.0.0
 * @version 1.0.0
 */
import fs from 'fs';
import path from 'path';
import { logger } from '../helpers/logger';

export class EvidenceCapture {
  /**
   * Captures a full-page screenshot and returns Base64 data with the filename.
   *
   * Behavior:
   * - Ensures the screenshots directory exists (creates it recursively if needed)
   * - Normalizes the testcase key into a filesystem-safe filename
   * - Attempts full-page screenshot first; logs and returns null on failure
   *
   * @param {any} page - Playwright Page-like object exposing a `screenshot` method
   * @param {string} testcaseKey - Identifier used to name the screenshot file
   * @param {number} [iteration] - Optional iteration index appended to the filename
   * @returns {Promise<{ base64Data: string, filename: string } | null>} Base64 data and filename, or null on failure
   *
   * @example
   * ```typescript
   * const shot = await EvidenceCapture.captureScreenshot(page, 'Login_TC', 2);
   * if (shot) {
   *   console.log('Saved:', shot.filename);
   * }
   * ```
   * @since 1.0.0
   */
  static async captureScreenshot(
    page: any,
    testcaseKey: string,
    iteration?: number
  ): Promise<{ base64Data: string; filename: string } | null> {
    try {
      const screenshotsDir = path.join(__dirname, '../../test-results/screenshots');
      if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
      const safeKey = testcaseKey.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = iteration ? `${safeKey}_iter${iteration}.png` : `${safeKey}.png`;
      const screenshotPath = path.join(screenshotsDir, filename);
      let base64Data = '';
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
        base64Data = fs.readFileSync(screenshotPath, { encoding: 'base64' });
      } catch (e) {
        const iterationText = iteration ? ` Iteration-${iteration}` : '';
        logger.error(`[EvidenceCapture] Screenshot failed for ${testcaseKey}${iterationText}: ${e}`);
        // Optionally, try fallback screenshot
        // try { await page.screenshot({ path: screenshotPath }); base64Data = fs.readFileSync(screenshotPath, { encoding: "base64" }); } catch {}
      }
      if (base64Data) {
        return { base64Data, filename };
      }
      return null;
    } catch (err) {
      logger.error(`[EvidenceCapture] : captureScreenshot error: ${err}`);
      return null;
    }
  }

  /**
   * @deprecated Use captureScreenshot instead. Maintained for backward compatibility.
   */
  static async capture(
    page: any,
    testcaseKey: string,
    iteration?: number
  ): Promise<{ base64Data: string; filename: string } | null> {
    return this.captureScreenshot(page, testcaseKey, iteration);
  }
}
