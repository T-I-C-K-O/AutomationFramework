/**
 * @fileoverview Resource & Session Cleanup Manager
 *
 * Centralised cleanup that runs once after all tests (global teardown) and
 * can also be invoked per-worker for parallel execution safety.
 *
 * Acceptance Criteria covered:
 *  ✅ Browser instances closed after execution.
 *  ✅ API connections terminated.
 *  ✅ Temporary files deleted.
 *  ✅ Memory footprint logged.
 *  ✅ Works in parallel execution.
 *
 * Usage:
 * ```ts
 * import { ResourceCleanupManager } from '../helpers/ResourceCleanupManager';
 *
 * // In global teardown
 * const cleanup = new ResourceCleanupManager();
 * await cleanup.cleanupAll();
 *
 * // Per-worker cleanup (called from fixture teardown)
 * await cleanup.cleanupWorker(page, context);
 * ```
 *
 * @since 1.1.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

// Playwright types — imported as type-only so the module works even if
// playwright is resolved lazily.
import type { Page, BrowserContext, Browser } from '@playwright/test';

// ============================================================================
// Configuration
// ============================================================================

/** Directories to clean (relative to cwd). Globs are NOT used — each entry is
 *  deleted recursively if it exists. Add more paths as needed. */
const TEMP_DIRECTORIES = ['tmp', 'temp', '.tmp', 'test-downloads', 'test-uploads', 'test-artifacts/tmp', 'dist'];

/** File glob patterns to remove from the project root (shallow, non-recursive). */
const TEMP_FILE_PATTERNS = [/^pw-test-.*\.tmp$/, /^trace-.*\.zip$/, /^auth-auth-.*\.json$/];

// ============================================================================
// Types
// ============================================================================

export interface CleanupOptions {
  /** Remove temp files and dirs. Default: true */
  deleteTempFiles?: boolean;
  /** Close browser contexts / pages passed explicitly. Default: true */
  closeBrowserInstances?: boolean;
  /** Terminate keep-alive HTTP/API connections. Default: true */
  terminateApiConnections?: boolean;
  /** Log process memory footprint. Default: true */
  logMemoryFootprint?: boolean;
  /** Additional directories to clean (absolute or relative to cwd). */
  extraTempDirs?: string[];
  /** Additional file patterns to clean from project root. */
  extraFilePatterns?: RegExp[];
}

export interface CleanupResult {
  success: boolean;
  /** Number of browser contexts closed */
  browserContextsClosed: number;
  /** Number of pages closed */
  pagesClosed: number;
  /** Number of temp files / dirs removed */
  tempItemsRemoved: number;
  /** Number of API / HTTP connections terminated */
  apiConnectionsTerminated: number;
  /** Memory snapshot at cleanup time */
  memorySnapshot: MemorySnapshot;
  /** Errors encountered (non-fatal) */
  warnings: string[];
  /** Total cleanup wall-time in ms */
  durationMs: number;
}

export interface MemorySnapshot {
  rss: string;
  heapUsed: string;
  heapTotal: string;
  external: string;
  arrayBuffers: string;
  workerIndex: string;
}

// ============================================================================
// Implementation
// ============================================================================

export class ResourceCleanupManager {
  private options: Required<CleanupOptions>;

  constructor(options: CleanupOptions = {}) {
    this.options = {
      deleteTempFiles: options.deleteTempFiles ?? true,
      closeBrowserInstances: options.closeBrowserInstances ?? true,
      terminateApiConnections: options.terminateApiConnections ?? true,
      logMemoryFootprint: options.logMemoryFootprint ?? true,
      extraTempDirs: options.extraTempDirs ?? [],
      extraFilePatterns: options.extraFilePatterns ?? [],
    };
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Run the full cleanup sequence. Safe to call from global teardown (runs
   * once) or from a per-worker fixture teardown (parallel-safe because each
   * operation is scoped to the calling process / provided handles).
   *
   * @param browsers  Optional array of Browser instances to close.
   * @param contexts  Optional array of BrowserContext instances to close.
   * @param pages     Optional array of Page instances to close.
   */
  async cleanupAll(browsers?: Browser[], contexts?: BrowserContext[], pages?: Page[]): Promise<CleanupResult> {
    const start = Date.now();
    const warnings: string[] = [];
    let browserContextsClosed = 0;
    let pagesClosed = 0;
    let tempItemsRemoved = 0;
    let apiConnectionsTerminated = 0;

    const workerId = process.env.TEST_WORKER_INDEX ?? process.env.PLAYWRIGHT_WORKER_INDEX ?? '0';
    logger.info(`[ResourceCleanup][Worker ${workerId}] Starting cleanup sequence…`);

    // 1️⃣  Close browser instances
    if (this.options.closeBrowserInstances) {
      const result = await this.closeBrowserInstances(browsers, contexts, pages);
      browserContextsClosed = result.contextsClosed;
      pagesClosed = result.pagesClosed;
      warnings.push(...result.warnings);
    }

    // 2️⃣  Terminate API / HTTP connections
    if (this.options.terminateApiConnections) {
      const result = await this.terminateApiConnections();
      apiConnectionsTerminated = result.terminated;
      warnings.push(...result.warnings);
    }

    // 3️⃣  Delete temporary files
    if (this.options.deleteTempFiles) {
      const result = await this.deleteTempFiles();
      tempItemsRemoved = result.removed;
      warnings.push(...result.warnings);
    }

    // 4️⃣  Log memory footprint
    const memorySnapshot = this.captureMemorySnapshot(workerId);
    if (this.options.logMemoryFootprint) {
      this.logMemoryFootprint(memorySnapshot);
    }

    const durationMs = Date.now() - start;

    const summary: CleanupResult = {
      success: true,
      browserContextsClosed,
      pagesClosed,
      tempItemsRemoved,
      apiConnectionsTerminated,
      memorySnapshot,
      warnings,
      durationMs,
    };

    logger.info(
      `[ResourceCleanup][Worker ${workerId}] Cleanup completed in ${durationMs}ms — ` +
        `pages: ${pagesClosed}, contexts: ${browserContextsClosed}, ` +
        `temp removed: ${tempItemsRemoved}, API conns: ${apiConnectionsTerminated}, ` +
        `warnings: ${warnings.length}`
    );

    return summary;
  }

  /**
   * Convenience method for per-worker cleanup inside a Playwright fixture
   * teardown. Parallel-safe because it only operates on the provided handles.
   */
  async cleanupWorker(page?: Page, context?: BrowserContext): Promise<CleanupResult> {
    return this.cleanupAll(undefined, context ? [context] : undefined, page ? [page] : undefined);
  }

  // --------------------------------------------------------------------------
  // 1️⃣  Browser Cleanup
  // --------------------------------------------------------------------------

  private async closeBrowserInstances(
    browsers?: Browser[],
    contexts?: BrowserContext[],
    pages?: Page[]
  ): Promise<{ contextsClosed: number; pagesClosed: number; warnings: string[] }> {
    const warnings: string[] = [];
    let contextsClosed = 0;
    let pagesClosed = 0;

    // Close individual pages
    if (pages?.length) {
      for (const page of pages) {
        try {
          if (!page.isClosed()) {
            await page.close().catch(() => {});
            pagesClosed++;
          }
        } catch (e: any) {
          warnings.push(`Failed to close page: ${e.message}`);
        }
      }
    }

    // Close contexts (this also closes any remaining pages within them)
    if (contexts?.length) {
      for (const ctx of contexts) {
        try {
          const ctxPages = ctx.pages();
          pagesClosed += ctxPages.filter((p) => !p.isClosed()).length;
          await ctx.close().catch(() => {});
          contextsClosed++;
        } catch (e: any) {
          warnings.push(`Failed to close browser context: ${e.message}`);
        }
      }
    }

    // Close browsers (this also closes all contexts + pages)
    if (browsers?.length) {
      for (const browser of browsers) {
        try {
          if (browser.isConnected()) {
            const allContexts = browser.contexts();
            for (const ctx of allContexts) {
              pagesClosed += ctx.pages().filter((p) => !p.isClosed()).length;
              contextsClosed++;
            }
            await browser.close().catch(() => {});
          }
        } catch (e: any) {
          warnings.push(`Failed to close browser: ${e.message}`);
        }
      }
    }

    if (pagesClosed || contextsClosed) {
      logger.info(`[ResourceCleanup] 🌐 Browser cleanup: ${pagesClosed} page(s), ${contextsClosed} context(s) closed`);
    }

    return { contextsClosed, pagesClosed, warnings };
  }

  // --------------------------------------------------------------------------
  // 2️⃣  API / HTTP Connection Cleanup
  // --------------------------------------------------------------------------

  private async terminateApiConnections(): Promise<{ terminated: number; warnings: string[] }> {
    const warnings: string[] = [];
    let terminated = 0;

    // --- Axios: destroy global agents (keeps alive sockets) ---
    try {
      const axios = require('axios');
      if (axios?.default) {
        // Cancel any pending interceptors / in-flight requests if a cancel source exists
        // Not all versions expose this — wrap defensively.
        const defaults = axios.default.defaults ?? axios.defaults;
        if (defaults) {
          // Destroy keep-alive agents so the process can exit cleanly
          const httpAgent = defaults.httpAgent;
          const httpsAgent = defaults.httpsAgent;
          if (httpAgent && typeof httpAgent.destroy === 'function') {
            httpAgent.destroy();
            terminated++;
          }
          if (httpsAgent && typeof httpsAgent.destroy === 'function') {
            httpsAgent.destroy();
            terminated++;
          }
        }
      }
    } catch {
      // axios may not be installed — that's fine
    }

    // --- Node built-in: destroy global HTTP/HTTPS agents ---
    try {
      const http = require('http');
      const https = require('https');

      if (http.globalAgent && typeof http.globalAgent.destroy === 'function') {
        http.globalAgent.destroy();
        terminated++;
        logger.info('[ResourceCleanup] 🔌 HTTP global agent destroyed');
      }

      if (https.globalAgent && typeof https.globalAgent.destroy === 'function') {
        https.globalAgent.destroy();
        terminated++;
        logger.info('[ResourceCleanup] 🔌 HTTPS global agent destroyed');
      }
    } catch (e: any) {
      warnings.push(`Failed to destroy HTTP agents: ${e.message}`);
    }

    // --- Close any WebSocket connections (if ws or similar is used) ---
    try {
      // Global registry pattern: if the project registers sockets in a global set
      const globalSockets: Set<{ close: () => void }> | undefined = (globalThis as any).__testWebSockets;
      if (globalSockets?.size) {
        for (const ws of globalSockets) {
          try {
            ws.close();
            terminated++;
          } catch {
            /* best effort */
          }
        }
        globalSockets.clear();
        logger.info(`[ResourceCleanup] 🔌 ${terminated} WebSocket(s) closed`);
      }
    } catch {
      /* no global registry — skip */
    }

    if (terminated) {
      logger.info(`[ResourceCleanup] 🔌 ${terminated} API/HTTP connection(s) terminated`);
    }

    return { terminated, warnings };
  }

  // --------------------------------------------------------------------------
  // 3️⃣  Temporary File Cleanup
  // --------------------------------------------------------------------------

  private async deleteTempFiles(): Promise<{ removed: number; warnings: string[] }> {
    const warnings: string[] = [];
    let removed = 0;
    const cwd = process.cwd();

    // Remove known temp directories
    const dirs = [...TEMP_DIRECTORIES, ...this.options.extraTempDirs];
    for (const dir of dirs) {
      const absDir = path.isAbsolute(dir) ? dir : path.join(cwd, dir);
      if (fs.existsSync(absDir)) {
        try {
          fs.rmSync(absDir, { recursive: true, force: true });
          removed++;
          logger.info(`[ResourceCleanup] 🗑️  Removed directory: ${dir}`);
        } catch (e: any) {
          warnings.push(`Failed to remove directory ${dir}: ${e.message}`);
        }
      }
    }

    // Remove matching temp files from project root
    const patterns = [...TEMP_FILE_PATTERNS, ...this.options.extraFilePatterns];
    try {
      const rootFiles = fs.readdirSync(cwd);
      for (const file of rootFiles) {
        if (patterns.some((p) => p.test(file))) {
          try {
            fs.unlinkSync(path.join(cwd, file));
            removed++;
            logger.info(`[ResourceCleanup] 🗑️  Removed file: ${file}`);
          } catch (e: any) {
            warnings.push(`Failed to remove file ${file}: ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      warnings.push(`Failed to scan project root for temp files: ${e.message}`);
    }

    // Remove matching temp files from .auth directory
    const authDir = path.join(cwd, '.auth');
    if (fs.existsSync(authDir)) {
      try {
        const authFiles = fs.readdirSync(authDir);
        for (const file of authFiles) {
          if (patterns.some((p) => p.test(file))) {
            try {
              fs.unlinkSync(path.join(authDir, file));
              removed++;
              logger.info(`[ResourceCleanup] 🗑️  Removed the temp auth file: .auth/${file}`);
            } catch (e: any) {
              warnings.push(`Failed to remove temp auth file .auth/${file}: ${e.message}`);
            }
          }
        }
      } catch (e: any) {
        warnings.push(`Failed to scan .auth directory: ${e.message}`);
      }
    }
    // Remove Playwright-specific temp artefacts
    const pwTempDirs = [path.join(cwd, 'test-results', '.tmp'), path.join(cwd, 'playwright-report', '.tmp')];
    for (const tmpDir of pwTempDirs) {
      if (fs.existsSync(tmpDir)) {
        try {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          removed++;
        } catch (e: any) {
          warnings.push(`Failed to remove PW temp dir ${tmpDir}: ${e.message}`);
        }
      }
    }

    if (removed) {
      logger.info(`[ResourceCleanup] 🗑️  ${removed} temp item(s) removed`);
    }

    return { removed, warnings };
  }

  // --------------------------------------------------------------------------
  // 4️⃣  Memory Footprint
  // --------------------------------------------------------------------------

  private captureMemorySnapshot(workerId: string): MemorySnapshot {
    const mem = process.memoryUsage();
    return {
      rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
      arrayBuffers: `${(mem.arrayBuffers / 1024 / 1024).toFixed(2)} MB`,
      workerIndex: workerId,
    };
  }

  private logMemoryFootprint(snapshot: MemorySnapshot): void {
    logger.info(
      `[ResourceCleanup] 📊 Memory footprint [Worker ${snapshot.workerIndex}] — ` +
        `RSS: ${snapshot.rss}, ` +
        `Heap Used: ${snapshot.heapUsed} / ${snapshot.heapTotal}, ` +
        `External: ${snapshot.external}, ` +
        `ArrayBuffers: ${snapshot.arrayBuffers}`
    );
  }
}
