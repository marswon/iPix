# iPix Qwen Edit and Dual-Platform Release Audit

## Scope

Release audit for `v0.21.0-gettoken.5`:

- GetToken `qwen-image-2.0-pro` reference-image editing and startup repair;
- compatibility-preserving iPix product rebrand and approved logo;
- macOS Apple Silicon and Windows x64 preview packaging from one source commit;
- public release staging, verification, and upgrade guidance.

Internal identities intentionally remain stable: bundle IDs, package name, `Nomi*` symbols, lower-case protocol/MCP keys, environment variables, legacy userData roots, and project roots.

## Independent Review

Separate API and release reviewers examined the complete uncommitted patch. Their findings were fixed and re-reviewed:

1. The Qwen canvas emits ratio under `size`, while legacy automation uses `aspect_ratio`. One provider map now accepts either shape and produces the required pixel dimensions for both text and edit operations.
2. Startup health checks now compare the complete verified HTTP operations, preserve model-key casing, reject noncanonical origins, and assert credential records remain byte-stable.
3. Both package jobs expose their resolved checkout SHA; publication aborts if they differ.
4. Release assets are uploaded to an invisible draft, checked for exactly one DMG and one EXE, and published only after verification. Existing public releases cannot be mutated.
5. Packaged MCP smoke derives the executable and Helper names from the renamed bundle and runs before macOS artifact upload.
6. iPix download aliases, README/install instructions, release runbook, quickstart, marketing logo, and the 16/32/48/256 Windows ICO were brought into the same brand contract.

No correctness, credential-safety, compatibility, or release-workflow finding remains in the reviewed scope.

## Real Evidence

- A direct provider probe established `POST /v1/images/generations`, pixel `size`, `image_urls`, and `data[0].url` for `qwen-image-2.0-pro`.
- Two real paid reference-image edits completed through the current desktop `tasks.run` runtime. The final run used the actual canvas parameter shape and returned a localized image asset.
- The iPix desktop journey verified document title, visible wordmark, approved viewfinder-plus-i geometry, and no horizontal overflow, and retained its screenshot artifact.
- The user approved the exact Logo HTML mockup before implementation. Generated PNG, ICNS, and four-entry ICO assets passed format and dimension inspection.
- No credential, signed provider URL, response identifier, or account detail is retained in repository evidence.

## Gates

- Full repository `pnpm run gates`: passed.
- Vitest: 8,098 passed, 1 skipped across 850 test files; Agent Runtime suite passed.
- Lint: 0 errors and 87 existing warnings within the 98-warning ratchet.
- TypeScript renderer, Electron, PI, and test-type checks: passed.
- All structural, security, design-token, i18n, heavy-path, site, handbook, production-build, and gate-chain checks: passed.
- Focused Qwen/repair/compatibility suites: 70+ tests passed across registration, startup seed, param translation, paths, and MCP configuration.
- Real Qwen Pro reference-image journey: passed.
- iPix desktop brand journey: passed.
- Marketing generation and static contract: passed.
- Dual-platform workflow contract: 3/3 passed.
- Stable release asset contract: 16/16 passed.

## Release Decision

Release is allowed only after the final gate chain succeeds, the branch commit is pushed to `personal/codex/gettoken-seedance-v021`, and GitHub Actions reports both platform package jobs plus the draft publication job successful. Completion requires verifying the release target SHA, DMG and EXE metadata, and published asset digests.
