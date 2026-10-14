# Security Policy

## Supported versions

SeeRead is in early development. Security fixes are made on `main` and shipped in the next release.
Only the latest release receives fixes.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

## Reporting a vulnerability

**Please do not report security issues in public issues, discussions or pull requests.**

Report privately through GitHub's
[private vulnerability reporting](https://github.com/clintgalendez/SeeRead/security/advisories/new)
(Security → Advisories → Report a vulnerability). If that is unavailable, email
**clintgalendez@gmail.com** with "SeeRead security" in the subject.

Please include the affected version and platform, a description of the issue and its impact, and steps
or a proof of concept to reproduce it. We aim to acknowledge reports within 5 working days and to agree
on a fix and disclosure timeline with you. We are happy to credit reporters who want to be credited.

## Scope

In scope: the SeeRead application, its build and release pipeline, and this repository's workflows.
Examples: code execution through crafted script files or settings, access to files outside what the
user chose, audio or script data leaving the device, or weaknesses in release integrity.

Out of scope: the screen-capture exclusion feature being bypassed by cameras, remote desktop,
privileged capture software or OS behaviour — this is a documented limitation, not a vulnerability
(see the README).

## How SeeRead protects users

- No network connections at runtime; the content security policy blocks remote resources.
- Least-privilege Tauri capabilities per window; file access is limited to files the user picks.
- Script files and recovery drafts are written atomically; script text is never logged.
- Dependencies are audited in CI (`npm audit`, `cargo deny`) and updated through Dependabot.
- GitHub Actions are pinned to commit SHAs, use minimal token permissions, and never expose secrets
  to pull-request builds. Releases are drafts built from tags, with SHA-256 checksums and build
  provenance attestations.
