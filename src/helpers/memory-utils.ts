import { logger } from './logger';

/**
 *
 * @param tag
 * RSS (Resident Set Size) → actual memory used by process.
 * HeapUsed → memory used by JavaScript objects.
 * process.env.TEST_WORKER_INDEX is provided by Playwright to identify the worker.
 */
export function logMemoryUsage(tag: string) {
  const mem = process.memoryUsage();
  logger.info(
    `[Worker ${process.env.TEST_WORKER_INDEX}] ${tag} - RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB, HeapUsed: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`
  );
}
