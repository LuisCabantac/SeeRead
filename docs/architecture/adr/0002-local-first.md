# 0002: Keep everything local; no network at runtime

- **Status:** accepted
- **Date:** 2026-10-14

## Context

Scripts can be confidential (unreleased products, legal statements) and a microphone is involved.
Users need to trust the tool without reading its source.

## Options considered

1. **No runtime network access at all** — model bundled with the installer; no update checks,
   analytics or crash reporting.
2. **In-app model download** — smaller installer, but adds network code and consent flows.
3. **Cloud features (sync, remote recognition)** — convenient, but contradicts the privacy goal.

## Decision

Option 1. The English model (~44 MB int8) ships inside release builds; additional models are added from
a local folder. The CSP blocks remote resources. Scripts are plain text files chosen by the user;
settings and a recovery draft live in the app's data folders. Nothing is logged that contains script
text or transcripts.

## Consequences

- Installers are ~45 MB larger. Updates are manual (download a new release).
- Any future network feature must be opt-in, disclosed in the UI and in `docs/PRIVACY.md`, and pass a
  design discussion first.
