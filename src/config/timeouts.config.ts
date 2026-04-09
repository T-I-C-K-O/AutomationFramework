/**
 * Centralized Timeout Configuration
 *
 * All timeout values used across the automation framework are defined here.
 * Values can be overridden via environment variables for CI/CD flexibility.
 *
 * ## Environment Variable Override
 * Set any of these env vars to override defaults:
 * - DEFAULT_TIMEOUT=30000
 * - ELEMENT_VISIBLE_TIMEOUT=5000
 * - NETWORK_IDLE_TIMEOUT=30000
 * - etc.
 *
 * ## Usage in Handlers
 * ```typescript
 * import { TIMEOUTS } from '../../../config/timeouts.config';
 *
 * await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.elementVisible });
 * ```
 *
 * @since 1.0.0
 */

const parseEnvTimeout = (envVar: string, defaultValue: number): number => {
  const envValue = process.env[envVar];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultValue;
};

export const TIMEOUTS = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ELEMENT TIMEOUTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Default timeout for element visibility (5 seconds) */
  elementVisible: parseEnvTimeout('ELEMENT_VISIBLE_TIMEOUT', 5000),

  /** Timeout for element to be attached to DOM (3 seconds) */
  elementAttached: parseEnvTimeout('ELEMENT_ATTACHED_TIMEOUT', 3000),

  /** Short timeout for quick element checks (2 seconds) */
  elementShort: parseEnvTimeout('ELEMENT_SHORT_TIMEOUT', 2000),

  /** Default element timeout for most operations (30 seconds) */
  elementDefault: parseEnvTimeout('ELEMENT_DEFAULT_TIMEOUT', 30000),

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE/NAVIGATION TIMEOUTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Timeout for network idle state (30 seconds) */
  networkIdle: parseEnvTimeout('NETWORK_IDLE_TIMEOUT', 30000),

  /** Timeout for page load/navigation (60 seconds) */
  pageLoad: parseEnvTimeout('PAGE_LOAD_TIMEOUT', 60000),

  /** Timeout for popup detection (3 seconds) */
  popupDetection: parseEnvTimeout('POPUP_DETECTION_TIMEOUT', 3000),

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION-SPECIFIC TIMEOUTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Timeout for click actions (10 seconds) */
  click: parseEnvTimeout('CLICK_TIMEOUT', 10000),

  /** Timeout for double-click actions (30 seconds) */
  doubleClick: parseEnvTimeout('DOUBLE_CLICK_TIMEOUT', 30000),

  /** Timeout for hover actions (30 seconds) */
  hover: parseEnvTimeout('HOVER_TIMEOUT', 10000),

  /** Timeout for fill/enter actions (30 seconds) */
  fill: parseEnvTimeout('FILL_TIMEOUT', 10000),

  /** Timeout for type actions (10 seconds) */
  type: parseEnvTimeout('TYPE_TIMEOUT', 10000),

  /** Timeout for scroll operations (5 seconds) */
  scroll: parseEnvTimeout('SCROLL_TIMEOUT', 5000),

  /** Timeout for drag-drop operations (30 seconds) */
  dragDrop: parseEnvTimeout('DRAG_DROP_TIMEOUT', 30000),

  /** Timeout for iframe operations (10 seconds) */
  iframe: parseEnvTimeout('IFRAME_TIMEOUT', 10000),

  /** Timeout for file upload operations (30 seconds) */
  upload: parseEnvTimeout('UPLOAD_TIMEOUT', 30000),

  /** Timeout for file download operations (60 seconds) */
  download: parseEnvTimeout('DOWNLOAD_TIMEOUT', 60000),

  /** Timeout for alert/dialog handling (10 seconds) */
  dialog: parseEnvTimeout('DIALOG_TIMEOUT', 10000),

  /** Timeout for store/get value operations (10 seconds) */
  storeValue: parseEnvTimeout('STORE_VALUE_TIMEOUT', 10000),

  // ═══════════════════════════════════════════════════════════════════════════
  // DELAY/WAIT TIMEOUTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** Small delay for UI stabilization (300ms) */
  smallDelay: parseEnvTimeout('SMALL_DELAY', 300),

  /** Medium delay for transitions (500ms) */
  mediumDelay: parseEnvTimeout('MEDIUM_DELAY', 500),

  /** Scroll into view timeout (2 seconds) */
  scrollIntoView: parseEnvTimeout('SCROLL_INTO_VIEW_TIMEOUT', 10000),

  // ═══════════════════════════════════════════════════════════════════════════
  // RETRY CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enable/disable retry globally (default: true)
   * To disable retry, set: retryEnabled: false,
   */
  retryEnabled: true,
  // To disable retry, set: retryEnabled: false,

  /** Maximum number of retry attempts for flaky actions */
  retryMaxAttempts: 2,

  /** Base delay between retry attempts in milliseconds */
  retryDelay: 1000,

  /** Maximum delay cap for exponential backoff in milliseconds */
  retryMaxDelay: 10000,

  /** Delay before executing recovery action in milliseconds */
  recoveryDelay: 500,
} as const;

// Type exports for IDE autocompletion
export type TimeoutKeys = Exclude<keyof typeof TIMEOUTS, 'retryEnabled'>;

/**
 * Get a timeout value with optional override
 * @param key - The timeout key
 * @param override - Optional override value
 * @returns The timeout value in milliseconds
 */
export const getTimeout = (key: TimeoutKeys, override?: number): number => {
  return override ?? TIMEOUTS[key];
};

/**
 * Check if retry is enabled globally
 */
export const isRetryEnabled = (): boolean => TIMEOUTS.retryEnabled;
