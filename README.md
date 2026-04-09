# @rappit/ps-test-automation-base

**PS Test Automation Base**

A powerful, reusable framework providing complete test automation capabilities including web UI testing, API testing, data management, AI-powered failure analysis, evidence capture, intelligent recovery mechanisms, and seamless third-party integrations (Xray, Jira). Built for enterprise-scale test automation with advanced step execution engine, action handlers, configuration management, and cross-project orchestration.

## 🚀 Key Features

- **🔧 Step Execution Engine** - Advanced action dispatcher with 20+ built-in actions
- **🌐 Web & API Testing** - Complete browser automation and REST API testing
- **🤖 AI Failure Analysis** - Intelligent test failure diagnosis and reporting
- **📊 Data Management** - Dynamic data generation, Excel operations, and runtime data handling
- **🖼️ Evidence Capture** - Screenshots, videos, and comprehensive test artifacts
- **🔄 Recovery Mechanisms** - Smart retry logic and failure recovery strategies
- **🔗 Third-party Integrations** - Xray, Jira, and custom integration support
- **⚙️ Configuration Management** - Flexible timeouts, selectors, and environment configs
- **📈 Test Orchestration** - Cross-project test execution and reporting

## 📦 Package Structure

This package provides the core automation components that can be reused across multiple projects.

```
ps-test-automation-base/
├── src/
│   ├── index.ts              # Main exports
│   ├── types/                # TypeScript type definitions
│   ├── config/               # Configuration (timeouts, retries)
│   ├── steps/                # Step execution engine
│   │   ├── actions/          # Action handlers (click, enter, etc.)
│   │   ├── API/              # API action handlers
│   │   └── functions/        # Custom function handlers
│   ├── recovery/             # Retry and recovery mechanisms
│   ├── execution/            # Test orchestration
│   ├── evidence/             # Screenshot and evidence capture
│   ├── data/                 # Data utilities
│   ├── ai/                   # AI-powered failure analysis
│   ├── helpers/              # Utility functions
│   ├── caseLoader/           # Test case loading
│   ├── excelOperations/      # Excel file handling
│   ├── integrationLibrary/   # Third-party integrations (Xray, etc.)
│   └── security/             # Security utilities
├── package.json
├── tsconfig.json
└── README.md
```

## � Functional Overview

### Core Components

| Component | Functionality | Key Features |
|-----------|---------------|--------------|
| **Step Execution Engine** | Orchestrates test step execution with action dispatching | 20+ built-in actions, custom function support, error handling |
| **Action Handlers** | Web element interactions and validations | Click, type, select, drag-drop, hover, scroll, assert, wait |
| **API Testing** | Complete REST API testing capabilities | HTTP methods, authentication, response validation, data extraction |
| **Data Management** | Dynamic test data generation and handling | Random data, Excel operations, CSV processing, runtime data storage |
| **AI Analysis** | Intelligent test failure diagnosis | Root cause analysis, failure pattern recognition, automated reporting |
| **Evidence Capture** | Comprehensive test artifact collection | Screenshots, videos, logs, performance metrics, custom evidence |
| **Recovery Mechanisms** | Intelligent failure recovery and retry logic | Smart retries, alternative actions, state recovery, timeout handling |
| **Configuration** | Flexible test environment setup | Timeouts, selectors, hooks, environment-specific configs |
| **Integration Library** | Third-party tool integrations | Xray test management, Jira issue tracking, custom API integrations |
| **Security** | Security testing and validation utilities | Origin validation, secure data handling, authentication helpers |

### Workflow Capabilities

- **🔄 Test Orchestration** - Coordinate complex multi-step test scenarios
- **📊 Data-Driven Testing** - Excel/CSV data sources with dynamic parameterization
- **🔍 Intelligent Assertions** - Smart validation with detailed failure reporting
- **📈 Performance Monitoring** - Built-in performance metrics and thresholds
- **🔗 Cross-System Integration** - Seamless interaction between web, API, and databases
- **🎯 Smart Wait Strategies** - Intelligent element waiting and synchronization
- **📋 Test Case Management** - JSON-based test case definitions with metadata
- **🚨 Failure Intelligence** - AI-powered failure analysis and recovery suggestions

## �🚀 Installation

```bash
npm install @rappit/ps-test-automation-base
```

## 📝 Migration Steps

To migrate from a monolithic framework to using this core library:

### 1. Update Import Paths

Before (monolithic):
```typescript
import { StepExecutor } from '../coreLibraries/steps/StepExecutor';
import { RetryHandler } from '../coreLibraries/recovery/RetryHandler';
import { TIMEOUTS } from '../config/timeouts.config';
```

After (with core library):
```typescript
import { StepExecutor, RetryHandler, TIMEOUTS } from '@rappit/ps-test-automation-base';
```

### 2. Project-Specific Files (Keep in Your Project)

These files are project-specific and should NOT be in the core library:
- `tests/` - Your test spec files
- `testcases/` - JSON test case definitions
- `testdata/` - Test data and fixtures
- `page-objects/` - Page object definitions (objectMap.ts)
- `pages/` - Page-specific implementations
- `playwright.config.js` - Project-specific Playwright config
- `config/dev.config.ts`, `config/uat.config.ts`, `config/prod.config.ts` - Environment configs

### 3. Core Library Components (Shared)

These are in the core library:
- Step execution engine
- Action handlers (click, enter, validate, etc.)
- Retry/Recovery mechanisms
- Evidence capture
- Data generators and utilities
- AI failure analysis
- Integration with Xray, Allure, etc.

## 🔧 Configuration

### Timeout Configuration

```typescript
import { TIMEOUTS, isRetryEnabled } from '@rappit/ps-test-automation-base';

// Access timeout values
console.log(TIMEOUTS.defaultTimeout);     // 30000
console.log(TIMEOUTS.retryMaxAttempts);   // 2
console.log(isRetryEnabled());            // true
```

### Override Retry Settings

```typescript
import { StepExecutor } from '@rappit/ps-test-automation-base';

const executor = new StepExecutor(page, { 
  enableRetry: false // Disable retry for this instance
});
```

## 📚 Usage Examples

### Step Execution

```typescript
import { StepExecutor } from '@rappit/ps-test-automation-base';

const executor = new StepExecutor(page);
await executor.execute({
  action: 'click',
  target: 'submitButton',
  description: 'Click submit button'
});
```

### Retry Handler

```typescript
import { RetryHandler } from '@rappit/ps-test-automation-base';

const retryHandler = new RetryHandler(page, {
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true
});

await retryHandler.executeWithRetry(
  async () => await element.click(),
  'Click Submit Button'
);
```

### Data Generation

```typescript
import { generateRandomEmail, generateRandomNumber } from '@rappit/ps-test-automation-base';

const email = generateRandomEmail();
const accountNumber = generateRandomNumber(10);
```

## 🏗️ Building

```bash
# Clean and build
npm run build

# Watch mode for development
npm run build:watch

# Clean build artifacts
npm run clean
```

## 🧹 Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## 🔐 Security and Quality Gates

This repository uses:
- **GitLeaks** to detect secrets (tokens, passwords, keys) before merge.
- **SonarQube** to enforce static code quality and security quality gates.

### CI Variables (GitLab)

Configure these in **Project Settings → CI/CD → Variables**:

- `SONAR_HOST_URL` - SonarQube server URL
- `SONAR_TOKEN` - SonarQube token with analysis permissions

### Pipeline Behavior

The GitLab pipeline runs these gates on `merge_requests` and `ps-test-automation-base` branch:

1. `lint` (ESLint)
2. `gitleaks` (secret scanning)
3. `build` (TypeScript build)
4. `sonarqube` (quality gate check with `sonar.qualitygate.wait=true`)

Any GitLeaks finding or SonarQube quality gate failure blocks the pipeline.

### Local Validation

```bash
# Lint and build
npm ci
npm run lint
npm run build

# GitLeaks local scan (install required)
gitleaks detect --source . --config .gitleaks.toml --redact

# SonarQube local scan (scanner + env vars required)
sonar-scanner
```

### Config Files

- `.gitleaks.toml` - GitLeaks rules and allowlist tuning
- `sonar-project.properties` - SonarQube project and scan settings
- `.gitlab-ci.yml` - CI stages for lint, security, build, and analysis

## 📦 Publishing

The package is configured for GitHub Packages by default. To publish:

```bash
npm run prepublishOnly  # Automatically runs clean and build
npm publish
```

To use as a local package during development:

```bash
# Option 1: Install from local path
cd your-project
npm install ../ps-test-automation-base

# Option 2: Use npm link
cd ps-test-automation-base
npm link

cd your-project
npm link @rappit/ps-test-automation-base
```

## 🎯 Features

### Action Handlers
- ✅ Click, Double Click, Hover
- ✅ Enter/Type, Check/Uncheck
- ✅ Dropdown Selection
- ✅ Drag & Drop
- ✅ File Upload/Download
- ✅ Alert Handling
- ✅ IFrame Operations
- ✅ Page Navigation & Switching
- ✅ Scroll Actions
- ✅ Wait Operations
- ✅ Validation & Assertions
- ✅ Store/Retrieve Data

### API Testing
- ✅ RESTful API handler
- ✅ Request/Response validation
- ✅ Authentication support

### AI Integration
- ✅ MCP (Model Context Protocol) client
- ✅ AI-powered failure analysis
- ✅ Intelligent error recovery suggestions

### Test Management
- ✅ Xray integration
- ✅ Test plan processing
- ✅ Execution tracking
- ✅ Report generation


### Excel Operations
- ✅ Excel to JSON conversion
- ✅ Result updates
- ✅ Report server

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [AI-and-Security-Guide.md](docs/AI-and-Security-Guide.md) | AI-powered failure analysis, self-healing locators, security configuration |
| [API-Test-Design-Guide.md](docs/API-Test-Design-Guide.md) | How to design API test cases using the framework |
| [Retry-Recovery-Guide.md](docs/Retry-Recovery-Guide.md) | Step-level retry mechanism and recovery actions |
| [TestCase-Guideline.md](docs/TestCase-Guideline.md) | Complete reference for action keywords and test case authoring |

These documents describe features provided by `@rappit/ps-test-automation-base`.

Projects that use this library should refer to these docs for:
- Understanding action handlers (click, enter, select, etc.)
- API test configuration
- Retry/recovery behavior
- AI and security features

## 🔌 Subpath Exports

The package supports subpath exports for optimized imports:

```typescript
// Main export
import { StepExecutor } from '@rappit/ps-test-automation-base';

// Specific modules
import { RetryHandler } from '@rappit/ps-test-automation-base/recovery';
import { TestExecutionOrchestrator } from '@rappit/ps-test-automation-base/execution';
import { generateRandomEmail } from '@rappit/ps-test-automation-base/data';
import { logger } from '@rappit/ps-test-automation-base/helpers';
import { EvidenceCapture } from '@rappit/ps-test-automation-base/evidence';
import { AIService } from '@rappit/ps-test-automation-base/ai';
import { TIMEOUTS } from '@rappit/ps-test-automation-base/config';
import { TestFileLoader } from '@rappit/ps-test-automation-base/caseLoader';
import { XrayAPI } from '@rappit/ps-test-automation-base/integrationLibrary';
import { TestStep } from '@rappit/ps-test-automation-base/types';
```

## 🛠️ Dependencies

### Peer Dependencies
- `@playwright/test` >= 1.57.0

### Core Dependencies
- `@modelcontextprotocol/sdk` - AI integration
- `axios` - HTTP client
- `winston` - Logging
- `xlsx` - Excel operations
- `dotenv` - Environment configuration
- `pdfkit` - PDF generation

## 📄 License

MIT

## 🤝 Contributing

1. Clone the repository
2. Install dependencies: `npm install`
3. Make your changes
4. Run linter: `npm run lint:fix`
5. Format code: `npm run format`
6. Build: `npm run build`
7. Test your changes
8. Submit a pull request

## 🌟 Version Management

Current version: 1.0.0

For detailed version management strategies, publishing workflows, and best practices, see:
- [Version Management Guide](./docs/Version-Management-Guide.md)
- [Local Development Setup](./docs/Local-Development-Setup.md)

## ⚙️ Requirements

- Node.js >= 18.0.0
- Playwright >= 1.57.0
