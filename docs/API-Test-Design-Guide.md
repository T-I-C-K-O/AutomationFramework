# API Test Cases Design Guide

## Table of Contents

1. [Overview](#1-overview)
2. [Test Case Structure](#2-test-case-structure)
3. [Request Configuration](#3-request-configuration)
4. [Expected Result Configuration](#4-expected-result-configuration)
5. [Variable Interpolation](#5-variable-interpolation)
6. [Runtime Data Resolver](#6-runtime-data-resolver)
7. [Validation Types](#7-validation-types)
8. [Storing Response Data](#8-storing-response-data)
9. [Complete Examples](#9-complete-examples)
10. [Best Practices](#10-best-practices)
11. [Quick Reference](#11-quick-reference)

---

## 1. Overview

This guide provides standards for designing API test cases within the automation framework. API tests are defined using a structured JSON format that specifies the request configuration, expected results, and data validation rules.

### Test Case Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Action        │ ──▶ │   Data          │ ──▶ │ Expected Result │
│   (Description) │     │   (Request)     │     │ (Validation)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 2. Test Case Structure

Each API test case consists of three columns:

| Column              | Purpose                                            | Format     |
| ------------------- | -------------------------------------------------- | ---------- |
| **Action**          | Human-readable description of the test step        | Plain text |
| **Data**            | Request configuration (URL, Method, Headers, Body) | JSON       |
| **Expected Result** | Validation rules and data storage                  | JSON       |

### Basic Template

| Action                                                 | Data                                                                | Expected Result                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Trigger the [METHOD] request of [resource description] | `{ "URL": "...", "Method": "...", "Header": {...}, "Body": {...} }` | `{ "StatusCode": 200, "ValidateFields": {...}, "StoreFields": {...} }` |

---

## 3. Request Configuration

### 3.1 Request Structure

```json
{
  "URL": "{{url}}/rest/api/endpoint",
  "Method": "POST",
  "Header": {
    "Authorization": "Bearer {{YOUR_TOKEN_HERE}}",
    "Connection": "",
    "Accept": ""
  },
  "Body": {
    "key": "value"
  }
}
```

### 3.2 Supported HTTP Methods

| Method   | Use Case                     | Body Required |
| -------- | ---------------------------- | ------------- |
| `GET`    | Retrieve data                | No            |
| `POST`   | Create resource / Query data | Yes           |
| `PUT`    | Update entire resource       | Yes           |
| `PATCH`  | Partial update               | Yes           |
| `DELETE` | Remove resource              | Optional      |

### 3.3 URL Configuration

```json
{
  "URL": "{{url}}/rest/licensecategorymasters/datatable"
}
```

- Use `{{url}}` for base URL (configured in environment)
- Use `{{variableName}}` for dynamic path parameters
- Path parameters are resolved from stored values

**Examples:**

```json
// Static endpoint
"URL": "{{url}}/rest/users/list"

// Dynamic endpoint with stored variable
"URL": "{{url}}/rest/users/getbysid/{{userSid}}"

// Multiple dynamic parameters
"URL": "{{url}}/rest/{{module}}/{{action}}/{{id}}"
```

### 3.4 Header Configuration

```json
{
  "Header": {
    "Authorization": "Bearer {{YOUR_TOKEN_HERE}}",
    "Content-Type": "application/json",
    "Connection": "",
    "Accept": ""
  }
}
```

| Header          | Description              | Common Values         |
| --------------- | ------------------------ | --------------------- |
| `Authorization` | Authentication token     | `Bearer {{token}}`    |
| `Content-Type`  | Request body format      | `application/json`    |
| `Accept`        | Expected response format | `application/json`    |
| `Connection`    | Connection handling      | `keep-alive`, `close` |

> **Note:** Empty string `""` uses default values.

### 3.5 Request Body Configuration

#### Simple Body

```json
{
  "Body": {
    "name": "Test Category",
    "description": "Test Description"
  }
}
```

#### DataTable Query Body

```json
{
  "Body": {
    "start": 0,
    "length": 50,
    "search": {},
    "mapper": {},
    "columns": [
      {
        "data": "name",
        "name": "name",
        "searchable": true,
        "orderable": true,
        "search": {}
      },
      {
        "data": "description",
        "name": "description",
        "searchable": true,
        "orderable": true,
        "search": {}
      }
    ],
    "order": []
  }
}
```

#### Update Body with Dynamic Values

```json
{
  "Body": {
    "sid": "{{sid}}",
    "name": "Updated Name",
    "description": "Updated Description"
  }
}
```

---

## 4. Expected Result Configuration

### 4.1 Expected Result Structure

```json
{
  "StatusCode": 200,
  "ValidateFields": {
    "fieldName": "validationType"
  },
  "StoreFields": {
    "responseField": "storedVariableName"
  }
}
```

### 4.2 Status Code Validation

```json
{
  "StatusCode": 200
}
```

| Status Code | Meaning      | Use Case                   |
| ----------- | ------------ | -------------------------- |
| `200`       | OK           | Successful GET, PUT, PATCH |
| `201`       | Created      | Successful POST (create)   |
| `204`       | No Content   | Successful DELETE          |
| `400`       | Bad Request  | Validation error tests     |
| `401`       | Unauthorized | Auth failure tests         |
| `403`       | Forbidden    | Permission tests           |
| `404`       | Not Found    | Resource not found tests   |
| `500`       | Server Error | Error handling tests       |

---

## 5. Variable Interpolation

Variables allow dynamic data flow between test steps.

### 5.1 Syntax

```
{{variableName}}
```

### 5.2 Variable Sources

| Source       | Example                 | Description                         |
| ------------ | ----------------------- | ----------------------------------- |
| Environment  | `{{url}}`               | Base URL from config                |
| Stored Value | `{{sid}}`               | Value stored from previous response |
| Test Data    | `{{testData.userName}}` | Value from test data file           |
| Token        | `{{YOUR_TOKEN_HERE}}`   | Authentication token                |

### 5.3 Using Variables in Different Contexts

**In URL:**

```json
"URL": "{{url}}/rest/users/{{userId}}"
```

**In Headers:**

```json
"Header": {
  "Authorization": "Bearer {{authToken}}"
}
```

**In Body:**

```json
"Body": {
  "sid": "{{sid}}",
  "parentId": "{{parentSid}}"
}
```

**In Validation:**

```json
"ValidateFields": {
  "sid": "equals:{{sid}}",
  "description": "equals:{{categoryDescription}}"
}
```

---

## 6. Runtime Data Resolver

The Runtime Data Resolver provides dynamic placeholder replacement for generating test data at runtime. This allows you to use dynamic values like dates, random strings, UUIDs, and more in your test cases.

### 6.1 How It Works

Placeholders in the format `{{functionName}}` or `{{functionName(args)}}` are automatically resolved at runtime.

```
Input:  "User created on {{today}} with ID {{uuid}}"
Output: "User created on 2026-01-14 with ID 550e8400-e29b-41d4-a716-446655440000"
```

### 6.2 Available Placeholders

#### Date Functions

| Placeholder | Example Output | Description |
|-------------|----------------|-------------|
| `{{today}}` | `2026-01-14` | Today's date (YYYY-MM-DD) |
| `{{today:MM/DD/YYYY}}` | `01/14/2026` | Today with custom format |
| `{{tomorrow}}` | `2026-01-15` | Tomorrow's date |
| `{{yesterday}}` | `2026-01-13` | Yesterday's date |
| `{{addDays(5)}}` | `2026-01-19` | 5 days from today |
| `{{addDays(-3)}}` | `2026-01-11` | 3 days ago |
| `{{addMonths(1)}}` | `2026-02-14` | 1 month from today |
| `{{addYears(1)}}` | `2027-01-14` | 1 year from today |
| `{{addBusinessDays(5)}}` | `2026-01-21` | 5 business days from today |
| `{{nextBusinessDay}}` | `2026-01-15` | Next weekday |
| `{{firstDayOfMonth}}` | `2026-01-01` | First day of current month |
| `{{lastDayOfMonth}}` | `2026-01-31` | Last day of current month |
| `{{timestamp}}` | `1736870400000` | Current timestamp (ms) |

#### UUID/ID Functions

| Placeholder | Example Output | Description |
|-------------|----------------|-------------|
| `{{uuid}}` | `550e8400-e29b-41d4-a716-446655440000` | UUID v4 |
| `{{shortId}}` | `a1b2c3d4` | 8-character unique ID |
| `{{uniqueId(12)}}` | `a1b2c3d4e5f6` | Custom length unique ID |
| `{{timestampId}}` | `1736870400_a1b2` | Timestamp-based ID |
| `{{timestampId(PREFIX)}}` | `PREFIX_1736870400` | Prefixed timestamp ID |

#### Random Data Functions

| Placeholder | Example Output | Description |
|-------------|----------------|-------------|
| `{{randomString(10)}}` | `aBcDeFgHiJ` | Random 10-char string |
| `{{randomNumber(1,100)}}` | `42` | Random number in range |
| `{{randomEmail}}` | `abc123@example.com` | Random email address |
| `{{randomPhone}}` | `555-123-4567` | Random phone number |
| `{{randomAlphanumeric(8)}}` | `Ab3Cd5Ef` | Random alphanumeric string |
| `{{randomPassword(12)}}` | `aB3$dE5&fG7!` | Random password |

### 6.3 Using in Test Cases

#### In URL

```json
{
  "URL": "{{BASE_URL}}/api/users/{{uuid}}",
  "Method": "GET"
}
```

#### In Request Body

```json
{
  "URL": "{{BASE_URL}}/api/users",
  "Method": "POST",
  "Body": {
    "id": "{{uuid}}",
    "email": "{{randomEmail}}",
    "name": "Test User {{shortId}}",
    "createdAt": "{{today}}",
    "expiresAt": "{{addDays(30)}}"
  }
}
```

#### In Action Text

```json
{
  "action": "Enter {{randomEmail}} in emailField",
  "result": "Email entered"
}
```

### 6.4 Custom Date Formats

Use the colon syntax to specify custom date formats:

| Placeholder | Output |
|-------------|--------|
| `{{today:YYYY-MM-DD}}` | `2026-01-14` |
| `{{today:MM/DD/YYYY}}` | `01/14/2026` |
| `{{today:DD-MM-YYYY}}` | `14-01-2026` |
| `{{today:YYYY/MM/DD}}` | `2026/01/14` |

### 6.5 Combining with Stored Values

You can use stored values (from previous API responses) alongside dynamic placeholders:

```json
{
  "URL": "{{BASE_URL}}/api/users/{{userId}}/orders",
  "Method": "POST",
  "Body": {
    "orderId": "{{uuid}}",
    "userId": "{{userId}}",
    "orderDate": "{{today}}",
    "deliveryDate": "{{addBusinessDays(5)}}"
  }
}
```

### 6.6 Complete Test Case Example

```json
[
  {
    "name": "Create User with Dynamic Data",
    "jira": { "key": "TEST-123", "summary": "Create user with dynamic data" },
    "steps": [
      {
        "action": "Execute Create User API",
        "data": {
          "URL": "{{BASE_URL}}/api/users",
          "Method": "POST",
          "Header": {
            "Authorization": "Bearer",
            "Content-Type": "application/json"
          },
          "Body": {
            "id": "{{uuid}}",
            "email": "{{randomEmail}}",
            "phone": "{{randomPhone}}",
            "username": "user_{{shortId}}",
            "registrationDate": "{{today}}",
            "subscriptionExpiry": "{{addMonths(12)}}"
          }
        },
        "result": {
          "StatusCode": 201,
          "ValidateFields": {
            "id": "notNull",
            "email": "contains:@"
          },
          "StoreFields": {
            "id": "userId"
          }
        }
      },
      {
        "action": "Execute Get User API",
        "data": {
          "URL": "{{BASE_URL}}/api/users/{{userId}}",
          "Method": "GET"
        },
        "result": {
          "StatusCode": 200,
          "ValidateFields": {
            "id": "equals:{{userId}}"
          }
        }
      }
    ]
  }
]
```

---

## 7. Validation Types

### 6.1 Available Validators

| Validator     | Syntax                       | Description                  |
| ------------- | ---------------------------- | ---------------------------- |
| `notNull`     | `"field": "notNull"`         | Field exists and is not null |
| `string`      | `"field": "string"`          | Field is a string type       |
| `number`      | `"field": "number"`          | Field is numeric             |
| `boolean`     | `"field": "boolean"`         | Field is true/false          |
| `timestamp`   | `"field": "timestamp"`       | Field is valid timestamp     |
| `array`       | `"field": "array"`           | Field is an array            |
| `object`      | `"field": "object"`          | Field is an object           |
| `equals`      | `"field": "equals:value"`    | Field equals exact value     |
| `contains`    | `"field": "contains:text"`   | Field contains substring     |
| `startsWith`  | `"field": "startsWith:text"` | Field starts with text       |
| `endsWith`    | `"field": "endsWith:text"`   | Field ends with text         |
| `regex`       | `"field": "regex:pattern"`   | Field matches regex pattern  |
| `greaterThan` | `"field": "greaterThan:10"`  | Numeric comparison           |
| `lessThan`    | `"field": "lessThan:100"`    | Numeric comparison           |
| `length`      | `"field": "length:5"`        | String/array length          |
| `minLength`   | `"field": "minLength:1"`     | Minimum length               |
| `maxLength`   | `"field": "maxLength:50"`    | Maximum length               |

### 6.2 Type Validation Examples

```json
{
  "ValidateFields": {
    "sid": "notNull",
    "name": "string",
    "count": "number",
    "isActive": "boolean",
    "createdDate": "timestamp",
    "items": "array",
    "metadata": "object"
  }
}
```

### 6.3 Value Validation Examples

```json
{
  "ValidateFields": {
    "sid": "equals:{{sid}}",
    "name": "contains:Intangible",
    "status": "equals:ACTIVE",
    "email": "contains:@",
    "code": "startsWith:LC-",
    "version": "regex:^\\d+\\.\\d+\\.\\d+$"
  }
}
```

### 6.4 Numeric Validation Examples

```json
{
  "ValidateFields": {
    "count": "greaterThan:0",
    "percentage": "lessThan:100",
    "items": "minLength:1",
    "name": "maxLength:255"
  }
}
```

### 6.5 Nested Field Validation

For nested JSON responses, use dot notation:

```json
{
  "ValidateFields": {
    "data.user.name": "notNull",
    "data.user.email": "contains:@",
    "meta.pagination.total": "greaterThan:0"
  }
}
```

### 6.6 Array Element Validation

```json
{
  "ValidateFields": {
    "items[0].name": "notNull",
    "items[0].status": "equals:ACTIVE",
    "data[*].id": "notNull"
  }
}
```

---

## 8. Storing Response Data

### 8.1 StoreFields Syntax

```json
{
  "StoreFields": {
    "responseFieldPath": "variableName"
  }
}
```

### 8.2 Basic Storage

```json
{
  "StoreFields": {
    "sid": "sid",
    "description": "categoryDescription",
    "createdDate": "createdDate"
  }
}
```

This stores:

- Response `sid` → Variable `{{sid}}`
- Response `description` → Variable `{{categoryDescription}}`
- Response `createdDate` → Variable `{{createdDate}}`

### 8.3 Nested Field Storage

```json
{
  "StoreFields": {
    "data.user.id": "userId",
    "data.token.accessToken": "authToken",
    "meta.pagination.nextPage": "nextPageUrl"
  }
}
```

### 8.4 Array Element Storage

```json
{
  "StoreFields": {
    "data[0].sid": "firstItemSid",
    "items[0].name": "firstItemName"
  }
}
```

### 8.5 Using Stored Values

Once stored, variables can be used in subsequent steps:

**Step 1 - Store:**

```json
{
  "StoreFields": {
    "sid": "categorySid"
  }
}
```

**Step 2 - Use:**

```json
{
  "URL": "{{url}}/rest/categories/{{categorySid}}",
  "Body": {
    "parentSid": "{{categorySid}}"
  }
}
```

---

## 9. Complete Examples

### 8.1 POST Request - List Data (DataTable)

| Action                                                         | Data      | Expected Result |
| -------------------------------------------------------------- | --------- | --------------- |
| Trigger the POST request for license category master datatable | See below | See below       |

**Data:**

```json
{
  "URL": "{{url}}/rest/licensecategorymasters/datatable",
  "Method": "POST",
  "Header": {
    "Authorization": "Bearer {{YOUR_TOKEN_HERE}}",
    "Connection": "",
    "Accept": ""
  },
  "Body": {
    "start": 0,
    "length": 50,
    "search": {},
    "mapper": {},
    "columns": [
      {
        "data": "name",
        "name": "name",
        "searchable": true,
        "orderable": true,
        "search": {}
      },
      {
        "data": "description",
        "name": "description",
        "searchable": true,
        "orderable": true,
        "search": {}
      }
    ],
    "order": []
  }
}
```

**Expected Result:**

```json
{
  "StatusCode": 200,
  "ValidateFields": {
    "sid": "notNull",
    "name": "string",
    "description": "string",
    "createdDate": "timestamp"
  },
  "StoreFields": {
    "sid": "sid",
    "description": "categoryDescription",
    "createdDate": "createdDate"
  }
}
```

---

### 8.2 GET Request - Retrieve by ID

| Action                                                      | Data      | Expected Result |
| ----------------------------------------------------------- | --------- | --------------- |
| Trigger the GET request to retrieve license category by SID | See below | See below       |

**Data:**

```json
{
  "URL": "{{url}}/rest/licensecategorymasters/getbysidunique/{{sid}}",
  "Method": "GET",
  "Header": {
    "Authorization": "Bearer {{YOUR_TOKEN_HERE}}",
    "Connection": "",
    "Accept": ""
  }
}
```

**Expected Result:**

```json
{
  "StatusCode": 200,
  "ValidateFields": {
    "sid": "equals:{{sid}}",
    "name": "contains:Intangible",
    "description": "equals:{{categoryDescription}}"
  }
}
```

---

### 8.3 POST Request - Update Resource

| Action                                              | Data      | Expected Result |
| --------------------------------------------------- | --------- | --------------- |
| Trigger the POST request to update license category | See below | See below       |

**Data:**

```json
{
  "URL": "{{url}}/rest/licensecategorymasters/datatable",
  "Method": "POST",
  "Header": {
    "Authorization": "Bearer {{YOUR_TOKEN_HERE}}",
    "Connection": "",
    "Accept": ""
  },
  "Body": {
    "sid": "{{sid}}",
    "name": "Intangible",
    "description": "Intangible Asset or Software Asset."
  }
}
```

**Expected Result:**

```json
{
  "StatusCode": 200,
  "ValidateFields": {
    "sid": "equals:{{sid}}",
    "name": "contains:Intangible",
    "description": "equals:Intangible Asset or Software Asset."
  }
}
```

---

### 8.4 DELETE Request

| Action                                                | Data      | Expected Result |
| ----------------------------------------------------- | --------- | --------------- |
| Trigger the DELETE request to remove license category | See below | See below       |

**Data:**

```json
{
  "URL": "{{url}}/rest/licensecategorymasters/{{sid}}",
  "Method": "DELETE",
  "Header": {
    "Authorization": "Bearer {{YOUR_TOKEN_HERE}}",
    "Connection": "",
    "Accept": ""
  }
}
```

**Expected Result:**

```json
{
  "StatusCode": 200,
  "ValidateFields": {
    "message": "contains:deleted successfully"
  }
}
```

---

### 8.5 Authentication Request

| Action                                    | Data      | Expected Result |
| ----------------------------------------- | --------- | --------------- |
| Trigger POST request to authenticate user | See below | See below       |

**Data:**

```json
{
  "URL": "{{url}}/rest/auth/login",
  "Method": "POST",
  "Header": {
    "Content-Type": "application/json"
  },
  "Body": {
    "username": "{{username}}",
    "password": "{{password}}"
  }
}
```

**Expected Result:**

```json
{
  "StatusCode": 200,
  "ValidateFields": {
    "accessToken": "notNull",
    "refreshToken": "notNull",
    "expiresIn": "greaterThan:0",
    "tokenType": "equals:Bearer"
  },
  "StoreFields": {
    "accessToken": "YOUR_TOKEN_HERE",
    "refreshToken": "refreshToken"
  }
}
```

---

### 8.6 Pagination Test

| Action                                        | Data      | Expected Result |
| --------------------------------------------- | --------- | --------------- |
| Trigger POST request to get paginated results | See below | See below       |

**Data:**

```json
{
  "URL": "{{url}}/rest/items/datatable",
  "Method": "POST",
  "Header": {
    "Authorization": "Bearer {{YOUR_TOKEN_HERE}}"
  },
  "Body": {
    "start": 0,
    "length": 10,
    "search": {},
    "order": [{ "column": 0, "dir": "asc" }]
  }
}
```

**Expected Result:**

```json
{
  "StatusCode": 200,
  "ValidateFields": {
    "data": "array",
    "data": "minLength:1",
    "recordsTotal": "greaterThan:0",
    "recordsFiltered": "greaterThan:0"
  },
  "StoreFields": {
    "recordsTotal": "totalRecords",
    "data[0].sid": "firstRecordSid"
  }
}
```

---

### 8.7 Error Handling Test

| Action                                                        | Data      | Expected Result |
| ------------------------------------------------------------- | --------- | --------------- |
| Trigger GET request with invalid SID to verify error handling | See below | See below       |

**Data:**

```json
{
  "URL": "{{url}}/rest/licensecategorymasters/getbysidunique/INVALID_SID",
  "Method": "GET",
  "Header": {
    "Authorization": "Bearer {{YOUR_TOKEN_HERE}}"
  }
}
```

**Expected Result:**

```json
{
  "StatusCode": 404,
  "ValidateFields": {
    "error": "notNull",
    "message": "contains:not found"
  }
}
```

---

## 10. Best Practices

### 9.1 Test Case Design

| Practice                      | Description                                              |
| ----------------------------- | -------------------------------------------------------- |
| **Descriptive Actions**       | Write clear, human-readable action descriptions          |
| **Unique Variable Names**     | Use descriptive names like `categorySid` instead of `id` |
| **Validate Important Fields** | Don't over-validate; focus on business-critical fields   |
| **Chain Tests Logically**     | Create → Read → Update → Delete (CRUD sequence)          |
| **Store Reusable Data**       | Store IDs, tokens, and values needed in later steps      |

### 9.2 Action Description Guidelines

✅ **Good:**

```
Trigger the POST request to create a new license category
Trigger the GET request to retrieve license category by SID
Trigger the PUT request to update license category details
Trigger the DELETE request to remove the license category
```

❌ **Bad:**

```
POST request
Get category
Update
Delete it
```

### 9.3 Variable Naming Conventions

| Type         | Convention                    | Example                       |
| ------------ | ----------------------------- | ----------------------------- |
| IDs/SIDs     | `{entity}Sid` or `{entity}Id` | `categorySid`, `userId`       |
| Tokens       | `{type}Token`                 | `accessToken`, `refreshToken` |
| Descriptions | `{entity}Description`         | `categoryDescription`         |
| Names        | `{entity}Name`                | `categoryName`, `userName`    |
| Dates        | `{entity}{DateType}`          | `createdDate`, `modifiedDate` |

### 9.4 Validation Strategy

```
1. Always validate StatusCode first
2. Validate primary identifier (sid/id) - usually notNull or equals
3. Validate business-critical fields
4. Validate data types for important fields
5. Store values needed for subsequent tests
```

### 9.5 Test Data Flow Example

```
Step 1: Create Category
  └── Store: sid → categorySid, name → categoryName

Step 2: Get Category by SID
  └── Use: {{categorySid}}
  └── Validate: sid equals {{categorySid}}

Step 3: Update Category
  └── Use: {{categorySid}} in body
  └── Validate: updated fields

Step 4: Delete Category
  └── Use: {{categorySid}} in URL
  └── Validate: deletion success
```

---

## 11. Quick Reference

### Request Template

```json
{
  "URL": "{{url}}/rest/endpoint/{{pathParam}}",
  "Method": "POST|GET|PUT|PATCH|DELETE",
  "Header": {
    "Authorization": "Bearer {{YOUR_TOKEN_HERE}}",
    "Content-Type": "application/json"
  },
  "Body": {
    "key": "value",
    "dynamicKey": "{{storedValue}}"
  }
}
```

### Expected Result Template

```json
{
  "StatusCode": 200,
  "ValidateFields": {
    "field1": "notNull",
    "field2": "string",
    "field3": "equals:{{expectedValue}}",
    "field4": "contains:partialText"
  },
  "StoreFields": {
    "responseField": "variableName"
  }
}
```

### Validation Quick Reference

| Type Check | Syntax                 |
| ---------- | ---------------------- |
| Not null   | `"field": "notNull"`   |
| String     | `"field": "string"`    |
| Number     | `"field": "number"`    |
| Boolean    | `"field": "boolean"`   |
| Timestamp  | `"field": "timestamp"` |
| Array      | `"field": "array"`     |

| Value Check | Syntax                       |
| ----------- | ---------------------------- |
| Equals      | `"field": "equals:value"`    |
| Contains    | `"field": "contains:text"`   |
| Starts with | `"field": "startsWith:text"` |
| Ends with   | `"field": "endsWith:text"`   |
| Regex       | `"field": "regex:pattern"`   |

| Numeric Check | Syntax                      |
| ------------- | --------------------------- |
| Greater than  | `"field": "greaterThan:10"` |
| Less than     | `"field": "lessThan:100"`   |
| Length equals | `"field": "length:5"`       |
| Min length    | `"field": "minLength:1"`    |
| Max length    | `"field": "maxLength:50"`   |

---

## Appendix: Sample Test Suite

### License Category Master - Full CRUD Test Suite

| Step | Action                                | Data                                                                                                                                                                                                                  | Expected Result                                                                                      |
| ---- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1    | Authenticate user to get access token | `{"URL":"{{url}}/rest/auth/login","Method":"POST","Body":{"username":"admin","password":"admin123"}}`                                                                                                                 | `{"StatusCode":200,"StoreFields":{"accessToken":"YOUR_TOKEN_HERE"}}`                                 |
| 2    | Create new license category           | `{"URL":"{{url}}/rest/licensecategorymasters","Method":"POST","Header":{"Authorization":"Bearer {{YOUR_TOKEN_HERE}}"},"Body":{"name":"Test Category","description":"Test Description"}}`                              | `{"StatusCode":201,"ValidateFields":{"sid":"notNull"},"StoreFields":{"sid":"categorySid"}}`          |
| 3    | Retrieve created category             | `{"URL":"{{url}}/rest/licensecategorymasters/{{categorySid}}","Method":"GET","Header":{"Authorization":"Bearer {{YOUR_TOKEN_HERE}}"}}`                                                                                | `{"StatusCode":200,"ValidateFields":{"sid":"equals:{{categorySid}}","name":"equals:Test Category"}}` |
| 4    | Update category                       | `{"URL":"{{url}}/rest/licensecategorymasters","Method":"PUT","Header":{"Authorization":"Bearer {{YOUR_TOKEN_HERE}}"},"Body":{"sid":"{{categorySid}}","name":"Updated Category","description":"Updated Description"}}` | `{"StatusCode":200,"ValidateFields":{"name":"equals:Updated Category"}}`                             |
| 5    | Delete category                       | `{"URL":"{{url}}/rest/licensecategorymasters/{{categorySid}}","Method":"DELETE","Header":{"Authorization":"Bearer {{YOUR_TOKEN_HERE}}"}}`                                                                             | `{"StatusCode":200}`                                                                                 |
| 6    | Verify deletion                       | `{"URL":"{{url}}/rest/licensecategorymasters/{{categorySid}}","Method":"GET","Header":{"Authorization":"Bearer {{YOUR_TOKEN_HERE}}"}}`                                                                                | `{"StatusCode":404}`                                                                                 |

---

_Document Version: 1.0_  
_Last Updated: December 2024_
