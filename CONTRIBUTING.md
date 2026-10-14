# Contributing to SeeRead

Thanks for helping make SeeRead better! Anyone can contribute: bug reports, docs, translations of
help text, tests and code are all welcome. By participating you agree to follow the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Ground rules

- **Discuss larger changes first.** Open an issue (or comment on one) before starting big features or
  architectural changes, so effort isn't wasted.
- **Privacy is a feature.** SeeRead makes no network connections and collects no data. Changes that add
  network access, telemetry, or send audio/scripts anywhere will not be accepted unless they are opt-in,
  clearly disclosed, and discussed in an issue first.
- **Honesty about platforms.** Don't claim a feature works on a platform you couldn't test; say how you
  tested in your pull request.
- **No secrets or build artifacts in commits.** Never commit credentials, `.env` files, models,
  installers or `target/`/`dist/` output.

## Getting set up

See [docs/development/setup.md](docs/development/setup.md). In short:

```sh
npm ci
npm run fetch:model   # optional: only needed for voice tracking and the real-audio test
npm run tauri dev
```

## Making a change

1. Fork the repository and create a branch from `main` (`fix/overlay-dpi`, `feat/markdown-emphasis`).
2. Make focused, reviewable commits. We use [Conventional Commits](https://www.conventionalcommits.org)
   style subjects, e.g. `fix(matcher): hold position on half-spoken words`.
3. **Add or update tests** for behaviour you change:
   - pure logic in `src/core/` → unit tests in `tests/unit/`
   - services and recorded-speech behaviour → `tests/integration/`
   - user-visible flows → Playwright tests in `tests/e2e/`
   - Rust → `#[cfg(test)]` modules in `src-tauri/src/`
4. **Update documentation** (README, `docs/`, in-app help text, CHANGELOG `Unreleased` section) for any
   user-facing change.
5. Run the checks locally:

   ```sh
   npm run check
   npm run test:e2e
   cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
   ```

6. Open a pull request using the template. All required CI checks must pass and at least one
   maintainer review is required before merging.

## Coding standards

- TypeScript is strict; formatting is Prettier (`npm run format`) and linting is ESLint.
- Rust is formatted with `rustfmt` and must be clean under `clippy -D warnings`.
- Keep `src/core/` free of DOM, React and Tauri imports so it stays fast and unit-testable.
- Prefer the platform and existing dependencies over new ones; justify any new dependency in the PR.
- Never log script text or transcripts. Log lengths or counts if you need diagnostics.
- UI must be keyboard accessible with visible focus and labelled controls; the E2E suite runs axe checks.

## Dependencies and licensing

SeeRead is licensed under Apache-2.0. New dependencies must use a license allowed by
`src-tauri/deny.toml` (Rust) or the `licenses:check` script (npm). By submitting a contribution you
agree that it is licensed under the project's Apache-2.0 license (see section 5 of the license).

## Authorship

Commit under your own name and email. Your commits are credited to you, and maintainers will not
rewrite your authorship. See [docs/development/CONTRIBUTOR_ATTRIBUTION.md](docs/development/CONTRIBUTOR_ATTRIBUTION.md).

## Reporting bugs and requesting features

Use the issue templates. For bugs, include your OS and version, SeeRead version, steps to reproduce,
and what you expected. Please **don't** paste private scripts — a short made-up example is enough.
Security problems go through [SECURITY.md](SECURITY.md), not public issues.
