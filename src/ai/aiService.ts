/**
 * @fileoverview AI Service
 *
 * High-level AI service that combines MCP capabilities with
 * additional AI features like self-healing and analysis.
 *
 * @since 1.0.0
 */

import { mcpClient } from './mcpClient';
import { logger } from '../helpers/logger';

// ============================================================================
// Types
// ============================================================================

export interface HealedLocator {
  originalLocator: string;
  healedRef: string;
  confidence: number;
  method: 'snapshot' | 'fallback';
}

export interface FailureAnalysis {
  summary: string;
  possibleCauses: string[];
  suggestedFixes: string[];
  pageState: {
    hasErrors: boolean;
    consoleErrors: string[];
    failedRequests: string[];
  };
}

export interface VisualValidationResult {
  isValid: boolean;
  summary: string;
  differences?: string[];
}

// ============================================================================
// AI Service Class
// ============================================================================

/**
 * AI Service providing high-level AI capabilities for test automation.
 */
export class AIService {
  private enabled: boolean;
  private healedLocators: Map<string, HealedLocator> = new Map();

  constructor() {
    this.enabled = process.env.ENABLE_AI_FEATURES === 'true';
  }

  /**
   * Checks if AI features are enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enables AI features.
   */
  enable(): void {
    this.enabled = true;
    logger.info('[AI] AI features enabled');
  }

  /**
   * Disables AI features.
   */
  disable(): void {
    this.enabled = false;
    logger.info('[AI] AI features disabled');
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Initializes the AI service and connects to MCP.
   */
  async initialize(): Promise<void> {
    if (!this.enabled) {
      logger.info('[AI] AI features disabled, skipping initialization');
      return;
    }

    try {
      await mcpClient.connect();
      logger.info('[AI] ✓ AI Service initialized');
    } catch (error) {
      logger.error(`[AI] Failed to initialize: ${error}`);
      throw error;
    }
  }

  /**
   * Shuts down the AI service.
   */
  async shutdown(): Promise<void> {
    if (!this.enabled) return;

    try {
      await mcpClient.disconnect();
      logger.info('[AI] ✓ AI Service shut down');
    } catch (error) {
      logger.warn(`[AI] Error during shutdown: ${error}`);
    }
  }

  // ============================================================================
  // Self-Healing Locators
  // ============================================================================

  /**
   * Attempts to heal a broken locator by finding the element in the page snapshot.
   *
   * @param locatorKey - The original locator key (e.g., "login_button")
   * @param originalLocator - The original CSS/XPath selector that failed
   * @param elementDescription - Human-readable description of the element
   * @returns Healed locator info or null if healing failed
   */
  async healLocator(
    locatorKey: string,
    originalLocator: string,
    elementDescription?: string
  ): Promise<HealedLocator | null> {
    if (!this.enabled) return null;

    // Check cache first
    const cached = this.healedLocators.get(locatorKey);
    if (cached) {
      logger.info(`[AI] Using cached healed locator for: ${locatorKey}`);
      return cached;
    }

    try {
      logger.info(`[AI] Attempting to heal locator: ${locatorKey}`);

      // Get page snapshot
      const snapshot = await mcpClient.getSnapshot();

      // Try to find element by key name or description
      const searchTerms = [
        locatorKey.replace(/_/g, ' '), // login_button → "login button"
        elementDescription,
        this.extractNameFromLocator(originalLocator),
      ].filter(Boolean);

      let ref: string | null = null;

      for (const term of searchTerms) {
        if (!term) continue;
        ref = await this.findInSnapshot(snapshot, term);
        if (ref) break;
      }

      if (ref) {
        const healed: HealedLocator = {
          originalLocator,
          healedRef: ref,
          confidence: 0.8,
          method: 'snapshot',
        };

        // Cache the healed locator
        this.healedLocators.set(locatorKey, healed);

        logger.info(`[AI] ✓ Locator healed: ${locatorKey} → ${ref}`);
        return healed;
      }

      logger.warn(`[AI] Could not heal locator: ${locatorKey}`);
      return null;
    } catch (error) {
      logger.error(`[AI] Error healing locator: ${error}`);
      return null;
    }
  }

  /**
   * Extracts element name from a locator string.
   */
  private extractNameFromLocator(locator: string): string | null {
    // Extract from ID: #login-button → "login button"
    const idMatch = locator.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      return idMatch[1].replace(/[-_]/g, ' ');
    }

    // Extract from data-testid: [data-testid="login-btn"] → "login btn"
    const testIdMatch = locator.match(/data-testid=["']([^"']+)["']/);
    if (testIdMatch) {
      return testIdMatch[1].replace(/[-_]/g, ' ');
    }

    // Extract from text content: text=Login → "Login"
    const textMatch = locator.match(/text=["']?([^"']+)["']?/);
    if (textMatch) {
      return textMatch[1];
    }

    return null;
  }

  /**
   * Finds an element reference in the snapshot by search term.
   */
  private findInSnapshot(snapshot: string, searchTerm: string): string | null {
    const lines = snapshot.split('\n');
    const lowerSearch = searchTerm.toLowerCase();

    for (const line of lines) {
      if (line.toLowerCase().includes(lowerSearch)) {
        const refMatch = line.match(/\[ref=([^\]]+)\]/);
        if (refMatch) {
          return refMatch[1];
        }
      }
    }

    return null;
  }

  /**
   * Clears the healed locator cache.
   */
  clearHealedLocatorCache(): void {
    this.healedLocators.clear();
    logger.info('[AI] Healed locator cache cleared');
  }

  /**
   * Gets all healed locators for reporting.
   */
  getHealedLocators(): Map<string, HealedLocator> {
    return new Map(this.healedLocators);
  }

  // ============================================================================
  // AI Actions
  // ============================================================================

  /**
   * Clicks an element using AI to find it.
   */
  async clickElement(description: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const ref = await mcpClient.findElementByDescription(description);
      if (ref) {
        await mcpClient.click({ element: description, ref });
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`[AI] Click failed: ${error}`);
      return false;
    }
  }

  /**
   * Types text into an element using AI to find it.
   */
  async typeIntoElement(description: string, text: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const ref = await mcpClient.findElementByDescription(description);
      if (ref) {
        await mcpClient.type({ element: description, ref, text });
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`[AI] Type failed: ${error}`);
      return false;
    }
  }

  /**
   * Performs an action described in natural language.
   */
  async performAction(instruction: string): Promise<boolean> {
    if (!this.enabled) return false;

    return await mcpClient.performNaturalLanguageAction(instruction);
  }

  // ============================================================================
  // Failure Analysis
  // ============================================================================

  /**
   * Analyzes a test failure and provides insights.
   */
  async analyzeFailure(
    error: Error,
    context?: {
      action?: string;
      locator?: string;
      step?: number;
    }
  ): Promise<FailureAnalysis> {
    const analysis: FailureAnalysis = {
      summary: '',
      possibleCauses: [],
      suggestedFixes: [],
      pageState: {
        hasErrors: false,
        consoleErrors: [],
        failedRequests: [],
      },
    };

    if (!this.enabled) {
      analysis.summary = error.message;
      return analysis;
    }

    try {
      // Get page state
      const pageState = await mcpClient.analyzePageState();

      // Parse console errors
      const consoleLines = pageState.consoleMessages.split('\n');
      analysis.pageState.consoleErrors = consoleLines.filter(
        (line) => line.toLowerCase().includes('error') || line.toLowerCase().includes('exception')
      );

      // Parse failed network requests
      const networkLines = pageState.networkRequests.split('\n');
      analysis.pageState.failedRequests = networkLines.filter(
        (line) => line.includes('4') || line.includes('5') // 4xx or 5xx status
      );

      analysis.pageState.hasErrors =
        analysis.pageState.consoleErrors.length > 0 || analysis.pageState.failedRequests.length > 0;

      // Analyze error message
      const errorMsg = error.message.toLowerCase();

      if (errorMsg.includes('timeout') || errorMsg.includes('waiting for') || errorMsg.includes('exceeded')) {
        analysis.summary = 'Element not found or page took too long to load';
        analysis.possibleCauses = [
          'Element selector has changed',
          'Page is still loading',
          'Element is not visible or enabled',
          'Network request is slow or failing',
        ];
        analysis.suggestedFixes = [
          'Verify the element selector is correct',
          'Increase timeout value',
          'Add explicit wait for element visibility',
          'Check network tab for failed requests',
        ];
      } else if (
        errorMsg.includes('all locators') ||
        errorMsg.includes('all dropdown') ||
        errorMsg.includes('strategies failed') ||
        errorMsg.includes('locator failed')
      ) {
        analysis.summary = 'All locator strategies failed to find the element';
        analysis.possibleCauses = [
          'Element selectors are outdated',
          'UI has changed after deployment',
          'Element is dynamically generated',
          'Element is inside an iframe or shadow DOM',
        ];
        analysis.suggestedFixes = [
          'Update locators in page objects',
          'Add more robust selector strategies',
          'Verify element exists in current UI',
          'Check if element is in iframe or shadow DOM',
        ];
      } else if (
        errorMsg.includes('target page') ||
        errorMsg.includes('browser has been closed') ||
        errorMsg.includes('context has been closed')
      ) {
        analysis.summary = 'Browser or page was closed during navigation';
        analysis.possibleCauses = [
          'Page navigation was interrupted',
          'Previous action caused page to close',
          'Test setup/teardown timing issue',
        ];
        analysis.suggestedFixes = [
          'Add wait for page to be ready before navigation',
          'Check if previous step closes the page',
          'Ensure proper page initialization in test setup',
        ];
      } else if (errorMsg.includes('no stored value') || errorMsg.includes('stored value found')) {
        // Extract variable name from error message
        const varNameMatch = error.message.match(/variable\s*['"]?(\w+)['"]?/i);
        const variableName = varNameMatch ? varNameMatch[1] : 'variable';

        analysis.summary = `Required value '${variableName}' not available from previous test`;
        analysis.possibleCauses = [
          `Previous test case failed to store '${variableName}'`,
          'Test execution order issue',
          'Variable name mismatch in test data',
        ];
        analysis.suggestedFixes = [
          `Ensure '${variableName}' is stored before use`,
          `Check if test storing '${variableName}' passed`,
          'Add fallback value or skip dependent test',
        ];
      } else if (errorMsg.includes('not clickable') || errorMsg.includes('intercepted')) {
        analysis.summary = 'Element exists but cannot be interacted with';
        analysis.possibleCauses = [
          'Another element is overlaying the target',
          'Modal or dialog is blocking interaction',
          'Element is disabled',
        ];
        analysis.suggestedFixes = [
          'Wait for overlays to disappear',
          'Close any open modals first',
          'Check if element is enabled before clicking',
        ];
      } else if (errorMsg.includes('detached') || errorMsg.includes('stale')) {
        analysis.summary = 'Element was removed from DOM during interaction';
        analysis.possibleCauses = [
          'Page navigation occurred',
          'Dynamic content replaced the element',
          'React/Vue component re-rendered',
        ];
        analysis.suggestedFixes = [
          'Re-locate element before interaction',
          'Wait for page to stabilize',
          'Use more stable locator strategy',
        ];
      } else if (errorMsg.includes('crashed') || errorMsg.includes('target crashed')) {
        analysis.summary = 'Browser or page crashed during test execution';
        analysis.possibleCauses = [
          'Memory leak in application',
          'Heavy JavaScript execution',
          'Browser resource exhaustion',
        ];
        analysis.suggestedFixes = ['Check for memory leaks', 'Reduce parallel test count', 'Add page reload handling'];
      } else {
        analysis.summary = error.message;
        analysis.possibleCauses = ['Unknown error - review logs and screenshot'];
        analysis.suggestedFixes = ['Review test execution logs', 'Check screenshot for context', 'Debug test locally'];
      }

      // Add context to summary
      if (context?.action) {
        analysis.summary = `${context.action} failed: ${analysis.summary}`;
      }

      logger.info(`[AI] Failure analysis complete: ${analysis.summary}`);
      return analysis;
    } catch (analysisError) {
      logger.warn(`[AI] Error during failure analysis: ${analysisError}`);
      analysis.summary = error.message;
      return analysis;
    }
  }

  // ============================================================================
  // Visual Validation
  // ============================================================================

  /**
   * Validates the current page state against a description.
   */
  async validateVisual(expectedDescription: string): Promise<VisualValidationResult> {
    if (!this.enabled) {
      return { isValid: true, summary: 'AI validation skipped (disabled)' };
    }

    try {
      const snapshot = await mcpClient.getSnapshot();

      // Check if expected elements are present
      const expectations = expectedDescription.toLowerCase().split(/\s+and\s+|\s*,\s*/);
      const missing: string[] = [];

      for (const expectation of expectations) {
        const trimmed = expectation.trim();
        if (trimmed && !snapshot.toLowerCase().includes(trimmed)) {
          missing.push(trimmed);
        }
      }

      if (missing.length > 0) {
        return {
          isValid: false,
          summary: `Missing expected elements: ${missing.join(', ')}`,
          differences: missing,
        };
      }

      return {
        isValid: true,
        summary: 'All expected elements found',
      };
    } catch (error) {
      logger.error(`[AI] Visual validation error: ${error}`);
      return {
        isValid: false,
        summary: `Validation error: ${error}`,
      };
    }
  }

  /**
   * Takes a screenshot for visual comparison.
   */
  async captureScreenshot(filename?: string): Promise<string> {
    if (!this.enabled) return '';

    return await mcpClient.takeScreenshot({ filename });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton AI service instance.
 */
export const aiService = new AIService();

export default aiService;
