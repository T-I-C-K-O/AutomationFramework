/**
 * @anthropic-poc/playwright-core
 *
 * Core library for Playwright test automation framework.
 * This package provides reusable components for building robust automated tests.
 *
 * @packageDocumentation
 */

// Core Types
export * from './types';

// Configuration
export * from './config';

// Step Execution (exclude TestStep to avoid duplicate)
export { StepExecutor, StepParser, ActionDispatcher, BaseActionHandler, LocatorResolver } from './steps';
export * from './steps/actions';
export * from './steps/API';
export * from './steps/functions';

// Auth Management
export * from './auth';
// Recovery & Retry
export * from './recovery';

// Test Execution Orchestration
export * from './execution';

// Evidence Capture
export * from './evidence';

// Data Utilities
export * from './data';

// Test Case Loading
export * from './caseLoader';

// AI-Powered Analysis
export * from './ai';

// Helpers & Utilities
export * from './helpers';

// Excel Operations
export * from './excelOperations';

// Integration Library (Xray, API, etc.)
export * from './integrationLibrary';

// Security Utilities
export * from './security';

// Utilities
export * from './utils';

// Page and Object Map (registry-based for project configuration)
export { objectMap, ObjectMapRegistry } from './page-objects/objectMap';
export { PageClassMapRegistry } from './pages/pageclassMap';
export type { ObjectMapType } from './page-objects/objectMap';
export { PageContextManager, pageContextManager } from './pages/PageContextManager';
export { storeValue } from './testdata/storeValue';
