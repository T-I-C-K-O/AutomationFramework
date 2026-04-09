import { BaseActionHandler } from '../BaseActionHandler';
import { objectMap } from '../../page-objects/objectMap';
import { logger } from '../../helpers/logger';
import { TIMEOUTS } from '../../config/timeouts.config';
import { formatStepError, getPageContext, locatorToString } from '../../helpers/StepErrorFormatter';

/**
 * DragDropActionHandler
 *
 * Handles drag and drop actions in test cases. Supports:
 * - Drag element to another element: "Drag 'Source' to 'Target'"
 * - Drag and drop: "Drag and drop 'Item' to 'Container'"
 * - Drag by offset: "Drag 'Element' by 100, 50"
 *
 * Usage Examples:
 * | Action                                    | Data              | Expected Result            |
 * |-------------------------------------------|-------------------|----------------------------|
 * | Drag 'Card' to 'Drop Zone'                |                   | Card moved to drop zone    |
 * | Drag and drop 'Item' to 'Container'       |                   | Item dropped in container  |
 * | Drag 'Slider' by offset                   | 100, 0            | Slider moved 100px right   |
 * | Drag 'Widget' to 'Dashboard'              |                   | Widget placed on dashboard |
 *
 * @since 1.0.0
 */
export class DragDropActionHandler extends BaseActionHandler {
  // Default timeout for drag operations (configurable)
  private readonly DEFAULT_DRAG_TIMEOUT = TIMEOUTS.dragDrop;

  canHandle(action: string): boolean {
    const lowerAction = action.toLowerCase().trim();
    return lowerAction.startsWith('drag');
  }

  async execute(action: string, data?: any, _result?: any, _step?: any): Promise<boolean> {
    const lowerAction = action.toLowerCase();

    try {
      // 1. Drag by offset: "Drag 'Element' by 100, 50" or data contains offset
      if (this.isDragByOffset(lowerAction, data)) {
        return await this.handleDragByOffset(action, data);
      }

      // 2. Drag to element: "Drag 'Source' to 'Target'"
      if (this.isDragToElement(action)) {
        return await this.handleDragToElement(action);
      }

      throw new Error(
        `Unrecognized drag action: '${action}'. Use formats like "Drag 'Source' to 'Target'" or "Drag 'Element' by offset" with data "100, 50".`
      );
    } catch (error: any) {
      // If already enriched, re-throw
      if (error.message?.includes('TEST STEP FAILED')) {
        throw error;
      }

      // Extract element names for error context
      const matches = action.match(/['''']([^''']+)[''']/g);
      const elementNames = matches ? matches.map((m) => m.replace(/[''']/g, '')) : [];

      // Enrich error with context
      const pageCtx = await getPageContext(this.page);
      throw formatStepError(error, {
        handler: 'DragDropActionHandler',
        action,
        elementName: elementNames.join(' → '),
        locatorExpression: elementNames.map((e) => locatorToString(objectMap[e])),
        pageUrl: pageCtx.url,
        pageTitle: pageCtx.title,
      });
    }
  }

  /**
   * Check if action is drag by offset
   */
  private isDragByOffset(action: string, data?: any): boolean {
    // Check if action contains "by" or "offset", or if data contains coordinates
    if (action.includes('by') || action.includes('offset')) {
      return true;
    }
    // Check if data contains offset pattern (e.g., "100, 50" or "100,50")
    if (data && /^-?\d+\s*,\s*-?\d+$/.test(String(data).trim())) {
      return true;
    }
    return false;
  }

  /**
   * Check if action is drag to element
   */
  private isDragToElement(action: string): boolean {
    // Pattern: "Drag 'Source' to 'Target'" - two quoted elements with "to" between
    const matches = action.match(/[''']([^''']+)[''']/g);
    return matches !== null && matches.length >= 2 && action.toLowerCase().includes(' to ');
  }

  /**
   * Handle drag element to another element
   */
  private async handleDragToElement(action: string): Promise<boolean> {
    // Extract both element names
    const matches = action.match(/[''']([^''']+)[''']/g);
    if (!matches || matches.length < 2) {
      throw new Error(`Expected two element names in action: '${action}'. Use: Drag 'Source' to 'Target'`);
    }

    // Remove quotes from matches
    const sourceElementName = matches[0].replace(/[''']/g, '');
    const targetElementName = matches[1].replace(/[''']/g, '');

    const sourceExprList = objectMap[sourceElementName];
    const targetExprList = objectMap[targetElementName];

    if (!sourceExprList || sourceExprList.length === 0) {
      throw new Error(`Source locator '${sourceElementName}' not found in objectMap.`);
    }

    if (!targetExprList || targetExprList.length === 0) {
      throw new Error(`Target locator '${targetElementName}' not found in objectMap.`);
    }

    logger.info(`[DragDropActionHandler] Dragging '${sourceElementName}' to '${targetElementName}'`);

    // Try source locators
    for (const [sourceIndex, sourceExpr] of sourceExprList.entries()) {
      try {
        const sourceLocator = await this.getLocator(sourceExpr);

        // Wait for source to be visible
        await sourceLocator.waitFor({ state: 'visible', timeout: this.DEFAULT_DRAG_TIMEOUT });

        // Try target locators
        for (const [targetIndex, targetExpr] of targetExprList.entries()) {
          try {
            const targetLocator = await this.getLocator(targetExpr);

            // Wait for target to be visible
            await targetLocator.waitFor({ state: 'visible', timeout: this.DEFAULT_DRAG_TIMEOUT });

            // Perform drag and drop
            await sourceLocator.dragTo(targetLocator, { timeout: this.DEFAULT_DRAG_TIMEOUT });

            logger.info(
              `Dragged '${sourceElementName}' (locator #${sourceIndex + 1}) to '${targetElementName}' (locator #${targetIndex + 1})`
            );
            return true;
          } catch (err: any) {
            logger.warn(
              `[DragDropActionHandler] Target locator #${targetIndex + 1} for '${targetElementName}' failed: ${err.message}`
            );
            if (targetIndex === targetExprList.length - 1) {
              throw err;
            }
          }
        }
      } catch (err: any) {
        logger.warn(
          `[DragDropActionHandler] Source locator #${sourceIndex + 1} for '${sourceElementName}' failed: ${err.message}`
        );
        if (sourceIndex === sourceExprList.length - 1) {
          throw new Error(
            `Failed to drag '${sourceElementName}' to '${targetElementName}'. All locator combinations failed.`
          );
        }
      }
    }

    return false;
  }

  /**
   * Handle drag by offset (x, y pixels)
   */
  private async handleDragByOffset(action: string, data?: any): Promise<boolean> {
    // Extract element name
    const elementMatch = action.match(/[''']([^''']+)[''']/);
    if (!elementMatch) {
      throw new Error(`No element name found in action: '${action}'`);
    }

    const elementName = elementMatch[1];
    const exprList = objectMap[elementName];

    if (!exprList || exprList.length === 0) {
      throw new Error(`Locator '${elementName}' not found in objectMap.`);
    }

    // Parse offset from data or action
    const offset = this.parseOffset(action, data);
    if (!offset) {
      throw new Error(
        `Could not parse offset from action or data. Use data format "100, 50" or action "Drag 'Element' by 100, 50"`
      );
    }

    logger.info(`[DragDropActionHandler] Dragging '${elementName}' by offset (${offset.x}, ${offset.y})`);

    for (const [index, expr] of exprList.entries()) {
      try {
        const locator = await this.getLocator(expr);

        // Wait for element to be visible
        await locator.waitFor({ state: 'visible', timeout: this.DEFAULT_DRAG_TIMEOUT });

        // Get element bounding box
        const boundingBox = await locator.boundingBox();
        if (!boundingBox) {
          throw new Error(`Could not get bounding box for '${elementName}'`);
        }

        // Calculate source and target positions
        const sourceX = boundingBox.x + boundingBox.width / 2;
        const sourceY = boundingBox.y + boundingBox.height / 2;
        const targetX = sourceX + offset.x;
        const targetY = sourceY + offset.y;

        // Perform drag using mouse
        await this.page.mouse.move(sourceX, sourceY);
        await this.page.mouse.down();
        await this.page.mouse.move(targetX, targetY, { steps: 10 });
        await this.page.mouse.up();

        logger.info(
          `[DragDropActionHandler] Dragged '${elementName}' by (${offset.x}, ${offset.y}) using locator #${index + 1}`
        );
        return true;
      } catch (err: any) {
        logger.warn(`[DragDropActionHandler] Locator #${index + 1} for '${elementName}' failed: ${err.message}`);
        if (index === exprList.length - 1) {
          throw new Error(`Failed to drag '${elementName}' by offset. All locators failed.`);
        }
      }
    }

    return false;
  }

  /**
   * Parse offset from action or data
   */
  private parseOffset(action: string, data?: any): { x: number; y: number } | null {
    // Try to parse from data first (e.g., "100, 50" or "100,50")
    if (data) {
      const dataStr = String(data).trim();
      const dataMatch = dataStr.match(/^(-?\d+)\s*,\s*(-?\d+)$/);
      if (dataMatch) {
        return {
          x: parseInt(dataMatch[1], 10),
          y: parseInt(dataMatch[2], 10),
        };
      }
    }

    // Try to parse from action (e.g., "Drag 'Element' by 100, 50")
    const actionMatch = action.match(/by\s+(-?\d+)\s*,\s*(-?\d+)/i);
    if (actionMatch) {
      return {
        x: parseInt(actionMatch[1], 10),
        y: parseInt(actionMatch[2], 10),
      };
    }

    return null;
  }
}
