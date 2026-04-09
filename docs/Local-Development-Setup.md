# Local Development Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Version | Check Command |
|------|---------|---------------|
| Node.js | >= 18.0.0 | `node --version` |
| npm | >= 9.0.0 | `npm --version` |
| Git | Latest | `git --version` |
| gcloud CLI | Latest | `gcloud --version` |

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://gitlab.rappit.io/qab/automationframework.git
cd automationframework
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

### 4. Verify Setup

```bash
# Check for linting errors
npm run lint

# Verify build output exists
ls -la dist/
```

---

## 📦 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Build | `npm run build` | Compile TypeScript to JavaScript |
| Build Watch | `npm run build:watch` | Compile with file watching |
| Lint | `npm run lint` | Run ESLint checks |
| Lint Fix | `npm run lint:fix` | Auto-fix linting issues |
| Format | `npm run format` | Format code with Prettier |
| Format Check | `npm run format:check` | Check code formatting |
| Clean | `npm run clean` | Remove dist, node_modules, package-lock.json |
| Clean Dist | `npm run clean:dist` | Remove only dist folder |
| Rebuild & Link | `npm run rebuild:link` | Full rebuild and npm link |

---

## 🔗 Local Development with npm link

When developing this core library alongside a consumer project, use `npm link` to test changes without publishing.

### Step 1: Link the Core Library

```bash
# In the core library directory
cd /path/to/ps-test-automation-base

# Build and create global link
npm run rebuild:link
# OR manually:
npm run clean
npm install
npm run build
npm link
```

### Step 2: Use the Link in Consumer Project

```bash
# In your consumer project directory
cd /path/to/your-test-project

# Link to the local core library
npm link @rappit/ps-test-automation-base
```

### Step 3: Verify the Link

```bash
# Check where the package is linked from
npm ls @rappit/ps-test-automation-base
# Should show: -> /path/to/ps-test-automation-base
```

### Step 4: Unlink When Done

```bash
# In consumer project
npm unlink @rappit/ps-test-automation-base
npm install

# In core library (optional - remove global link)
npm unlink
```

---

## 🔄 Development Workflow

### Making Changes

1. **Make code changes** in `src/` directory

2. **Rebuild the library**
   ```bash
   npm run build
   # OR for continuous rebuilding:
   npm run build:watch
   ```

3. **Run linting**
   ```bash
   npm run lint:fix
   ```

4. **Test in consumer project** (if using npm link, changes are reflected automatically after rebuild)

### Recommended Workflow with Watch Mode

Open two terminals:

**Terminal 1 - Core Library (watch mode):**
```bash
cd /path/to/ps-test-automation-base
npm run build:watch
```

**Terminal 2 - Consumer Project (run tests):**
```bash
cd /path/to/your-test-project
npx playwright test
```

---

## 📤 Publishing via GitLab CI (Required)

Publishing is handled **only** through the GitLab CI pipeline. Do not publish locally.

### How Publishing Works

1. **Trigger**: Push to the `ps-test-automation-base` branch.
2. **Build**: CI installs dependencies, lints, and builds the package.
3. **Version Bump**: CI updates the version based on the `VERSION_BUMP` variable.
4. **Publish**: CI authenticates using Workload Identity and publishes to GCP Artifact Registry.

### Choose Version Bump Type

Set the `VERSION_BUMP` variable in GitLab CI/CD variables (or override in the pipeline UI):

- `patch` (default): bug fixes
- `minor`: new features
- `major`: breaking changes
- `prerelease`, `prepatch`, `preminor`, `premajor`: pre-release versions

### Steps to Publish

1. **Commit and push changes** to `ps-test-automation-base`.
2. **Run the publish job** manually (the `publish` stage is `when: manual`).
3. **Verify** the published version in Artifact Registry or via:
   ```bash
   npm view @rappit/ps-test-automation-base
   ```

> 🔒 **Note**: Authentication is managed by GitLab OIDC and Workload Identity Federation.
> Local authentication and manual publishing are not supported.

### Version Management

```bash
# Bump patch version (1.0.0 -> 1.0.1)
npm version patch

# Bump minor version (1.0.0 -> 1.1.0)
npm version minor

# Bump major version (1.0.0 -> 2.0.0)
npm version major

# Set specific version
npm version 1.2.3
```

---

## 🏗️ Project Structure

```
ps-test-automation-base/
├── src/                          # Source code
│   ├── index.ts                  # Main exports
│   ├── ai/                       # AI-powered analysis
│   ├── caseLoader/               # Test case loading
│   ├── config/                   # Configuration
│   │   └── hooks/                # Global setup/teardown
│   ├── data/                     # Data utilities
│   ├── evidence/                 # Screenshot capture
│   ├── excelOperations/          # Excel handling
│   ├── execution/                # Test orchestration
│   ├── expectedResult/           # Result validation
│   ├── helpers/                  # Utility functions
│   ├── integrationLibrary/       # Third-party integrations
│   │   ├── api/                  # REST API handlers
│   │   └── testManagement/       # Xray integration
│   ├── page-objects/             # Object mapping
│   ├── pages/                    # Page context management
│   ├── recovery/                 # Retry mechanisms
│   ├── security/                 # Security utilities
│   ├── steps/                    # Step execution
│   │   ├── actions/              # UI action handlers
│   │   ├── API/                  # API action handlers
│   │   └── functions/            # Custom functions
│   ├── testdata/                 # Test data store
│   └── types/                    # TypeScript types
├── dist/                         # Compiled output (generated)
├── docs/                         # Documentation
├── .gitlab-ci.yml                # CI/CD pipeline
├── .npmrc                        # npm registry config
├── eslint.config.mjs             # ESLint configuration
├── package.json                  # Package manifest
├── tsconfig.json                 # TypeScript config
└── README.md                     # Project readme
```

---

## 🐛 Troubleshooting

### Common Issues

#### 1. `tsc: not found`
```bash
# TypeScript not installed
npm install

# Or install globally (not recommended)
npm install -g typescript
```

#### 2. `ENEEDAUTH` during npm publish
```bash
# Token expired or not set
npm run gcp:auth

# Verify .npmrc has correct registry
cat .npmrc
```

#### 3. npm link not working
```bash
# Ensure build exists
npm run build

# Re-create link
npm unlink
npm link

# In consumer project
npm unlink @rappit/ps-test-automation-base
npm link @rappit/ps-test-automation-base
```

#### 4. Type errors after changes
```bash
# Clean and rebuild
npm run clean:dist
npm run build
```

#### 5. Changes not reflecting in consumer project
```bash
# Ensure build is running
npm run build

# Check link is active
npm ls @rappit/ps-test-automation-base

# If using npm link, no reinstall needed
# If using published version, update:
npm update @rappit/ps-test-automation-base
```

---

## � Version Management Guide

### Version Management Strategies

This guide covers different versioning approaches for your Playwright core library.

### 🎯 Semantic Versioning (SemVer)

We follow [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

| Version Type | When to Use | Example |
|--------------|-------------|---------|
| **MAJOR** | Breaking changes | `2.0.0` |
| **MINOR** | New features (backward compatible) | `1.1.0` |
| **PATCH** | Bug fixes (backward compatible) | `1.0.1` |

### 🔧 Version Management Options

#### 1. Automatic Version Bumping (CI/CD)

The CI pipeline automatically bumps versions based on the `VERSION_BUMP` variable:

```yaml
# In .gitlab-ci.yml
variables:
  VERSION_BUMP: "patch"  # Change this: patch, minor, major, prerelease, etc.
```

**Available options:**
- `patch` - 1.0.0 → 1.0.1 (default)
- `minor` - 1.0.0 → 1.1.0
- `major` - 1.0.0 → 2.0.0
- `prerelease` - 1.0.0 → 1.0.1-alpha.0
- `prepatch` - 1.0.0 → 1.0.1-alpha.0
- `preminor` - 1.0.1 → 1.1.0-alpha.0
- `premajor` - 1.0.1 → 2.0.0-alpha.0

#### 2. Manual Version Management

For more control, bump versions manually before pushing:

```bash
# Bump patch version
npm run version:patch    # 1.0.0 → 1.0.1

# Bump minor version
npm run version:minor    # 1.0.0 → 1.1.0

# Bump major version
npm run version:major    # 1.0.0 → 2.0.0

# Prerelease versions
npm run version:prerelease  # 1.0.0 → 1.0.1-alpha.0
npm run version:prepatch    # 1.0.0 → 1.0.1-alpha.0
npm run version:preminor    # 1.0.0 → 1.1.0-alpha.0
npm run version:premajor    # 1.0.0 → 2.0.0-alpha.0
```

#### 3. Set Specific Version

```bash
# Set exact version
npm version 2.1.5

# Set prerelease version
npm version 2.1.5-beta.1
```

### 🚀 Publishing Workflows

#### Workflow 1: Automatic CI Publishing (Recommended)

1. **Make changes** and commit to a branch
2. **Create a merge request** to `ps-test-automation-base` branch
3. **Set VERSION_BUMP variable** in CI/CD settings or pipeline:
   ```yaml
   variables:
     VERSION_BUMP: "minor"  # For new features
   ```
4. **Merge the MR** - CI automatically publishes with bumped version

#### Workflow 2: Manual Publishing

```bash
# 1. Make changes and commit
git add .
git commit -m "Add new feature"

# 2. Bump version manually
npm run version:minor

# 3. Push changes (including version bump)
git add package.json
git commit -m "Bump version to 1.1.0"
git push

# 4. Publish manually
npm run gcp:auth
npm run gcp:publish
```

#### Workflow 3: Prerelease for Testing

```bash
# Create alpha/beta versions for testing
npm run version:prerelease  # Creates 1.0.1-alpha.0
npm run gcp:publish

# Test in consumer projects
npm install @rappit/ps-test-automation-base@1.0.1-alpha.0

# When ready for release
npm run version:patch       # Converts to 1.0.1
npm run gcp:publish
```

### 📊 Version Control Examples

| Scenario | VERSION_BUMP | Current Version | Result Version | Use Case |
|----------|-------------|-----------------|----------------|----------|
| Bug fixes | `patch` | 1.0.0 | 1.0.1 | Hotfixes, small patches |
| New features | `minor` | 1.0.0 | 1.1.0 | Feature additions |
| Breaking changes | `major` | 1.0.0 | 2.0.0 | API breaking changes |
| **Prerelease testing** | `prerelease` | 1.0.0 | 1.0.1-alpha.0 | First prerelease |
| | `prerelease` | 1.0.1-alpha.0 | 1.0.1-alpha.1 | Subsequent prerelease |
| **Pre-patch testing** | `prepatch` | 1.0.0 | 1.0.1-alpha.0 | Test patch release |
| | `prepatch` | 1.0.1-alpha.0 | 1.0.1-alpha.1 | Next prepatch |
| **Pre-minor testing** | `preminor` | 1.0.0 | 1.1.0-alpha.0 | Test minor release |
| | `preminor` | 1.1.0-alpha.0 | 1.1.0-alpha.1 | Next preminor |
| **Pre-major testing** | `premajor` | 1.0.0 | 2.0.0-alpha.0 | Test major release |
| | `premajor` | 2.0.0-alpha.0 | 2.0.0-alpha.1 | Next premajor |

#### 🔄 Prerelease Version Flow Examples

**Example 1: Testing a patch release**
```
Start: 1.0.0
Set VERSION_BUMP=prepatch → Publish: 1.0.1-alpha.0 (test version)
Set VERSION_BUMP=prepatch → Publish: 1.0.1-alpha.1 (another test)
Set VERSION_BUMP=patch → Publish: 1.0.1 (stable release)
```

**Example 2: Testing a minor release**
```
Start: 1.0.0
Set VERSION_BUMP=preminor → Publish: 1.1.0-alpha.0 (test version)
Set VERSION_BUMP=preminor → Publish: 1.1.0-alpha.1 (another test)
Set VERSION_BUMP=minor → Publish: 1.1.0 (stable release)
```

**Example 3: Testing a major release**
```
Start: 1.0.0
Set VERSION_BUMP=premajor → Publish: 2.0.0-alpha.0 (test version)
Set VERSION_BUMP=premajor → Publish: 2.0.0-alpha.1 (another test)
Set VERSION_BUMP=major → Publish: 2.0.0 (stable release)
```

**Example 4: General prerelease testing**
```
Start: 1.0.0
Set VERSION_BUMP=prerelease → Publish: 1.0.1-alpha.0 (test version)
Set VERSION_BUMP=prerelease → Publish: 1.0.1-alpha.1 (another test)
Set VERSION_BUMP=patch → Publish: 1.0.1 (stable release)
```

### 🔄 Consumer Project Updates

#### Automatic Updates (Recommended)

```bash
# Update to latest version
npm update @rappit/ps-test-automation-base

# Or update to specific version
npm install @rappit/ps-test-automation-base@1.1.0
```

#### Check Current Version

```bash
# Check installed version
npm list @rappit/ps-test-automation-base

# Check available versions
npm view @rappit/ps-test-automation-base versions --json
```

### ⚠️ Important Notes

#### Version Conflicts
- **Never publish the same version twice** - npm registries don't allow overwrites
- **CI automatically bumps versions** to avoid conflicts
- **Use prerelease versions** for testing: `1.0.0-alpha.0`, `1.0.0-beta.1`

#### Breaking Changes
- **Major version bumps** require consumer projects to update their code
- **Document breaking changes** in release notes
- **Use deprecation warnings** before removing features

#### Git Workflow
- **Version bumps are not committed back to git** in CI (uses `--no-git-tag-version`)
- **For manual publishing**, commit version changes:
  ```bash
  npm run version:minor
  git add package.json
  git commit -m "Bump version to 1.1.0"
  ```

### 🛠️ Troubleshooting

#### "Version already exists" Error
```bash
# Check current version
npm view @rappit/ps-test-automation-base version

# Bump to next available version
npm run version:patch
npm run gcp:publish
```

#### Rollback a Version
```bash
# Can't unpublish, but can publish a patch
npm run version:patch
# Fix the issue
npm run gcp:publish
```

#### Check Version Before Publishing
```bash
# Dry run to check what would be published
npm publish --dry-run

# Check package contents
npm pack
tar -tf *.tgz
```

### 📋 Best Practices

1. **Use semantic versioning** consistently
2. **Document changes** in commit messages and release notes
3. **Test prerelease versions** before stable releases
4. **Communicate breaking changes** to consumer teams
5. **Keep version bumps small** - prefer patch over minor, minor over major
6. **Use CI for automatic publishing** to reduce manual errors
7. **Tag important releases** in git: `git tag v1.1.0`


---

## 💡 Tips

1. **Use build:watch** during active development to auto-rebuild on changes

2. **Keep terminal open** with `build:watch` while testing in another project

3. **Commit often** - the CI pipeline auto-bumps versions, so keep your local version in sync

4. **Run lint before committing** to catch issues early:
   ```bash
   npm run lint:fix && npm run format
   ```

5. **Use VS Code extensions**:
   - ESLint
   - Prettier
   - TypeScript Hero (for auto-imports)
