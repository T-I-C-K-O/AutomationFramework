# Automation Framework Test Case Guideline

---

| **Document Title** | Test Case Authoring Guidelines       |
| ------------------ | ------------------------------------ |
| **Version**        | Version 1.0.0                        |
| **Date**           | Dec 2, 2025                          |
| **Audience**       | Manual Testers, Automation Engineers |
| **Status**         | Published                            |
| **Author(s)**      | Automation WorkGroup                 |
| **Reviewer(s)**    | Automation WorkGroup                 |

---

## Table of Contents

1. [Introduction](#1-introduction)
   - [1.1 Purpose](#11-purpose)
   - [1.2 Key Concepts](#12-key-concepts)
2. [Quick Start Guide](#2-quick-start-guide)
   - [2.1 Your First Test Case](#21-your-first-test-case)
   - [2.2 Basic Rules](#22-basic-rules)
3. [Test Case Structure](#3-test-case-structure)
   - [3.1 Excel Template Structure](#31-excel-template-structure)
   - [3.2 Sheet Organization](#32-sheet-organization)
4. [Action Keywords Reference](#4-action-keywords-reference)
   - [4.1 Navigation Actions](#41-navigation-actions)
   - [4.2 Click Actions](#42-click-actions)
   - [4.3 Input Actions](#43-input-actions)
   - [4.4 Dropdown Actions](#44-dropdown-actions)
   - [4.5 Checkbox Actions](#45-checkbox-actions)
   - [4.6 Hover Actions](#46-hover-actions)
   - [4.7 Assertion Actions](#47-assertion-actions)
   - [4.8 Store Actions](#48-store-actions)
   - [4.9 Page Switch Actions](#49-page-switch-actions)
   - [4.10 Function Actions](#410-function-actions)
   - [4.11 API Actions](#411-api-actions)
   - [4.12 Validate Actions](#412-validate-actions)
   - [4.13 Wait Actions](#413-wait-actions)
   - [4.14 Alert Actions](#414-alert-actions)
   - [4.15 Scroll Actions](#415-scroll-actions)
   - [4.16 Drag and Drop Actions](#416-drag-and-drop-actions)
   - [4.17 Upload Actions](#417-upload-actions)
   - [4.18 Download Actions](#418-download-actions)
   - [4.19 IFrame Actions](#419-iframe-actions)
5. [Data Column Usage](#5-data-column-usage)
   - [5.1 Static Values](#51-static-values)
   - [5.2 Variable References](#52-variable-references)
   - [5.3 Environment Variables](#53-environment-variables)
   - [5.4 Special Data Formats](#54-special-data-formats)
   - [5.5 Dynamic Runtime Data Generation](#55-dynamic-runtime-data-generation)
6. [Expected Result Column](#6-expected-result-column)
   - [6.1 Assertion Results](#61-assertion-results)
   - [6.2 Popup/New Tab Registration](#62-popupnew-tab-registration)
   - [6.3 Descriptive Results](#63-descriptive-results)
7. [Working with Locators](#7-working-with-locators)
   - [7.1 Understanding Element Names](#71-understanding-element-names)
   - [7.2 Finding Element Names](#72-finding-element-names)
   - [7.3 Requesting New Locators](#73-requesting-new-locators)
   - [7.4 Locator Naming Best Practices](#74-locator-naming-best-practices)
8. [Advanced Features](#8-advanced-features)
   - [8.1 Multi-Tab Workflows](#81-multi-tab-workflows)
   - [8.2 Data-Driven Testing](#82-data-driven-testing)
   - [8.3 Conditional Workflows](#83-conditional-workflows)
   - [8.4 Storing and Reusing Values](#84-storing-and-reusing-values)
   - [8.5 Function Calls with Parameters](#85-function-calls-with-parameters)
9. [Environment Configuration](#9-environment-configuration)
   - [9.1 Overview](#91-overview-1)
   - [9.2 Environment Variable (ENV)](#92-environment-variable-env)
   - [9.3 Configuration Files](#93-configuration-files)
   - [9.4 Available Properties](#94-available-properties)
   - [9.5 Using Configuration in Tests](#95-using-configuration-in-tests)
10. [Running Excel Test Cases](#10-running-excel-test-cases)
    - [10.1 Overview](#101-overview)
    - [10.2 Environment Variables](#102-environment-variables)
    - [10.3 Run Mode Options](#103-run-mode-options)
    - [10.4 Command Examples](#104-command-examples)
    - [10.5 Execution Modes](#105-execution-modes)
    - [10.6 Data-Driven Iterations](#106-data-driven-iterations)
    - [10.7 Test Results](#107-test-results)
11. [Running X-Ray Test Cases](#11-running-x-ray-test-cases)
    - [11.1 Overview](#111-overview)
    - [11.2 Environment Variables](#112-environment-variables)
    - [11.3 Run Mode Options](#113-run-mode-options)
    - [11.4 Command Examples](#114-command-examples)
    - [11.5 Execution Modes](#115-execution-modes)
    - [11.6 Data-Driven Iterations](#116-data-driven-iterations)
    - [11.7 X-Ray Integration](#117-x-ray-integration)
12. [Common Patterns & Examples](#12-common-patterns--examples)
    - [12.1 Login Flow](#121-login-flow)
    - [12.2 Form Submission](#122-form-submission)
    - [12.3 Search and Verify](#123-search-and-verify)
    - [12.4 CRUD Operations](#124-crud-operations)
    - [12.5 Navigation Menu Flow](#125-navigation-menu-flow)
    - [12.6 Modal/Dialog Handling](#126-modaldialog-handling)
13. [Troubleshooting Guide](#13-troubleshooting-guide)
    - [13.1 Common Errors and Solutions](#131-common-errors-and-solutions)
    - [13.2 Debugging Tips](#132-debugging-tips)
    - [13.3 Getting Help](#133-getting-help)
14. [Best Practices](#14-best-practices)
    - [14.1 Test Case Design](#141-test-case-design)
    - [14.2 Step Writing](#142-step-writing)
    - [14.3 Assertion Strategy](#143-assertion-strategy)
    - [14.4 Maintainability Checklist](#144-maintainability-checklist)
15. [Appendix](#15-appendix)
    - [15.1 Action Keywords Quick Reference](#151-action-keywords-quick-reference)
    - [15.2 Assertion Keywords Quick Reference](#152-assertion-keywords-quick-reference)
    - [15.3 Variable Syntax](#153-variable-syntax)
    - [15.4 Excel Template](#154-excel-template)
    - [15.5 Sample Test Cases](#155-sample-test-cases)
    - [15.6 Change Log](#156-change-log)
16. [Document Version](#16-document-version)

---

## 1. Introduction

### 1.1 Purpose

This document provides comprehensive guidelines for writing test cases that can be executed by the Playwright Automation Framework. Whether you're a manual tester creating test cases or an automation engineer maintaining them, this guide will help you write effective, maintainable test scripts.

### 1.2 Key Concepts

| Concept             | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| **Action**          | What you want to do (click, enter, assert)                   |
| **Locator**         | The element name in single quotes (e.g., \`'Login Button'\`) |
| **Data**            | Input values or variables to use                             |
| **Expected Result** | What should happen after the action                          |

---

## 2. Quick Start Guide

### 2.1 Your First Test Case

Here's a simple login test case:

| Step | Action                   | Data                 | Expected Result         |
| ---- | ------------------------ | -------------------- | ----------------------- |
| 1    | Goto the 'Login Page'    |                      | Login page is displayed |
| 2    | Enter 'Email Address'    | testuser@example.com |                         |
| 3    | Enter 'Password'         | Password123!         |                         |
| 4    | Click 'Sign In'          |                      | Dashboard is displayed  |
| 5    | Assert 'Welcome Message' |                      | should be visible       |

### 2.2 Basic Rules

#### ✅ DO:

- Use single quotes around element names: \`'Element Name'\`
- Keep actions simple and readable
- One action per step
- Use descriptive element names that match with the application label or placeholder

#### ❌ DON'T:

- Use double quotes for element names
- Combine multiple actions in one step
- Use technical selectors directly in actions
- Leave required data fields empty

---

## 3. Test Case Structure

### 3.1 Excel Template Structure

Your test case Excel file should have these columns:

> 📋 **Sample template:** [TestCase Format & Guidelines](https://docs.google.com/spreadsheets/d/15t7QIW5LnMUA5YeFc7jdeQOgJpCGMhB_Cf2xMcvd_Vg/edit?gid=0#gid=0)

| Column              | Required    | Description                         |
| ------------------- | ----------- | ----------------------------------- |
| **Step**            | Yes         | Sequential step number (1, 2, 3...) |
| **Action**          | Yes         | The action to perform               |
| **Data**            | Conditional | Input data (when needed)            |
| **Expected Result** | Recommended | Expected outcome                    |

### 3.2 Sheet Organization

#### Test Management

- Store test cases in a central repository Excel
- Each Test Plan may include one or multiple Test Executions
- Organize executions as **parallel** or **serial/sequential**

##### Serial Execution Rules:

- Execution name **must start with "Serial"**
- If any test case fails, execution stops immediately (subsequent cases depend on the failed one)

##### Parallel Execution Rules:

- If execution name does **not** start with "Serial", the framework treats it as parallel
- Runs based on the number of assigned workers
- If a test case fails, execution continues with remaining test cases

##### Post-Execution:

- Update results (Pass/Fail status) back to Excel/CSV
- Upload detailed error messages for failed test cases

---

## 4. Action Keywords Reference

### 4.1 Navigation Actions

#### Goto / Navigate / Open / Login

Navigate to a URL or page.

**Supported Keywords:** `goto`, `navigate`, `open`, `login`

**Action Formats:**
\`\`\`
Goto the application LOGIN page
Navigate to the application LOGIN page
Open the LOGIN page
Goto the 'LOGIN' page
Login PORTAL
Goto HOYER as supervisor
\`\`\`

#### Authentication with `as` Syntax

The `as` keyword specifies which user's stored authentication (cookie/storage state) to use when navigating. The framework loads the auth file from `.auth/auth-<user>.json`.

| Action Format            | Auth File Used               | Description                            |
| ------------------------ | ---------------------------- | -------------------------------------- |
| `Goto HOYER`             | `.auth/auth-auth-admin.json` | Default auth-admin user                |
| `Goto HOYER as admin`    | `.auth/auth-admin.json`      | Navigate as admin user                 |
| `Login PORTAL as tester` | `.auth/auth-tester.json`     | Navigate as tester user                |

> **Note:**
>
> - Action starts with \`Goto\`, \`Navigate\`, \`Open\`, or \`Login\`; provide the constant in UPPERCASE
> - \`LOGIN\` is the constant stored in the configuration file
> - Page names map to URLs in the configuration
> - Quotation marks are optional, but the constant must be uppercase
> - The `login` keyword behaves identically to `goto` — it navigates to the URL with optional auth state
> - Auth storage state files must exist in the `.auth/` directory

---

### 4.2 Click Actions

The framework provides two click action handlers — **Click** (single) and **Double-click** — both powered by the core library's `ClickActionHandler` and `DoubleClickActionHandler`.

#### Click (Single Click)

Performs a single click on a UI element. The handler automatically:

1. Waits for the network to become idle (30 s timeout)
2. Waits for the element to become visible (30 s timeout)
3. Scrolls the element into view if needed
4. Clicks the element
5. Detects any new tabs/popups opened by the click

**Supported Keyword:** `click`

**Action Formats:**

| Action Format | Example |
| --- | --- |
| `Click '<Element>'` | Click 'Submit Button' |
| `Click '<Element>' on the login page` | Click 'Login Button' on the login page |
| `Click on '<Element>'` | Click on 'Submit' |

**Basic Click Examples:**

| Step | Action | Data | Expected Result |
| ---- | ------ | ---- | --------------- |
| 1 | Click 'Submit Button' | | |
| 2 | Click 'Login' | | |
| 3 | Click 'Menu Item' | | |
| 4 | Click 'Close Icon' | | |

#### Multiple Clicks (Sequential)

Click several elements in a single step by chaining element names with `and`. Each quoted element is clicked sequentially in the order it appears.

| Step | Action | Data | Expected Result |
| ---- | ------ | ---- | --------------- |
| 1 | Click 'Sign In' and 'Menu' | | |
| 2 | Click 'Accept' and 'Continue' and 'Done' | | |

> **Note:** All elements are clicked left-to-right. If any element fails, the step fails without clicking the remaining elements.

#### Click with New Tab / Popup Handling

When a click opens a new browser tab or popup window, the **Expected Result** column must contain the page key wrapped in quotes. The framework automatically detects the popup and registers it in the `PageContextManager` so you can switch to it later.

| Step | Action | Data | Expected Result |
| ---- | ------ | ---- | --------------- |
| 1 | Click 'Open New Window' | | 'New Window Page' |
| 2 | Click 'External Link' | | 'External Site' |
| 3 | Click 'View Details' | | 'Details Page' |

> **Important:**
>
> - The expected result **must include the page key in quotes** (e.g., `'Details Page'`) for popup registration
> - The new page is stored in `PageContextManager` with this key
> - Use **Switch Page** action to switch to the registered page in a subsequent step
> - If the click opens a popup but the expected result does not contain a quoted page key, the step will **fail**

#### Click with Expected Result Validation

When the **Expected Result** column contains quoted element names (and the click does **not** open a popup), the handler validates the presence and visibility of each referenced element after clicking.

| Step | Action | Data | Expected Result |
| ---- | ------ | ---- | --------------- |
| 1 | Click 'Save' | | 'Success Toast' |
| 2 | Click 'Submit' | | 'Confirmation Dialog' |

> The handler looks up each quoted name in `objectMap` and waits for it to become visible. If any element is not found or not visible, the step fails.

#### Double-Click

Performs a double-click on a UI element. Commonly used for editing table cells, selecting text, or activating edit modes. The handler shares the same auto-scroll, visibility wait, popup detection, and expected-result validation behaviour as the single-click handler.

**Supported Keywords:** `double-click`, `double click`, `doubleclick`

**Action Formats:**

| Action Format | Example |
| --- | --- |
| `Double-click '<Element>'` | Double-click 'Table Cell' |
| `Double click '<Element>' on the landing page` | Double click 'Row Item' on the landing page |
| `Double-click on '<Element>'` | Double-click on 'File Name' |
| `Doubleclick '<Element>'` | Doubleclick 'List Item' |

**Basic Double-Click Examples:**

| Step | Action | Data | Expected Result |
| ---- | ------ | ---- | --------------- |
| 1 | Double-click 'Table Cell' | | |
| 2 | Double click 'Editable Field' | | |
| 3 | Doubleclick 'File Name' | | |

**Double-Click with Popup:**

| Step | Action | Data | Expected Result |
| ---- | ------ | ---- | --------------- |
| 1 | Double-click 'Open New Window' | | 'New Window Page' |
| 2 | Double-click 'External Link' | | 'External Site' |

**Common Double-Click Use Cases:**

- Editing inline table cells
- Selecting text/words in text fields
- Opening files or folders
- Activating edit mode on form fields
- Expanding/collapsing tree nodes

#### Click Actions — Internal Behaviour Summary

| Feature | Click | Double-Click |
| --- | --- | --- |
| **Keyword** | `click` | `double-click`, `double click`, `doubleclick` |
| **Network wait** | Yes (30 s) | No |
| **Visibility wait** | Yes (30 s) | Yes (30 s) |
| **Auto-scroll** | Yes | Yes |
| **Multi-element (and)** | Yes | No |
| **Popup detection** | Yes | Yes |
| **Multi-locator fallback** | Yes (tries all objectMap locators) | Yes (tries all objectMap locators) |
| **Expected result validation** | Yes (validates element presence) | Yes (validates element presence) |
| **Error enrichment** | Yes (page URL, title, locator details) | Yes (page URL, title, locator details) |

> **Tip:** If you need a right-click or context-menu action, use the dedicated context-menu handlers — not these click actions.

---

### 4.3 Input Actions

#### Enter / Fill

Enter text into input fields using fill (instant value set).

**Supported Keywords:** `enter`, `fill`

**Execution Modes:**

| Mode             | Trigger (Expected Result) | Behavior                                   |
| ---------------- | ------------------------- | ------------------------------------------ |
| `validate`       | Contains success keywords | Enters value and verifies it was filled    |
| `readonly-check` | Contains blocked keywords | Verifies field rejects input (read-only)   |
| `normal`         | Empty or no match         | Enters value without validation            |

| Action Format       | Data        | Example                                   |
| ------------------- | ----------- | ----------------------------------------- |
| \`Enter '<Field>'\` | Value       | Enter 'Username' with data john.doe       |
| \`Fill '<Field>'\`  | JSON object | Fill 'Email' with data user@test.com      |

**Data Format Options:**

| Format              | Example                    | Description                    |
| ------------------- | -------------------------- | ------------------------------ |
| Single value        | `John`                     | Fills single field             |
| Comma-separated     | `John, Doe, 30`            | Fills multiple fields in order |
| Semicolon-separated | `John; Doe; 30`            | Alternative delimiter          |
| Pipe-separated      | `John \| Doe \| 30`       | Alternative delimiter          |
| Variable reference  | `{{variableName}}`         | Resolves stored variable       |

**Examples:**

| Step | Action                          | Data                                                             | Expected Result                             |
| ---- | ------------------------------- | ---------------------------------------------------------------- | ------------------------------------------- |
| 1    | Enter 'Email Address'           | user@example.com                                                 |                                             |
| 2    | Enter 'Password'                | SecurePass123!                                                   |                                             |
| 3    | Enter 'Comments'                | This is a test comment                                           |                                             |
| 4    | Enter 'Username' and 'Password' | \`{"username":"user@example.com", "Password":"SecurePass123!"}\` | It should enter the data without any issues |
| 5    | Enter 'First Name' and 'Last Name' | John, Doe                                                    |                                             |
| 6    | Enter 'Locked Field'            | test                                                             | Field should not be entered                 |

> **Note:** `enter` / `fill` uses Playwright's `fill()` method which instantly sets the value. For character-by-character typing (e.g., triggering key events, autocomplete), use `type` instead.

#### Type / EnterGrid

Type text character-by-character into input fields. Useful for fields that need keypress events (e.g., PrimeNG autocomplete, chips components).

**Supported Keywords:** `type`, `entergrid`

**Execution Modes:**

| Mode             | Trigger (Expected Result) | Behavior                                 |
| ---------------- | ------------------------- | ---------------------------------------- |
| `validate`       | Contains success keywords | Types value and verifies it was typed    |
| `readonly-check` | Contains blocked keywords | Verifies field rejects input (read-only) |
| `normal`         | Empty or no match         | Types value without validation           |

| Action Format             | Data           | Example                                          |
| ------------------------- | -------------- | ------------------------------------------------ |
| \`Type '<Field>'\`        | Value          | Type 'Search' with data playwright               |
| \`EnterGrid '<Field>'\`   | Value          | EnterGrid 'Cell Editor' with data 100            |

**Data Format Support:**

| Format          | Example              | Description                         |
| --------------- | -------------------- | ----------------------------------- |
| Single value    | `john.doe`           | Types same value to all fields      |
| Comma-separated | `John, Doe`          | Maps values to fields in order      |
| Quoted values   | `"a,b", "c,d"`       | Preserves commas within quotes      |
| Array           | `["val1", "val2"]`   | Maps array items to fields          |
| Store reference | `{{variableName}}`   | Uses stored value from storeManager |
| Random data     | `[random:email]`     | Generates random data               |

**Examples:**

| Step | Action                              | Data               | Expected Result                   |
| ---- | ----------------------------------- | ------------------ | --------------------------------- |
| 1    | Type 'Username'                     | john.doe           | Text typed into Username field    |
| 2    | Type 'First Name' and 'Last Name'  | John, Doe          | Values typed into respective fields |
| 3    | Type 'Min Temp' and 'Max Temp'     | "10,20", "30,40"   | Quoted values preserve commas     |
| 4    | Type 'Search'                       | [random:email]     | Random email generated and typed  |
| 5    | EnterGrid 'Row Cell'               | 150                | Value typed into grid cell        |

**`EnterGrid` Behavior:**
- Clicks on the grid cell element first (to activate edit mode)
- Then types the value character-by-character
- Useful for editable grid/table cells that require click-to-edit activation

> **Difference between Enter/Fill and Type:**
>
> | Feature          | Enter / Fill                    | Type / EnterGrid                    |
> | ---------------- | ------------------------------- | ----------------------------------- |
> | Method           | Playwright `fill()`             | Playwright `pressSequentially()`    |
> | Speed            | Instant (sets value at once)    | Character-by-character              |
> | Key events       | No individual keypress events   | Fires keydown/keypress/keyup        |
> | Best for         | Standard form fields            | Autocomplete, search, PrimeNG      |
> | Grid support     | No                              | Yes (`EnterGrid` clicks cell first) |

---

### 4.4 Dropdown Actions

#### Select / Choose / SelectGrid / SelectAndEnter

Select an option from a dropdown.

**Supported Keywords:** `select`, `choose`, `selectgrid`, `selectandenter`

**Execution Modes:**

| Mode             | Trigger (Expected Result) | Behavior                                   |
| ---------------- | ------------------------- | ------------------------------------------ |
| `validate`       | Contains success keywords | Selects and verifies selection             |
| `readonly-check` | Contains blocked keywords | Verifies dropdown rejects selection        |
| `normal`         | Empty or no match         | Selects value without validation           |

| Action Format                  | Data   | Example                                       |
| ------------------------------ | ------ | --------------------------------------------- |
| \`Select '<Dropdown>'\`        | Option | Select 'Country' with data United States      |
| \`Choose '<Dropdown>'\`        | Option | Choose 'Status' with data Active              |
| \`SelectGrid '<GridCell>'\`    | Option | SelectGrid 'Row Status' with data Approved    |
| \`SelectAndEnter '<Dropdown>'\`| Option | SelectAndEnter 'City' with data Austin        |

**Data Format Options:**

| Format              | Example                   | Description                    |
| ------------------- | ------------------------- | ------------------------------ |
| Single value        | `United States`           | Selects single option          |
| Comma-separated     | `JavaScript, React, Node` | Selects multiple options       |
| Semicolon-separated | `EN; FR; DE`              | Alternative delimiter          |
| Variable reference  | `{{countryName}}`         | Resolves stored variable       |

**Selection Strategies (Automatic Fallback):**

The handler automatically tries these strategies in order until one succeeds:

| # | Strategy                        | Description                                    |
| - | ------------------------------- | ---------------------------------------------- |
| 1 | Native HTML `<select>`          | Uses Playwright's `selectOption()` — fastest   |
| 2 | Static Dropdown                 | Clicks trigger, selects from visible list      |
| 3 | Click-Only Dropdown             | Overlay panels with item selection             |
| 4 | Autocomplete                    | Types value and selects from suggestions       |
| 5 | Multiselect (No Filter)         | Multiple selection without search              |
| 6 | Multiselect (With Filter)       | Multiple selection with search input           |
| 7 | Direct Autocomplete             | Types directly into field with suggestions     |
| 8 | Text-Based Fallback             | Last resort text matching                      |

**Examples:**

| Step | Action                         | Data              | Expected Result                |
| ---- | ------------------------------ | ----------------- | ------------------------------ |
| 1    | Select 'Country Dropdown'      | Australia         |                                |
| 2    | Choose 'Language'              | English           |                                |
| 3    | Select 'Skills'                | JavaScript, React | Multiple options selected      |
| 4    | SelectGrid 'Row Status'        | Approved          | Grid cell dropdown selected    |
| 5    | SelectAndEnter 'City'          | Austin            | Types then selects             |
| 6    | Select 'Locked Dropdown'       | Option A          | Dropdown should not be selected|
| 7    | Select 'User Role'             | {{selectedRole}}  |                                |

**Keyword Differences:**

| Keyword          | Behavior                                                    |
| ---------------- | ----------------------------------------------------------- |
| `select`/`choose`| Standard dropdown selection with all 8 strategies           |
| `selectgrid`     | Grid cell dropdown — clicks cell first to activate dropdown |
| `selectandenter` | Types value into dropdown field, then selects matching item |

---

### 4.5 Checkbox Actions

#### Check / Tick

Check a checkbox (make it selected).

**Supported Keywords:** `check`, `tick`

| Action Format              | Example                         |
| -------------------------- | ------------------------------- |
| \`Check '<Checkbox>'\`     | Check 'Remember Me'             |
| \`Check the '<Checkbox>'\` | Check the 'Terms Checkbox'      |
| \`Tick '<Checkbox>'\`      | Tick 'Terms and Conditions'     |

#### Uncheck / Untick

Uncheck a checkbox (deselect it).

**Supported Keywords:** `uncheck`, `untick`

| Action Format                | Example                           |
| ---------------------------- | --------------------------------- |
| \`Uncheck '<Checkbox>'\`     | Uncheck 'Newsletter Subscription' |
| \`Uncheck the '<Checkbox>'\` | Uncheck the 'Auto-save'          |
| \`Untick '<Checkbox>'\`      | Untick 'Accept Privacy Policy'    |

#### Execution Modes

| Mode            | Trigger (Expected Result)  | Behavior                                      |
| --------------- | -------------------------- | --------------------------------------------- |
| `validate`      | Contains success keywords  | Performs action and verifies checkbox state    |
| `blocked-check` | Contains blocked keywords  | Verifies checkbox is disabled (rejects action)|
| `normal`        | Empty or no match          | Performs action without validation             |

**Examples:**

| Step | Action                     | Data | Expected Result                    |
| ---- | -------------------------- | ---- | ---------------------------------- |
| 1    | Check 'Remember Me'        |      | Checkbox is checked                |
| 2    | Tick 'Terms and Conditions' |      | Checkbox is ticked                |
| 3    | Uncheck 'Marketing Emails' |      | Checkbox is unchecked              |
| 4    | Untick 'Accept Privacy'    |      | Privacy checkbox cleared           |
| 5    | Check 'Disabled Box'       |      | Checkbox should not be checked     |

> **Note:** Works with standard HTML checkboxes and PrimeNG/custom checkboxes (falls back to `click()` if native `check()`/`uncheck()` fails). Also works with radio buttons.

---

### 4.6 Hover Actions

#### Hover / Mouseover

Hover over an element to trigger hover effects.

| Action Format              | Example                       |
| -------------------------- | ----------------------------- |
| \`Hover '<Element>'\`      | Hover 'Profile Menu'          |
| \`Hover over '<Element>'\` | Hover over 'Dropdown Trigger' |
| \`Mouseover '<Element>'\`  | Mouseover 'Tooltip Icon'      |

**Examples:**

| Step | Action                | Data | Expected Result                     |
| ---- | --------------------- | ---- | ----------------------------------- |
| 1    | Hover 'User Menu'     |      | Dropdown menu appears               |
| 2    | Click 'Logout Option' |      | User should logged out successfully |

---

### 4.7 Assertion Actions

#### Assert / Verify / Check / Validate (without Data)

Verify element states and values. The framework uses a **combined ValidationAssertActionHandler** that routes based on the **Data** column:

- **Data is empty** → **Assertion mode** (element state checking — this section)
- **Data has a value** → **Validation mode** (content checking — see [§4.12 Validate Actions](#412-validate-actions))

**Supported Keywords:** `assert`, `verify`, `check`, `validate`

#### The `mandatory` Keyword

Add `mandatory` to the action to control failure behavior:

| Variant                             | On Failure                              |
| ----------------------------------- | --------------------------------------- |
| `Assert 'Element'`                  | Logs a **warning**, test **continues**  |
| `Assert mandatory 'Element'`        | Throws an **error**, test **fails**     |

| Action Format                    | Expected Result         | Description                              |
| -------------------------------- | ----------------------- | ---------------------------------------- |
| \`Assert '<Element>'\`           | should be visible       | Element is visible (soft — logs warning) |
| \`Assert mandatory '<Element>'\` | should be visible       | Element is visible (hard — fails test)   |
| \`Assert '<Element>'\`           | should not be visible   | Element is hidden                        |
| \`Assert '<Element>'\`           | should be enabled       | Element is enabled                       |
| \`Assert '<Element>'\`           | should be disabled      | Element is disabled                      |
| \`Assert '<Element>'\`           | should contain 'text'   | Contains specific text                   |
| \`Assert '<Element>'\`           | should have value 'xyz' | Has exact value                          |
| \`Assert '<Element>'\`           | should be checked       | Checkbox is checked                      |
| \`Assert '<Element>'\`           | should not be checked   | Checkbox is unchecked                    |
| \`Assert '<Element>'\`           | should be clickable     | Element is visible AND enabled           |
| \`Assert '<Element>'\`           | should not be clickable | Element is NOT clickable                 |

#### Complete Assertion Keywords

| Assertion Type | Keywords (any of these work)                      |
| -------------- | ------------------------------------------------- |
| Visibility     | visible, displayed, shown, present                |
| Hidden         | not visible, hidden, not displayed, invisible     |
| Enabled        | enabled, active                                   |
| Disabled       | disabled, inactive                                |
| Clickable      | clickable, interactive                            |
| Not Clickable  | unclickable, not clickable, non-interactive       |
| Contains       | contain, contains, include, includes              |
| Exact Value    | have value, has value, equal, equals              |
| Checked        | checked, selected, ticked                         |
| Unchecked      | not checked, unchecked, not selected, unticked    |

> **Note:** If the Expected Result doesn't match any keywords above, the framework **defaults to `visible`** with a warning log.

**Examples:**

| Step | Action                            | Data | Expected Result              |
| ---- | --------------------------------- | ---- | ---------------------------- |
| 1    | Assert 'Welcome Banner'           |      | should be visible            |
| 2    | Assert 'Error Message'            |      | should not be visible        |
| 3    | Assert 'Submit Button'            |      | should be enabled            |
| 4    | Assert 'Page Title'               |      | should contain 'Dashboard'   |
| 5    | Assert 'Username Field'           |      | should have value 'john.doe' |
| 6    | Assert 'Remember Me'              |      | should be checked            |
| 7    | Assert 'Continue Button'          |      | clickable                    |
| 8    | Assert 'Loading Spinner'          |      | hidden                       |
| 9    | Assert mandatory 'Submit Button'  |      | should be visible            |
| 10   | Verify 'Terms Checkbox'           |      | ticked                       |
| 11   | Check 'Delete Button'             |      | non-interactive              |

---

### 4.8 Store Actions

#### Store / Save / Get

Extract and store element values for later use in subsequent test steps.

**Supported Keywords:** `store`, `save`, `get`

**Action Syntax — `as` keyword (required):**

The `as` keyword specifies the variable name to store the value into:

\`\`\`
Store '<Element>' as VariableName
Save '<Element>' as variableName
Get '<Element>' as refCode
Store the '<Element>' as orderNum
Store value of '<Element>' as totalAmount
\`\`\`

The stored value can be referenced later using \`{{VariableName}}\`.

**Value Extraction by Element Type:**

| Element Type        | Extraction Method              |
| ------------------- | ------------------------------ |
| `input`             | Uses `inputValue()`            |
| `textarea`          | Uses `inputValue()`            |
| `select`            | Uses `inputValue()`            |
| Other (div, span…)  | Uses `textContent()` (trimmed) |

**Examples:**

| Step | Action                                | Data         | Expected Result                    |
| ---- | ------------------------------------- | ------------ | ---------------------------------- |
| 1    | Store 'Order ID' as orderId           |              | Value stored in orderId variable   |
| 2    | Save 'Customer Name' as custName      |              | Value stored in custName variable  |
| 3    | Get 'Reference Code' as refCode       |              | Value stored in refCode variable   |
| 4    | Click 'Search Icon'                   |              |                                    |
| 5    | Enter 'Search Field'                  | {{orderId}}  |                                    |
| 6    | Assert 'Result Row'                   |              | should contain '{{custName}}'      |

> **Important:**
>
> - Variable names should be alphanumeric (no spaces)
> - The `as` keyword is **required** — the old syntax without `as` is not supported
> - Values are trimmed before storage
> - Stored values persist for the duration of the test case execution

---

### 4.9 Page Switch Actions

#### Switch / SwitchTo / SwitchPage

Switch between browser tabs/windows.

**Supported Keywords:** `switch`, `switchto`, `switch to`, `switch.to`, `switchpage`

| Action Format                  | Data | Example                 |
| ------------------------------ | ---- | ----------------------- |
| \`Switch to page '<PageKey>'\` |      | Switch to page 'NewTab' |
| \`Switch to tab '<PageKey>'\`  |      | Switch to tab 'popup_1' |
| \`Switch page '<PageKey>'\`    |      | Switch page 'parent'    |
| \`SwitchTo '<PageKey>'\`       |      | SwitchTo 'page_2'       |
| \`SwitchPage '<PageKey>'\`     |      | SwitchPage 'main'       |

#### Page Keys

| Key                      | Description                 |
| ------------------------ | --------------------------- |
| \`parent\`               | The original/main page      |
| \`popup_1\`, \`popup_2\` | Auto-generated popup keys   |
| Custom keys              | From Expected Result column |

**Examples:**

| Step | Action                        | Data | Expected Result         |
| ---- | ----------------------------- | ---- | ----------------------- |
| 1    | Click 'Open Settings'         |      | 'SettingsPage'          |
| 2    | Switch to page 'SettingsPage' |      | Settings page is active |
| 3    | Click 'Save'                  |      |                         |
| 4    | Switch to page 'parent'       |      | Back to main page       |

---

### 4.10 Function Actions

#### Function / Call / Invoke

Call custom page class methods.

| Action Format                  | Example                    |
| ------------------------------ | -------------------------- |
| \`Execute the login function\` | Execute the login function |
| \`Perform the login function\` | Perform the login function |
| \`Invoke the login function\`  | Invoke the login function  |

**Examples:**

| Step | Action                                 | Data                              | Expected Result |
| ---- | -------------------------------------- | --------------------------------- | --------------- |
| 1    | Execute the login with supervisor user | LoginPage.login(admin, Admin123!) | User logged in  |

---

### 4.11 API Actions

#### Trigger API / GET / POST / PUT / DELETE

Perform REST API requests directly from test cases.

| Action Format               | Example                 |
| --------------------------- | ----------------------- |
| \`Trigger API request\`     | Trigger API request     |
| \`GET the API data\`        | GET the API data        |
| \`POST to the API\`         | POST to the API         |
| \`PUT the API update\`      | PUT the API update      |
| \`DELETE the API resource\` | DELETE the API resource |

#### Data Format for API Actions

The Data column accepts a JSON object with the following properties:

| Property   | Type          | Required | Description                                         |
| ---------- | ------------- | -------- | --------------------------------------------------- |
| \`URL\`    | string        | Yes      | API endpoint URL (can use \`{{variable}}\`)         |
| \`Method\` | string        | Yes      | HTTP method: GET, POST, PUT, DELETE, PATCH          |
| \`Header\` | object        | No       | Request headers (e.g., Authorization, Content-Type) |
| \`Body\`   | object/string | No       | Request body for POST/PUT/PATCH                     |

#### Expected Result for API Actions

The Expected Result column can contain validation and storage instructions:

| Property           | Type   | Description                                     |
| ------------------ | ------ | ----------------------------------------------- |
| \`StatusCode\`     | number | Expected HTTP status code (e.g., 200, 201, 404) |
| \`ValidateFields\` | object | Field path → validation rule mapping            |
| \`StoreFields\`    | object | Field path → store key mapping                  |

#### Validation Rules

| Rule              | Description                      | Example                           |
| ----------------- | -------------------------------- | --------------------------------- |
| \`notNull\`       | Value must not be null/undefined | \`"id": "notNull"\`               |
| \`string\`        | Value must be a string           | \`"name": "string"\`              |
| \`number\`        | Value must be a number           | \`"count": "number"\`             |
| \`boolean\`       | Value must be a boolean          | \`"active": "boolean"\`           |
| \`timestamp\`     | Value must be a valid timestamp  | \`"createdAt": "timestamp"\`      |
| \`equals:value\`  | Value must equal expected        | \`"status": "equals:active"\`     |
| \`contains:text\` | Value must contain substring     | \`"message": "contains:success"\` |

**Examples:**

**Simple GET Request:**

| Step | Action                  | Data                                                 | Expected Result         |
| ---- | ----------------------- | ---------------------------------------------------- | ----------------------- |
| 1    | Trigger get API request | \`{"URL": "{{API_BASE}}/users/1", "Method": "GET"}\` | \`{"StatusCode": 200}\` |

**POST Request with Body:**

| Step | Action              | Data                                                                                                                                                    | Expected Result                                          |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1    | Trigger get API request | \`{"URL": "{{API_BASE}}/users", "Method": "POST", "Header": {"Content-Type": "application/json"}, "Body": {"name": "John", "email": "john@test.com"}}\` | \`{"StatusCode": 201, "StoreFields": {"id": "userId"}}\` |

**GET with Validation and Storage:**

| Step | Action              | Data                                                    | Expected Result                                                                                                           |
| ---- | ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | Trigger get API request | \`{"URL": "{{API_BASE}}/categories", "Method": "GET"}\` | \`{"StatusCode": 200, "ValidateFields": {"results[0].name": "notNull"}, "StoreFields": {"results[0].id": "categoryId"}}\` |

**Using Stored Values in Subsequent Requests:**

| Step | Action                  | Data                                                                   | Expected Result         |
| ---- | ----------------------- | ---------------------------------------------------------------------- | ----------------------- |
| 1    | Trigger get API request | \`{"URL": "{{API_BASE}}/categories/{{categoryId}}", "Method": "GET"}\` | \`{"StatusCode": 200}\` |

> **Note:** API actions automatically handle authentication token caching for 30 minutes.

---

### 4.12 Validate Actions

#### Validate / Assert / Verify / Check (with Data)

Validate multiple element values or messages on the page. This is the **validation mode** of the combined `ValidationAssertActionHandler` — it activates when the **Data column has a value**.

**Supported Keywords:** `validate`, `assert`, `verify`, `check`

> **Routing Rule:** Same keywords as assertion actions. The framework uses the **Data column** to decide:
>
> - **Data is empty** → Assertion mode ([§4.7](#47-assertion-actions))
> - **Data has a value** → Validation mode (this section)

| Action Format                      | Example                     |
| ---------------------------------- | --------------------------- |
| \`Validate 'Element Name'\`        | Validate 'Error Messages'   |
| \`Validate 'Field1' and 'Field2'\` | Validate 'Name' and 'Email' |
| \`Assert 'Element'\`               | Assert 'Total Price'        |
| \`Verify 'Element'\`               | Verify 'Status Label'       |
| \`Check 'Element'\`                | Check 'Error Message'       |

#### The `mandatory` Keyword

Add `mandatory` to the action to control failure behavior:

| Variant                                  | On Failure                              |
| ---------------------------------------- | --------------------------------------- |
| `Validate 'Element'`                     | Logs a **warning**, test **continues**  |
| `Validate mandatory 'Element'`           | Throws an **error**, test **fails**     |

#### Data Format for Validate Actions

The Data column contains expected values to validate:

| Format          | Description                | Example                              |
| --------------- | -------------------------- | ------------------------------------ |
| Single value    | One expected message/value | \`Error occurred\`                   |
| Multiple values | Comma-separated values     | \`Value1, Value2, Value3\`           |
| Semicolon-sep   | Semicolon-separated values | \`Value1; Value2; Value3\`           |
| Pipe-separated  | Pipe-separated values      | \`Value1 \| Value2 \| Value3\`      |
| Quoted values   | Preserve commas in values  | \`"Error: Missing, required field"\` |
| Variable ref    | Stored value reference     | \`{{expectedValue}}\`               |

#### Validation Modes

| Mode        | Description                           | Use Case                          |
| ----------- | ------------------------------------- | --------------------------------- |
| \`message\` | Match text content of elements        | Validating error messages, labels |
| \`value\`   | Match input field values              | Validating form field values      |
| \`auto\`    | Automatically detect based on context | Default behavior                  |

#### Validation Options

| Option            | Type    | Default    | Description                        |
| ----------------- | ------- | ---------- | ---------------------------------- |
| \`exact\`         | boolean | false      | Require exact text match           |
| \`caseSensitive\` | boolean | false      | Case-sensitive comparison          |
| \`match\`         | string  | 'contains' | Match type: 'contains' or 'equals' |
| \`itemSelector\`  | string  | -          | CSS selector for list items        |

**Examples:**

**Validate Single Message:**

| Step | Action                            | Data                 | Expected Result      |
| ---- | --------------------------------- | -------------------- | -------------------- |
| 1    | Validate 'Error Message'          | Username is required | Message is displayed |

**Validate Multiple Messages:**

| Step | Action                            | Data                                                         | Expected Result      |
| ---- | --------------------------------- | ------------------------------------------------------------ | -------------------- |
| 1    | Validate 'Validation Errors'      | Username is required, Password is required, Email is invalid | All errors displayed |

**Validate with Mandatory (fails test on mismatch):**

| Step | Action                            | Data                 | Expected Result         |
| ---- | --------------------------------- | -------------------- | ----------------------- |
| 1    | Validate mandatory 'Error Message'| Username is required | Must match or test fails|

**Validate with Stored Value:**

| Step | Action                            | Data            | Expected Result           |
| ---- | --------------------------------- | --------------- | ------------------------- |
| 1    | Validate 'Confirmation Text'      | {{OrderNumber}} | Order number is displayed |

**Validate List Items:**

| Step | Action                       | Data                         | Expected Result         |
| ---- | ---------------------------- | ---------------------------- | ----------------------- |
| 1    | Validate 'Dropdown Options'  | Option 1, Option 2, Option 3 | All options are present |

> **Note:** Validate actions automatically wait for elements to be visible before checking values.

---

### 4.13 Wait Actions

#### Wait

Explicit wait actions for synchronization in test workflows. Use these when you need to pause execution for specific conditions.

#### Time-Based Waits

Pause execution for a specified duration.

| Action Format         | Example                |
| --------------------- | ---------------------- |
| `Wait X seconds`      | Wait 5 seconds         |
| `Wait X milliseconds` | Wait 3000 milliseconds |
| `Wait X ms`           | Wait 500 ms            |
| `Wait X minute(s)`    | Wait 1 minute          |

**Examples:**

| Step | Action                 | Data | Expected Result    |
| ---- | ---------------------- | ---- | ------------------ |
| 1    | Wait 5 seconds         |      | Wait for 5 seconds |
| 2    | Wait 3000 milliseconds |      | Wait for 3 seconds |
| 3    | Wait 2 minutes         |      | Wait for 2 minutes |

#### Element Wait Conditions

Wait for elements to reach a specific state.

| Action Format                       | Description                    |
| ----------------------------------- | ------------------------------ |
| `Wait for 'Element'`                | Wait for element to be visible |
| `Wait for 'Element' to be visible`  | Wait for element to be visible |
| `Wait for 'Element' to appear`      | Wait for element to be visible |
| `Wait for 'Element' to disappear`   | Wait for element to be hidden  |
| `Wait for 'Element' to be hidden`   | Wait for element to be hidden  |
| `Wait for 'Element' to be attached` | Wait for element to be in DOM  |

**Examples:**

| Step | Action                                  | Data | Expected Result        |
| ---- | --------------------------------------- | ---- | ---------------------- |
| 1    | Wait for 'Loading Spinner' to disappear |      | Spinner is hidden      |
| 2    | Wait for 'Results Table' to be visible  |      | Results appear         |
| 3    | Wait for 'Submit Button'                |      | Button becomes visible |
| 4    | Wait for 'Modal Dialog' to be attached  |      | Modal is in DOM        |

#### Wait for Element Text

Wait for an element to contain specific text content.

| Action Format                        | Description                         |
| ------------------------------------ | ----------------------------------- |
| `Wait for 'Element' to have text`    | Wait for element to have exact text |
| `Wait for 'Element' to contain text` | Wait for element to contain text    |

**Examples:**

| Step | Action                             | Data      | Expected Result            |
| ---- | ---------------------------------- | --------- | -------------------------- |
| 1    | Wait for 'Status' to have text     | Completed | Status shows "Completed"   |
| 2    | Wait for 'Message' to contain text | Success   | Message contains "Success" |

#### URL Wait Conditions

Wait for URL to match specific patterns.

| Action Format                       | Description                         |
| ----------------------------------- | ----------------------------------- |
| `Wait for URL to contain 'pattern'` | Wait for URL to include the pattern |
| `Wait for URL to match 'regex'`     | Wait for URL to match regex pattern |

**Examples:**

| Step | Action                                   | Data | Expected Result               |
| ---- | ---------------------------------------- | ---- | ----------------------------- |
| 1    | Wait for URL to contain 'dashboard'      |      | URL includes "dashboard"      |
| 2    | Wait for URL to contain 'order/complete' |      | URL shows order complete page |
| 3    | Wait for URL to match '/order/\d+'       |      | URL matches order ID pattern  |

#### Page State Waits

Wait for page-level conditions.

| Action Format               | Description                            |
| --------------------------- | -------------------------------------- |
| `Wait for page to load`     | Wait for page load event               |
| `Wait for page load`        | Wait for page load event               |
| `Wait for network idle`     | Wait until no network activity (500ms) |
| `Wait for networkidle`      | Wait until no network activity (500ms) |
| `Wait for DOM to load`      | Wait for DOMContentLoaded event        |
| `Wait for domcontentloaded` | Wait for DOMContentLoaded event        |

**Examples:**

| Step | Action                | Data | Expected Result              |
| ---- | --------------------- | ---- | ---------------------------- |
| 1    | Wait for page to load |      | Page fully loaded            |
| 2    | Wait for network idle |      | All network requests settled |
| 3    | Wait for DOM to load  |      | DOM content loaded           |

#### Data Column with Wait Actions

The Data column can specify custom timeout values:

| Step | Action                                | Data        | Expected Result       |
| ---- | ------------------------------------- | ----------- | --------------------- |
| 1    | Wait for 'Slow Element' to be visible | timeout=30s | Wait up to 30 seconds |
| 2    | Wait for 'API Response'               | timeout=60s | Wait up to 60 seconds |

#### When to Use Wait Actions

| Scenario                  | Recommended Wait                         |
| ------------------------- | ---------------------------------------- |
| Page transitions          | `Wait for page to load`                  |
| AJAX content loading      | `Wait for 'Element' to be visible`       |
| Loading spinners          | `Wait for 'Spinner' to disappear`        |
| API responses             | `Wait for network idle`                  |
| Animations completing     | `Wait X milliseconds` or element wait    |
| Third-party integrations  | `Wait for 'Element'` with custom timeout |
| Navigation completion     | `Wait for URL to contain 'target'`       |
| Dynamic text updates      | `Wait for 'Element' to have text`        |
| Form submission redirects | `Wait for URL to match 'pattern'`        |

> **Note:** Most framework actions have built-in auto-wait. Use explicit waits only when necessary for synchronization issues or when waiting for elements to disappear.

---

### 4.14 Alert Actions

#### Alert / Confirm / Prompt / Dialog

Handle JavaScript dialogs (alert, confirm, prompt) that appear during test execution.

#### Accept Dialog Actions

Accept (click OK) on dialogs.

| Action Format    | Description                            |
| ---------------- | -------------------------------------- |
| `Accept alert`   | Click OK on JavaScript alert           |
| `Accept confirm` | Click OK on confirm dialog             |
| `Accept prompt`  | Click OK on prompt dialog (with input) |
| `Accept dialog`  | Accept any dialog type                 |
| `Handle alert`   | Accept the alert                       |

**Examples:**

| Step | Action         | Data          | Expected Result           |
| ---- | -------------- | ------------- | ------------------------- |
| 1    | Accept alert   |               | Alert accepted            |
| 2    | Accept confirm |               | Confirm dialog accepted   |
| 3    | Accept prompt  | My input text | Prompt accepted with text |

#### Dismiss Dialog Actions

Dismiss (click Cancel) on dialogs.

| Action Format     | Description                    |
| ----------------- | ------------------------------ |
| `Dismiss alert`   | Click Cancel/Close on alert    |
| `Dismiss confirm` | Click Cancel on confirm dialog |
| `Dismiss prompt`  | Click Cancel on prompt dialog  |
| `Cancel dialog`   | Dismiss any dialog type        |
| `Close alert`     | Close the alert                |

**Examples:**

| Step | Action          | Data | Expected Result   |
| ---- | --------------- | ---- | ----------------- |
| 1    | Dismiss alert   |      | Alert dismissed   |
| 2    | Dismiss confirm |      | Confirm cancelled |
| 3    | Cancel dialog   |      | Dialog closed     |

#### Wait for Dialog

Wait for a dialog to appear before taking action.

| Action Format                | Description                          |
| ---------------------------- | ------------------------------------ |
| `Wait for alert`             | Wait for alert to appear then accept |
| `Wait for dialog`            | Wait for any dialog to appear        |
| `Wait for alert and dismiss` | Wait for alert then dismiss it       |

**Examples:**

| Step | Action                     | Data  | Expected Result        |
| ---- | -------------------------- | ----- | ---------------------- |
| 1    | Wait for alert             |       | Wait and accept alert  |
| 2    | Wait for dialog            | 15000 | Wait up to 15 seconds  |
| 3    | Wait for alert and dismiss |       | Wait and dismiss alert |

#### Dialog Types Reference

| Dialog Type | Description                            | User Actions                 |
| ----------- | -------------------------------------- | ---------------------------- |
| `alert`     | Information display, single OK button  | Accept only                  |
| `confirm`   | Yes/No question, OK and Cancel buttons | Accept or Dismiss            |
| `prompt`    | Text input with OK and Cancel buttons  | Accept with input or Dismiss |

> **Note:** Dialog handlers are set up before the triggering action. If a dialog appears immediately after a click, the framework will handle it automatically.

---

### 4.15 Scroll Actions

#### Scroll

Handle scroll operations for page and container elements.

#### Scroll to Element

Scroll an element into the visible viewport.

| Action Format                | Description              |
| ---------------------------- | ------------------------ |
| `Scroll to 'Element'`        | Scroll element into view |
| `Scroll 'Element' into view` | Scroll element into view |

**Examples:**

| Step | Action                           | Data | Expected Result           |
| ---- | -------------------------------- | ---- | ------------------------- |
| 1    | Scroll to 'Submit Button'        |      | Button scrolled into view |
| 2    | Scroll to 'Footer Section'       |      | Footer visible            |
| 3    | Scroll 'Error Message' into view |      | Error message visible     |

#### Directional Page Scroll

Scroll the page in a specific direction.

| Action Format            | Description                         |
| ------------------------ | ----------------------------------- |
| `Scroll down`            | Scroll page down (default 300px)    |
| `Scroll up`              | Scroll page up (default 300px)      |
| `Scroll left`            | Scroll page left (default 300px)    |
| `Scroll right`           | Scroll page right (default 300px)   |
| `Scroll down 500 pixels` | Scroll page down by specific amount |
| `Scroll up 200px`        | Scroll page up by specific amount   |

**Examples:**

| Step | Action                 | Data | Expected Result          |
| ---- | ---------------------- | ---- | ------------------------ |
| 1    | Scroll down            |      | Page scrolled down 300px |
| 2    | Scroll down 500 pixels |      | Page scrolled down 500px |
| 3    | Scroll up              | 200  | Page scrolled up 200px   |
| 4    | Scroll right           |      | Page scrolled right      |

#### Scroll to Position

Scroll to specific page positions.

| Action Format      | Description              |
| ------------------ | ------------------------ |
| `Scroll to top`    | Scroll to top of page    |
| `Scroll to bottom` | Scroll to bottom of page |
| `Scroll to start`  | Scroll to start of page  |
| `Scroll to end`    | Scroll to end of page    |

**Examples:**

| Step | Action           | Data | Expected Result |
| ---- | ---------------- | ---- | --------------- |
| 1    | Scroll to top    |      | Page at top     |
| 2    | Scroll to bottom |      | Page at bottom  |

#### Container Scroll

Scroll within a scrollable container element.

| Action Format                  | Description               |
| ------------------------------ | ------------------------- |
| `Scroll 'Container' down`      | Scroll container down     |
| `Scroll 'Container' up`        | Scroll container up       |
| `Scroll 'Container' to bottom` | Scroll container to end   |
| `Scroll 'Container' to top`    | Scroll container to start |

**Examples:**

| Step | Action                             | Data | Expected Result        |
| ---- | ---------------------------------- | ---- | ---------------------- |
| 1    | Scroll 'Results List' down         |      | List scrolled down     |
| 2    | Scroll 'Table Container' to bottom |      | Table scrolled to end  |
| 3    | Scroll 'Chat Window' up 100px      |      | Chat scrolled up 100px |

#### Data Column with Scroll Actions

The Data column can specify scroll amount in pixels:

| Step | Action      | Data | Expected Result        |
| ---- | ----------- | ---- | ---------------------- |
| 1    | Scroll down | 500  | Scroll down 500 pixels |
| 2    | Scroll up   | 250  | Scroll up 250 pixels   |

> **Note:** Scroll actions use smooth scrolling behavior. A brief pause is added after scrolling to allow the UI to settle.

---

### 4.16 Drag and Drop Actions

#### Drag

Handle drag and drop interactions between elements or by offset.

#### Drag Element to Element

Drag one element and drop it onto another element.

| Action Format                    | Description                           |
| -------------------------------- | ------------------------------------- |
| `Drag 'Source' to 'Target'`      | Drag source element to target element |
| `Drag and drop 'Item' to 'Zone'` | Drag item and drop onto zone          |

**Examples:**

| Step | Action                            | Data | Expected Result         |
| ---- | --------------------------------- | ---- | ----------------------- |
| 1    | Drag 'Card' to 'Drop Zone'        |      | Card moved to drop zone |
| 2    | Drag 'Task Item' to 'Done Column' |      | Task moved to done      |
| 3    | Drag and drop 'File' to 'Folder'  |      | File dropped in folder  |

#### Drag by Offset

Drag an element by a specific pixel offset.

| Action Format               | Description                            |
| --------------------------- | -------------------------------------- |
| `Drag 'Element' by offset`  | Drag element by x,y pixels (from Data) |
| `Drag 'Element' by 100, 50` | Drag element 100px right, 50px down    |

**Examples:**

| Step | Action                    | Data   | Expected Result              |
| ---- | ------------------------- | ------ | ---------------------------- |
| 1    | Drag 'Slider' by offset   | 100, 0 | Slider moved 100px right     |
| 2    | Drag 'Handle' by offset   | 0, -50 | Handle moved 50px up         |
| 3    | Drag 'Widget' by 200, 100 |        | Widget moved to new position |

#### Data Column Format

For offset-based dragging, the Data column accepts:

| Format   | Description                              | Example     |
| -------- | ---------------------------------------- | ----------- |
| `x, y`   | Horizontal and vertical offset in pixels | `100, 50`   |
| `x,y`    | Without spaces                           | `100,50`    |
| `-x, -y` | Negative values for opposite direction   | `-50, -100` |

> **Note:** Both source and target elements must be defined in the objectMap (page objects). The drag operation waits for elements to be visible before executing.

---

### 4.17 Upload Actions

#### Upload

Handle file upload operations on file input elements.

**Supported Keywords:** `upload`

**Execution Modes:**

| Mode       | Trigger (Expected Result)            | Behavior                               |
| ---------- | ------------------------------------ | -------------------------------------- |
| `validate` | "should be uploaded", "uploaded"     | Uploads and verifies file was uploaded |
| `blocked`  | "should not be uploaded", "disabled" | Verifies upload is disabled/blocked    |
| `normal`   | Empty or no matching keywords        | Uploads without validation             |

**Upload Strategies (Automatic Fallback):**

The handler automatically tries these strategies in order until one succeeds:

| # | Strategy              | Description                                           |
| - | --------------------- | ----------------------------------------------------- |
| 1 | Direct setInputFiles  | For standard `<input type="file">` elements           |
| 2 | Hidden file input     | For custom components with hidden file inputs          |
| 3 | Click + FileChooser   | For buttons that open file dialog on click            |
| 4 | Drag and Drop         | For dropzone-style upload areas                        |
| 5 | Nearby file input     | Search parent/sibling elements for file inputs         |

#### Upload Single File

| Action Format              | Description                          |
| -------------------------- | ------------------------------------ |
| `Upload file to 'Element'` | Upload file specified in Data column |
| `Upload to 'Element'`      | Upload file to the element           |

**Examples:**

| Step | Action                      | Data                  | Expected Result      |
| ---- | --------------------------- | --------------------- | -------------------- |
| 1    | Upload file to 'File Input' | testdata/sample.pdf   | should be uploaded   |
| 2    | Upload to 'Profile Picture' | images/avatar.png     | Image uploaded       |
| 3    | Upload to 'Drop Zone'       | report.xlsx           | should be uploaded   |
| 4    | Upload to 'Disabled Upload' | test.pdf              | should not be uploaded|

#### Upload Multiple Files

Upload multiple files at once (comma-separated).

| Step | Action                      | Data                         | Expected Result    |
| ---- | --------------------------- | ---------------------------- | ------------------ |
| 1    | Upload files to 'Documents' | doc1.pdf, doc2.pdf, doc3.pdf | All files uploaded |

#### File Path Formats

| Format               | Description              | Example                     |
| -------------------- | ------------------------ | --------------------------- |
| Relative to testdata | Files in testdata folder | `sample.pdf`                |
| With testdata prefix | Explicit testdata path   | `testdata/uploads/file.pdf` |
| Absolute path        | Full system path         | `/Users/user/file.pdf`      |
| Multiple files       | Comma-separated paths    | `file1.pdf, file2.pdf`      |

> **Note:** Files are validated for existence before upload. Relative paths without `testdata/` prefix are assumed to be in the testdata folder. Supports PrimeNG, Angular Material, and other UI framework upload components.

---

### 4.18 Download Actions

#### Download / Retrieve / Export / Save

Handle file download operations triggered by clicking elements.

**Supported Keywords:** `download`, `retrieve`, `export`, `save`

**Execution Modes:**

| Mode           | Trigger (Expected Result)                              | Behavior                                    |
| -------------- | ------------------------------------------------------ | ------------------------------------------- |
| `validate`     | "file is downloaded", "downloaded", "verified"         | Downloads and verifies file exists          |
| `verifyFormat` | "should be in pdf format", "xlsx format", "csv format" | Downloads and validates file extension      |
| `blocked`      | "should not be downloaded", "disabled"                 | Verifies download is disabled/blocked       |
| `normal`       | Empty or no matching keywords                          | Downloads without validation                |

**Supported File Formats for Validation:**
`pdf`, `xlsx`, `xls`, `csv`, `docx`, `doc`, `txt`, `json`, `xml`, `zip`, `png`, `jpg`, `jpeg`

#### Download File

Click an element to trigger a file download.

| Action Format                    | Description                     |
| -------------------------------- | ------------------------------- |
| `Download by clicking 'Element'` | Click element to start download |
| `Download file from 'Element'`   | Download file from the element  |
| `Download from 'Element'`        | Download from the element       |
| `Retrieve file from 'Element'`   | Retrieve file from the element  |
| `Export file from 'Element'`     | Export file from the element    |

**Examples:**

| Step | Action                               | Data               | Expected Result                              |
| ---- | ------------------------------------ | ------------------ | -------------------------------------------- |
| 1    | Download by clicking 'Export Button' |                    | File downloaded                              |
| 2    | Download file from 'PDF Link'        | reports/output.pdf | File saved to path                           |
| 3    | Download from 'Report Button'        |                    | the downloaded file should be in pdf format  |
| 4    | Download from 'Data Export'          |                    | the downloaded file should be in xlsx format |
| 5    | Download from 'CSV Link'            |                    | the downloaded file should be in csv format  |
| 6    | Download from 'Disabled Link'        |                    | should not be downloaded                     |

#### Save Path Options

The Data column can specify where to save the downloaded file:

| Format        | Description                             | Example                          |
| ------------- | --------------------------------------- | -------------------------------- |
| Empty         | Save to `downloads/` with original name |                                  |
| Relative path | Save to `downloads/` subdirectory       | `reports/monthly.pdf`            |
| Absolute path | Save to specified location              | `/Users/user/Downloads/file.pdf` |

> **Note:** Files are saved to the `downloads/` folder by default. The directory is created automatically if it doesn't exist. Download timeout is 60 seconds. The handler automatically manages browser download dialogs and system file picker support.

---

### 4.19 IFrame Actions

#### Switch to IFrame / Switch to Main Frame / Switch to Parent Frame

Handle iframe (inline frame) interactions. Switch the browser context into or out of iframes embedded in the page.

**Supported Keywords:** Actions containing both `frame` (or `iframe`) and `switch`

#### Switch to an IFrame

Enter an iframe context by element name, URL pattern, or index.

| Action Format                                   | Description                          |
| ----------------------------------------------- | ------------------------------------ |
| `Switch to iframe 'Frame Name'`                 | Switch by element name in objectMap  |
| `Switch to iframe containing 'url-pattern'`     | Switch by URL pattern match          |
| `Switch to iframe 0`                            | Switch by index (0-based)            |

#### Switch Back to Main / Parent Frame

Exit the iframe context and return to the main page or parent frame.

| Action Format                  | Description                         |
| ------------------------------ | ----------------------------------- |
| `Switch to main frame`         | Switch back to topmost/main page    |
| `Switch to default content`    | Same as main frame                  |
| `Switch to parent frame`       | Switch to the parent frame (one up) |

#### Frame Context Keywords

| Keyword in Action  | Behavior                                    |
| ------------------ | ------------------------------------------- |
| `main` / `default` / `top` | Returns to the main page context   |
| `parent`           | Goes up one level in the frame hierarchy    |
| `containing` / `with url` | Finds iframe by URL pattern match    |
| Quoted element name | Finds iframe by locator in objectMap       |
| Number in action/data | Finds iframe by index                    |

**Examples:**

| Step | Action                                    | Data | Expected Result            |
| ---- | ----------------------------------------- | ---- | -------------------------- |
| 1    | Switch to iframe 'Payment Frame'          |      | Context switched to iframe |
| 2    | Enter 'Card Number'                       | 4242424242424242 |                |
| 3    | Switch to main frame                      |      | Back to main page          |
| 4    | Switch to iframe containing 'payment'     |      | Switched to iframe by URL  |
| 5    | Switch to parent frame                    |      | Back to parent frame       |

#### Typical IFrame Workflow

| Step | Action                                | Data                | Expected Result               |
| ---- | ------------------------------------- | ------------------- | ----------------------------- |
| 1    | Goto 'PAYMENT_PAGE'                   |                     | Page loaded                   |
| 2    | Switch to iframe 'Payment IFrame'     |                     | Entered payment iframe        |
| 3    | Enter 'Card Number'                   | 4242424242424242    |                               |
| 4    | Enter 'Expiry Date'                   | 12/28               |                               |
| 5    | Enter 'CVC'                           | 123                 |                               |
| 6    | Click 'Pay Now'                       |                     |                               |
| 7    | Switch to main frame                  |                     | Back to main page             |
| 8    | Assert 'Payment Confirmation'         |                     | should be visible             |

> **Important:**
>
> - After switching to an iframe, all subsequent actions operate within that iframe context
> - You **must** switch back to the main frame before interacting with elements outside the iframe
> - IFrame elements must be defined in the objectMap like any other element
> - Nested iframes require sequential switches (main → outer iframe → inner iframe)

---

## 5. Data Column Usage

### 5.1 Static Values

Direct input of values:

| Step | Action         | Data                 | Expected Result |
| ---- | -------------- | -------------------- | --------------- |
| 1    | Enter 'Email'  | john.doe@example.com |                 |
| 2    | Enter 'Phone'  | +1-555-123-4567      |                 |
| 3    | Enter 'Amount' | 1500.50              |                 |

### 5.2 Variable References

Use stored values with \`{{VariableName}}\` syntax:

| Step | Action               | Data             | Expected Result                   |
| ---- | -------------------- | ---------------- | --------------------------------- |
| 1    | Store 'Generated ID' |                  |                                   |
| 2    | Enter 'Search Field' | {{Generated ID}} |                                   |
| 3    | Assert 'Result'      |                  | should contain '{{Generated ID}}' |

### 5.3 Environment Variables

Reference configuration values for API automation:

| Variable           | Description    | Example Usage            |
| ------------------ | -------------- | ------------------------ |
| \`{{LOGIN_URL}}\`  | Login page URL | Goto '{{LOGIN_URL}}'     |
| \`{{ADMIN_USER}}\` | Admin username | Data: {{ADMIN_USER}}     |
| \`{{API_BASE}}\`   | API base URL   | Data: {{API_BASE}}/users |

### 5.4 Special Data Formats

| Format     | Example                 | Description              |
| ---------- | ----------------------- | ------------------------ |
| Date       | \`2025-12-02\`          | ISO date format          |
| DateTime   | \`2025-12-02T10:30:00\` | ISO datetime             |
| Currency   | \`1500.50\`             | Decimal numbers          |
| Boolean    | \`true\` / \`false\`    | Boolean values           |
| Multi-line | \`Line1\\nLine2\`       | Use \`\\n\` for newlines |

### 5.5 Dynamic Runtime Data Generation

The framework supports dynamic data generation using `{{placeholder}}` syntax. These placeholders are automatically resolved at runtime, generating unique values for each test execution.

#### Date Functions

| Pattern                    | Example Output    | Description                      |
| -------------------------- | ----------------- | -------------------------------- |
| \`{{today}}\`              | \`2025-12-12\`    | Today's date (YYYY-MM-DD)        |
| \`{{today:MM/DD/YYYY}}\`   | \`12/12/2025\`    | Today with custom format         |
| \`{{tomorrow}}\`           | \`2025-12-13\`    | Tomorrow's date                  |
| \`{{yesterday}}\`          | \`2025-12-11\`    | Yesterday's date                 |
| \`{{addDays(5)}}\`         | \`2025-12-17\`    | 5 days from today                |
| \`{{addDays(-3)}}\`        | \`2025-12-09\`    | 3 days ago                       |
| \`{{addMonths(1)}}\`       | \`2026-01-12\`    | 1 month from today               |
| \`{{addYears(1)}}\`        | \`2026-12-12\`    | 1 year from today                |
| \`{{addBusinessDays(5)}}\` | \`2025-12-19\`    | 5 business days (skips weekends) |
| \`{{nextBusinessDay}}\`    | \`2025-12-13\`    | Next weekday                     |
| \`{{firstDayOfMonth}}\`    | \`2025-12-01\`    | First day of current month       |
| \`{{lastDayOfMonth}}\`     | \`2025-12-31\`    | Last day of current month        |
| \`{{timestamp}}\`          | \`1702396800000\` | Current timestamp (ms)           |

#### ID/UUID Functions

| Pattern                   | Example Output                           | Description                 |
| ------------------------- | ---------------------------------------- | --------------------------- |
| \`{{uuid}}\`              | \`550e8400-e29b-41d4-a716-446655440000\` | UUID v4                     |
| \`{{shortId}}\`           | \`a1b2c3d4\`                             | 8-character unique ID       |
| \`{{uniqueId(12)}}\`      | \`a1b2c3d4e5f6\`                         | Custom length unique ID     |
| \`{{timestampId}}\`       | \`1702396800000_a1b2\`                   | Timestamp-based sortable ID |
| \`{{timestampId(USER)}}\` | \`USER_1702396800000_a1b2\`              | Prefixed timestamp ID       |

#### Random Data Functions

| Pattern                        | Example Output         | Description                   |
| ------------------------------ | ---------------------- | ----------------------------- |
| \`{{randomString(10)}}\`       | \`aBcDeFgHiJ\`         | Random 10-character string    |
| \`{{randomAlphanumeric(8)}}\`  | \`Ab3Cd5Ef\`           | Random letters + numbers      |
| \`{{randomNumber(1,100)}}\`    | \`42\`                 | Random integer in range       |
| \`{{randomDecimal(0,100,2)}}\` | \`45.67\`              | Random decimal with precision |
| \`{{randomEmail}}\`            | \`abc123@example.com\` | Random email address          |
| \`{{randomPhone}}\`            | \`555-123-4567\`       | Random phone number           |
| \`{{randomPassword(16)}}\`     | \`aB3$dE5!gH7@jK9#\`   | Random secure password        |

#### Example: Using Dynamic Data in Test Cases

| Step | Action                  | Data                  | Expected Result |
| ---- | ----------------------- | --------------------- | --------------- |
| 1    | Enter 'Username'        | TestUser\_{{shortId}} |                 |
| 2    | Enter 'Email'           | {{randomEmail}}       |                 |
| 3    | Enter 'Start Date'      | {{today}}             |                 |
| 4    | Enter 'End Date'        | {{addDays(30)}}       |                 |
| 5    | Enter 'Order ID'        | ORD-{{timestamp}}     |                 |
| 6    | Enter 'Transaction Ref' | TXN-{{uuid}}          |                 |

#### Example: Dynamic Data in API Requests

\`\`\`json
{
"URL": "{{url}}/rest/users",
"Method": "POST",
"Body": {
"username": "User\_{{shortId}}",
"email": "{{randomEmail}}",
"createdAt": "{{today}}",
"expiresAt": "{{addDays(90)}}",
"transactionId": "{{uuid}}"
}
}
\`\`\`

#### Combining Static and Dynamic Values

You can combine static text with dynamic placeholders:

| Step | Action               | Data                                                      | Expected Result |
| ---- | -------------------- | --------------------------------------------------------- | --------------- |
| 1    | Enter 'Project Name' | Project*{{today}}*{{shortId}}                             |                 |
| 2    | Enter 'Description'  | Created on {{today:MMMM DD, YYYY}}                        |                 |
| 3    | Enter 'Reference'    | REF/{{addMonths(1):YYYYMMDD}}/{{randomNumber(1000,9999)}} |                 |

#### Supported Date Formats

Use the `:format` syntax to customize date output:

| Format            | Example Output        | Description          |
| ----------------- | --------------------- | -------------------- |
| \`YYYY-MM-DD\`    | \`2025-12-12\`        | ISO format (default) |
| \`MM/DD/YYYY\`    | \`12/12/2025\`        | US format            |
| \`DD/MM/YYYY\`    | \`12/12/2025\`        | EU format            |
| \`DD-MM-YYYY\`    | \`12-12-2025\`        | EU dash format       |
| \`MMM DD, YYYY\`  | \`Dec 12, 2025\`      | Short month          |
| \`MMMM DD, YYYY\` | \`December 12, 2025\` | Full month           |
| \`YYYYMMDD\`      | \`20251212\`          | Compact format       |

**Example Usage:**
\`\`\`
{{today:MM/DD/YYYY}} → 12/12/2025
{{addDays(7):DD MMM YYYY}} → 19 Dec 2025
\`\`\`

---

## 6. Expected Result Column

### 6.1 Assertion Results

For assertion steps, specify the expected state:

| Assertion Type | Expected Result Format          |
| -------------- | ------------------------------- |
| Visible        | should be visible               |
| Hidden         | should not be visible           |
| Enabled        | should be enabled               |
| Disabled       | should be disabled              |
| Text Contains  | should contain 'expected text'  |
| Exact Value    | should have value 'exact value' |
| Checked        | should be checked               |

### 6.2 Popup/New Tab Registration

When an action opens a new tab, specify the page key:

| Step | Action              | Data | Expected Result |
| ---- | ------------------- | ---- | --------------- |
| 1    | Click 'Open Report' |      | 'ReportPage'    |

The framework will:

1. Detect the popup
2. Register it with key \`'ReportPage'\`
3. Allow switching using \`Switch to page 'ReportPage'\`

### 6.3 Descriptive Results

For documentation purposes:

| Step | Action                | Data | Expected Result                |
| ---- | --------------------- | ---- | ------------------------------ |
| 1    | Click 'Submit'        |      | Form is submitted successfully |
| 2    | Assert 'Confirmation' |      | should be visible              |

---

## 7. Working with Locators

### 7.1 Understanding Element Names

Element names in your test cases map to locator definitions:

**Test Case:**
\`\`\`
Click 'Login Button'
\`\`\`

**Locator Definition (in page-objects):**

> In the page objects, add objects by inspecting Playwright first, then use id, name, XPath, and CSS selectors via Selector Hub or browser-level inspect

\`\`\`typescript
export const loginPage = {
"Login Button": "getByRole('button', { name: 'Sign In' })",
};
\`\`\`

### 7.2 Finding Element Names

Check the objectMap or page object files for available elements:

\`\`\`
page-objects/
├── general/
│ └── login/
│ └── Login.ts # "Email Address", "Password", "Sign In"
├── dashboard/
│ └── Dashboard.ts # "Welcome Message", "User Menu"
└── objectMap.ts # Combined map of all elements
\`\`\`

### 7.3 Requesting New Locators

If an element doesn't exist:

1. Identify the element in the application
2. Document the request:
   - Page/Screen name
   - Element description
   - Element purpose
   - Suggested name
3. Submit to automation team for addition

**Request Template:**
\`\`\`
Page: Login Page
Element: The blue "Forgot Password?" link below password field
Purpose: Navigate to password recovery
Suggested Name: 'Forgot Password Link' or 'Forgot Password?'
\`\`\`

### 7.4 Locator Naming Best Practices

| ✅ Good Names          | ❌ Avoid      |
| ---------------------- | ------------- |
| 'Login Button'         | 'btn1'        |
| 'Email Address'        | 'input_email' |
| 'Save Changes Button'  | 'SaveBtn'     |
| 'Error Message Banner' | 'err'         |
| 'User Profile Menu'    | 'menu'        |

---

## 8. Advanced Features

### 8.1 Multi-Tab Workflows

**Scenario:** Click opens new tab, perform actions, return to original.

| Step | Action                     | Data | Expected Result             |
| ---- | -------------------------- | ---- | --------------------------- |
| 1    | Click 'View Report Link'   |      | 'ReportTab'                 |
| 2    | Switch to page 'ReportTab' |      | Report page displayed       |
| 3    | Assert 'Report Title'      |      | should be visible           |
| 4    | Click 'Download PDF'       |      |                             |
| 5    | Switch to page 'parent'    |      | Back to main page           |
| 6    | Assert 'Success Message'   |      | should contain 'Downloaded' |

### 8.2 Data-Driven Testing

**Scenario:** Same test with different data sets.

**Sheet: TC001_Login_ValidUsers**

| Step | Action             | Data              | Expected Result   |
| ---- | ------------------ | ----------------- | ----------------- |
| 1    | Goto 'Login Page'  |                   |                   |
| 2    | Enter 'Email'      | \${TEST_EMAIL}    |                   |
| 3    | Enter 'Password'   | \${TEST_PASSWORD} |                   |
| 4    | Click 'Sign In'    |                   |                   |
| 5    | Assert 'Dashboard' |                   | should be visible |

**Data Sets (separate sheet or config):**

| TEST_EMAIL     | TEST_PASSWORD |
| -------------- | ------------- |
| admin@test.com | Admin123!     |
| user@test.com  | User456!      |
| guest@test.com | Guest789!     |

### 8.3 Conditional Workflows

**Scenario:** Handle optional elements.

| Step | Action                 | Data | Expected Result         |
| ---- | ---------------------- | ---- | ----------------------- |
| 1    | Click 'Accept Cookies' |      | Cookie banner dismissed |
| 2    | Goto 'Dashboard'       |      |                         |

> **Note:** If 'Accept Cookies' element doesn't appear, the step may fail. Work with automation team for conditional handling.

### 8.4 Storing and Reusing Values

**Scenario:** Capture a generated ID and verify it later.

| Step | Action                 | Data             | Expected Result                   |
| ---- | ---------------------- | ---------------- | --------------------------------- |
| 1    | Click 'Create Order'   |                  |                                   |
| 2    | Store 'Order Number'   |                  | Value captured                    |
| 3    | Click 'Orders Menu'    |                  |                                   |
| 4    | Enter 'Search Box'     | {{Order Number}} |                                   |
| 5    | Click 'Search Button'  |                  |                                   |
| 6    | Assert 'Search Result' |                  | should contain '{{Order Number}}' |

### 8.5 Function Calls with Parameters

**Scenario:** Call a custom login function.

| Step | Action                                 | Data                              | Expected Result   |
| ---- | -------------------------------------- | --------------------------------- | ----------------- |
| 1    | Execute the login with supervisor user | LoginPage.login(admin, Admin123!) | User logged in    |
| 2    | Assert 'Welcome Message'               |                                   | should be visible |

> **Available Functions:** Check with automation team for available page class methods.

---

## 9. Environment Configuration

This section describes how to configure the framework for different environments (development, UAT, production).

### 9.1 Overview

The framework supports multiple environment configurations, allowing you to:

- Switch between environments using the `ENV` variable
- Define environment-specific URLs, credentials, and API endpoints
- Use configuration properties in test cases via `{{PROPERTY_NAME}}` syntax

### 9.2 Environment Variable (ENV)

Set the `ENV` variable to switch between environments:

| Value  | Description                       | Config File             |
| ------ | --------------------------------- | ----------------------- |
| `dev`  | Development environment (default) | `config/dev.config.ts`  |
| `uat`  | User Acceptance Testing           | `config/uat.config.ts`  |
| `prod` | Production environment            | `config/prod.config.ts` |

**Command Examples:**

```bash
# Run with default (dev) environment
npx playwright test tests/run-excel-case.spec.ts

# Run with UAT environment
ENV=uat npx playwright test tests/run-excel-case.spec.ts

# Run with production environment
ENV=prod npx playwright test tests/run-excel-case.spec.ts
```

### 9.3 Configuration Files

Configuration files are located in the `config/` directory:

```
config/
├── index.ts          # Environment selector
├── dev.config.ts     # Development configuration
├── uat.config.ts     # UAT configuration
├── prod.config.ts    # Production configuration
└── api.config.ts     # API-specific configuration
```

**Configuration File Structure:**

```typescript
// config/dev.config.ts
export const PROPERTIES = {
  LOGIN: 'https://dev.example.com/login',
  HOYER: 'https://dev-hoyer.example.com/#/home',
  URL: 'https://api-dev.example.com',
  AUTH_URL: 'https://api-dev.example.com/oauth2/token',
  CLIENT_ID: 'your-client-id',
  CLIENT_SECRET: 'your-client-secret',
};
```

### 9.4 Available Properties

Common configuration properties available across environments:

| Property        | Description          | Usage in Test      |
| --------------- | -------------------- | ------------------ |
| `LOGIN`         | Login page URL       | `Goto 'LOGIN'`     |
| `HOYER`         | Application home URL | `Goto 'HOYER'`     |
| `URL`           | API base URL         | `{{URL}}/endpoint` |
| `AUTH_URL`      | OAuth token endpoint | API authentication |
| `CLIENT_ID`     | OAuth client ID      | API authentication |
| `CLIENT_SECRET` | OAuth client secret  | API authentication |

> **Note:** Property names in configuration files should be UPPERCASE for consistency.

### 9.5 Using Configuration in Tests

**Navigation Actions:**

| Step | Action       | Data | Expected Result      |
| ---- | ------------ | ---- | -------------------- |
| 1    | Goto 'LOGIN' |      | Login page displayed |
| 2    | Goto 'HOYER' |      | Home page displayed  |

**API Actions:**

| Step | Action              | Data                                             | Expected Result       |
| ---- | ------------------- | ------------------------------------------------ | --------------------- |
| 1    | Execute API request | `{"URL": "{{URL}}/categories", "Method": "GET"}` | `{"StatusCode": 200}` |

**Adding Custom Properties:**

To add a new property:

1. Add to all config files (`dev.config.ts`, `uat.config.ts`, `prod.config.ts`):

   ```typescript
   export const PROPERTIES = {
     // ... existing properties
     MY_NEW_URL: 'https://new-service.example.com',
   };
   ```

2. Use in test cases:
   ```
   Goto 'MY_NEW_URL'
   ```
   or
   ```
   Data: {"URL": "{{MY_NEW_URL}}/endpoint"}
   ```

---

## 10. Running Excel Test Cases

This section describes how to execute Excel-based test cases using the Playwright Automation Framework.

### 10.1 Overview

The Excel Test Runner (`tests/run-excel-case.spec.ts`) loads test cases from Excel files and executes them using the TestExecutionOrchestrator. Key features include:

- **Single test execution** and **data-driven iterations**
- **Grouping tests** by execution key with configurable parallel/serial modes
- **Automatic result updates** back to the Excel file
- **Custom orchestrator support** via environment variables
- **Run mode filtering** for selective test execution

### 10.2 Environment Variables

| Variable                  | Values                                | Default | Description                            |
| ------------------------- | ------------------------------------- | ------- | -------------------------------------- |
| `EXCEL_RUN_MODE`          | `all`, `failed`, `pending`, `skipped` | `all`   | Controls which test cases to run       |
| `USE_CUSTOM_ORCHESTRATOR` | `true`, `false`                       | `false` | Use custom orchestrator implementation |

### 10.3 Run Mode Options

| Mode      | Description                                                   | Use Case                         |
| --------- | ------------------------------------------------------------- | -------------------------------- |
| `all`     | Run all test cases regardless of status                       | Full regression testing          |
| `failed`  | Run failed, pending, and skipped cases (excludes only PASSED) | Re-run after fixing issues       |
| `pending` | Run only cases without results (not yet executed)             | Continue interrupted test runs   |
| `skipped` | Run only skipped test cases                                   | Execute previously skipped tests |

### 10.4 Command Examples

**Run pending (not yet executed) cases:**

```bash
npx playwright test tests/run-excel-case.spec.ts
```

**Run all cases:**

```bash
EXCEL_RUN_MODE=all npx playwright test tests/run-excel-case.spec.ts
```

**Run only failed cases:**

```bash
EXCEL_RUN_MODE=failed npx playwright test tests/run-excel-case.spec.ts
```

**Run only skipped cases:**

```bash
EXCEL_RUN_MODE=skipped npx playwright test tests/run-excel-case.spec.ts
```

**Run with custom orchestrator:**

```bash
USE_CUSTOM_ORCHESTRATOR=true npx playwright test tests/run-excel-case.spec.ts
```

**Combine multiple options:**

```bash
EXCEL_RUN_MODE=failed USE_CUSTOM_ORCHESTRATOR=true npx playwright test tests/run-excel-case.spec.ts
```

### 10.5 Execution Modes

Test cases are grouped by execution key and can run in two modes:

#### Parallel Mode (Default)

- Tests run concurrently based on assigned workers
- If a test case fails, execution continues with remaining test cases
- Best for independent test cases

#### Serial Mode

- Execution name **must start with "Serial"**
- If any test case fails, execution stops immediately
- Subsequent cases are automatically marked as `SKIPPED`
- Best for dependent test cases where order matters

**Example Execution Names:**

| Execution Name            | Mode     | Behavior                                   |
| ------------------------- | -------- | ------------------------------------------ |
| `Sprint-1 Regression`     | Parallel | All tests run, failures don't block others |
| `Serial-Login-Flow`       | Serial   | Stops on first failure                     |
| `Serial_Checkout_Process` | Serial   | Stops on first failure                     |

### 10.6 Data-Driven Iterations

When a test case has a **DataSet** column with a path to a test data Excel file, the framework creates multiple iterations:

**Test Repository Configuration:**

| Key    | Summary    | DataSet                     |
| ------ | ---------- | --------------------------- |
| TC-001 | Login Test | `DataSets/credentials.xlsx` |

**DataSet Excel File (`DataSets/credentials.xlsx`):**

| username         | password  | expected_result     |
| ---------------- | --------- | ------------------- |
| admin@test.com   | Admin123! | Dashboard displayed |
| user@test.com    | User456!  | Dashboard displayed |
| invalid@test.com | wrong     | Error message shown |

**Resulting Test Execution:**

- TC-001 will run 3 times (one for each row in the DataSet)
- Each iteration uses the corresponding row's data
- Results are aggregated and written back to Excel

**DataSet Column Formats:**

```
# Simple path format
DataSets/credentials.xlsx

# JSON format with Path key
{ "Path": "DataSets/credentials.xlsx" }
```

### 10.7 Test Results

After execution, results are automatically updated in the Excel file:

| Result    | Description                                               |
| --------- | --------------------------------------------------------- |
| `PASSED`  | Test completed successfully                               |
| `FAILED`  | Test failed with error (error message included)           |
| `SKIPPED` | Test was skipped (due to run mode or serial mode failure) |

**Iteration Result Format:**

- For tests with multiple iterations, results show aggregated status
- Example: `2 of 3 iterations failed.` followed by failure details

**Result Columns Updated:**

- **Result**: PASSED, FAILED, or SKIPPED
- **Error Message**: Detailed error information for failed tests
- **Execution Time**: Duration of test execution

---

## 11. Running X-Ray Test Cases

This section describes how to execute X-Ray (Jira) based test cases using the Playwright Automation Framework with automatic result upload to X-Ray Cloud.

### 11.1 Overview

The X-Ray Test Runner (`tests/run-xray.spec.ts`) loads test cases from X-Ray JSON files and executes them using the TestExecutionOrchestrator. Key features include:

- **Jira/X-Ray integration** for test case management
- **Single test execution** and **data-driven iterations**
- **Grouping tests** by execution key with configurable parallel/serial modes
- **Automatic result upload** to X-Ray Cloud after test completion
- **Custom orchestrator support** via environment variables
- **Run mode filtering** for selective test execution

### 11.2 Environment Variables

| Variable                  | Values                                | Default | Description                            |
| ------------------------- | ------------------------------------- | ------- | -------------------------------------- |
| `XRAY_RUN_MODE`           | `all`, `failed`, `pending`, `skipped` | `all`   | Controls which test cases to run       |
| `USE_CUSTOM_ORCHESTRATOR` | `true`, `false`                       | `false` | Use custom orchestrator implementation |

### 11.3 Run Mode Options

| Mode      | Description                                                   | Use Case                         |
| --------- | ------------------------------------------------------------- | -------------------------------- |
| `all`     | Run all test cases regardless of status                       | Full regression testing          |
| `failed`  | Run failed, pending, and skipped cases (excludes only PASSED) | Re-run after fixing issues       |
| `pending` | Run only cases without results (status = "TO DO")             | Execute new test cases           |
| `skipped` | Run only skipped test cases (status = "TO DO")                | Execute previously skipped tests |

> **Note:** X-Ray uses "TO DO" status to indicate pending/not yet executed test cases.

### 11.4 Command Examples

**Run all X-Ray test cases (default):**

```bash
npx playwright test tests/run-xray.spec.ts
```

**Run only pending X-Ray cases:**

```bash
XRAY_RUN_MODE=pending npx playwright test tests/run-xray.spec.ts
```

**Run only failed X-Ray cases:**

```bash
XRAY_RUN_MODE=failed npx playwright test tests/run-xray.spec.ts
```

**Run only skipped X-Ray cases:**

```bash
XRAY_RUN_MODE=skipped npx playwright test tests/run-xray.spec.ts
```

**Run with custom orchestrator:**

```bash
USE_CUSTOM_ORCHESTRATOR=true npx playwright test tests/run-xray.spec.ts
```

**Combine multiple options:**

```bash
XRAY_RUN_MODE=failed USE_CUSTOM_ORCHESTRATOR=true npx playwright test tests/run-xray.spec.ts
```

### 11.5 Execution Modes

Test cases are grouped by execution key and can run in two modes:

#### Parallel Mode (Default)

- Tests run concurrently based on assigned workers
- If a test case fails, execution continues with remaining test cases
- Best for independent test cases

#### Serial Mode

- Execution key indicates serial mode (framework configured)
- If any test case fails, dependent tests may be affected
- Best for dependent test cases where order matters

### 11.6 Data-Driven Iterations

When a test case has iterations defined, each iteration runs as a separate test:

**Test Case with Iterations:**

```
TC-001: Login Test
├── Iteration 1: admin@test.com / Admin123!
├── Iteration 2: user@test.com / User456!
└── Iteration 3: guest@test.com / Guest789!
```

**Resulting Test Execution:**

- Each iteration runs as a separate Playwright test
- Results are aggregated after all iterations complete
- Final result uploaded to X-Ray reflects all iterations

### 11.7 X-Ray Integration

#### Test Case Source

Test cases are loaded from JSON files in the `/testcases/x-ray/` directory:

```
testcases/
└── x-ray/
    ├── Sprint-1/
    │   └── APS-123.json
    ├── Sprint-2/
    │   └── APS-456.json
    └── Regression/
        └── APS-789.json
```

#### Automatic Result Upload

After all tests complete, results are automatically uploaded to X-Ray Cloud:

| Result    | X-Ray Status | Description                 |
| --------- | ------------ | --------------------------- |
| `PASSED`  | PASS         | Test completed successfully |
| `FAILED`  | FAIL         | Test failed with error      |
| `SKIPPED` | TODO         | Test was skipped            |

**Upload Process:**

1. Tests execute and results are collected
2. Results are grouped by execution key
3. Each group is uploaded to X-Ray Cloud via API
4. X-Ray Test Execution is updated with results

#### X-Ray Configuration

Ensure your X-Ray API credentials are configured:

```bash
# Environment variables for X-Ray Cloud
XRAY_CLIENT_ID=your_client_id
XRAY_CLIENT_SECRET=your_client_secret
XRAY_CLOUD_URL=https://xray.cloud.getxray.app
```

#### Viewing Results in Jira

After upload:

1. Navigate to your Jira project
2. Open the Test Execution issue
3. View test results with pass/fail status
4. Failed tests include error messages and screenshots

---

## 12. Common Patterns & Examples

### 12.1 Login Flow

| Step | Action                    | Data                 | Expected Result           |
| ---- | ------------------------- | -------------------- | ------------------------- |
| 1    | Goto 'Login Page'         |                      | Login page displayed      |
| 2    | Enter 'Email Address'     | testuser@example.com |                           |
| 3    | Enter 'Password'          | SecurePass123!       |                           |
| 4    | Check 'Remember Me'       |                      |                           |
| 5    | Click 'Sign In'           |                      |                           |
| 6    | Assert 'Dashboard Header' |                      | should be visible         |
| 7    | Assert 'Welcome Message'  |                      | should contain 'testuser' |

### 12.2 Form Submission

| Step | Action                       | Data                        | Expected Result            |
| ---- | ---------------------------- | --------------------------- | -------------------------- |
| 1    | Goto 'Contact Form Page'     |                             |                            |
| 2    | Enter 'Full Name'            | John Doe                    |                            |
| 3    | Enter 'Email'                | john.doe@test.com           |                            |
| 4    | Select 'Subject Dropdown'    | Technical Support           |                            |
| 5    | Enter 'Message'              | I need help with my account |                            |
| 6    | Check 'Subscribe Newsletter' |                             |                            |
| 7    | Click 'Submit Button'        |                             |                            |
| 8    | Assert 'Success Message'     |                             | should be visible          |
| 9    | Assert 'Success Message'     |                             | should contain 'Thank you' |

### 12.3 Search and Verify

| Step | Action                     | Data       | Expected Result             |
| ---- | -------------------------- | ---------- | --------------------------- |
| 1    | Enter 'Search Box'         | Playwright |                             |
| 2    | Click 'Search Button'      |            |                             |
| 3    | Assert 'Search Results'    |            | should be visible           |
| 4    | Assert 'Result Count'      |            | should contain 'results'    |
| 5    | Click 'First Result'       |            |                             |
| 6    | Assert 'Detail Page Title' |            | should contain 'Playwright' |

### 12.4 CRUD Operations

#### Create

| Step | Action                 | Data                | Expected Result          |
| ---- | ---------------------- | ------------------- | ------------------------ |
| 1    | Click 'Add New Button' |                     |                          |
| 2    | Enter 'Name Field'     | Test Item           |                          |
| 3    | Enter 'Description'    | This is a test item |                          |
| 4    | Click 'Save Button'    |                     |                          |
| 5    | Assert 'Success Toast' |                     | should contain 'created' |
| 6    | Store 'Item ID'        |                     |                          |

#### Read

| Step | Action               | Data        | Expected Result            |
| ---- | -------------------- | ----------- | -------------------------- |
| 7    | Enter 'Search Field' | {{Item ID}} |                            |
| 8    | Click 'Search'       |             |                            |
| 9    | Assert 'Result Row'  |             | should contain 'Test Item' |

#### Update

| Step | Action                 | Data         | Expected Result          |
| ---- | ---------------------- | ------------ | ------------------------ |
| 10   | Click 'Edit Button'    |              |                          |
| 11   | Enter 'Name Field'     | Updated Item |                          |
| 12   | Click 'Save Button'    |              |                          |
| 13   | Assert 'Success Toast' |              | should contain 'updated' |

#### Delete

| Step | Action                 | Data | Expected Result          |
| ---- | ---------------------- | ---- | ------------------------ |
| 14   | Click 'Delete Button'  |      |                          |
| 15   | Click 'Confirm Delete' |      |                          |
| 16   | Assert 'Success Toast' |      | should contain 'deleted' |

### 12.5 Navigation Menu Flow

| Step | Action                      | Data | Expected Result   |
| ---- | --------------------------- | ---- | ----------------- |
| 1    | Hover 'Settings Menu'       |      | Submenu appears   |
| 2    | Click 'Profile Settings'    |      |                   |
| 3    | Assert 'Profile Page Title' |      | should be visible |
| 4    | Click 'Back Button'         |      |                   |
| 5    | Assert 'Dashboard'          |      | should be visible |

### 12.6 Modal/Dialog Handling

| Step | Action                      | Data | Expected Result               |
| ---- | --------------------------- | ---- | ----------------------------- |
| 1    | Click 'Delete Item'         |      |                               |
| 2    | Assert 'Confirmation Modal' |      | should be visible             |
| 3    | Assert 'Modal Message'      |      | should contain 'Are you sure' |
| 4    | Click 'Cancel Button'       |      |                               |
| 5    | Assert 'Confirmation Modal' |      | should not be visible         |
| 6    | Click 'Delete Item'         |      |                               |
| 7    | Click 'Confirm Button'      |      |                               |
| 8    | Assert 'Success Message'    |      | should be visible             |

---

## 13. Troubleshooting Guide

### 13.1 Common Errors and Solutions

#### Error: "No quoted text found in action"

**Problem:** Element name not in single quotes.

| ❌ Wrong            | ✅ Correct            |
| ------------------- | --------------------- |
| Click Login Button  | Click 'Login Button'  |
| Enter Email Address | Enter 'Email Address' |

---

#### Error: "Locator 'X' not found in objectMap"

**Problem:** Element name doesn't exist in locator definitions.

**Solutions:**

1. Check spelling (case-sensitive)
2. Verify element exists in page objects
3. Request new locator from automation team

---

#### Error: "All locators for 'X' failed"

**Problem:** Element exists in objectMap but not found on page.

**Possible Causes:**

- Element not visible (hidden, loading)
- Wrong page context (on different tab)
- Element changed in application
- Timing issue (element not loaded yet)

**Solutions:**

1. Add wait/assertion before the action
2. Verify you're on correct page
3. Report locator update needed

---

#### Error: "Check the test cases expected results"

**Problem:** Popup action requires page key in Expected Result.

| ❌ Wrong                | ✅ Correct             |
| ----------------------- | ---------------------- |
| Expected: New tab opens | Expected: 'NewTabPage' |

---

#### Error: "Timeout waiting for element"

**Problem:** Element took too long to appear.

**Solutions:**

1. Increase step timeout (if configurable)
2. Add explicit wait step before
3. Verify element is actually present in application

---

### 13.2 Debugging Tips

| Tip                   | Description                           |
| --------------------- | ------------------------------------- |
| **Check Screenshots** | Review failure screenshots in reports |
| **Verify Page**       | Ensure correct page is active         |
| **Check Timing**      | Add assertions to wait for elements   |
| **Review Logs**       | Check execution logs for details      |
| **Isolate Issue**     | Run individual test case to isolate   |

### 13.3 Getting Help

| Issue Type        | Contact          |
| ----------------- | ---------------- |
| Missing Locator   | Automation Team  |
| Framework Bug     | Automation Lead  |
| Test Case Review  | QA Lead          |
| Application Issue | Development Team |

---

## 14. Best Practices

### 14.1 Test Case Design

| Practice              | Description                               |
| --------------------- | ----------------------------------------- |
| **One Purpose**       | Each test case should verify one scenario |
| **Independence**      | Tests should not depend on other tests    |
| **Cleanup**           | Reset state after test if needed          |
| **Descriptive Names** | Use clear, descriptive test names         |

### 14.2 Step Writing

| ✅ Do                  | ❌ Don't                     |
| ---------------------- | ---------------------------- |
| One action per step    | Multiple actions in one step |
| Clear element names    | Ambiguous names              |
| Meaningful data        | Random/unclear data          |
| Verify critical states | Skip important assertions    |

### 14.3 Assertion Strategy

Follow these guidelines when adding assertions to your test cases:

#### Critical Assertions (Always Include)

- **Authentication states** - Verify login success/failure
- **Form submissions** - Confirm data was saved/submitted
- **Navigation completion** - Verify correct page loaded
- **Error handling** - Check error messages display correctly
- **Permission checks** - Verify access control works

#### Important Assertions (Usually Include)

- **Success messages** - Confirm operation completed
- **Data display** - Verify retrieved data shows correctly
- **UI state changes** - Confirm buttons enabled/disabled
- **Modal/dialog states** - Verify popups appear/close
- **List/table updates** - Confirm items added/removed

#### Optional Assertions (Include When Relevant)

- **Exact text matching** - Verify specific wording
- **Styling/formatting** - Check visual presentation
- **Default values** - Verify pre-populated fields
- **Placeholder text** - Check input hints
- **Tooltip content** - Verify hover text

#### Assertion Best Practices

| Practice                       | Description                                                               |
| ------------------------------ | ------------------------------------------------------------------------- |
| **One assertion per step**     | Keep assertions focused and clear                                         |
| **Assert after actions**       | Verify state changes after each critical action                           |
| **Use specific assertions**    | Prefer `should contain 'text'` over `should be visible` when text matters |
| **Avoid redundant assertions** | Don't assert the same element multiple times                              |
| **Assert before proceeding**   | Verify page is ready before next action                                   |

#### Assertion Priority

| Priority   | When to Assert           | Example                                |
| ---------- | ------------------------ | -------------------------------------- |
| **High**   | User-critical workflows  | Login, checkout, form submission       |
| **Medium** | Important UI feedback    | Success/error messages, loading states |
| **Low**    | Nice-to-have validations | Exact formatting, styling details      |

### 14.4 Maintainability Checklist

- [ ] Element names are descriptive
- [ ] No hardcoded waits (use assertions)
- [ ] Data is parameterized where needed
- [ ] Expected results are specific
- [ ] Steps are reusable across tests
- [ ] Edge cases are documented

---

## 15. Appendix

### 15.1 Action Keywords Quick Reference

| Category     | Keywords                                                           |
| ------------ | ------------------------------------------------------------------ |
| Navigation   | goto, navigate, open, login                                        |
| Click        | click, click on                                                    |
| Double Click | double click, double-click, doubleclick                            |
| Enter/Fill   | enter, fill                                                        |
| Type         | type, entergrid                                                    |
| Dropdown     | select, choose, selectgrid, selectandenter                         |
| Checkbox     | check, tick, uncheck, untick                                       |
| Hover        | hover, hover over, mouseover                                       |
| Assert       | assert, verify, check (without data)                               |
| Validate     | validate, assert, verify, check (with data)                        |
| Store        | store, save, get (with `as` syntax)                                |
| Switch Page  | switch, switchto, switch to, switch.to, switchpage                 |
| IFrame       | switch to iframe, switch to main frame, switch to parent frame     |
| Function     | execute, perform, invoke                                           |
| API          | api, get, post, put, delete, patch                                 |
| Wait         | wait, wait for                                                     |
| Alert        | alert, confirm, prompt, dialog, accept, dismiss                    |
| Scroll       | scroll, scroll to, scroll down, scroll up                          |
| Drag         | drag, drag to, drag and drop                                       |
| Upload       | upload, upload file, upload to                                     |
| Download     | download, retrieve, export, save                                   |

### 15.2 Assertion Keywords Quick Reference

| State         | Keywords                                         |
| ------------- | ------------------------------------------------ |
| Visible       | visible, displayed, shown, present               |
| Hidden        | not visible, hidden, not displayed, invisible    |
| Enabled       | enabled, active                                  |
| Disabled      | disabled, inactive                               |
| Clickable     | clickable, interactive                           |
| Not Clickable | unclickable, not clickable, non-interactive      |
| Contains      | contain, contains, include                       |
| Value         | have value, has value, equal                     |
| Checked       | checked, selected, ticked                        |
| Unchecked     | not checked, unchecked, not selected, unticked   |

### 15.3 Variable Syntax

| Syntax             | Description            | Example                      |
| ------------------ | ---------------------- | ---------------------------- |
| \`'Element Name'\` | Locator reference      | Click 'Submit'               |
| \`{{variable}}\`   | Stored value reference | Enter 'Field' {{savedValue}} |
| \`{{ENV_VAR}}\`    | Environment variable   | {{LOGIN_URL}}                |

### 15.4 Excel Template

Download the test case template from the shared drive:

📁 \`Templates/TestCase_Template.xlsx\`

### 15.5 Sample Test Cases

Reference implementations available at:

📁 \`testcases/excel/Samples/\`

### 15.6 Change Log

| Version | Date       | Changes                                    |
| ------- | ---------- | ------------------------------------------ |
| 1.0     | 2025-12-02 | Initial release                            |
| 1.1     | 2025-12-08 | Added Section 10: Running Excel Test Cases |
| 1.2     | 2025-12-08 | Added Section 11: Running X-Ray Test Cases |
| 1.3     | 2025-12-08 | Added Section 4.11: API Actions            |
| 1.4     | 2025-12-08 | Added Section 4.12: Validate Actions       |
| 1.5     | 2025-12-08 | Added Section 9: Environment Configuration |
| 1.6     | 2026-03-02 | Synchronized with action handler implementations: added §4.19 IFrame Actions, Type/EnterGrid actions, `mandatory` keyword for assertions/validations, `as` syntax for Store and Goto, `clickable`/`unclickable` assertion types, `tick`/`untick` checkbox keywords, `selectgrid`/`selectandenter` dropdown keywords, `login` navigation keyword, download format validation modes, upload strategies, and updated all keyword references |

---

## 16. Document Version

| Version       | Author(s)            | Date        | Comment                                                            |
| ------------- | -------------------- | ----------- | ------------------------------------------------------------------ |
| Version 1.0.0 | Balakrishnan A       | Dec 2, 2025 | Initial Version                                                    |
| Version 1.1.0 | Automation WorkGroup | Dec 8, 2025 | Added Excel Test Runner documentation                              |
| Version 1.2.0 | Automation WorkGroup | Dec 8, 2025 | Added X-Ray Test Runner documentation                              |
| Version 1.3.0 | Automation WorkGroup | Dec 8, 2025 | Added API Actions, Validate Actions, and Environment Configuration |
| Version 1.4.0 | Automation WorkGroup | Mar 2, 2026 | Synchronized all action handler documentation with base library implementations |

---

_© 2025 Automation WorkGroup. All rights reserved._
