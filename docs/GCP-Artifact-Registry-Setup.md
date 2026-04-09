# Publishing to GCP Artifact Registry

This guide covers setting up, versioning, and publishing `@rappit/ps-test-automation-base` to Google Cloud Artifact Registry.

---

## 1. Prerequisites

- **Google Cloud SDK** installed and authenticated
- **Node.js** ≥ 18
- GCP project with Artifact Registry API enabled

---

## 2. One-Time Setup

### 2.1 Create Artifact Registry Repository (if not exists)

```bash
# Set variables
export GCP_PROJECT="gp-ps-artifacts-repo-prod"
export GCP_REGION="europe-west1"
export REPO_NAME="ps-artifacts-fe"

# Create npm repository (if not already created)
gcloud artifacts repositories create $REPO_NAME \
  --repository-format=npm \
  --location=$GCP_REGION \
  --project=$GCP_PROJECT \
  --description="Private npm packages"
```

### 2.2 Configure `.npmrc`

Copy the template and fill in your values:

```bash
cp .npmrc.template .npmrc
```

Edit `.npmrc`:

```ini
@rappit:registry=https://europe-west1-npm.pkg.dev/gp-ps-artifacts-repo-prod/ps-artifacts-fe/
//europe-west1-npm.pkg.dev/gp-ps-artifacts-repo-prod/ps-artifacts-fe/:always-auth=true
```

### 2.3 Update `package.json`

The `publishConfig` is already configured in `package.json`:

```json
"publishConfig": {
  "@rappit:registry": "https://europe-west1-npm.pkg.dev/gp-ps-artifacts-repo-prod/ps-artifacts-fe"
}
```

---

## 3. Authentication

### Option A: Local Development (Interactive)

```bash
# Login to GCP
gcloud auth login

# Configure npm credentials (auto-refreshes tokens)
npx google-artifactregistry-auth
```

### Option B: CI/CD (Workload Identity Federation)

The CI/CD pipeline uses GitLab's Workload Identity Federation for authentication:

- **OIDC Provider**: Configured in GCP for GitLab integration
- **Service Account**: Has `roles/artifactregistry.writer` permission
- **Token Generation**: Automatic via GitLab OIDC token exchange

No manual key management required - authentication is handled automatically in CI.

---

## 4. Version Management

## 4. Version Management

We use **Semantic Versioning** (SemVer): `MAJOR.MINOR.PATCH`

| Change Type | Version Bump | Example | When to Use |
|-------------|--------------|---------|-------------|
| Breaking changes | MAJOR | 1.0.0 → 2.0.0 | API changes that break consumers |
| New features | MINOR | 1.0.0 → 1.1.0 | Backward-compatible additions |
| Bug fixes | PATCH | 1.0.0 → 1.0.1 | Backward-compatible fixes |

### Version Bumping in CI/CD

Version management is handled automatically in the GitLab CI pipeline. The `VERSION_BUMP` variable controls the bump type:

- `patch` (default): Bug fixes
- `minor`: New features
- `major`: Breaking changes
- `prerelease`: Pre-release versions
- `prepatch/preminor/premajor`: Pre-release with specific bump

### Available Scripts (for local development)

```bash
# Bump version only (creates git tag + commit)
npm run version:patch   # 1.0.0 → 1.0.1
npm run version:minor   # 1.0.0 → 1.1.0
npm run version:major   # 1.0.0 → 2.0.0
npm run version:prerelease  # 1.0.0 → 1.0.1-alpha.0
```

---

## 5. Publishing Workflow

### CI/CD Release (Recommended)

The publishing is automated through GitLab CI:

1. **Trigger**: Push to `ps-test-automation-base` branch
2. **Build**: Install dependencies, lint, and build
3. **Version Bump**: Automatic based on `VERSION_BUMP` variable
4. **Publish**: Authenticate and publish to GCP Artifact Registry

To trigger a release:

```bash
# Set VERSION_BUMP in GitLab CI variables or .gitlab-ci.yml
# Options: patch, minor, major, prerelease, prepatch, preminor, premajor

# Then push to the branch
git push origin ps-test-automation-base
```

### Manual Release (Local)

```bash
# 1. Ensure you're authenticated
npm run gcp:auth

# 2. Bump version locally
npm run version:patch   # or minor/major as needed

# 3. Publish
npm run gcp:publish

# 4. Commit and push changes
git add package.json package-lock.json
git commit -m "Bump version to X.X.X"
git push
```

---

## 6. CI/CD Pipeline Configuration

### GitLab CI (.gitlab-ci.yml)

The pipeline is configured with:

```yaml
stages:
  - build
  - publish

variables:
  NODE_VERSION: "18"
  VERSION_BUMP: "patch"  # Change this for different bump types

# Build stage
build:
  stage: build
  script:
    - npm ci
    - npm run lint
    - npm run build

# Publish stage (manual trigger)
publish:
  stage: publish
  script:
    # GCP Workload Identity authentication
    # Version bumping logic
    # npm publish with authentication
  only:
    - ps-test-automation-base
  when: manual
```

### Authentication Details

- Uses GitLab OIDC tokens for GCP authentication
- No service account keys stored in CI
- Automatic token refresh via Workload Identity Federation

---

## 7. Installing the Package (Consumer Projects)

Consumers need to configure their `.npmrc`:

```ini
@rappit:registry=https://europe-west1-npm.pkg.dev/gp-ps-artifacts-repo-prod/ps-artifacts-fe/
//europe-west1-npm.pkg.dev/gp-ps-artifacts-repo-prod/ps-artifacts-fe/:always-auth=true
```

Then authenticate and install:

```bash
npx google-artifactregistry-auth
npm install @rappit/ps-test-automation-base
```

---

## 8. Useful Commands

```bash
# View published versions
gcloud artifacts versions list \
  --package=@rappit/ps-test-automation-base \
  --repository=ps-artifacts-fe \
  --location=europe-west1 \
  --project=gp-ps-artifacts-repo-prod

# Delete a specific version
gcloud artifacts versions delete 1.0.0 \
  --package=@rappit/ps-test-automation-base \
  --repository=ps-artifacts-fe \
  --location=europe-west1 \
  --project=gp-ps-artifacts-repo-prod

# View package info
npm view @rappit/ps-test-automation-base
```

---

## 9. Troubleshooting

| Issue | Solution |
|-------|----------|
| `401 Unauthorized` | Run `npx google-artifactregistry-auth` or check Workload Identity setup |
| `403 Forbidden` | Ensure service account has `roles/artifactregistry.writer` |
| `404 Not Found` | Verify registry URL in `.npmrc` and `package.json` |
| Token expired | Re-run authentication or check CI token refresh |
| Version not bumped | Check `VERSION_BUMP` variable in GitLab CI |

---

## 10. Best Practices

1. **Use CI for production releases** — automated, consistent, and secure
2. **Set `VERSION_BUMP` appropriately** — follow SemVer guidelines
3. **Test builds locally first** — run `npm run build && npm run lint`
4. **Keep CHANGELOG.md updated** — document changes for each version
5. **Use manual publish trigger** — review before publishing to production
