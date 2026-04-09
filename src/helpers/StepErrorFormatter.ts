/**
 * @fileoverview Step Error Formatter
 * @description Centralized error enrichment utility for test step failures.
 * Wraps raw Playwright errors with actionable context so you can immediately
 * understand WHY a step failed, WHAT was attempted, and WHERE it failed.
 *
 * @module helpers/StepErrorFormatter
 * @since 1.0.6
 */

import { Page } from '@playwright/test';
import { logger } from './logger';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured context for a failed test step.
 * Every field is optional — include what you have.
 */
export interface StepErrorContext {
  /** Handler name, e.g. "DropdownActionHandler", "ClickActionHandler" */
  handler: string;

  /** The raw action string from the test case, e.g. "Select 'Country'" */
  action: string;

  /** The element name / objectMap key, e.g. "Country" */
  elementName?: string;

  /** The locator expression(s) attempted, e.g. "//div[@id='country']" */
  locatorExpression?: string | string[];

  /** The data/values being used, e.g. "United States" */
  inputData?: string;

  /** Which strategy or attempt failed, e.g. "Strategy 4 - Autocomplete" */
  strategy?: string;

  /** The current page URL at the time of failure */
  pageUrl?: string;

  /** The current page title at the time of failure */
  pageTitle?: string;

  /** Per-strategy error details collected during fallback attempts */
  strategyErrors?: StrategyError[];
}

/**
 * Error details from a single strategy attempt.
 */
export interface StrategyError {
  /** Human-readable strategy name */
  strategy: string;

  /** The raw error message from Playwright or the handler */
  error: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAYWRIGHT ERROR CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Known Playwright error patterns mapped to human-readable explanations.
 */
const PLAYWRIGHT_ERROR_MAP: Array<{ pattern: RegExp; explanation: string }> = [
  {
    pattern: /Timeout \d+ms exceeded.*waiting for (locator|selector)/i,
    explanation:
      'Element was not found on the page within the timeout. It may not be rendered, may be hidden, or the locator expression may be wrong.',
  },
  {
    pattern: /waiting for locator.*to be visible/i,
    explanation: 'Element exists in the DOM but is not visible (may be hidden via CSS, display:none, or off-screen).',
  },
  {
    pattern: /locator resolved to.*element/i,
    explanation: 'The locator matched an element but the action could not be performed on it.',
  },
  {
    pattern: /strict mode violation.*resolved to \d+ elements/i,
    explanation: 'The locator matched multiple elements. Use a more specific locator that matches exactly one element.',
  },
  {
    pattern: /element is not attached to the DOM/i,
    explanation:
      'Element was found but then removed from the page (DOM mutation). The page content likely changed during the action.',
  },
  {
    pattern: /element is outside of the viewport/i,
    explanation: 'Element exists but is outside the visible area. Scrolling may be needed before interaction.',
  },
  {
    pattern: /element is (disabled|not enabled)/i,
    explanation:
      'Element is disabled and cannot be interacted with. Check if a prerequisite step is needed to enable it.',
  },
  {
    pattern: /element.*intercepts pointer events/i,
    explanation: 'Another element (overlay, modal, tooltip) is covering the target element and blocking the click.',
  },
  {
    pattern: /page has been closed/i,
    explanation:
      'The browser page/tab was closed before the action completed. A navigation or popup may have caused this.',
  },
  {
    pattern: /frame was detached/i,
    explanation: 'The iframe containing the element was removed or navigated away.',
  },
  {
    pattern: /Protocol error/i,
    explanation: 'Communication with the browser failed. The browser may have crashed or become unresponsive.',
  },
  {
    pattern: /net::ERR_/i,
    explanation: 'Network error occurred. The application server may be unreachable or a resource failed to load.',
  },
  {
    pattern: /selectOption.*not a <select> element/i,
    explanation:
      'Attempted native <select> dropdown operation on a non-select element. This is expected when the UI uses a custom dropdown component.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CORE FORMATTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a test step error with full context for debugging.
 *
 * Combines the raw Playwright error with structured context to produce
 * an error message that immediately tells you:
 * - **WHAT** action was being performed
 * - **WHERE** it was being performed (element, locator, page)
 * - **WHY** it failed (human-readable explanation of the Playwright error)
 * - **WHICH** strategies were tried (for multi-strategy handlers)
 *
 * @param originalError - The raw error from Playwright or the handler
 * @param context - Structured context about the step
 * @returns A new Error with an enriched, actionable message
 *
 * @example
 * ```typescript
 * catch (error) {
 *   throw formatStepError(error, {
 *     handler: 'DropdownActionHandler',
 *     action: "Select 'Country'",
 *     elementName: 'Country',
 *     locatorExpression: '//select[@id="country"]',
 *     inputData: 'United States',
 *     pageUrl: page.url(),
 *   });
 * }
 * ```
 */
export function formatStepError(originalError: unknown, context: StepErrorContext): Error {
  const rawMessage = originalError instanceof Error ? originalError.message : String(originalError);
  const rawStack = originalError instanceof Error ? originalError.stack : undefined;

  const lines: string[] = [];

  // ── Header ──
  lines.push(`\n╔══════════════════════════════════════════════════════════════╗`);
  lines.push(`║  TEST STEP FAILED                                          ║`);
  lines.push(`╚══════════════════════════════════════════════════════════════╝`);

  // ── What was attempted ──
  lines.push(`\n🔹 Action:    ${context.action}`);
  if (context.elementName) {
    lines.push(`🔹 Element:   '${context.elementName}'`);
  }
  if (context.inputData) {
    lines.push(`🔹 Data:      '${context.inputData}'`);
  }
  if (context.strategy) {
    lines.push(`🔹 Strategy:  ${context.strategy}`);
  }

  // ── Where it failed ──
  if (context.locatorExpression) {
    const locators = Array.isArray(context.locatorExpression) ? context.locatorExpression : [context.locatorExpression];
    lines.push(`\n📍 Locator(s) attempted:`);
    locators.forEach((l, i) => lines.push(`   ${i + 1}. ${l}`));
  }
  if (context.pageUrl) {
    lines.push(`📍 Page URL:  ${context.pageUrl}`);
  }
  if (context.pageTitle) {
    lines.push(`📍 Page Title: ${context.pageTitle}`);
  }

  // ── Why it failed ──
  const explanation = classifyPlaywrightError(rawMessage);
  lines.push(`\n❌ Error: ${rawMessage.split('\n')[0]}`); // First line only for readability
  if (explanation) {
    lines.push(`\n💡 Likely Cause: ${explanation}`);
  }

  // ── Per-strategy breakdown (for multi-strategy handlers) ──
  if (context.strategyErrors && context.strategyErrors.length > 0) {
    lines.push(`\n📋 Strategy Attempts:`);
    context.strategyErrors.forEach((se, i) => {
      const shortError = se.error.split('\n')[0]; // First line only
      const strategyExplanation = classifyPlaywrightError(se.error);
      lines.push(`   ${i + 1}. ${se.strategy}`);
      lines.push(`      Error: ${shortError}`);
      if (strategyExplanation) {
        lines.push(`      Cause: ${strategyExplanation}`);
      }
    });
  }

  // ── Suggestions ──
  const suggestions = generateSuggestions(rawMessage, context);
  if (suggestions.length > 0) {
    lines.push(`\n🔧 Suggestions:`);
    suggestions.forEach((s, i) => lines.push(`   ${i + 1}. ${s}`));
  }

  lines.push('');

  const enrichedMessage = lines.join('\n');

  // Log the enriched error for file/console visibility
  logger.error(`[${context.handler}] ${enrichedMessage}`);

  // Create new error preserving original stack
  const enrichedError = new Error(enrichedMessage);
  if (rawStack) {
    enrichedError.stack = enrichedMessage + '\n\n--- Original Stack ---\n' + rawStack;
  }

  return enrichedError;
}

/**
 * Classifies a Playwright error message into a human-readable explanation.
 *
 * @param errorMessage - The raw error message
 * @returns Human-readable explanation, or empty string if unrecognized
 */
export function classifyPlaywrightError(errorMessage: string): string {
  for (const { pattern, explanation } of PLAYWRIGHT_ERROR_MAP) {
    if (pattern.test(errorMessage)) {
      return explanation;
    }
  }
  return '';
}

/**
 * Generates actionable suggestions based on the error type and context.
 */
function generateSuggestions(errorMessage: string, context: StepErrorContext): string[] {
  const suggestions: string[] = [];

  if (/Timeout.*exceeded/i.test(errorMessage)) {
    suggestions.push('Verify the element exists on the page at this point in the test flow.');
    suggestions.push('Check if the locator in objectMap is correct for the current page version.');
    if (context.elementName) {
      suggestions.push(`Open the app manually and inspect the '${context.elementName}' element.`);
    }
  }

  if (/not visible/i.test(errorMessage)) {
    suggestions.push('The element may be hidden behind a modal, accordion, or tab. Ensure it is revealed first.');
    suggestions.push('Check if a prior step (scroll, click tab, expand section) is missing.');
  }

  if (/strict mode violation/i.test(errorMessage)) {
    suggestions.push(
      'The locator matches multiple elements. Add more specificity (e.g., use nth(), filter by text, or a tighter xpath).'
    );
  }

  if (/intercepts pointer/i.test(errorMessage)) {
    suggestions.push('Close any open modals, tooltips, or overlays before this step.');
    suggestions.push('Add a "Wait" step before this action to let overlays disappear.');
  }

  if (/All dropdown selection strategies failed/i.test(errorMessage) || context.handler === 'DropdownActionHandler') {
    if (context.strategyErrors?.length === 0 || !context.strategyErrors) {
      suggestions.push('Check if clicking the element actually opens a dropdown panel.');
    }
    suggestions.push('Verify the dropdown option text matches exactly (case-sensitive).');
    if (context.inputData) {
      suggestions.push(`Open the app and check if '${context.inputData}' exists as an option in the dropdown.`);
    }
  }

  if (/not found in objectMap/i.test(errorMessage)) {
    suggestions.push('Ensure the element name in the test step matches an entry in the objectMap / Object Repository.');
  }

  if (/page has been closed/i.test(errorMessage)) {
    suggestions.push('Check if a previous navigation or popup closed the page unexpectedly.');
  }

  return suggestions;
}

/**
 * Safely collects page context (URL, title) without throwing.
 * Use this at the point of failure to include page state in errors.
 *
 * @param page - Playwright Page instance
 * @returns Object with url and title (empty strings if page is closed)
 */
export async function getPageContext(page: Page): Promise<{ url: string; title: string }> {
  try {
    if (page.isClosed()) return { url: '(page closed)', title: '(page closed)' };
    const url = page.url();
    const title = await page.title().catch(() => '(unknown)');
    return { url, title };
  } catch {
    return { url: '(unavailable)', title: '(unavailable)' };
  }
}

/**
 * Extracts the locator expression string for error reporting.
 * Converts objectMap values (string or string[]) to a displayable format.
 *
 * @param expr - The locator expression from objectMap
 * @returns Displayable string
 */
export function locatorToString(expr: string | string[] | undefined): string {
  if (!expr) return '(not resolved)';
  if (Array.isArray(expr)) return expr.join(' | ');
  return expr;
}
