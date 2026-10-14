# Recommended repository settings

These settings are **recommendations**. They are not applied automatically; a repository admin must
enable them under **Settings** on GitHub. This document does not claim any of them are currently
enabled.

## Branch protection for `main` (Settings → Rules → Rulesets)

Create a ruleset targeting the default branch with:

- **Restrict deletions** and **block force pushes**.
- **Require a pull request before merging**
  - Required approvals: 1 (raise when there are more maintainers)
  - Dismiss stale approvals when new commits are pushed
  - Require review from Code Owners
  - Require conversation resolution before merging
- **Require status checks to pass** (require branches to be up to date):
  - `Web (format, lint, types, tests, build)`
  - `End-to-end tests`
  - `Rust (ubuntu-24.04)`, `Rust (windows-latest)`, `Rust (macos-latest)`
  - `Speech recognition (recorded audio)`
  - `Dependency and license audit`
  - `Secret scan`
  - `Workflow lint`
  - `CodeQL (javascript-typescript)`, `CodeQL (actions)`, `CodeQL (rust)`
- **Require linear history** (squash or rebase merges).
- Optionally **require signed commits**.
- Do not grant bypass to anyone except, if needed, repository admins for emergencies.

## Security (Settings → Code security)

- Enable **Private vulnerability reporting** (used by SECURITY.md).
- Enable **Dependabot alerts** and **Dependabot security updates** (version updates are configured in
  `.github/dependabot.yml`).
- Enable **Secret scanning** and **Push protection**.
- CodeQL runs from `.github/workflows/codeql.yml`; leave "default setup" off to avoid duplicate runs.

## Actions (Settings → Actions → General)

- Allow actions from GitHub and verified creators, or "selected actions" listing the actions pinned in
  the workflows.
- **Workflow permissions:** "Read repository contents" (the default token is read-only; jobs request
  more explicitly).
- Disable "Allow GitHub Actions to create and approve pull requests".
- Require approval for workflows from outside collaborators (first-time contributors at minimum).

## Release environment (Settings → Environments)

Create an environment named **`release`**:

- Required reviewers: the maintainers who may publish releases.
- Deployment branches and tags: only tags matching `v*.*.*`.
- Environment secrets for signing (optional, see [RELEASING](../releasing/RELEASING.md)):
  `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`,
  `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`.
- Repository variable `REQUIRE_SIGNING=true` once signing is set up, so unsigned releases fail.

## Tag protection

Add a ruleset for tags matching `v*` that restricts creation and deletion to maintainers.
