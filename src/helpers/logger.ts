/**
 * @fileoverview Logger Module for Playwright Test Automation Framework
 *
 * Centralized, structured logging built on top of Winston with daily-rotating
 * file logs and colorized console output. Automatically annotates messages
 * with file and line context for faster debugging.
 *
 * Key Features:
 * - Console and daily-rotating file transports (7-day retention)
 * - Timestamped, level-prefixed log lines
 * - Automatic caller file:line annotation
 * - Configurable log level via `LOG_LEVEL` env var (default: info)
 *
 * Usage:
 * ```typescript
 * import { logger } from './utils/logger';
 *
 * logger.info('Starting test');
 * logger.debug(`Payload: ${JSON.stringify(payload)}`);
 * logger.warn('Slow response detected');
 * logger.error('Request failed: ' + err.message);
 * ```
 *
 * Notes:
 * - Log files are stored under `logs/playwright-YYYY-MM-DD.log` (rotated daily)
 * - File size limited to 10MB; compressed archives enabled
 * - Intended for test, utility, and framework logs
 *
 * @since 1.0.0
 * @version 1.0.0
 */
// utils/logger.ts
import { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * Derives a human-readable caller context (file:line) from the stack trace.
 *
 * Behavior:
 * - Inspects the call stack and extracts the frame at the provided depth
 * - Returns a bracketed string like `[SomeFile.ts:123]` or an empty string
 *   when the stack cannot be parsed
 *
 * @param {number} [stackDepth=3] - Stack frame index to read for caller context
 * @returns {string} Caller context in the format `[FileName:LineNumber]` or `''`
 * @since 1.0.0
 */
function getLogContext(stackDepth = 3) {
  const stack = new Error().stack?.split('\n');
  if (stack && stack.length > stackDepth) {
    // stack[0] = Error
    // stack[1] = at getLogContext...
    // stack[2] = at logger.<method>...
    // stack[3] = at <caller> (file:line:col)
    const match =
      stack[stackDepth].match(/at (.+?) \((.+):(\d+):(\d+)\)/) || stack[stackDepth].match(/at (.+):(\d+):(\d+)/);
    if (match) {
      if (match.length === 5) {
        // With function/class name
        return `[${match[2].split('/').pop()}:${match[3]}]`;
      } else if (match.length === 4) {
        // Without function/class name
        return `[${match[1].split('/').pop()}:${match[2]}]`;
      }
    }
  }
  return '';
}

const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf((info) => {
    // info.context is set by our helper functions below
    return `${info.timestamp} [${info.level.toUpperCase()}]${info.context || ''} : ${info.message}`;
  })
);

const consoleTransport = new transports.Console({
  format: format.combine(format.colorize(), logFormat),
});

const fileTransport = new DailyRotateFile({
  filename: 'logs/playwright-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '7d',
  format: logFormat,
});

const baseLogger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [consoleTransport, fileTransport],
});

/**
 * Lightweight logger facade that injects caller context into each message.
 *
 * Methods:
 * - info(message): Informational messages for normal operations
 * - warn(message): Potential issues that don't stop execution
 * - error(message): Errors that require attention
 * - debug(message): Verbose diagnostics, controlled by LOG_LEVEL
 *
 * @example
 * ```typescript
 * logger.info('Test started');
 * logger.warn('Retrying request');
 * logger.error('Unhandled exception: ' + err.message);
 * logger.debug('Response: ' + JSON.stringify(res));
 * ```
 * @since 1.0.0
 */
export const logger = {
  info: (msg: string) => baseLogger.info(msg, { context: getLogContext(3) }),
  warn: (msg: string) => baseLogger.warn(msg, { context: getLogContext(3) }),
  error: (msg: string) => baseLogger.error(msg, { context: getLogContext(3) }),
  debug: (msg: string) => baseLogger.debug(msg, { context: getLogContext(3) }),
};
