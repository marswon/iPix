# GetToken Multi-group Release Audit

## Scope

Release audit for the GetToken correction following `v0.21.0-gettoken.3`:

- immutable provider task identity during repeated result queries;
- multiple credential-bearing connections on one endpoint;
- restart and legacy alias migration behavior;
- GetToken general text and Qwen Image catalog readiness;
- canvas projection and real runtime execution.

No project document schema or new persistent UI control is introduced.

## Review

The architecture was reviewed from CTO, product, frontend, backend, design, and real-user perspectives. A final independent code review raised four concrete risks; all were resolved before release:

1. Image promotion was narrowed to the exact official-host `qwen-image-2.0` contract proven by a real response. Discovered Pro/Max variants remain unverified and disabled.
2. Migration now preserves stable numeric sibling identities (`gettoken-2`, `gettoken-3`, and later) even when they predate the credential-scope marker.
3. The live journey now fails when its credential is absent and establishes two credential-bearing groups before restart verification.
4. Endpoint identity now uses URL normalization, making default ports and trailing slashes idempotent.

No unresolved correctness or security finding remains in the reviewed diff. The intentional residual boundary is that additional discovered Qwen Image variants require their own wire evidence before production activation.

## Real Evidence

- Fixed Seedance runtime: a real 5-second 720p text-to-video task completed after nine polls. The accepted `task_...` identity remained stable on every poll and a video asset was returned.
- Multi-group runtime: canonical GetToken and `gettoken-2` both retained enabled credentials across an application restart.
- Real Qwen Image: `qwen-image-2.0` completed through Nomi `tasks.run` and returned a localized image asset.
- Real general text: `qwen3.5-flash` completed through Nomi `tasks.run`.
- Visual walkthrough: Model Services shows two independently named GetToken connections; the canvas image picker shows Qwen Image beside Jimeng choices without overlap or clipped text.

No credential, signed asset URL, provider account detail, or request identifier is retained in source evidence.

## Gates

- Full Vitest: 8,082 passed, 1 skipped.
- Lint ratchet: 0 errors, 87 existing warnings within the 98-warning ceiling.
- TypeScript: passed for renderer, Electron, and PI configs.
- Repository checks: filesize, design tokens, i18n, heavy paths, test waits, AGENTS sync, walkthrough quality, secrets, and archetype defaults passed.
- Production build: renderer and Electron builds passed.
- Electron smoke: 14 assertions passed.
- GetToken upgrade journey: stale failure repaired, catalog wire ready, canvas video model enabled, and generic adapter fallback absent.

## Release Decision

Approved for an Apple Silicon prerelease after commit/push and successful GitHub Actions packaging. The prerelease must not be described as complete until the release asset exists and its workflow commit matches the pushed branch head.
