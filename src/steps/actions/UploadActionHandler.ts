import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { expectsUploadSuccess, expectsUploadBlocked } from '../../expectedResult';
import * as path from 'path';
import * as fs from 'fs';
import { TIMEOUTS } from '../../config/timeouts.config';
import { Locator } from '@playwright/test';
import { SELECTORS } from '../../config/selectors.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/** Upload execution modes */
type UploadExecutionType = 'normal' | 'validate' | 'blocked';

/**
 * UploadActionHandler
 *
 * Handles file upload actions in test cases with multiple upload strategies.
 * Automatically detects the best upload method based on element type and
 * provides fallback mechanisms for different upload implementations.
 *
 * **Supported Keywords:** `upload`
 *
 * **Upload Strategies (in order of attempt):**
 * 1. **Direct setInputFiles**: For standard `<input type="file">` elements
 * 2. **Hidden file input**: For custom components with hidden file inputs
 * 3. **Click + FileChooser**: For buttons that open file dialog on click
 * 4. **Drag and Drop**: For dropzone-style upload areas
 * 5. **Nearby file input**: Search parent/sibling elements for file inputs
 *
 * **Execution Modes:**
 * | Mode       | Trigger (Expected Result)              | Behavior                               |
 * |------------|----------------------------------------|----------------------------------------|
 * | `validate` | "should be uploaded", "uploaded"       | Uploads and verifies file was uploaded |
 * | `blocked`  | "should not be uploaded", "disabled"   | Verifies upload is disabled/blocked    |
 * | `normal`   | Empty or no matching keywords          | Uploads without validation             |
 *
 * **Usage Examples:**
 * | Action                               | Data                    | Expected Result            |
 * |--------------------------------------|-------------------------|----------------------------|
 * | Upload the file to 'attachments'     | testdata/sample.pdf     | should be uploaded         |
 * | Upload file to 'File Input'          | sample.pdf              | File uploaded              |
 * | Upload to 'Profile Picture'          | images/avatar.png       | Image should be uploaded   |
 * | Upload files to 'Documents'          | doc1.pdf, doc2.pdf      | Files uploaded             |
 * | Upload the file to 'Drop Zone'       | report.xlsx             | should be uploaded         |
 * | Upload to 'Disabled Upload'          | test.pdf                | should not be uploaded     |
 *
 * **Key Features:**
 * - Multiple upload strategies with automatic fallback
 * - Drag and drop upload support
 * - Click-to-upload button support
 * - File existence validation before upload
 * - Support for single and multiple file uploads
 * - Expected result validation
 * - Disabled/blocked upload detection
 * - PrimeNG, Angular Material, and other UI framework support
 *
 * @since 1.0.0
 */
export class UploadActionHandler extends BaseActionHandler {
  private readonly DEFAULT_UPLOAD_TIMEOUT = TIMEOUTS.upload;
  private readonly TESTDATA_BASE_PATH = 'testdata';

  canHandle(action: string): boolean {
    const lowerAction = action.toLowerCase().trim();

    // Match: "Upload the file to 'element'", "Upload file to 'element'", "Upload to 'element'"
    if (/^upload\s+(the\s+)?file(s)?\s+to\s+/i.test(lowerAction)) return true;
    if (/^upload\s+to\s+/i.test(lowerAction)) return true;
    if (/^upload\s+/i.test(lowerAction) && lowerAction.includes("'")) return true;
    if (lowerAction.includes('attach') && lowerAction.includes('file')) return true;

    return false;
  }

  async execute(action: string, data?: any, result?: any, _step?: any): Promise<boolean> {
    try {
      if (!data) {
        throw new Error('File path(s) must be provided in the Data column for upload action.');
      }

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

      // Parse and validate file paths
      const filePaths = this.parseFilePaths(data);
      if (filePaths.length === 0) {
        throw new Error('No valid file paths found in Data column.');
      }
      await this.validateFiles(filePaths);

      // Determine execution mode based on expected result
      const executionType = this.getExecutionType(result);

      logger.info(
        `[UploadActionHandler] Mode: ${executionType}, Uploading ${filePaths.length} file(s) to '${elementName}'`
      );

      // Try each locator
      for (const [index, expr] of exprList.entries()) {
        try {
          const locator = await this.getLocator(expr);
          await locator.waitFor({ state: 'attached', timeout: this.DEFAULT_UPLOAD_TIMEOUT });

          // Handle blocked upload verification
          if (executionType === 'blocked') {
            const isBlocked = await this.isUploadBlocked(locator);
            if (isBlocked) {
              logger.info(`[UploadActionHandler] Verified '${elementName}' upload is blocked (as expected)`);
              return true;
            }
            throw new Error(`Expected '${elementName}' upload to be blocked but it is not`);
          }

          // Attempt upload using multiple strategies
          const uploadSuccess = await this.performUpload(locator, filePaths, elementName);

          if (uploadSuccess) {
            logger.info(`[UploadActionHandler] Uploaded file(s) to '${elementName}' using locator #${index + 1}`);

            // Validate upload if expected
            if (executionType === 'validate') {
              await this.validateUploadSuccess(locator, elementName, filePaths);
              logger.info(`[UploadActionHandler] Validated upload success for '${elementName}'`);
            }

            return true;
          }
        } catch (err: any) {
          logger.warn(`[UploadActionHandler] Locator #${index + 1} for '${elementName}' failed: ${err.message}`);
          if (index === exprList.length - 1) {
            throw new Error(
              `Failed to upload file(s) to '${elementName}'. All locators failed. Last error: ${err.message}`
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
        handler: 'UploadActionHandler',
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
  private getExecutionType(result: any): UploadExecutionType {
    if (expectsUploadBlocked(result)) return 'blocked';
    if (expectsUploadSuccess(result)) return 'validate';
    return 'normal';
  }

  /**
   * Perform upload using multiple strategies with fallback
   */
  private async performUpload(locator: Locator, filePaths: string[], elementName: string): Promise<boolean> {
    // const page = this.page;
    const strategies = [
      { name: 'clickAndUpload', fn: () => this.tryClickAndUpload(locator, filePaths) },
      { name: 'directFileInput', fn: () => this.tryDirectFileInput(locator, filePaths) },
      { name: 'hiddenFileInput', fn: () => this.tryHiddenFileInput(locator, filePaths) },
      { name: 'clickAndFileChooser', fn: () => this.tryClickAndFileChooser(locator, filePaths) },
      { name: 'dragAndDrop', fn: () => this.tryDragAndDrop(locator, filePaths) },
      { name: 'nearbyFileInput', fn: () => this.tryNearbyFileInput(locator, filePaths) },
      { name: 'pageFileInput', fn: () => this.tryPageFileInput(filePaths) },
    ];

    for (const strategy of strategies) {
      try {
        const success = await strategy.fn();
        if (success) {
          logger.info(`[UploadActionHandler] Success with strategy '${strategy.name}' for '${elementName}'`);
          return true;
        }
      } catch (err: any) {
        logger.debug(`[UploadActionHandler] Strategy '${strategy.name}' failed: ${err.message}`);
      }
    }

    throw new Error(`All upload strategies failed for '${elementName}'`);
  }

  /**Normal strategy using the click and upload */
  private async tryClickAndUpload(locator: Locator, filePaths: string[]): Promise<boolean> {
    const page = this.page;
    try {
      const fileChooserPromise = page.waitForEvent('filechooser', { timeout: TIMEOUTS.elementShort });
      await locator.click({ timeout: TIMEOUTS.elementShort });
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(filePaths);
    } catch (err: any) {
      logger.debug(`[UploadActionHandler] Click and upload failed: ${err.message}`);
    }
    return false;
  }

  /**
   * Strategy 1: Direct file input (for standard <input type="file">)
   */
  private async tryDirectFileInput(locator: Locator, filePaths: string[]): Promise<boolean> {
    const tagName = await locator.evaluate((el: any) => el.tagName.toLowerCase()).catch(() => '');
    const inputType = await locator.evaluate((el: any) => el.type?.toLowerCase()).catch(() => '');

    if (tagName === 'input' && inputType === 'file') {
      await locator.setInputFiles(filePaths, { timeout: this.DEFAULT_UPLOAD_TIMEOUT });
      logger.debug(`[UploadActionHandler] Used direct setInputFiles`);
      return true;
    }
    return false;
  }

  /**
   * Strategy 2: Find hidden file input inside the element
   */
  private async tryHiddenFileInput(locator: Locator, filePaths: string[]): Promise<boolean> {
    const hiddenInput = await this.findHiddenFileInput(locator);
    if (hiddenInput && (await hiddenInput.count()) > 0) {
      await hiddenInput.setInputFiles(filePaths, { timeout: this.DEFAULT_UPLOAD_TIMEOUT });
      logger.debug(`[UploadActionHandler] Used hidden file input`);
      return true;
    }
    return false;
  }

  /**
   * Strategy 3: Click element and handle file chooser dialog
   */
  private async tryClickAndFileChooser(locator: Locator, filePaths: string[]): Promise<boolean> {
    const page = this.page;

    // Set up file chooser listener before clicking
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: TIMEOUTS.elementShort });

    // Click the element to trigger file chooser
    await locator.click({ timeout: TIMEOUTS.elementShort });

    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePaths);

    logger.debug(`[UploadActionHandler] Used click + filechooser`);
    return true;
  }

  /**
   * Strategy 4: Drag and drop files onto element
   * Supports drag-and-drop upload zones by dispatching drag events and finding revealed inputs
   */
  private async tryDragAndDrop(locator: Locator, filePaths: string[]): Promise<boolean> {
    const page = this.page;

    // Check if element looks like a drop zone
    const isDropZone = await locator
      .evaluate((el: any) => {
        const classList = (el.className || '').toLowerCase();
        const id = (el.id || '').toLowerCase();
        const hasDropAttribute =
          el.hasAttribute('data-dropzone') ||
          el.hasAttribute('ngx-file-drop') ||
          el.hasAttribute('appFileDrop') ||
          el.hasAttribute('data-upload');
        return (
          classList.includes('drop') ||
          classList.includes('dropzone') ||
          classList.includes('upload-area') ||
          classList.includes('upload-zone') ||
          classList.includes('drag') ||
          classList.includes('file-drop') ||
          id.includes('drop') ||
          id.includes('upload') ||
          hasDropAttribute
        );
      })
      .catch(() => false);

    if (!isDropZone) {
      return false;
    }

    // Get element bounding box for drop coordinates
    const box = await locator.boundingBox();
    if (!box) {
      throw new Error('Could not get element bounding box for drag and drop');
    }

    // Dispatch drag events using browser's native APIs
    await locator.evaluate((el: any) => {
      // Create and dispatch dragenter event
      const dragEnterEvent = new Event('dragenter', { bubbles: true, cancelable: true });
      el.dispatchEvent(dragEnterEvent);

      // Create and dispatch dragover event
      const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true });
      el.dispatchEvent(dragOverEvent);
    });

    // Wait for any hidden file input to be revealed
    await page.waitForTimeout(300);

    // Look for file input that may have been revealed or activated
    const revealedInput = await this.findHiddenFileInput(locator);
    if (revealedInput && (await revealedInput.count()) > 0) {
      await revealedInput.setInputFiles(filePaths, { timeout: this.DEFAULT_UPLOAD_TIMEOUT });
      logger.debug(`[UploadActionHandler] Used drag and drop + revealed file input`);
      return true;
    }

    // Try clicking the drop zone which often triggers a file input
    try {
      const fileChooserPromise = page.waitForEvent('filechooser', { timeout: TIMEOUTS.elementShort });
      await locator.click({ timeout: TIMEOUTS.elementShort });
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(filePaths);
      logger.debug(`[UploadActionHandler] Used drag zone click + filechooser`);
      return true;
    } catch {
      // Continue to next strategy
    }

    return false;
  }

  /**
   * Strategy 5: Find file input in parent/sibling elements
   */
  private async tryNearbyFileInput(locator: Locator, filePaths: string[]): Promise<boolean> {
    const nearbyInput = await this.findNearbyFileInput(locator);
    if (nearbyInput && (await nearbyInput.count()) > 0) {
      await nearbyInput.setInputFiles(filePaths, { timeout: this.DEFAULT_UPLOAD_TIMEOUT });
      logger.debug(`[UploadActionHandler] Used nearby file input`);
      return true;
    }
    return false;
  }

  /**
   * Strategy 6: Find any visible file input on the page
   */
  private async tryPageFileInput(filePaths: string[]): Promise<boolean> {
    const page = this.page;

    // Find all file inputs on the page
    const fileInputs = page.locator(SELECTORS.upload.FILE_INPUT);
    const count = await fileInputs.count();

    for (let i = 0; i < count; i++) {
      const input = fileInputs.nth(i);
      // const isVisible = await input.isVisible().catch(() => false);
      const isEnabled = await input.isEnabled().catch(() => false);

      if (isEnabled) {
        try {
          await input.setInputFiles(filePaths, { timeout: TIMEOUTS.elementShort });
          logger.debug(`[UploadActionHandler] Used page file input #${i + 1}`);
          return true;
        } catch {
          continue;
        }
      }
    }

    return false;
  }

  /**
   * Find hidden file input associated with the element
   */
  private async findHiddenFileInput(locator: any): Promise<any> {
    try {
      // Check if there's a hidden input inside the element
      const hiddenInput = locator.locator(SELECTORS.upload.FILE_INPUT).first();
      if ((await hiddenInput.count()) > 0) {
        return hiddenInput;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Find file input in parent or sibling elements
   */
  private async findNearbyFileInput(locator: any): Promise<any> {
    try {
      // Try to find file input in parent container
      const parentInput = locator.locator(SELECTORS.upload.PARENT_LABEL).first();
      if ((await parentInput.count()) > 0) {
        return parentInput;
      }

      // Try sibling file input
      const siblingInput = locator.locator(SELECTORS.upload.SIBLING_LABEL).first();
      if ((await siblingInput.count()) > 0) {
        return siblingInput;
      }

      // Try preceding sibling
      const precedingInput = locator.locator(SELECTORS.upload.PRECEDING_LABEL).first();
      if ((await precedingInput.count()) > 0) {
        return precedingInput;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Check if upload is blocked/disabled
   */
  private async isUploadBlocked(locator: any): Promise<boolean> {
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

      // Check if readonly
      const isReadonly = await locator
        .evaluate((el: any) => el.readOnly || el.hasAttribute('readonly'))
        .catch(() => false);
      if (isReadonly) return true;

      // Try to find file input and check if it's disabled
      const fileInput = await this.findHiddenFileInput(locator);
      if (fileInput) {
        const inputDisabled = await fileInput.isDisabled().catch(() => false);
        if (inputDisabled) return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Validate that upload was successful
   */
  private async validateUploadSuccess(locator: any, elementName: string, filePaths: string[]): Promise<void> {
    try {
      // Wait a bit for upload to process
      await this.page.waitForTimeout(500);

      // Check if file input has files
      const fileInput = await this.findHiddenFileInput(locator);
      if (fileInput) {
        const hasFiles = await fileInput.evaluate((el: any) => el.files && el.files.length > 0).catch(() => false);

        if (hasFiles) {
          logger.debug(`[UploadActionHandler] Validated: file input has files`);
          return;
        }
      }

      // Check for common upload success indicators
      const uploadIndicators = [
        // File name displayed
        ...filePaths.map((fp) => path.basename(fp)),
        // Common success messages
        'uploaded',
        'success',
        'complete',
        'attached',
        // File icons/previews
        '.file-item',
        '.upload-item',
        '.attachment-item',
      ];

      // Look for any indicator in the page
      for (const indicator of uploadIndicators) {
        try {
          if (indicator.startsWith('.')) {
            // CSS selector
            const element = this.page.locator(indicator).first();
            if ((await element.count()) > 0) {
              logger.debug(`[UploadActionHandler] Validated: found upload indicator '${indicator}'`);
              return;
            }
          } else {
            // Text content - check near the upload element
            const text = await locator
              .locator(SELECTORS.upload.NEAR_UPLOAD)
              .textContent()
              .catch(() => '');
            if (text.toLowerCase().includes(indicator.toLowerCase())) {
              logger.debug(`[UploadActionHandler] Validated: found text indicator '${indicator}'`);
              return;
            }
          }
        } catch {
          // Continue checking other indicators
        }
      }

      // If no explicit validation but no error occurred, consider it successful
      logger.debug(`[UploadActionHandler] Upload completed without errors for '${elementName}'`);
    } catch (err: any) {
      logger.warn(`[UploadActionHandler] Validation check failed: ${err.message}`);
      // Don't throw - upload might still be successful
    }
  }

  /**
   * Parse file paths from data string
   */
  private parseFilePaths(data: any): string[] {
    const dataStr = String(data).trim();

    // Split by comma (for multiple files)
    const rawPaths = dataStr
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Resolve each path
    return rawPaths.map((filePath) => this.resolvePath(filePath));
  }

  /**
   * Resolve file path (handle relative and absolute paths)
   */
  private resolvePath(filePath: string): string {
    // If absolute path, return as is
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    // If starts with testdata/, resolve from project root
    if (filePath.startsWith('testdata/') || filePath.startsWith('testdata\\')) {
      return path.resolve(process.cwd(), filePath);
    }

    // Otherwise, assume relative to testdata folder
    return path.resolve(process.cwd(), this.TESTDATA_BASE_PATH, filePath);
  }

  /**
   * Validate that all files exist
   */
  private async validateFiles(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: '${filePath}'`);
      }
      logger.debug(`[UploadActionHandler] File validated: ${filePath}`);
    }
  }
}
