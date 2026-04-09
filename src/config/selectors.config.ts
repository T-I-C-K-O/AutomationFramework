/**
 * Centralized Selector Configuration
 *
 * All reusable selector patterns used across the automation framework are defined here.
 * This reduces hardcoded values, improves maintainability, and enhances code coverage.
 *
 * ## Usage in Handlers
 * ```typescript
 * import { SELECTORS } from '../../../config/selectors.config';
 *
 * const cellLocator = this.page.locator(SELECTORS.grid.cell('columnId')).first();
 * ```
 *
 * @since 1.0.0
 */

/**
 * Grid-related selectors for AG-Grid and custom grid components
 */
export const GRID_SELECTORS = {
  /** Base grid cell selector with col-id attribute */
  CELL_TAG: 'app-rt-grid-cell',

  /** Attribute name for column identifier */
  COL_ID_ATTR: 'col-id',

  /**
   * Generates a selector for a grid cell by column ID
   * @param colId - The column identifier
   * @returns The CSS selector string
   */
  cell: (colId: string): string => `app-rt-grid-cell[col-id='${colId}']`,

  /**
   * Generates a selector for an input inside a grid cell
   * @param colId - The column identifier
   * @returns The CSS selector string for the input element
   */
  cellInput: (colId: string): string => `app-rt-grid-cell[col-id='${colId}'] input`,
} as const;

/**
 * Dropdown-related selectors for PrimeNG and native dropdowns
 */
export const DROPDOWN_SELECTORS = {
  /** Static dropdown item selectors (in priority order) */
  STATIC_ITEMS: ['.p-dropdown-items .p-dropdown-item', '.p-listbox-item', '.p-dropdown-item'] as const,

  /** Autocomplete input selectors */
  AUTOCOMPLETE_INPUT: 'input.p-autocomplete-input, input[type="text"], input',

  /** Autocomplete suggestion panel */
  AUTOCOMPLETE_PANEL: '.p-autocomplete-panel:visible',

  /** Autocomplete suggestion item */
  AUTOCOMPLETE_ITEM: 'li.p-autocomplete-item',

  /** Multiselect panel */
  MULTISELECT_PANEL: '.p-multiselect-panel, .p-overlay',

  /** Multiselect item */
  MULTISELECT_ITEM: '.p-multiselect-item',

  /** Multiselect filter input */
  MULTISELECT_FILTER_INPUT:
    'input.p-multiselect-filter, .p-multiselect-filter-container input, input[placeholder*="Search"], input[placeholder*="Filter"]',

  /** Multiselect unselected items */
  MULTISELECT_UNSELECTED_ITEM: '.p-multiselect-item:not(.p-highlight), li[role="option"][aria-selected="false"]',

  /** CSS classes that indicate disabled state */
  DISABLED_CLASSES: ['p-disabled', 'disabled'] as const,

  /** Display selectors for value verification */
  DISPLAY_SELECTORS: [
    '.p-dropdown-label',
    '.p-multiselect-label',
    '.p-autocomplete-input',
    'input',
    '.selected-value',
  ] as const,

  /** Selected/highlighted item selectors for validation */
  SELECTED_ITEM_PATTERNS: {
    ARIA_SELECTED: '[aria-selected="true"]',
    HIGHLIGHT: '.p-highlight',
  } as const,

  /**
   * Generates a selector for selected item with specific text
   * @param text - The text to search for
   * @returns CSS selector string
   */
  getSelectedItemSelector: (text: string): string =>
    `[aria-selected="true"]:has-text("${text}"), .p-highlight:has-text("${text}")`,

  /**
   * Generates a fallback text selector
   * @param text - The text to match exactly
   * @returns CSS selector string
   */
  getFallbackTextSelector: (text: string): string => `text="${text}"`,

  /** Overlay/panel selectors for click-only dropdowns */
  OVERLAY_PANELS: [
    '.p-overlay-content',
    '.p-overlay',
    '.cdk-overlay-pane',
    '.dropdown-menu',
    '.p-listbox-list',
    'ul[role="listbox"]',
    '.p-dropdown-panel',
    '.mat-select-panel',
    '.ng-dropdown-panel-items',
  ] as const,

  /** Item selectors within overlay panels */
  OVERLAY_ITEMS: [
    'li',
    '.p-listbox-item',
    '.p-dropdown-item',
    '.mat-option',
    '.ng-option',
    '[role="option"]',
    '.dropdown-item',
  ] as const,

  /**
   * Generates combined overlay panel selector string
   * @returns Comma-separated selector string
   */
  getOverlayPanelSelector: (): string => DROPDOWN_SELECTORS.OVERLAY_PANELS.join(', '),

  /**
   * Generates combined overlay item selector string
   * @returns Comma-separated selector string
   */
  getOverlayItemSelector: (): string => DROPDOWN_SELECTORS.OVERLAY_ITEMS.join(', '),
} as const;

export const UPLOAD_SELECTORS = {
  FILE_INPUT: 'input[type="file"]',
  PARENT_LABEL: 'xpath=ancestor::*[.//input[@type="file"]]//input[@type="file"]',
  SIBLING_LABEL: 'xpath=following-sibling::input[@type="file"]',
  PRECEDING_LABEL: 'xpath=preceding-sibling::input[@type="file"]',
  NEAR_UPLOAD: 'xpath=ancestor::*[position() <= 3]',
};

export const HOVER_SELECTORS = {
  PRIMENG_TOOLTIP: [
    '.p-tooltip',
    '.p-tooltip-text',
    '.p-tooltip-content',
    '.p-overlaypanel',
    '.p-overlay',
    '.p-popover',
    '.p-toast',
  ] as const,
} as const;

/**
 * Consolidated selectors export
 */
export const SELECTORS = {
  grid: GRID_SELECTORS,
  dropdown: DROPDOWN_SELECTORS,
  hover: HOVER_SELECTORS,
  upload: UPLOAD_SELECTORS,
} as const;
