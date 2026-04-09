# Retry & Recovery Mechanism Guide

This guide explains the step-level retry and recovery mechanism built into the automation framework. It provides automatic retry for flaky element interactions with screenshot capture and conditional recovery actions.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Execution Flow](#2-execution-flow)
3. [Key Components](#3-key-components)
4. [Configuration](#4-configuration)
5. [Error Classification](#5-error-classification)
6. [Recovery Actions](#6-recovery-actions)
7. [Usage Examples](#7-usage-examples)
8. [Disabling Retry](#8-disabling-retry)
9. [Best Practices](#9-best-practices)

---

## 1. Overview

The retry mechanism provides:

| Feature                   | Description                                              |
| ------------------------- | -------------------------------------------------------- |
| **Step-level retry**      | Retries individual steps without failing the entire test |
| **Screenshot on failure** | Captures evidence before each retry attempt              |
| **Exponential backoff**   | Increasing delays between retries (1s → 2s → 4s...)      |
| **Smart recovery**        | Auto-selects recovery strategy based on error type       |
| **Conditional recovery**  | Dismiss dialogs, wait for stability, clear overlays      |
| **Error classification**  | Distinguishes retryable vs non-retryable errors          |

---

## 2. Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    StepExecutor.executeStep()                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Parse step (StepParser.parse)                               │
│  2. Replace ${variables} (StepParser.replaceParameters)         │
│  3. Resolve {{placeholders}} (runtimeDataResolver)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              RetryHandler.executeWithRetry()                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Attempt 1: Execute step action                           │  │
│  │    ├─ SUCCESS → Return result ✅                          │  │
│  │    └─ FAILURE → Check if retryable error                  │  │
│  │         ├─ Non-retryable (assertion) → Fail immediately ❌│  │
│  │         └─ Retryable (timeout, stale) → Continue ↓        │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  📸 Capture screenshot before retry                       │  │
│  │  🔧 Execute recovery action (dismiss dialogs, wait, etc.) │  │
│  │  ⏱️ Wait with exponential backoff (1s → 2s → 4s...)       │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  Attempt 2: Retry step action                             │  │
│  │    ├─ SUCCESS → Return result ✅                          │  │
│  │    └─ FAILURE → Continue to next attempt...               │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  Attempt 3 (max): Final retry                             │  │
│  │    ├─ SUCCESS → Return result ✅                          │  │
│  │    └─ FAILURE → Throw error ❌                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Breakdown

1. **Step Parsing**: The raw step is parsed and validated
2. **Variable Replacement**: `${Email Address}` → `supervisor@gmail.com`
3. **Placeholder Resolution**: `{{today}}` → `2025-12-12`
4. **Retry Wrapper**: Step execution wrapped in retry logic
5. **Error Check**: Determines if error is retryable
6. **Screenshot**: Captures evidence before retry
7. **Recovery**: Executes recovery actions (dismiss dialogs, wait)
8. **Backoff**: Waits with increasing delay
9. **Retry**: Re-executes the step
10. **Final Result**: Success or throw error after all attempts

---

## 3. Key Components

| Component         | File                                        | Purpose                                     |
| ----------------- | ------------------------------------------- | ------------------------------------------- |
| `RetryHandler`    | `src/recovery/RetryHandler.ts`    | Core retry logic with configurable attempts |
| `RecoveryActions` | `src/recovery/RecoveryActions.ts` | Recovery strategies between retries         |
| `StepExecutor`    | `src/steps/StepExecutor.ts`       | Integrates retry into step execution        |
| `TIMEOUTS`        | `config/timeouts.config.ts`                 | Retry configuration values                  |

### RetryHandler

The `RetryHandler` class provides:

```typescript
import { RetryHandler } from '../recovery/RetryHandler';

const retryHandler = new RetryHandler(page, {
  maxRetries: 2, // Number of retry attempts
  retryDelay: 1000, // Base delay between retries (ms)
  exponentialBackoff: true, // Enable exponential backoff
  backoffMultiplier: 2, // Delay multiplier (1s → 2s → 4s)
  maxDelay: 10000, // Maximum delay cap (ms)
  screenshotOnRetry: true, // Capture screenshot before retry
  testCaseKey: 'TC-123', // For screenshot naming
});
```

### RecoveryActions

The `RecoveryActions` class provides recovery strategies:

```typescript
import { RecoveryActions } from '../recovery/RecoveryActions';

const recovery = new RecoveryActions(page);

// Available recovery methods
await recovery.dismissDialogs(); // Dismiss alert/confirm/prompt
await recovery.waitForStability(); // Wait for network idle
await recovery.scrollToElement(locator); // Scroll into view
await recovery.clearOverlays(); // Hide blocking modals
await recovery.pressEscape(); // Close dropdowns/popovers
await recovery.clickAway(); // Click elsewhere to deselect
await recovery.focusPage(); // Bring page to front
await recovery.refreshPage(); // Reload page (use sparingly)
```

---

## 4. Configuration

### Timeout Configuration

Located in `config/timeouts.config.ts`:

```typescript
export const TIMEOUTS = {
  // ... other timeouts ...

  // RETRY CONFIGURATION
  retryMaxAttempts: 2, // Default: 2 retries (3 total attempts)
  retryDelay: 1000, // Default: 1000ms between retries
  retryMaxDelay: 10000, // Default: 10000ms max delay with backoff
  recoveryDelay: 500, // Default: 500ms before recovery action
};
```

### Environment Variable Overrides

Override defaults via environment variables for CI/CD flexibility:

```bash
# Override retry settings
RETRY_MAX_ATTEMPTS=3       # Max retry attempts
RETRY_DELAY=2000           # Base delay between retries (ms)
RETRY_MAX_DELAY=15000      # Max delay cap (ms)
RECOVERY_DELAY=1000        # Delay before recovery action (ms)
```

### Example CI/CD Configuration

```yaml
# .gitlab-ci.yml
test:
  script:
    - RETRY_MAX_ATTEMPTS=3 RETRY_DELAY=2000 npx playwright test
```

---

## 5. Error Classification

The retry mechanism classifies errors to determine if retry should occur.

### Retryable Errors (Will Retry)

These errors are often transient and may succeed on retry:

| Error Pattern                        | Cause                          |
| ------------------------------------ | ------------------------------ |
| `element is not attached`            | DOM changed during interaction |
| `element was detached`               | Element removed from DOM       |
| `element is not visible`             | Element hidden or loading      |
| `element is not stable`              | Element animating              |
| `element is outside of the viewport` | Need to scroll                 |
| `waiting for selector`               | Element not found yet          |
| `timeout` / `TimeoutError`           | Operation took too long        |
| `net::ERR_CONNECTION`                | Network connectivity issue     |
| `net::ERR_TIMED_OUT`                 | Network timeout                |
| `execution context was destroyed`    | Page navigated away            |
| `frame was detached`                 | iframe removed                 |
| `strict mode violation`              | Multiple elements matched      |

### Non-Retryable Errors (Fail Immediately)

These errors indicate real test failures that won't succeed on retry:

| Error Pattern                  | Cause                       |
| ------------------------------ | --------------------------- |
| `assertion failed`             | Test expectation not met    |
| `expect(` / `toBe` / `toEqual` | Playwright assertion failed |
| `Authentication failed`        | Invalid credentials         |
| `403 Forbidden`                | Access denied               |
| `401 Unauthorized`             | Not authenticated           |
| `Invalid JSON` / `SyntaxError` | Malformed data              |
| `Permission denied`            | Insufficient permissions    |

---

## 6. Recovery Actions

Recovery actions are executed between retry attempts to increase success chances.

### Available Recovery Strategies

| Recovery           | When Used                  | What It Does                       |
| ------------------ | -------------------------- | ---------------------------------- |
| `dismissDialogs`   | Alert/confirm blocking     | Auto-dismiss native dialogs        |
| `waitForStability` | Page loading/transitioning | Wait for network idle + animations |
| `scrollToElement`  | Element not in viewport    | Scroll element into view           |
| `clearOverlays`    | Modal/overlay blocking     | Hide blocking overlay elements     |
| `pressEscape`      | Dropdown/popover open      | Send Escape key to close           |
| `clickAway`        | Element has focus          | Click elsewhere to deselect        |
| `focusPage`        | Page lost focus            | Bring page to front                |
| `refreshPage`      | Stale DOM                  | Reload page (last resort)          |

### Smart Recovery

The `smartRecovery` method automatically selects the best strategy based on error:

```typescript
// Automatically picks recovery based on error message
await recovery.smartRecovery(error, targetLocator);
```

### Recovery Chains

Pre-configured recovery chains for common scenarios:

```typescript
import { createRecoveryChain } from '../recovery/RecoveryActions';

const chain = createRecoveryChain(page);

// Basic recovery (default for step retry)
await chain.basic(); // dismissDialogs + waitForStability

// Aggressive recovery for stubborn elements
await chain.aggressive(); // pressEscape + clearOverlays + waitForStability + dismissDialogs

// Recovery for overlay issues
await chain.overlay(); // pressEscape + clearOverlays + clickAway

// Recovery for visibility issues
await chain.visibility(locator); // focusPage + scrollToElement + waitForStability
```

---

## 7. Usage Examples

### Default Behavior (Automatic)

By default, all steps executed via `StepExecutor` have retry enabled:

```typescript
const executor = new StepExecutor(page, {
  enableRetry: true, // Default: true
  testCaseKey: 'APS-123', // For screenshot naming
  iteration: 1, // Current iteration number
});

// This step will automatically retry on failure
await executor.executeStep(step, iterationData);
```

### Custom Retry Configuration

Override retry settings for specific steps:

```typescript
await executor.executeStep(step, iterationData, {
  maxRetries: 5, // More retries for flaky element
  retryDelay: 500, // Faster retry
  exponentialBackoff: false, // Fixed delay
});
```

### Direct RetryHandler Usage

Use `RetryHandler` directly for custom retry logic:

```typescript
import { RetryHandler } from '../recovery/RetryHandler';

const retryHandler = new RetryHandler(page, {
  maxRetries: 3,
  screenshotOnRetry: true,
  testCaseKey: 'TC-456',
});

const result = await retryHandler.executeWithRetry(async () => {
  await page.locator('#submit').click();
  return 'clicked';
}, 'Click Submit Button');

if (result.success) {
  console.log(`Succeeded after ${result.attempts} attempt(s)`);
} else {
  console.log(`Failed: ${result.error?.message}`);
  console.log(`Screenshots: ${result.screenshots.length}`);
}
```

### Factory Methods

Use pre-configured retry handlers:

```typescript
import { createRetryHandler } from '../recovery/RetryHandler';

// Standard retry (2 retries, 1s delay, exponential backoff)
const standard = createRetryHandler.standard(page, 'TC-123');

// Aggressive retry (4 retries, 500ms delay, 1.5x backoff)
const aggressive = createRetryHandler.aggressive(page, 'TC-123');

// Minimal retry (1 retry, 500ms delay, no backoff)
const minimal = createRetryHandler.minimal(page, 'TC-123');

// No retry (just screenshot on failure)
const noRetry = createRetryHandler.noRetry(page, 'TC-123');
```

---

## 8. Disabling Retry

### Disable for Entire Test

```typescript
const executor = new StepExecutor(page, {
  enableRetry: false, // Disable retry for all steps
});
```

### Disable for Single Step

```typescript
// Use executeStepWithoutRetry for specific step
await executor.executeStepWithoutRetry(step, iterationData);
```

### Disable via Configuration

```typescript
await executor.executeStep(step, iterationData, {
  maxRetries: 0, // No retries
});
```

---

## 9. Best Practices

### When to Use Retry

✅ **Good candidates for retry:**

- Click actions (elements may still be loading)
- Form inputs (focus issues)
- Navigation (network latency)
- Dropdown selections (animation delays)
- File uploads (network variability)

❌ **Not recommended for retry:**

- Assertions/verifications (if it fails, it's a real failure)
- Data validation steps
- API response checks
- Authentication with wrong credentials

### Optimizing Retry Settings

```typescript
// For fast-loading pages
{ maxRetries: 1, retryDelay: 500 }

// For slow/heavy pages
{ maxRetries: 3, retryDelay: 2000 }

// For flaky third-party integrations
{ maxRetries: 4, retryDelay: 1000, exponentialBackoff: true }
```

### Debugging Retry Issues

1. **Check logs** for retry attempts:

   ```
   [RetryHandler] ❌ Attempt 1/3 failed for "Click Submit": timeout
   [RetryHandler] 📸 Screenshot captured: TC-123_retry1_Click_Submit.png
   [RecoveryActions] Waiting for page stability...
   [RetryHandler] Waiting 2000ms before retry 2...
   ```

2. **Review screenshots** in `test-results/screenshots/`

3. **Analyze error patterns** to adjust recovery strategies

### Performance Considerations

- Exponential backoff prevents hammering the application
- Screenshot capture adds ~100-200ms per retry
- Recovery actions add ~500-1000ms per retry
- Consider reducing retries in CI for faster feedback

---

## Related Documentation

- [TestCase-Guideline.md](./TestCase-Guideline.md) - Test case authoring guide
- [API-Test-Design-Guide.md](./API-Test-Design-Guide.md) - API testing guide
- [CI-CD-Setup-Guide.md](./CI-CD-Setup-Guide.md) - CI/CD configuration
