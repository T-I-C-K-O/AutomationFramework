# 📘 Complete Setup, Execution & Usage Guide

## @rappit/ps-test-automation-base — Test Automation Framework

**Version:** 1.0.0  
**Last Updated:** January 2026

---

## 📋 Table of Contents

1. [Introduction](#1-introduction)
2. [What is Playwright?](#2-what-is-playwright)
3. [Prerequisites](#3-prerequisites)
4. [Project Setup](#4-project-setup)
5. [Project Structure Explained](#5-project-structure-explained)
6. [Configuration](#6-configuration)
7. [How the Framework Works](#7-how-the-framework-works)
8. [Writing Test Cases](#8-writing-test-cases)
9. [Running Tests](#9-running-tests)
10. [Common Commands Reference](#10-common-commands-reference)
11. [Troubleshooting](#11-troubleshooting)
12. [Glossary](#12-glossary)

---

## 1. Introduction

### What is this project?

This is a **test automation framework** built on top of [Playwright](https://playwright.dev/). It helps you write and execute automated tests for web applications without needing deep programming knowledge.

### Who is this for?

- QA Engineers who want to automate test cases
- Developers who need to add automated testing
- Anyone who needs to understand or maintain this codebase

### What can you do with this framework?

| Capability | Description |
|------------|-------------|
| **Automated UI Testing** | Click buttons, fill forms, navigate pages automatically |
| **API Testing** | Send HTTP requests and validate responses |
| **Cross-Browser Testing** | Run tests on Chrome, Firefox, Safari, Edge |
| **Evidence Capture** | Automatic screenshots on failures |
| **Retry Mechanism** | Automatically retry failed steps |
| **Integration** | Connect with Jira/Xray for test management |
| **AI Features** | Optional AI-powered failure analysis |

---

## 2. What is Playwright?

**Playwright** is a modern automation tool created by Microsoft that allows you to:

- Control web browsers programmatically
- Simulate user actions (clicking, typing, scrolling)
- Take screenshots and recordings
- Run tests in parallel for speed

Think of it as a "robot" that can operate a web browser exactly like a human would, but much faster and consistently.

### Key Playwright Concepts

| Concept | Explanation |
|---------|-------------|
| **Browser** | Chrome, Firefox, Safari, or Edge |
| **Context** | An isolated browser session (like an incognito window) |
| **Page** | A single browser tab |
| **Locator** | A way to find elements on a page (buttons, inputs, etc.) |
| **Action** | Something you do on a page (click, type, scroll) |
| **Assertion** | A check to verify something is correct |

---

## 3. Prerequisites

Before you begin, make sure you have these installed:

### Required Software

| Software | Minimum Version | How to Check | Download Link |
|----------|-----------------|--------------|---------------|
| **Node.js** | 18.0.0 or higher | `node --version` | [nodejs.org](https://nodejs.org/) |
| **npm** | 8.0.0 or higher | `npm --version` | Comes with Node.js |
| **Git** | Any recent version | `git --version` | [git-scm.com](https://git-scm.com/) |
| **VS Code** | Latest recommended | N/A | [code.visualstudio.com](https://code.visualstudio.com/) |

### Recommended VS Code Extensions

Install these extensions for the best experience:

1. **Playwright Test for VSCode** — Run tests from the editor
2. **ESLint** — Code quality checking
3. **Prettier** — Code formatting
4. **GitLens** — Enhanced Git features

### Verify Your Setup

Open a terminal and run:

```bash
# Check Node.js version (must be 18+)
node --version

# Check npm version
npm --version

# Check Git
git --version
```

**Expected output example:**
```
v20.10.0
10.2.3
git version 2.42.0
```

---

## 4. Project Setup

### Step 1: Clone or Download the Project

If using Git:
```bash
git clone <repository-url>
cd playwright-core-library
```

Or if you received a ZIP file, extract it and open the folder.

### Step 2: Install Dependencies

```bash
npm install
```

This downloads all required packages. Wait for it to complete (may take 2-5 minutes).

**What this does:**
- Reads `package.json` to find required packages
- Downloads them into the `node_modules` folder
- Creates `package-lock.json` to lock versions

### Step 3: Install Playwright Browsers

```bash
npx playwright install
```

This downloads the browser engines (Chromium, Firefox, WebKit).

### Step 4: Build the Project

```bash
npm run build
```

This compiles TypeScript code into JavaScript in the `dist` folder.

### Step 5: Create Environment Configuration

Create a `.env` file in the project root:

```bash
touch .env
```

Add your configuration (example):

```ini
# Application URLs
LOGIN_URL=https://your-app.com/login
BASE_URL=https://your-app.com

# Environment
ENV=dev

# Test Configuration
DEFAULT_TIMEOUT=30000
RETRY_ENABLED=true
RETRY_MAX_ATTEMPTS=2

# Optional: AI Features
ENABLE_AI_FEATURES=false

# Optional: Xray Integration
XRAY_CLIENT_ID=your-client-id
XRAY_CLIENT_SECRET=your-client-secret
XRAY_BASE_URL=https://xray.cloud.getxray.app
```

### Step 6: Verify Setup

```bash
npm run build
```

If no errors appear, you're ready to go! ✅

---

## 5. Project Structure Explained

This section provides a comprehensive breakdown of the project structure. Understanding this will help you know where to find things and where to add new code.

### 5.1 High-Level Overview

```
playwright-core-library/
│
├── 📁 src/                   # Source code (TypeScript) - THE MAIN CODE
├── 📁 dist/                  # Compiled JavaScript (auto-generated, don't edit)
├── 📁 docs/                  # Documentation files
├── 📁 node_modules/          # Dependencies (auto-generated, don't edit)
├── 📁 logs/                  # Log files (auto-generated during test runs)
├── 📁 test-results/          # Screenshots & evidence (auto-generated)
│
├── 📄 package.json           # Project configuration
├── 📄 tsconfig.json          # TypeScript settings
├── 📄 eslint.config.mjs      # Code style rules
├── 📄 .env                   # Environment variables (create this)
├── 📄 .npmrc                 # npm registry settings
└── 📄 README.md              # Quick start guide
```

---

### 5.2 Root-Level Files (Detailed)

#### 📄 `package.json`
**Purpose:** The "identity card" of the project. Defines project name, version, dependencies, and available scripts.

**What's inside:**
```json
{
  "name": "@rappit/ps-test-automation-base",    // Package name
  "version": "1.0.0",                   // Current version
  "scripts": { ... },                   // Commands you can run
  "dependencies": { ... },              // Required packages
  "devDependencies": { ... }            // Development-only packages
}
```

**When to edit:**
- Adding a new npm package: `npm install package-name` (auto-updates this file)
- Adding a new script command
- Updating package version before publishing

**Common scripts:**
```bash
npm run build          # Compile TypeScript
npm run lint           # Check code quality
npm run clean          # Delete dist folder
```

---

#### 📄 `tsconfig.json`
**Purpose:** Tells TypeScript compiler how to convert `.ts` files to `.js` files.

**Key settings explained:**
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",        // JavaScript version to output
    "module": "commonjs",      // Module system (Node.js style)
    "outDir": "./dist",        // Where compiled files go
    "rootDir": "./src",        // Where source files are
    "strict": true,            // Enable strict type checking
    "declaration": true        // Generate .d.ts type files
  }
}
```

**When to edit:** Rarely. Only if you need to change compiler behavior.

---

#### 📄 `.env` (You Create This)
**Purpose:** Store environment-specific configuration that shouldn't be in code.

**Example:**
```ini
# URLs
LOGIN_URL=https://staging.myapp.com/login
BASE_URL=https://staging.myapp.com

# Timeouts
DEFAULT_TIMEOUT=30000

# Credentials (never commit real credentials!)
XRAY_CLIENT_ID=abc123
XRAY_CLIENT_SECRET=xyz789
```

**Important:** Add `.env` to `.gitignore` to avoid committing secrets!

---

#### 📄 `.npmrc`
**Purpose:** Configure npm registry settings (for publishing to private registries like GCP).

**Example:**
```ini
@rappit:registry=https://europe-west1-npm.pkg.dev/gp-ps-artifacts-repo-prod/ps-artifacts-fe/
//europe-west1-npm.pkg.dev/gp-ps-artifacts-repo-prod/ps-artifacts-fe/:always-auth=true
```

---

### 5.3 The `src/` Folder (Detailed Breakdown)

This is where all the source code lives. Let's explore each subfolder:

---

#### 📁 `src/types/`
**Purpose:** Define TypeScript interfaces and types used throughout the project.

**Files:**
| File | Purpose |
|------|---------|
| `types.ts` | Core type definitions (TestCase, TestStep, Evidence, etc.) |
| `index.ts` | Exports all types |

**What to keep here:**
- Interface definitions
- Type aliases
- Enum definitions

**Example content:**
```typescript
// types.ts
export interface TestStep {
  id: string;
  action: string;      // e.g., "Click 'Submit'"
  data?: string;       // Optional test data
  result?: string;     // Expected result description
}

export interface TestCase {
  name: string;
  jira: { key: string; summary: string };
  steps: TestStep[];
}

export type TestStatus = 'PASSED' | 'FAILED' | 'SKIPPED';
```

**How to use:**
```typescript
import { TestStep, TestCase } from '@rappit/ps-test-automation-base/types';

const myStep: TestStep = {
  id: '1',
  action: "Click 'Login Button'",
  result: 'User is logged in'
};
```

---

#### 📁 `src/config/`
**Purpose:** Centralized configuration for the entire framework.

**Structure:**
```
config/
├── index.ts              # Exports all config
├── timeouts.config.ts    # All timeout values
└── hooks/
    ├── index.ts
    ├── global.setup.ts   # Runs BEFORE all tests
    └── global.teardown.ts # Runs AFTER all tests
```

##### `timeouts.config.ts`
**Purpose:** Single place to manage all wait times.

```typescript
export const TIMEOUTS = {
  // Element timeouts
  elementVisible: 5000,      // Wait for element to appear
  elementDefault: 30000,     // General element operations
  
  // Page timeouts
  pageLoad: 60000,           // Page navigation
  networkIdle: 30000,        // Wait for network to settle
  
  // Action timeouts
  click: 30000,              // Click operations
  scroll: 5000,              // Scroll operations
  
  // Retry settings
  retryMaxAttempts: 2,       // Number of retries
  retryDelay: 1000,          // Delay between retries
};
```

**How to use:**
```typescript
import { TIMEOUTS } from '@rappit/ps-test-automation-base/config';

await element.waitFor({ timeout: TIMEOUTS.elementVisible });
```

##### `hooks/global.setup.ts`
**Purpose:** Code that runs ONCE before any tests start.

**Use for:**
- Validating environment variables
- Health checks on the application
- Setting up test data
- Authenticating and saving session state
- Initializing AI features

```typescript
export class BaseGlobalSetup {
  async onSetup(): Promise<void> {
    await this.validateEnvironment();    // Check required env vars
    await this.performHealthCheck();     // Ping the app
    await this.setupAuthentication();    // Login and save session
    await this.seedTestData();           // Create test data
  }
}
```

##### `hooks/global.teardown.ts`
**Purpose:** Code that runs ONCE after all tests complete.

**Use for:**
- Cleaning up test data
- Generating summary reports
- Uploading results to Xray/Jira
- Sending notifications

---

#### 📁 `src/steps/`
**Purpose:** The CORE of the framework. Handles parsing and executing test steps.

**Structure:**
```
steps/
├── index.ts              # Exports all step components
├── StepExecutor.ts       # Main step execution engine
├── StepParser.ts         # Parses step text into structured format
├── ActionDispatcher.ts   # Routes actions to correct handler
├── LocatorResolver.ts    # Resolves element names to locators
├── BaseActionHandler.ts  # Base class for action handlers
│
├── actions/              # UI action handlers
│   ├── index.ts
│   ├── ClickActionHandler.ts
│   ├── EnterActionHandler.ts
│   ├── GotoActionHandler.ts
│   └── ... (more handlers)
│
├── API/                  # API action handlers
│   ├── index.ts
│   └── APIActionHandler.ts
│
└── functions/            # Custom function handlers
    ├── index.ts
    └── FunctionHandler.ts
```

##### `StepExecutor.ts` (Most Important!)
**Purpose:** The brain of test execution. Takes a step and makes it happen.

**What it does:**
1. Receives a step: `"Click 'Submit Button'"`
2. Parses it to understand the action
3. Resolves the element locator
4. Dispatches to the correct handler
5. Handles retries if it fails

**How it works (simplified):**
```typescript
class StepExecutor {
  async executeStep(step: TestStep, data?: Record<string, any>) {
    // 1. Parse the step
    const parsed = this.parser.parse(step.action);
    
    // 2. Replace variables like ${username}
    const resolved = this.parser.replaceParameters(parsed, data);
    
    // 3. Dispatch to correct handler
    await this.dispatcher.dispatch(resolved);
  }
}
```

##### `StepParser.ts`
**Purpose:** Converts human-readable step text into structured data.

**Example:**
```
Input:  "Enter 'Username Field' with 'john@email.com'"

Output: {
  action: "enter",
  element: "Username Field",
  value: "john@email.com"
}
```

##### `ActionDispatcher.ts`
**Purpose:** Routes actions to the correct handler.

**Example routing:**
```
"Click ..."     → ClickActionHandler
"Enter ..."     → EnterActionHandler
"Validate ..."  → ValidateActionHandler
"API ..."       → APIActionHandler
```

##### `LocatorResolver.ts`
**Purpose:** Converts element names to Playwright locators.

**Example:**
```
Input:  "Submit Button"

Looks up in objectMap:
  "Submit Button": ["button[type='submit']", "#submit-btn"]

Output: page.locator("button[type='submit']")
```

##### `actions/` Folder
**Purpose:** Contains handlers for each type of UI action.

| Handler | Handles Actions Like |
|---------|---------------------|
| `ClickActionHandler.ts` | `Click 'Button'`, `Double Click 'Row'` |
| `EnterActionHandler.ts` | `Enter 'Field' with 'text'` |
| `GotoActionHandler.ts` | `Goto 'Page Name'` |
| `ValidateActionHandler.ts` | `Validate 'Element' is visible` |
| `WaitActionHandler.ts` | `Wait 'Spinner' to disappear` |
| `DropdownActionHandler.ts` | `Select 'Dropdown' with 'Option'` |
| `CheckActionHandler.ts` | `Check 'Checkbox'` |
| `UncheckActionHandler.ts` | `Uncheck 'Checkbox'` |
| `HoverActionHandler.ts` | `Hover 'Menu Item'` |
| `ScrollActionHandler.ts` | `Scroll 'Page' to bottom` |
| `UploadActionHandler.ts` | `Upload 'Input' with 'file.pdf'` |
| `DownloadActionHandler.ts` | `Download 'Button'` |
| `AlertActionHandler.ts` | `Accept Alert`, `Dismiss Alert` |
| `IFrameActionHandler.ts` | `Switch to iframe 'Frame'` |
| `DragDropActionHandler.ts` | `Drag 'Source' to 'Target'` |
| `StoreActionHandler.ts` | `Store 'Element' as 'variable'` |
| `SwitchPageActionHandler.ts` | `Switch Page 'Tab Name'` |

**Example handler structure:**
```typescript
// ClickActionHandler.ts
export class ClickActionHandler extends BaseActionHandler {
  canHandle(action: string): boolean {
    return action.toLowerCase().startsWith('click');
  }

  async execute(page: Page, parsed: ParsedStep): Promise<void> {
    const locator = await this.resolveLocator(page, parsed.element);
    await locator.click({ timeout: TIMEOUTS.click });
  }
}
```

##### `API/` Folder
**Purpose:** Handle REST API calls within tests.

**Supported actions:**
```
API GET 'https://api.example.com/users'
API POST 'https://api.example.com/users' with '{"name": "John"}'
API PUT 'https://api.example.com/users/1' with '{"name": "Jane"}'
API DELETE 'https://api.example.com/users/1'
```

##### `functions/` Folder
**Purpose:** Execute custom JavaScript/TypeScript functions.

**Use for:**
- Complex operations not covered by standard actions
- Calling page class methods
- Custom validations

**Example:**
```
Call LoginPage.performComplexLogin('user', 'pass')
```

---

#### 📁 `src/execution/`
**Purpose:** Orchestrates the overall test execution flow.

**Files:**
| File | Purpose |
|------|---------|
| `TestExecutionOrchestrator.ts` | Manages running tests, collecting results |

**What it does:**
1. Groups test cases by execution mode (parallel/serial)
2. Creates browser contexts for each test
3. Runs steps through StepExecutor
4. Collects results and evidence
5. Handles failures and reporting

**Example usage:**
```typescript
const orchestrator = new TestExecutionOrchestrator();

// Run a single test
await orchestrator.runSingleTest({
  testInfo,
  testcase: myTestCase,
  browser
});

// Run tests with iterations (data-driven)
await orchestrator.runIteratedTest({
  testInfo,
  testcase: myTestCase,
  iterations: [
    { username: 'user1', password: 'pass1' },
    { username: 'user2', password: 'pass2' }
  ],
  browser
});
```

---

#### 📁 `src/recovery/`
**Purpose:** Handle failures gracefully with retry and recovery mechanisms.

**Files:**
| File | Purpose |
|------|---------|
| `RetryHandler.ts` | Retry failed steps with configurable attempts |
| `RecoveryActions.ts` | Actions to perform before retrying |

##### `RetryHandler.ts`
**Purpose:** Automatically retry failed steps.

**Features:**
- Configurable retry count
- Exponential backoff (increasing delay between retries)
- Screenshot capture before each retry
- Custom recovery actions

**Configuration:**
```typescript
const retryHandler = new RetryHandler(page, {
  maxRetries: 3,           // Try up to 3 times
  retryDelay: 1000,        // Wait 1 second between retries
  exponentialBackoff: true, // Double delay each retry
  screenshotOnRetry: true   // Capture screenshot on failure
});
```

##### `RecoveryActions.ts`
**Purpose:** Define what to do before retrying a failed step.

**Built-in recovery actions:**
- Close unexpected popups
- Dismiss alerts
- Scroll element into view
- Wait for page to stabilize
- Refresh the page

**Example:**
```typescript
const recoveryChain = createRecoveryChain([
  RecoveryActions.dismissAlerts,
  RecoveryActions.closePopups,
  RecoveryActions.waitForStability
]);
```

---

#### 📁 `src/evidence/`
**Purpose:** Capture screenshots and other evidence during test execution.

**Files:**
| File | Purpose |
|------|---------|
| `EvidenceCapture.ts` | Screenshot capture utilities |

**What it captures:**
- Full-page screenshots on failure
- Screenshots at specific steps
- Base64-encoded images for reports

**How to use:**
```typescript
import { EvidenceCapture } from '@rappit/ps-test-automation-base/evidence';

// Capture screenshot
const evidence = await EvidenceCapture.captureScreenshot(
  page,
  'TC-001',      // Test case key
  1              // Iteration number
);

// Returns:
// {
//   base64Data: "iVBORw0KGgoAAAANS...",
//   filename: "TC_001_iter1.png"
// }
```

**Where screenshots are saved:**
```
test-results/
└── screenshots/
    ├── TC_001_iter1.png
    ├── TC_001_iter2.png
    └── TC_002.png
```

---

#### 📁 `src/data/`
**Purpose:** Data generation and management utilities.

**Files:**
| File | Purpose |
|------|---------|
| `storeManager.ts` | Store/retrieve values during test execution |
| `dataGenerators.ts` | Generate random test data |
| `dateUtils.ts` | Date formatting and manipulation |
| `randomUtils.ts` | Random string/number generation |
| `runtimeDataResolver.ts` | Resolve dynamic data at runtime |

##### `storeManager.ts`
**Purpose:** Save values during test execution for use in later steps.

**Example scenario:**
1. Step 1: Create an order → Order ID is "ORD-12345"
2. Step 2: Save the Order ID
3. Step 3: Search for the Order ID in another page

```typescript
import { saveValue, getValue } from '@rappit/ps-test-automation-base/data';

// Save a value
saveValue('orderId', 'ORD-12345');

// Retrieve later
const orderId = getValue('orderId'); // Returns 'ORD-12345'
```

**In test steps:**
```json
{ "action": "Store 'Order ID Element' as 'orderId'" },
{ "action": "Enter 'Search Box' with '[orderId]'" }
```

##### `dataGenerators.ts`
**Purpose:** Generate random test data on-the-fly.

**Available generators:**
```typescript
import { generateRandomEmail, generateRandomPhone } from '@rappit/ps-test-automation-base/data';

generateRandomEmail();     // "test_a7x9k@example.com"
generateRandomPhone();     // "+1-555-123-4567"
generateRandomName();      // "John Smith"
generateRandomDate();      // "2026-01-15"
```

##### `dateUtils.ts`
**Purpose:** Work with dates easily.

```typescript
import { formatDate, addDays, getToday } from '@rappit/ps-test-automation-base/data';

getToday();                    // "2026-01-07"
addDays(new Date(), 30);       // Date 30 days from now
formatDate(date, 'MM/DD/YYYY'); // "01/07/2026"
```

---

#### 📁 `src/caseLoader/`
**Purpose:** Load test cases from JSON files.

**Files:**
| File | Purpose |
|------|---------|
| `TestFileLoader.ts` | Load and parse test case files |

**What it does:**
1. Scans `testcases/` folder for JSON files
2. Parses files and validates structure
3. Extracts execution mode (parallel/serial) from filename
4. Returns array of test cases

**File naming convention:**
```
testcases/
├── Login_testCases.json           # Parallel execution (default)
├── Checkout_serial_testCases.json # Serial execution
└── Search_parallel_testCases.json # Parallel execution (explicit)
```

**How to use:**
```typescript
import { loadXrayTestcases } from '@rappit/ps-test-automation-base/caseLoader';

// Load all test cases
const testCases = loadXrayTestcases('all');

// Load only failed tests (for re-run)
const failedTests = loadXrayTestcases('failed');

// Load only pending tests
const pendingTests = loadXrayTestcases('pending');
```

---

#### 📁 `src/ai/`
**Purpose:** AI-powered features for smarter test automation (optional).

**Files:**
| File | Purpose |
|------|---------|
| `aiService.ts` | High-level AI service |
| `mcpClient.ts` | MCP (Model Context Protocol) client |

**Features (when enabled):**
- **Self-healing locators:** Automatically find elements when locators break
- **Failure analysis:** AI explains why a test failed
- **Visual validation:** Compare screenshots intelligently

**How to enable:**
```ini
# In .env
ENABLE_AI_FEATURES=true
```

**Example usage:**
```typescript
import { aiService } from '@rappit/ps-test-automation-base/ai';

// Check if AI is enabled
if (aiService.isEnabled()) {
  // Analyze a failure
  const analysis = await aiService.analyzeFailure(page, error);
  console.log(analysis.suggestedFixes);
}
```

---

#### 📁 `src/helpers/`
**Purpose:** General utility functions used across the framework.

**Files:**
| File | Purpose |
|------|---------|
| `logger.ts` | Centralized logging system |
| `memory-utils.ts` | Monitor memory usage |

##### `logger.ts`
**Purpose:** Consistent logging throughout the framework.

**Features:**
- Colorized console output
- Daily rotating log files
- Automatic caller location (file:line)
- Configurable log level

**Log levels:**
```typescript
import { logger } from '@rappit/ps-test-automation-base/helpers';

logger.error('Something went wrong');  // Red - always shown
logger.warn('Something suspicious');   // Yellow
logger.info('Step completed');         // Green - default level
logger.debug('Detailed info');         // Blue - verbose mode
```

**Log files location:**
```
logs/
├── playwright-2026-01-07.log
├── playwright-2026-01-06.log
└── playwright-2026-01-05.log  (deleted after 7 days)
```

**Configure log level:**
```ini
# In .env
LOG_LEVEL=debug  # Show all logs including debug
```

---

#### 📁 `src/excelOperations/`
**Purpose:** Read/write Excel files for test data and results.

**Files:**
| File | Purpose |
|------|---------|
| `excelToJson.ts` | Convert Excel sheets to JSON |
| `resultUpdater.ts` | Update Excel with test results |
| `config.ts` | Excel configuration settings |
| `reportServer.ts` | Serve Excel reports via HTTP |

**Use cases:**
- Read test data from Excel spreadsheets
- Write test results back to Excel
- Generate Excel reports

**Example:**
```typescript
import { excelToJson } from '@rappit/ps-test-automation-base/excelOperations';

// Convert Excel to JSON
const testData = excelToJson('testdata/LoginData.xlsx', 'Sheet1');
// Returns: [{ username: 'user1', password: 'pass1' }, ...]
```

---

#### 📁 `src/integrationLibrary/`
**Purpose:** Connect with external tools and services.

**Structure:**
```
integrationLibrary/
├── api/
│   └── restServices/
│       └── apiHandler.ts     # HTTP request utilities
│
└── testManagement/
    ├── xrayAPI.ts            # Xray Cloud API client
    ├── TestPlanProcessor.ts  # Process Xray test plans
    ├── TestExecutionProcessor.ts
    ├── TestPlanReportGenerator.ts
    ├── downloadAttachment.ts
    └── readDataFromExcel.ts
```

##### `api/restServices/apiHandler.ts`
**Purpose:** Make HTTP requests in tests.

```typescript
import { apiHandler } from '@rappit/ps-test-automation-base/integrationLibrary';

// GET request
const response = await apiHandler.get('https://api.example.com/users');

// POST request
const response = await apiHandler.post('https://api.example.com/users', {
  body: { name: 'John' }
});
```

##### `testManagement/xrayAPI.ts`
**Purpose:** Integrate with Jira/Xray for test management.

**Features:**
- Fetch test cases from Xray
- Upload test results to Xray
- Attach screenshots as evidence
- Update test execution status

**Required environment variables:**
```ini
XRAY_CLIENT_ID=your-client-id
XRAY_CLIENT_SECRET=your-client-secret
XRAY_BASE_URL=https://xray.cloud.getxray.app
```

---

#### 📁 `src/page-objects/`
**Purpose:** Registry for element locators.

**Files:**
| File | Purpose |
|------|---------|
| `objectMap.ts` | Element locator definitions |

**How it works:**
```typescript
// Projects register their locators
ObjectMapRegistry.register({
  "Login Button": ["#login-btn", "button:has-text('Login')"],
  "Username Field": ["input[name='username']", "#username"],
  "Password Field": ["input[name='password']"]
});

// Framework uses these to find elements
ObjectMapRegistry.get("Login Button"); 
// Returns: ["#login-btn", "button:has-text('Login')"]
```

**Fallback locators:** If the first locator fails, the framework tries the next one.

---

#### 📁 `src/pages/`
**Purpose:** Manage page contexts and page classes.

**Files:**
| File | Purpose |
|------|---------|
| `PageContextManager.ts` | Track current page/tab |
| `pageclassMap.ts` | Registry of page classes |

**Use for:**
- Switching between browser tabs
- Managing popup windows
- Calling page class methods

---

#### 📁 `src/security/`
**Purpose:** Security utilities to prevent unsafe operations.

**Files:**
| File | Purpose |
|------|---------|
| `OriginValidator.ts` | Validate navigation URLs |

**What it does:**
- Validates URLs before navigation
- Prevents navigation to unauthorized domains
- Blocks potentially malicious URLs

---

#### 📁 `src/testdata/`
**Purpose:** Runtime data storage.

**Files:**
| File | Purpose |
|------|---------|
| `storeValue.ts` | Persisted key-value store file |

**Note:** This file is auto-generated/modified by `storeManager.ts`. Don't edit manually.

---

### 5.4 The `docs/` Folder

Contains documentation files:

| File | Description |
|------|-------------|
| `Setup-Execution-Usage-Guide.md` | This guide |
| `API-Test-Design-Guide.md` | How to write API tests |
| `Retry-Recovery-Guide.md` | Retry mechanism details |
| `AI-and-Security-Guide.md` | AI features and security |
| `TestCase-Guideline.md` | Test case writing standards |
| `GCP-Artifact-Registry-Setup.md` | Publishing to GCP |

---

### 5.5 Auto-Generated Folders (Don't Edit)

| Folder | Purpose | When Created |
|--------|---------|--------------|
| `dist/` | Compiled JavaScript | After `npm run build` |
| `node_modules/` | Dependencies | After `npm install` |
| `logs/` | Log files | During test execution |
| `test-results/` | Screenshots, traces | During test execution |

---

### 5.6 Quick Reference: Where to Put Things

| You Want To... | Put It In... |
|----------------|--------------|
| Add a new element locator | `src/page-objects/objectMap.ts` |
| Add a new action type | `src/steps/actions/` (new handler) |
| Change timeout values | `src/config/timeouts.config.ts` |
| Add pre-test setup | `src/config/hooks/global.setup.ts` |
| Add a new data generator | `src/data/dataGenerators.ts` |
| Add a new utility function | `src/helpers/` |
| Add new types/interfaces | `src/types/types.ts` |
| Add documentation | `docs/` folder |

---

### 5.7 Key Files Quick Reference

| File | Purpose | When You'd Edit It |
|------|---------|-------------------|
| `package.json` | Project dependencies and scripts | Adding new packages |
| `.env` | Environment-specific settings | Changing URLs, credentials |
| `src/config/timeouts.config.ts` | Timeout values | Adjusting wait times |
| `src/page-objects/objectMap.ts` | Element locators | Adding new UI elements |
| `src/config/hooks/global.setup.ts` | Pre-test setup | Adding setup logic |
| `src/steps/actions/*.ts` | Action handlers | Adding new action types |
| `src/types/types.ts` | Type definitions | Adding new interfaces |

---

## 6. Configuration

### 6.1 Environment Variables (.env)

Create a `.env` file in the project root:

```ini
# ═══════════════════════════════════════════════════════════════
# APPLICATION CONFIGURATION
# ═══════════════════════════════════════════════════════════════

# The URL where users log in
LOGIN_URL=https://your-app.com/login

# The base URL of your application
BASE_URL=https://your-app.com

# Environment name (dev, uat, staging, prod)
ENV=dev

# ═══════════════════════════════════════════════════════════════
# TIMEOUT CONFIGURATION (in milliseconds)
# ═══════════════════════════════════════════════════════════════

# Default timeout for most operations (30 seconds)
DEFAULT_TIMEOUT=30000

# Time to wait for elements to appear (5 seconds)
ELEMENT_VISIBLE_TIMEOUT=5000

# Time to wait for page to fully load (60 seconds)
PAGE_LOAD_TIMEOUT=60000

# ═══════════════════════════════════════════════════════════════
# RETRY CONFIGURATION
# ═══════════════════════════════════════════════════════════════

# Enable/disable automatic retry on failure
RETRY_ENABLED=true

# Number of retry attempts
RETRY_MAX_ATTEMPTS=2

# Delay between retries (1 second)
RETRY_DELAY=1000

# ═══════════════════════════════════════════════════════════════
# OPTIONAL: XRAY/JIRA INTEGRATION
# ═══════════════════════════════════════════════════════════════

# XRAY_CLIENT_ID=your-client-id
# XRAY_CLIENT_SECRET=your-client-secret
# XRAY_BASE_URL=https://xray.cloud.getxray.app

# ═══════════════════════════════════════════════════════════════
# OPTIONAL: AI FEATURES
# ═══════════════════════════════════════════════════════════════

# Set to 'true' to enable AI-powered features
ENABLE_AI_FEATURES=false
```

### 6.2 Timeout Settings

All timeouts are configured in `src/config/timeouts.config.ts`:

| Timeout | Default | Purpose |
|---------|---------|---------|
| `elementVisible` | 5000ms | Wait for element to appear |
| `elementDefault` | 30000ms | General element operations |
| `pageLoad` | 60000ms | Page navigation |
| `click` | 30000ms | Click operations |
| `networkIdle` | 30000ms | Wait for network to settle |
| `popupDetection` | 3000ms | Detect new tabs/popups |

**Override via environment variables:**
```ini
ELEMENT_VISIBLE_TIMEOUT=10000
PAGE_LOAD_TIMEOUT=120000
```

### 6.3 Retry Configuration

When a step fails, the framework can automatically retry it:

```ini
# Enable retry mechanism
RETRY_ENABLED=true

# Number of retry attempts (default: 2)
RETRY_MAX_ATTEMPTS=3

# Delay between retries in ms (default: 1000)
RETRY_DELAY=2000
```

---

## 7. How the Framework Works

### Execution Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    TEST EXECUTION FLOW                        │
└──────────────────────────────────────────────────────────────┘

     ┌─────────────┐
     │  Test Case  │  (JSON file with steps)
     │   (JSON)    │
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │ TestLoader  │  Loads and parses test case files
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │ Orchestrator│  Manages test execution
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │StepExecutor │  Executes each step
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │ StepParser  │  Parses step: "Click 'Submit'"
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │  Dispatcher │  Routes to correct handler
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │   Handler   │  ClickActionHandler.execute()
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │  Locator    │  Finds element: button[name="submit"]
     │  Resolver   │
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │  Playwright │  Actually clicks the element
     └──────┬──────┘
            │
     ┌──────┴──────┐
     │             │
   SUCCESS      FAILURE
     │             │
     ▼             ▼
  Next Step   ┌─────────────┐
              │RetryHandler │  Capture screenshot, retry
              └──────┬──────┘
                     │
              ┌──────┴──────┐
              │             │
            SUCCESS      MAX RETRIES
              │             │
              ▼             ▼
           Continue     FAIL TEST
```

### Component Responsibilities

| Component | What It Does |
|-----------|--------------|
| **TestFileLoader** | Reads JSON test files from `testcases/` folder |
| **TestExecutionOrchestrator** | Coordinates test execution, manages results |
| **StepExecutor** | Core engine that executes individual steps |
| **StepParser** | Converts step text into structured format |
| **ActionDispatcher** | Routes actions to the correct handler |
| **LocatorResolver** | Converts element names to Playwright locators |
| **ActionHandlers** | Perform actual browser actions |
| **RetryHandler** | Retries failed steps with recovery |
| **EvidenceCapture** | Takes screenshots on failure |

---

## 8. Writing Test Cases

### Test Case JSON Structure

Test cases are written as JSON files:

```json
[
  {
    "name": "Login Test",
    "jira": {
      "key": "TC-001",
      "summary": "Verify user can login successfully"
    },
    "steps": [
      {
        "action": "Goto 'Login Page'",
        "data": "",
        "result": "Login page is displayed"
      },
      {
        "action": "Enter 'Username' with '${username}'",
        "data": "",
        "result": "Username is entered"
      },
      {
        "action": "Enter 'Password' with '${password}'",
        "data": "",
        "result": "Password is entered"
      },
      {
        "action": "Click 'Submit Button'",
        "data": "",
        "result": "Form is submitted"
      },
      {
        "action": "Validate 'Welcome Message' is visible",
        "data": "",
        "result": "User is logged in"
      }
    ]
  }
]
```

### Available Actions

#### Navigation Actions

| Action | Example | Description |
|--------|---------|-------------|
| `Goto` | `Goto 'Login Page'` | Navigate to a URL |
| `Switch Page` | `Switch Page 'New Tab'` | Switch to different tab |
| `Navigate Back` | `Navigate Back` | Go to previous page |

#### Input Actions

| Action | Example | Description |
|--------|---------|-------------|
| `Enter` | `Enter 'Email Field' with 'test@email.com'` | Type text into field |
| `Type` | `Type 'Search Box' with 'query'` | Type with keyboard events |
| `Clear` | `Clear 'Input Field'` | Clear field contents |

#### Click Actions

| Action | Example | Description |
|--------|---------|-------------|
| `Click` | `Click 'Submit Button'` | Click an element |
| `Double Click` | `Double Click 'Row Item'` | Double-click |
| `Right Click` | `Right Click 'Context Menu'` | Right-click |

#### Selection Actions

| Action | Example | Description |
|--------|---------|-------------|
| `Select` | `Select 'Country Dropdown' with 'USA'` | Select dropdown option |
| `Check` | `Check 'Terms Checkbox'` | Check a checkbox |
| `Uncheck` | `Uncheck 'Newsletter'` | Uncheck a checkbox |

#### Validation Actions

| Action | Example | Description |
|--------|---------|-------------|
| `Validate visible` | `Validate 'Success Message' is visible` | Check element is visible |
| `Validate text` | `Validate 'Header' has text 'Welcome'` | Check element text |
| `Validate enabled` | `Validate 'Submit' is enabled` | Check element is enabled |
| `Validate count` | `Validate 'List Items' count is 5` | Check number of elements |

#### Wait Actions

| Action | Example | Description |
|--------|---------|-------------|
| `Wait` | `Wait 'Loading Spinner' to disappear` | Wait for element state |
| `Wait for` | `Wait for 5 seconds` | Wait fixed time |

#### Other Actions

| Action | Example | Description |
|--------|---------|-------------|
| `Hover` | `Hover 'Menu Item'` | Mouse hover |
| `Scroll` | `Scroll 'Page' to bottom` | Scroll page |
| `Upload` | `Upload 'File Input' with 'test.pdf'` | Upload file |
| `Download` | `Download 'Export Button'` | Download file |
| `Store` | `Store 'Order ID' as 'orderId'` | Save value for later |
| `Assert` | `Assert 'Price' equals '$100'` | Strict assertion |

### Using Variables

#### From Test Data (`${variable}`)

Variables from iteration data:
```json
{
  "action": "Enter 'Username' with '${username}'",
  "data": "",
  "result": "Username entered"
}
```

#### Stored Values (`[variable]`)

Values saved during test execution:
```json
{
  "action": "Store 'Order ID' as 'orderId'",
  "data": "",
  "result": "Order ID saved"
},
{
  "action": "Enter 'Search' with '[orderId]'",
  "data": "",
  "result": "Search with saved order ID"
}
```

### Element Locators (Object Map)

Define element locators in your project's object map:

```typescript
// page-objects/objectMap.ts
export const objectMap = {
  // Format: "Element Name": ["locator1", "locator2 (fallback)"]
  
  "Login Page": ["https://app.example.com/login"],
  
  "Username Field": [
    "input[name='username']",
    "#username",
    "[data-testid='username-input']"
  ],
  
  "Password Field": [
    "input[name='password']",
    "#password"
  ],
  
  "Submit Button": [
    "button[type='submit']",
    "button:has-text('Login')",
    "#login-btn"
  ],
  
  "Welcome Message": [
    ".welcome-message",
    "[data-testid='welcome']"
  ]
};
```

**Locator types supported:**
- CSS selectors: `button.primary`, `#submit`, `[data-testid='login']`
- Text-based: `text=Login`, `button:has-text('Submit')`
- XPath: `//button[@type='submit']`
- Role-based: `role=button[name='Submit']`

---

## 9. Running Tests

### Basic Commands

```bash
# Build the project (compile TypeScript)
npm run build

# Run all tests
npx playwright test

# Run specific test file
npx playwright test tests/login.spec.ts

# Run tests with UI (visual mode)
npx playwright test --ui

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Debug Mode

```bash
# Run with Playwright Inspector (step through tests)
npx playwright test --debug

# Run single test in debug mode
npx playwright test -g "login test" --debug
```

### View Reports

```bash
# Show HTML report after test run
npx playwright show-report

# Generate report
npx playwright test --reporter=html
```

### Parallel Execution

```bash
# Run with 4 parallel workers
npx playwright test --workers=4

# Run in serial (one at a time)
npx playwright test --workers=1
```

### Filter Tests

```bash
# Run tests matching pattern
npx playwright test -g "login"

# Run tests with specific tag
npx playwright test --grep @smoke

# Exclude tests
npx playwright test --grep-invert @slow
```

---

## 10. Common Commands Reference

### Development Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all dependencies |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:watch` | Compile and watch for changes |
| `npm run clean` | Delete compiled files |
| `npm run lint` | Check code for issues |
| `npm run lint:fix` | Fix code issues automatically |
| `npm run format` | Format code with Prettier |

### Test Commands

| Command | Description |
|---------|-------------|
| `npx playwright test` | Run all tests |
| `npx playwright test --ui` | Open interactive UI |
| `npx playwright test --headed` | Run with visible browser |
| `npx playwright test --debug` | Run in debug mode |
| `npx playwright show-report` | View HTML report |
| `npx playwright codegen` | Record and generate test code |

### Publishing Commands

| Command | Description |
|---------|-------------|
| `npm run version:patch` | Bump patch version (1.0.0 → 1.0.1) |
| `npm run version:minor` | Bump minor version (1.0.0 → 1.1.0) |
| `npm run version:major` | Bump major version (1.0.0 → 2.0.0) |
| `npm run gcp:publish` | Publish to GCP Artifact Registry |
| `npm run release:patch` | Version bump + publish |

### Utility Commands

| Command | Description |
|---------|-------------|
| `npm run reinstall:build:link` | Fresh install, build, and link |
| `npx playwright install` | Install browser engines |
| `npx playwright install chromium` | Install only Chromium |

---

## 11. Troubleshooting

### Common Issues and Solutions

#### ❌ "Cannot find module" error

**Cause:** Dependencies not installed or build not run.

**Solution:**
```bash
npm install
npm run build
```

#### ❌ "Browser not found" error

**Cause:** Playwright browsers not installed.

**Solution:**
```bash
npx playwright install
```

#### ❌ "Timeout exceeded" error

**Cause:** Element not found or page too slow.

**Solutions:**
1. Increase timeout in `.env`:
   ```ini
   ELEMENT_VISIBLE_TIMEOUT=15000
   PAGE_LOAD_TIMEOUT=120000
   ```
2. Check if element locator is correct
3. Add explicit wait before the action

#### ❌ "Element not visible" error

**Cause:** Element exists but not visible on screen.

**Solutions:**
1. Add scroll action before interacting
2. Wait for element to be visible
3. Check if element is in an iframe

#### ❌ "Strict mode violation" error

**Cause:** Multiple elements match the locator.

**Solution:** Make locator more specific:
```typescript
// Too generic - matches multiple
"Submit Button": ["button"]

// More specific - matches one
"Submit Button": ["button[data-testid='submit-form']"]
```

#### ❌ Tests pass locally but fail in CI

**Causes & Solutions:**
1. **Timing issues** — Increase timeouts
2. **Different screen size** — Set viewport explicitly
3. **Missing environment variables** — Check CI configuration
4. **Missing browsers** — Add `npx playwright install` to CI

#### ❌ "EACCES permission denied" on npm install

**Solution (macOS/Linux):**
```bash
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### Debug Tips

1. **Run single test:** Focus on one test at a time
   ```bash
   npx playwright test -g "test name" --headed --debug
   ```

2. **Add screenshots:** Capture page state
   ```typescript
   await page.screenshot({ path: 'debug.png' });
   ```

3. **Check logs:** Look at the logs folder for details
   ```bash
   cat logs/playwright-*.log
   ```

4. **Trace viewer:** Record and analyze test execution
   ```bash
   npx playwright test --trace on
   npx playwright show-trace trace.zip
   ```

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Action** | A single operation like click, type, or navigate |
| **Assertion** | A check that verifies expected behavior |
| **Browser Context** | Isolated browser session (like incognito) |
| **CI/CD** | Continuous Integration/Deployment - automated testing pipeline |
| **Element** | Any part of a webpage (button, input, text, etc.) |
| **Fixture** | Setup/teardown code that runs before/after tests |
| **Headless** | Running browser without visible UI |
| **Headed** | Running browser with visible UI |
| **Iteration** | One execution of a test with specific data |
| **Locator** | Expression to find elements (CSS selector, XPath, etc.) |
| **Page Object** | Pattern for organizing element locators |
| **Parallel** | Running multiple tests at the same time |
| **Retry** | Automatically re-running a failed step |
| **Selector** | Another term for locator |
| **Serial** | Running tests one after another |
| **Snapshot** | Captured state of page for comparison |
| **Step** | Single action in a test case |
| **Test Case** | Collection of steps that verify a feature |
| **Test Suite** | Collection of related test cases |
| **Timeout** | Maximum time to wait for an operation |
| **TypeScript** | Programming language used (extends JavaScript) |
| **Worker** | Parallel process that runs tests |

---

## 📞 Getting Help

1. **Check the docs folder** for detailed guides on specific topics
2. **Read error messages carefully** — they often contain the solution
3. **Search existing issues** in the repository
4. **Run in debug mode** to step through problems
5. **Ask the team** with specific error messages and context

---

**Happy Testing! 🎭**
