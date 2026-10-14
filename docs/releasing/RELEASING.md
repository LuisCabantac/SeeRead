# Releasing SeeRead

Releases are built by GitHub Actions from a version tag and published as **draft** GitHub Releases. A
maintainer reviews the draft and publishes it by hand. Nothing is published automatically.

## Versioning

SeeRead uses [Semantic Versioning](https://semver.org). The version appears in three places, which
must match the tag (the release workflow checks this):

- `package.json` → `version`
- `src-tauri/Cargo.toml` → `[package] version`
- `src-tauri/tauri.conf.json` → `version`

Pre-releases use a suffix such as `0.2.0-rc.1` and are marked as pre-releases.

## Steps

1. Make sure `main` is green in CI.
2. Update the three version fields and run `cargo update -p seeread` in `src-tauri` so `Cargo.lock`
   matches.
3. Move the `Unreleased` notes in `CHANGELOG.md` into a new `## [x.y.z] - YYYY-MM-DD` section and
   update the comparison links at the bottom.
4. Verify locally: `node scripts/check-version.mjs vx.y.z`.
5. Open a pull request, get it reviewed and merged.
6. Tag the merge commit and push the tag:

   ```sh
   git tag -s vx.y.z -m "SeeRead x.y.z"   # -a instead of -s if you don't sign tags
   git push origin vx.y.z
   ```

7. The **Release** workflow then:
   1. validates the tag against the version fields and the changelog;
   2. re-runs the full CI suite on the tagged commit;
   3. builds installers on Windows (NSIS `.exe` + `.msi`), macOS (universal `.dmg`) and Linux
      (`.AppImage` + `.deb`), downloading and checksum-verifying the speech model and generating the
      third-party license inventory;
   4. waits for approval in the protected `release` environment (if reviewers are configured);
   5. writes `SHA256SUMS`, creates build-provenance attestations, and creates a **draft** release with
      notes taken from the changelog.
8. Download a couple of artifacts, check them against `SHA256SUMS`
   (`sha256sum -c SHA256SUMS --ignore-missing`) and with
   `gh attestation verify <file> --repo clintgalendez/SeeRead`, smoke-test an installer, then press
   **Publish release**.

## Code signing (optional)

Without signing secrets, builds are unsigned and the draft release notes say so. To sign, add these as
secrets of the `release` environment:

| Platform | Secrets                                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | `APPLE_CERTIFICATE` (base64 .p12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, and for notarization `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID` |
| Windows  | `WINDOWS_CERTIFICATE` (base64 .pfx), `WINDOWS_CERTIFICATE_PASSWORD`                                                                                                                   |

Then set the repository variable `REQUIRE_SIGNING` to `true`. From then on a release fails rather than
shipping unsigned builds if a secret is missing. Signing secrets are only available to the release
build jobs in the `release` environment, never to pull-request workflows.

## If something goes wrong

- A failed workflow publishes nothing; fix the problem, delete the tag
  (`git push --delete origin vx.y.z`), and tag again.
- Never edit or replace artifacts of a published release; ship a new patch version instead.

## Reproducibility

Builds use the committed lockfiles (`npm ci`, `cargo --locked`) and a pinned Rust toolchain
(`rust-toolchain.toml`), and the speech model is pinned by SHA-256. This makes builds
**dependency-reproducible**; they are not bit-for-bit reproducible (timestamps, signing and platform
toolchains differ). The weekly maintenance workflow re-checks that lockfiles are consistent.
