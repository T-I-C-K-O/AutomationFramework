import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { expectsDownloadSuccess, expectsDownloadBlocked } from '../../expectedResult';
import * as path from 'path';
import * as fs from 'fs';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/** Download execution modes */
type DownloadExecutionType = 'normal' | 'validate' | 'blocked' | 'verifyFormat';

/**
 * DownloadActionHandler
 *
 * Handles file download actions in test cases with system file picker support.
 * Automatically handles browser download dialogs and saves files to specified locations.
 *
 * **Supported Keywords:** `download`, `retrieve`, `export`, `save`
 *
 * **Execution Modes:**
 * | Mode           | Trigger (Expected Result)                              | Behavior                                    |
 * |----------------|--------------------------------------------------------|---------------------------------------------|
 * | `validate`     | "file is downloaded", "downloaded", "verified"         | Downloads and verifies file exists          |
 * | `verifyFormat` | "should be in pdf format", "xlsx format", "csv format" | Downloads and validates file extension      |
 * | `blocked`      | "should not be downloaded", "disabled"                 | Verifies download is disabled/blocked       |
 * | `normal`       | Empty or no matching keywords                          | Downloads without validation                |
 *
 * **Usage Examples:**
 * | Action                                    | Data  | Expected Result                                    |
 * |-------------------------------------------|-------|----------------------------------------------------|
 * | Download the file from the 'link'         |       | Verify the file is downloaded                      |
 * | Download the file from the 'Export'       |       | the downloaded file should be in pdf format        |
 * | Download the file from the 'Report Link'  |       | the downloaded file should be in xlsx format       |
 * | Download the file from the 'Data Export'  |       | the downloaded file should be in csv format        |
 * | Download file from 'Invoice'              |       | File should be downloaded                          |
 * | Download from 'Disabled Link'             |       | should not be downloaded                           |
 *
 * **Key Features:**
 * - Automatic handling of browser download dialogs
 * - System file picker/save dialog support
 * - File format validation (pdf, xlsx, csv, docx, etc.)
 * - Download confirmation and verification
 * - Disabled/blocked download detection
 *
 * @since 1.0.0
 */
export class DownloadActionHandler extends BaseActionHandler {
  // Default timeout for download operations
  private readonly DEFAULT_DOWNLOAD_TIMEOUT = TIMEOUTS.download;

  // Default download directory
  private readonly DEFAULT_DOWNLOAD_PATH = 'downloads';

  // Supported file formats for validation
  private readonly SUPPORTED_FORMATS = [
    'pdf',
    'xlsx',
    'xls',
    'csv',
    'docx',
    'doc',
    'txt',
    'json',
    'xml',
    'zip',
    'png',
    'jpg',
    'jpeg',
  ];

  // Store last downloaded file info for validation
  private lastDownloadedFile: { path: string; filename: string; extension: string } | null = null;

  canHandle(action: string): boolean {
    const lowerAction = action.toLowerCase().trim();
    return (
      lowerAction.includes('download') ||
      lowerAction.includes('retrieve') ||
      lowerAction.includes('export file') ||
      lowerAction.includes('save file')
    );
  }

  async execute(action: string, data?: any, result?: any, _step?: any): Promise<boolean> {
    try {
      // Extract element name from action
      const elementMatch = action.match(/[''']([^''']+)[''']/);
      if (!elementMatch) {
        throw new Error(`No element name found in action: '${action}'`);
      }

      const elementName = elementMatch[1];
      const exprList = objectMap[elementName];

      if (!exprList || exprList.length === 0) {
        throw new Error(`Locator '${elementName}' not found in objectMap.`);
      }

      // Determine execution mode based on expected result
      const executionType = this.getExecutionType(result);

      // Determine save path from data or use default
      const savePath = this.resolveSavePath(data);

      logger.info(`[DownloadActionHandler] Mode: ${executionType}, Downloading file by clicking '${elementName}'`);

      // Try each locator
      for (const [index, expr] of exprList.entries()) {
        try {
          const locator = await this.getLocator(expr);

          // Wait for element to be visible and clickable
          await locator.waitFor({ state: 'visible', timeout: this.DEFAULT_DOWNLOAD_TIMEOUT });

          // Handle blocked download verification
          if (executionType === 'blocked') {
            const isBlocked = await this.isDownloadBlocked(locator);
            if (isBlocked) {
              logger.info(`[DownloadActionHandler] Verified '${elementName}' download is blocked (as expected)`);
              return true;
            }
            throw new Error(`Expected '${elementName}' download to be blocked but it is not`);
          }

          // Perform download with automatic dialog handling
          const downloadResult = await this.performDownload(locator, savePath, elementName);

          if (downloadResult) {
            logger.info(`[DownloadActionHandler] Download completed for '${elementName}' using locator #${index + 1}`);

            // Validate download based on execution type
            if (executionType === 'validate') {
              await this.verifyDownloadSuccess(downloadResult.path, downloadResult.filename);
              logger.info(`[DownloadActionHandler] Validated download success for '${elementName}'`);
            }

            // Verify file format if expected result specifies format
            if (executionType === 'verifyFormat') {
              const expectedFormat = this.extractExpectedFormat(result);
              await this.verifyFileFormat(downloadResult.path, downloadResult.filename, expectedFormat);
              logger.info(`[DownloadActionHandler] Verified file format '${expectedFormat}' for '${elementName}'`);
            }

            return true;
          }
        } catch (err: any) {
          logger.warn(`[DownloadActionHandler] Locator #${index + 1} for '${elementName}' failed: ${err.message}`);
          if (index === exprList.length - 1) {
            throw new Error(
              `Failed to download file from '${elementName}'. All locators failed. Last error: ${err.message}`
            );
          }
        }
      }

      return false;
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }

      // Extract element name for error context
      const matchQuotedText = action.match(/['''']([^''']+)[''']/);
      const elementName = matchQuotedText ? matchQuotedText[1] : 'unknown';

      // Enrich error with context
      const pageCtx = await getPageContext(this.page);
      throw formatStepError(error, {
        handler: 'DownloadActionHandler',
        action,
        elementName,
        locatorExpression: locatorToString(objectMap[elementName]),
        inputData: typeof data === 'string' ? data : JSON.stringify(data),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }

  /**
   * Determines execution mode based on expected result
   */
  private getExecutionType(result: any): DownloadExecutionType {
    if (!result) return 'normal';

    const resultStr = String(result).toLowerCase().trim();

    // Check for blocked download
    if (expectsDownloadBlocked(result)) return 'blocked';

    // Check for file format validation (e.g., "should be in pdf format", "xlsx format")
    if (this.hasFormatValidation(resultStr)) return 'verifyFormat';

    // Check for download success validation (e.g., "file is downloaded", "verify the file is downloaded")
    if (
      expectsDownloadSuccess(result) ||
      resultStr.includes('is downloaded') ||
      resultStr.includes('file downloaded') ||
      (resultStr.includes('verify') && resultStr.includes('download'))
    ) {
      return 'validate';
    }
    return 'normal';
  }

  /**
   * Check if expected result contains file format validation
   */
  private hasFormatValidation(resultStr: string): boolean {
    const lowerResult = resultStr.toLowerCase();

    // Check for patterns like "should be in pdf format", "in xlsx format", "csv format"
    for (const format of this.SUPPORTED_FORMATS) {
      if (
        lowerResult.includes(`${format} format`) ||
        lowerResult.includes(`in ${format}`) ||
        lowerResult.includes(`.${format}`)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract expected file format from result string
   */
  private extractExpectedFormat(result: any): string {
    if (!result) return '';

    const resultStr = String(result).toLowerCase().trim();

    // Find the format in the result string
    for (const format of this.SUPPORTED_FORMATS) {
      if (
        resultStr.includes(`${format} format`) ||
        resultStr.includes(`in ${format}`) ||
        resultStr.includes(`.${format}`)
      ) {
        return format;
      }
    }
    return '';
  }

  /**
   * Perform download with automatic handling of browser download dialogs
   */
  private async performDownload(
    locator: any,
    savePath: string | null,
    _elementName: string
  ): Promise<{ path: string; filename: string; extension: string } | null> {
    const page = this.page;

    // Start waiting for download BEFORE clicking (to handle system file picker)
    const downloadPromise = page.waitForEvent('download', {
      timeout: this.DEFAULT_DOWNLOAD_TIMEOUT,
    });

    // Click the download element to trigger download/file picker
    await locator.click();

    // Wait for the download to start (handles system file picker automatically)
    const download = await downloadPromise;

    const suggestedFilename = download.suggestedFilename();
    const extension = path.extname(suggestedFilename).replace('.', '').toLowerCase();

    logger.info(`[DownloadActionHandler] Download started: ${suggestedFilename}`);

    // Determine final save path
    let finalPath: string;
    if (savePath) {
      finalPath = savePath;
    } else {
      // Use default download directory with suggested filename
      const downloadDir = path.resolve(process.cwd(), this.DEFAULT_DOWNLOAD_PATH);
      this.ensureDirectoryExists(downloadDir);
      finalPath = path.join(downloadDir, suggestedFilename);
    }

    // Save the file (handles file save dialog automatically)
    await download.saveAs(finalPath);

    // Store for later validation
    this.lastDownloadedFile = { path: finalPath, filename: suggestedFilename, extension };

    logger.info(`[DownloadActionHandler] File downloaded and saved to: ${finalPath}`);

    return { path: finalPath, filename: suggestedFilename, extension };
  }

  /**
   * Check if download is blocked/disabled
   */
  private async isDownloadBlocked(locator: any): Promise<boolean> {
    try {
      // Check if element is disabled
      const isDisabled = await locator.isDisabled().catch(() => false);
      if (isDisabled) return true;

      // Check for disabled attribute
      const hasDisabledAttr = await locator
        .evaluate(
          (el: any) =>
            el.hasAttribute('disabled') ||
            el.getAttribute('aria-disabled') === 'true' ||
            el.classList.contains('disabled') ||
            el.classList.contains('p-disabled')
        )
        .catch(() => false);
      if (hasDisabledAttr) return true;

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Verify that file was downloaded successfully
   */
  private async verifyDownloadSuccess(filePath: string, filename: string): Promise<void> {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Downloaded file not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);

    // Check file is not empty
    if (stats.size === 0) {
      throw new Error(`Downloaded file is empty: ${filePath}`);
    }

    logger.info(`[DownloadActionHandler] Download verified: ${filename} (${stats.size} bytes)`);
  }

  /**
   * Verify file format matches expected format
   */
  private async verifyFileFormat(filePath: string, filename: string, expectedFormat: string): Promise<void> {
    // First verify the file exists
    await this.verifyDownloadSuccess(filePath, filename);

    // Get actual file extension
    const actualExtension = path.extname(filename).replace('.', '').toLowerCase();

    if (!expectedFormat) {
      throw new Error('No expected format specified in expected result');
    }

    // Compare extensions
    if (actualExtension !== expectedFormat.toLowerCase()) {
      throw new Error(
        `File format mismatch - Expected: ${expectedFormat}, Actual: ${actualExtension} (File: ${filename})`
      );
    }
    logger.info(`[DownloadActionHandler] File format verified: ${filename} is in ${actualExtension} format`);
  }

  /**
   * Resolve save path from data
   */
  private resolveSavePath(data?: any): string | null {
    if (!data) return null;

    const dataStr = String(data).trim();
    if (!dataStr) return null;

    // If absolute path, use as is
    if (path.isAbsolute(dataStr)) {
      this.ensureDirectoryExists(path.dirname(dataStr));
      return dataStr;
    }

    // Resolve relative to downloads folder
    const fullPath = path.resolve(process.cwd(), this.DEFAULT_DOWNLOAD_PATH, dataStr);
    this.ensureDirectoryExists(path.dirname(fullPath));
    return fullPath;
  }

  /**
   * Ensure directory exists, create if not
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.debug(`[DownloadActionHandler] Created directory: ${dirPath}`);
    }
  }

  /**
   * Get the last downloaded file info (useful for subsequent validations)
   */
  public getLastDownloadedFile(): { path: string; filename: string; extension: string } | null {
    return this.lastDownloadedFile;
  }
}
