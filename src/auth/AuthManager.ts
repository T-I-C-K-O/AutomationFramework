/**
 * @fileoverview Dynamic Multi-User Authentication Manager
 *
 * Fully dynamic authentication - no hardcoded roles.
 * Supports any number of users/profiles with dynamic auth file generation.
 *
 * @example
 * // Run with a specific user/profile:
 * TEST_USER=fleet_manager npx playwright test
 * TEST_USER=supervisor npx playwright test
 * TEST_USER=john.doe npx playwright test
 *
 * // Setup multiple users:
 * TEST_USERS=admin,supervisor,fleet npx playwright test
 *
 * @since 1.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';

// Auth directory for storing auth files
const AUTH_DIR = path.resolve(process.cwd(), '.auth');

export class AuthManager {
  /**
   * Generate auth file name from user/profile name
   * Sanitizes the name to be file-system safe
   */
  static getAuthFileName(userOrProfile: string): string {
    // Sanitize: lowercase, replace spaces/special chars with dash
    const sanitized = userOrProfile
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `auth-${sanitized}.json`;
  }

  /**
   * Get the full auth file path for a user/profile
   */
  static getAuthFile(userOrProfile: string = 'default'): string {
    if (!userOrProfile || userOrProfile === 'default') {
      return path.join(AUTH_DIR, 'auth-default.json');
    }
    return path.join(AUTH_DIR, this.getAuthFileName(userOrProfile));
  }

  /**
   * Check if auth file exists and is valid for a user
   */
  static hasValidAuth(userOrProfile: string = 'default'): boolean {
    const authFile = this.getAuthFile(userOrProfile);
    if (!fs.existsSync(authFile)) {
      return false;
    }
    try {
      const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      // Valid if has cookies OR has localStorage with tokens
      const hasCookies = authData.cookies && authData.cookies.length > 0;
      const hasLocalStorage =
        authData.origins && authData.origins.some((o: any) => o.localStorage && o.localStorage.length > 0);
      return hasCookies || hasLocalStorage;
    } catch {
      return false;
    }
  }

  /**
   * List all existing auth files
   */
  static listAuthFiles(): string[] {
    this.ensureAuthDir();
    const files = fs.readdirSync(AUTH_DIR);
    return files
      .filter((f) => f.startsWith('auth-') && f.endsWith('.json'))
      .map((f) => f.replace('auth-', '').replace('.json', ''));
  }

  /**
   * Ensure auth directory exists
   */
  static ensureAuthDir(): void {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
  }

  /**
   * Perform manual SSO/login for a user
   */
  static async performManualLogin(
    userOrProfile: string,
    baseUrl: string,
    options: {
      headless?: boolean;
      timeout?: number;
      waitForUrl?: string;
      waitForSelector?: string;
    } = {}
  ): Promise<string> {
    // waitForUrl can be configured via:
    // 1. Options parameter
    // 2. Environment variable: LOGIN_SUCCESS_URL
    // 3. Default fallback: '**/home**'
    const {
      headless = false,
      timeout = 120000,
      waitForUrl = process.env.LOGIN_SUCCESS_URL || '**/home**',
      waitForSelector = process.env.LOGIN_SUCCESS_SELECTOR,
    } = options;

    this.ensureAuthDir();
    const authFile = this.getAuthFile(userOrProfile);

    console.log(`[AuthManager] Starting login for user: ${userOrProfile}`);
    console.log(`[AuthManager] Auth will be saved to: ${this.getAuthFileName(userOrProfile)}`);

    const browser = await chromium.launch({
      headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-extensions',
      ],
    });

    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      bypassCSP: true,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      // Once the email login page opens, please add the username and password
      // Auto-fill credentials if available and enabled
      console.log(`[AuthManager] Auto-filling credentials for ${userOrProfile}`);
      console.log(`[AuthManager] ⏸️  Please login as "${userOrProfile}" in the browser...`);

      // Wait for login success - can use URL pattern OR element selector
      if (waitForSelector) {
        console.log(`[AuthManager] Waiting for selector: ${waitForSelector}`);
        await page.locator(waitForSelector).waitFor({ timeout });
      } else {
        console.log(`[AuthManager] Waiting for URL matching: ${waitForUrl}`);
        await page.waitForURL(waitForUrl, { timeout });
      }

      console.log(`[AuthManager] ✅ Login successful for "${userOrProfile}"!`);

      await context.storageState({ path: authFile });
      console.log(`[AuthManager] Auth saved: ${this.getAuthFileName(userOrProfile)}`);

      return authFile;
    } finally {
      await browser.close();
    }
  }

  /**
   * Setup authentication for a user - auto-detects method
   */
  static async setupAuth(
    userOrProfile: string,
    baseUrl: string,
    options: {
      forceRefresh?: boolean;
      useToken?: boolean;
      waitForUrl?: string;
      waitForSelector?: string;
    } = {}
  ): Promise<string> {
    const { forceRefresh = false, waitForUrl, waitForSelector } = options;

    // Check existing auth unless force refresh
    if (!forceRefresh && this.hasValidAuth(userOrProfile)) {
      console.log(`[AuthManager] Using existing auth for: ${userOrProfile}`);
      return this.getAuthFile(userOrProfile);
    }

    // Manual login (with optional auto-fill)
    return this.performManualLogin(userOrProfile, baseUrl, { waitForUrl, waitForSelector });
  }

  /**
   * Setup multiple users at once
   */
  static async setupMultipleUsers(
    users: string[],
    baseUrl: string,
    options: { waitForUrl?: string; waitForSelector?: string } = {}
  ): Promise<Map<string, string>> {
    const authFiles = new Map<string, string>();

    for (const user of users) {
      try {
        const authFile = await this.setupAuth(user, baseUrl, options);
        authFiles.set(user, authFile);
      } catch (error) {
        console.error(`[AuthManager] Failed to setup auth for "${user}":`, error);
      }
    }

    return authFiles;
  }

  /**
   * Clear auth for a specific user
   */
  static clearAuth(userOrProfile: string): void {
    const authFile = this.getAuthFile(userOrProfile);
    if (fs.existsSync(authFile)) {
      fs.unlinkSync(authFile);
      console.log(`[AuthManager] Cleared auth for: ${userOrProfile}`);
    }
  }

  /**
   * Clear all auth files
   */
  static clearAllAuth(): void {
    if (fs.existsSync(AUTH_DIR)) {
      const files = fs.readdirSync(AUTH_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(AUTH_DIR, file));
        }
      }
      console.log('[AuthManager] Cleared all auth files');
    }
  }
}

export default AuthManager;
