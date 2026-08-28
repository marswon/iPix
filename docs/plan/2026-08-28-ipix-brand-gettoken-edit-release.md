# iPix Brand, GetToken Qwen Edit, and Dual-Platform Release Plan

Date: 2026-08-28
Branch: `codex/gettoken-seedance-v021`
Target release: `v0.21.0-gettoken.5`

## Goals

1. Repair the installed `gettoken-2 / qwen-image-2.0-pro` reference-image edit mode with a provider contract proven against the real GetToken endpoint.
2. Rebrand all user-visible product surfaces and preview artifacts from Nomi to iPix while preserving technical identity and user data compatibility.
3. Publish both the Apple Silicon DMG and Windows x64 NSIS installer on the same prerelease.

## Proven GetToken Contract

A credential-gated probe against `https://www.gettoken.net` established:

- `POST /v1/images/generations`
- bearer authentication
- model `qwen-image-2.0-pro`
- JSON body with `prompt`, pixel `size`, `n`, and `image_urls`
- HTTP 200 response with the generated asset at `data[0].url`

The historical adaptive mapping incorrectly used `/v1/chat/completions`. The request returned a successful envelope with no media asset and verification failed at `verify_asset`.

Implementation invariants:

- Promote the edit contract only for the exact official GetToken HTTPS origin and exact live-tested Pro model.
- Translate the Qwen canvas ratio (`size`) and legacy runtime alias (`aspect_ratio`) with `resolution` into the provider's required pixel size for both text and edit operations.
- Startup repair must replace any partially stale Pro operation without changing saved credentials, vendor identity, labels, model-key casing, or unrelated models.
- Reference images continue through the existing asset-localization and public-URL consent path.

## iPix Rebrand Scope

Approved scope: user-visible brand rename with compatibility-preserving internal identity.

Change:

- App product name, preview product name, window/document titles, About/brand strings, wordmark, public logo, installer filenames, and release copy.
- Desktop icon assets for macOS and Windows.
- User-facing default project-folder label for new users only where migration-safe.

Preserve:

- package/import symbols and internal `Nomi*` component names
- `com.nomi.app` and `com.nomi.app.preview` bundle IDs
- existing application-support and credential-service identities
- existing project roots and persisted paths
- existing protocol/MCP identifiers where renaming would break callers

Logo direction approved: pixel viewfinder plus lowercase `i`. The mark must remain recognizable at 16 px, work in light/dark UI, and have square application-icon variants without ornamental gradients.

## Release Workflow

- Both `mac-preview` and `windows-preview` must complete before `publish-prerelease`.
- Both package jobs publish their resolved checkout SHA; publication aborts unless the values are identical.
- Stage exactly one DMG and one EXE on an invisible draft, verify both assets, and only then publish the prerelease. Never mutate an already public tag.
- Upload `iPix.Preview-mac-arm64.dmg` and the Windows x64 NSIS installer to the same tag.
- Release target commit must equal the pushed branch head.
- Verify both asset names, sizes, digests, and uploaded states through GitHub Release metadata.

## Verification

- Focused unit tests for exact GetToken Pro registration and startup repair.
- Real credential-gated Qwen Pro reference-image edit through the Nomi/iPix runtime.
- Existing multi-credential and Seedance identity regressions.
- Brand search audit separating allowed internal compatibility names from user-visible stale names.
- Packaged macOS smoke and Windows build artifact verification.
- Human review of Logo samples and final app screenshots at desktop and compact sizes.
- Full repository gates, typecheck, lint, tests, and production build before push.

## Evidence Recorded

- Real Qwen Pro edit succeeded twice through the current desktop task runtime. The final run used the actual canvas shape (`size: 1:1`, `resolution: 1K`) and returned a localized image asset.
- Startup repair tests cover stale chat mappings, partial operation corruption, exact-origin rejection, model-key casing, idempotence, reference capability, and byte-stable credential records.
- The approved iPix mockup is implemented in the desktop wordmark, public logo, macOS icon, and four-entry Windows ICO (16/32/48/256 px).
- A current-source Electron walkthrough verified the iPix title, wordmark, logo geometry, and project-library layout without horizontal overflow.
- Independent API and release reviews were repeated after fixes and reported no remaining findings in their reviewed areas.
