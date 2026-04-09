/**
 * Origin Validator - Security Guard for Navigation
 *
 * Enforces strict origin validation for all page navigations.
 * Ensures that tests can only navigate to URLs that are explicitly
 * allowed in the MCP_ALLOWED_ORIGINS configuration.
 *
 * Security Policy:
 * - All navigations are blocked by default
 * - Only origins listed in MCP_ALLOWED_ORIGINS are permitted
 * - Violations throw an error immediately, failing the test
 *
 * Configuration:
 * Set MCP_ALLOWED_ORIGINS in .env file:
 * ```
 * MCP_ALLOWED_ORIGINS=https://app1.example.com,https://app2.example.com
 * ```
 *
 * @since 1.0.0
 */

import * as dotenv from 'dotenv';
import { logger } from '../helpers/logger';

// Ensure .env is loaded
dotenv.config({ quiet: true });

/**
 * Security error thrown when navigation to an unauthorized origin is attempted.
 */
export class OriginSecurityError extends Error {
  public readonly attemptedUrl: string;
  public readonly allowedOrigins: string[];

  constructor(attemptedUrl: string, allowedOrigins: string[]) {
    const message = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                         🔒 SECURITY VIOLATION                                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Navigation blocked to unauthorized origin                                    ║
║                                                                              ║
║  Attempted URL: ${attemptedUrl.substring(0, 50).padEnd(50)}║
║                                                                              ║
║  Allowed Origins:                                                            ║
${allowedOrigins.map((o) => `║    • ${o.padEnd(64)}║`).join('\n') || '║    • (none configured)                                                  ║'}
║                                                                              ║
║  Resolution:                                                                 ║
║    1. Add the origin to MCP_ALLOWED_ORIGINS in your .env file               ║
║    2. Or update your test to use an allowed URL                             ║
║                                                                              ║
║  Example .env:                                                               ║
║    MCP_ALLOWED_ORIGINS=https://your-app.com,https://staging.your-app.com    ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;
    super(message);
    this.name = 'OriginSecurityError';
    this.attemptedUrl = attemptedUrl;
    this.allowedOrigins = allowedOrigins;
  }
}

/**
 * Origin Validator singleton for enforcing navigation security.
 */
export class OriginValidator {
  private static instance: OriginValidator;
  private allowedOrigins: string[] = [];
  private initialized = false;

  private constructor() {
    this.loadAllowedOrigins();
  }

  /**
   * Gets the singleton instance of OriginValidator.
   */
  public static getInstance(): OriginValidator {
    if (!OriginValidator.instance) {
      OriginValidator.instance = new OriginValidator();
    }
    return OriginValidator.instance;
  }

  /**
   * Loads allowed origins from environment variable.
   */
  private loadAllowedOrigins(): void {
    const envValue = process.env.MCP_ALLOWED_ORIGINS;

    if (!envValue) {
      logger.warn('[Security] MCP_ALLOWED_ORIGINS not configured - all navigations will be blocked!');
      this.allowedOrigins = [];
    } else {
      this.allowedOrigins = envValue
        .split(',')
        .map((origin) => origin.trim().toLowerCase())
        .filter(Boolean);

      logger.info(`[Security] Origin validation enabled for: ${this.allowedOrigins.join(', ')}`);
    }

    this.initialized = true;
  }

  /**
   * Extracts the origin (protocol + host) from a URL.
   *
   * @param url - The full URL
   * @returns The origin (e.g., "https://example.com")
   */
  private extractOrigin(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`.toLowerCase();
    } catch {
      // If URL parsing fails, return the URL as-is for comparison
      return url.toLowerCase();
    }
  }

  /**
   * Checks if a URL's origin is in the allowed list.
   *
   * @param url - The URL to validate
   * @returns true if the origin is allowed, false otherwise
   */
  public isOriginAllowed(url: string): boolean {
    if (!url) return false;

    const origin = this.extractOrigin(url);

    // Check if the origin matches any allowed origin
    return this.allowedOrigins.some((allowed) => {
      const allowedOrigin = this.extractOrigin(allowed);
      return origin === allowedOrigin || origin.startsWith(allowedOrigin);
    });
  }

  /**
   * Validates a URL and throws an error if the origin is not allowed.
   *
   * @param url - The URL to validate
   * @throws OriginSecurityError if the origin is not in the allowed list
   */
  public validateOrigin(url: string): void {
    // Reload env vars in case they weren't loaded when singleton was created
    if (this.allowedOrigins.length === 0) {
      this.loadAllowedOrigins();
    }

    if (!url) {
      throw new OriginSecurityError('(empty URL)', this.allowedOrigins);
    }

    const origin = this.extractOrigin(url);
    logger.info(`[Security] Validating origin: ${origin}`);
    logger.info(`[Security] Allowed origins: ${this.allowedOrigins.join(', ')}`);

    if (!this.isOriginAllowed(url)) {
      logger.error(`[Security] 🔒 BLOCKED: ${origin} is not in allowed origins`);
      throw new OriginSecurityError(url, this.allowedOrigins);
    }

    logger.info(`[Security] ✓ Navigation allowed: ${origin}`);
  }

  /**
   * Gets the list of allowed origins.
   */
  public getAllowedOrigins(): string[] {
    return [...this.allowedOrigins];
  }

  /**
   * Reloads the allowed origins from environment.
   * Useful for testing or dynamic configuration updates.
   */
  public reload(): void {
    this.loadAllowedOrigins();
  }
}

/**
 * Convenience function to validate a URL origin.
 * Throws OriginSecurityError if the origin is not allowed.
 *
 * @param url - The URL to validate
 * @throws OriginSecurityError if navigation is not allowed
 *
 * @example
 * ```typescript
 * import { validateNavigationOrigin } from '../security/OriginValidator';
 *
 * // In your navigation handler:
 * validateNavigationOrigin(url);  // Throws if blocked
 * await page.goto(url);           // Only reached if allowed
 * ```
 */
export function validateNavigationOrigin(url: string): void {
  OriginValidator.getInstance().validateOrigin(url);
}

/**
 * Convenience function to check if a URL origin is allowed.
 *
 * @param url - The URL to check
 * @returns true if navigation is allowed, false otherwise
 */
export function isNavigationAllowed(url: string): boolean {
  return OriginValidator.getInstance().isOriginAllowed(url);
}
