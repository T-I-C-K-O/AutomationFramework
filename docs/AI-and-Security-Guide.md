# AI Features & Security Configuration

## Table of Contents

1. [Overview](#overview)
2. [AI Features](#ai-features)
   - [AI-Powered Failure Analysis](#1-ai-powered-failure-analysis)
   - [Self-Healing Locators](#2-self-healing-locators)
   - [Google Chat Notifications](#3-google-chat-notifications-with-ai-insights)
3. [Security Features](#security-features)
   - [Origin Validation](#1-origin-validation)
   - [MCP Security Configuration](#2-mcp-security-configuration)
4. [Configuration](#configuration)
5. [Architecture](#architecture)
6. [Usage Examples](#usage-examples)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This document covers the AI-powered features and security configurations in the automation framework. The framework integrates with Playwright MCP (Model Context Protocol) to provide intelligent test analysis, self-healing capabilities, and strict security enforcement.

### Key Components

| Component         | Location                                    | Purpose                         |
| ----------------- | ------------------------------------------- | ------------------------------- |
| `AIService`       | `src/ai/aiService.ts`             | High-level AI capabilities      |
| `McpClient`       | `src/ai/mcpClient.ts`             | MCP server communication        |
| `OriginValidator` | `src/security/OriginValidator.ts` | Navigation security             |
| `GlobalTeardown`  | `config/hooks/global.teardown.ts`           | AI failure analysis integration |

---

## AI Features

### 1. AI-Powered Failure Analysis

Automatically analyzes test failures and provides intelligent categorization with actionable recommendations.

#### Categories

| Category              | Detection Pattern                   | Example Recommendation                    |
| --------------------- | ----------------------------------- | ----------------------------------------- |
| **Timeout**           | `timeout`, `exceeded`               | Increase timeout or check network latency |
| **Locator Failure**   | `all locators`, `strategies failed` | Update locators in page objects           |
| **Browser Closed**    | `target page`, `context closed`     | Check for unexpected navigation           |
| **Data Dependency**   | `no stored value`, `variable`       | Ensure 'ProductId' is stored before use   |
| **Element Not Found** | `element not found`, `no element`   | Verify element exists in current UI       |
| **Assertion Failure** | `expect`, `assertion`               | Review expected values                    |
| **Network Error**     | `ECONNREFUSED`, `network`           | Check API availability                    |
| **Authentication**    | `401`, `403`, `unauthorized`        | Verify credentials                        |

#### How It Works

```
Test Failure
    ↓
Extract Error from JUnit XML / Allure Results
    ↓
Categorize Failure (pattern matching)
    ↓
Get Page Snapshot via MCP
    ↓
Analyze Console Errors & Network Requests
    ↓
Generate Smart Recommendations
    ↓
Send Google Chat Notification
```

#### Variable Extraction

The AI extracts specific variable names from error messages:

- Error: `No stored value found for variable 'ProductId'`
- Recommendation: `Ensure 'ProductId' is stored before use`

### 2. Self-Healing Locators

Automatically attempts to find elements when locators fail by using page snapshots.

#### How It Works

```typescript
// When a locator fails:
const healed = await aiService.healLocator(
  'login_button', // Locator key
  '#old-login-btn', // Original failing selector
  'Login submit button' // Description
);

if (healed) {
  // Use healed.healedRef to click
  await mcpClient.click({ element: 'Login button', ref: healed.healedRef });
}
```

#### Healing Strategy

1. Get page accessibility snapshot via MCP
2. Search for element by:
   - Locator key name (`login_button` → "login button")
   - Element description
   - ID/data-testid from original selector
3. Return reference from snapshot if found

### 3. Google Chat Notifications with AI Insights

Sends test run summaries with AI-powered analysis to Google Chat.

#### Notification Format

```
🎭 Playwright Test Run Completed 🧠 AI-Powered

📊 Project: Automation Framework

❌ Results Summary
   • Total: 3
   • Passed: 1 ✅
   • Failed: 2 ❌
   • Skipped: 0 ⏭️

🤖 AI-Powered Failure Analysis
   • Locator Failure: 1 failure(s)
   • Data Dependency: 1 failure(s)

💡 AI Recommendations:
   • Update locators in page objects
   • Ensure 'ProductId' is stored before use

⏱️ Duration: 0.50 minutes
```

#### Configuration

```env
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/...
ENABLE_AI_FEATURES=true
```

---

## Security Features

### 1. Origin Validation

**Purpose:** Prevents tests from navigating to unauthorized URLs.

#### Why It Matters

- ✅ Prevents accidental testing on production
- ✅ Enforces organizational security policies
- ✅ Protects against malicious test data injection
- ✅ Provides fail-fast behavior with clear errors
- ✅ Centralizes domain whitelisting

#### How It Works

```
page.goto(url)
    ↓
validateNavigationOrigin(url)
    ↓
Extract origin from URL
    ↓
Check against MCP_ALLOWED_ORIGINS
    ↓
✓ Allowed → Continue navigation
✗ Blocked → Throw OriginSecurityError
```

#### Security Error Example

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         🔒 SECURITY VIOLATION                                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Navigation blocked to unauthorized origin                                    ║
║                                                                              ║
║  Attempted URL: https://unauthorized-site.com/page                           ║
║                                                                              ║
║  Allowed Origins:                                                            ║
║    • https://srv-cbe-nport7.dmz.com                                          ║
║    • https://portal.eparts.shop                                              ║
║                                                                              ║
║  Resolution:                                                                 ║
║    1. Add the origin to MCP_ALLOWED_ORIGINS in your .env file               ║
║    2. Or update your test to use an allowed URL                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### Integration Points

The origin validation is enforced at all navigation points:

| File                         | Handler                          |
| ---------------------------- | -------------------------------- |
| `GotoActionHandler.ts`       | Excel step actions: `Goto HOYER` |
| `CustomGotoActionHandler.ts` | Custom navigation with cookies   |
| `StepExecutor.ts`            | JSON-style goto actions          |
| `LoginPage.ts`               | Direct page object navigation    |

### 2. MCP Security Configuration

The MCP server is configured with strict security restrictions:

#### Transport Security (`stdio`)

- ✅ No TCP ports opened
- ✅ No network socket exposed
- ✅ Process-to-process communication only

#### Allowed Hosts (`--allowed-hosts`)

- ✅ Restricts network connections
- ✅ Default: `localhost` only
- ✅ Prevents external scanning

#### Allowed Origins (`--allowed-origins`)

- ✅ Restricts automatable origins
- ✅ Prevents use as generic browser
- ✅ Blocks data exfiltration

---

## Configuration

### Environment Variables

| Variable                  | Required | Default     | Description                     |
| ------------------------- | -------- | ----------- | ------------------------------- |
| `ENABLE_AI_FEATURES`      | Yes      | `false`     | Master toggle for AI features   |
| `MCP_ALLOWED_ORIGINS`     | Yes\*    | -           | Comma-separated allowed domains |
| `MCP_ALLOWED_HOSTS`       | No       | `localhost` | Network host restrictions       |
| `MCP_DEBUG`               | No       | `false`     | Enable debug logging            |
| `GOOGLE_CHAT_WEBHOOK_URL` | No       | -           | Notification webhook            |

\*Required when `ENABLE_AI_FEATURES=true`

### Example `.env` Configuration

```env
# ============================================================================
# AI Features - Playwright MCP Configuration
# ============================================================================

# Enable AI-powered features (self-healing, failure analysis, etc.)
ENABLE_AI_FEATURES=true

# Debug mode for MCP (shows available tools)
MCP_DEBUG=false

# REQUIRED: Allowed origins for browser automation (comma-separated)
# Security: Only these origins can be accessed
MCP_ALLOWED_ORIGINS=https://omega-tst.hoyer-group.com,https://srv-cbe-nport7.dmz.com,https://portal.eparts.shop

# Allowed hosts for network connections
MCP_ALLOWED_HOSTS=localhost

# Google Chat webhook for notifications
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/xxx/messages?key=xxx
```

---

## Architecture

### Module Structure

```
src/
├── ai/
│   ├── index.ts           # Module exports
│   ├── aiService.ts       # High-level AI service
│   └── mcpClient.ts       # MCP server client
│
├── security/
│   ├── index.ts           # Security exports
│   └── OriginValidator.ts # URL validation
│
config/
├── hooks/
│   ├── global.setup.ts    # AI initialization
│   └── global.teardown.ts # Failure analysis & notifications
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GLOBAL SETUP                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Load .env configuration                                                  │
│  2. Check ENABLE_AI_FEATURES                                                 │
│  3. Initialize AIService                                                     │
│  4. Connect to Playwright MCP server (with security restrictions)            │
│  5. Validate MCP_ALLOWED_ORIGINS configured                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TEST EXECUTION                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  For each navigation (Goto, Navigate, Login):                                │
│    1. Extract URL from PROPERTIES                                            │
│    2. validateNavigationOrigin(url)                                          │
│       → If blocked: Throw OriginSecurityError                                │
│       → If allowed: Continue navigation                                      │
│    3. Execute test steps                                                     │
│    4. On locator failure: Attempt self-healing                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GLOBAL TEARDOWN                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Collect test results (JUnit XML / Allure / Playwright HTML)              │
│  2. For each failure:                                                        │
│     a. Extract error message                                                 │
│     b. Categorize failure (Timeout, Locator, Data Dependency, etc.)          │
│     c. Get page snapshot, console errors, network requests via MCP           │
│     d. Generate smart recommendations                                        │
│  3. Build notification message with AI insights                              │
│  4. Send to Google Chat                                                      │
│  5. Disconnect from MCP server                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Usage Examples

### Programmatic AI Service Usage

```typescript
import { aiService, getAIService } from '../src/ai';

// Initialize
const service = await getAIService();
await service.initialize();

// Analyze failure
const analysis = await service.analyzeFailure('Test failed: timeout');
console.log(analysis.summary);
console.log(analysis.suggestedFixes);

// Self-healing
const healed = await service.healLocator('btn_login', '#old-selector', 'Login button');
if (healed) {
  console.log('Healed to:', healed.healedRef);
}

// Cleanup
await service.shutdown();
```

### Origin Validation Usage

```typescript
import { validateNavigationOrigin, isNavigationAllowed } from '../src/security';

// Check before navigation
if (isNavigationAllowed(url)) {
  await page.goto(url);
} else {
  console.log('URL not allowed:', url);
}

// Or let it throw
try {
  validateNavigationOrigin(url);
  await page.goto(url);
} catch (error) {
  if (error instanceof OriginSecurityError) {
    console.log('Blocked:', error.attemptedUrl);
    console.log('Allowed:', error.allowedOrigins);
  }
}
```

### Custom Teardown with AI

```typescript
// utils/customHooks/custom.teardown.ts
import { GlobalTeardown } from '../../config/hooks/global.teardown';

export class CustomGlobalTeardown extends GlobalTeardown {
  async onTeardown(): Promise<void> {
    logger.info('[CustomTeardown] Running custom teardown logic...');
    // Custom logic here
    await super.onTeardown();
  }

  getProjectName(): string {
    return 'My Custom Project';
  }
}

export default CustomGlobalTeardown;
```

---

## Troubleshooting

### Error: "MCP_ALLOWED_ORIGINS must be configured"

```
[MCP] Security Error: MCP_ALLOWED_ORIGINS must be configured.
```

**Solution:** Add `MCP_ALLOWED_ORIGINS` to your `.env` file:

```env
MCP_ALLOWED_ORIGINS=https://your-app.com
```

### Error: "🔒 SECURITY VIOLATION - Navigation blocked"

The URL you're trying to navigate to is not in the allowed origins list.

**Solutions:**

1. Add the origin to `MCP_ALLOWED_ORIGINS`:
   ```env
   MCP_ALLOWED_ORIGINS=https://existing.com,https://new-origin.com
   ```
2. Or update your test to use an allowed URL

### AI Features Not Working

1. Check `ENABLE_AI_FEATURES=true` in `.env`
2. Verify MCP server starts: look for `[MCP] ✓ Connected` in logs
3. Enable debug: `MCP_DEBUG=true`

### Notifications Not Sending

1. Verify `GOOGLE_CHAT_WEBHOOK_URL` is set
2. Check webhook URL is valid (test in browser)
3. Check for network/firewall issues

### Self-Healing Not Finding Elements

1. Element might not be in accessibility tree
2. Try more descriptive element names
3. Check page snapshot for available refs: `MCP_DEBUG=true`

---

## Security Compliance

This configuration adheres to:

| Principle                 | Implementation                              |
| ------------------------- | ------------------------------------------- |
| **Least-Privilege**       | Server limited to minimum required access   |
| **Defense in Depth**      | Multiple layers (transport, hosts, origins) |
| **Zero Network Exposure** | No listening ports                          |
| **Fail-Fast**             | Clear errors on security violations         |
| **Audit Trail**           | Logging of all validations                  |

---

## References

- [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol)
- [@playwright/mcp](https://www.npmjs.com/package/@playwright/mcp)
- [Playwright Documentation](https://playwright.dev)
