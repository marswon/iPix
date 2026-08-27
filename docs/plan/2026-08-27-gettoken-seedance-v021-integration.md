# GetToken Seedance 2.0 v0.21 Integration

Date: 2026-08-27
Reference contract: `marswon/workbuddy-gettoken-seedance-skill` commit `a9c9b7d8c07a103810ab0a3f99a8fd0c942fdfa3`
Upstream base: `origin/main` at `8f9365ae`

## Problem

Nomi recognizes `doubao-seedance-2-0-260128`, but GetToken exposes Seedance through the New API route instead of the Volcengine-native route that Nomi probes. Falling back to the generic video body drops GetToken's required metadata and first/last-frame shape.

The v0.21 upstream release also changed Seedance profile derivation and fixed frame-intent projection. The adapter must integrate with those changes rather than restoring the older global reference projection.

## Verified Contract

- Auth: `Authorization: Bearer <API_KEY>`
- Create: `POST /v1/video/generations`
- Query: `GET /v1/video/generations/{task_id}`
- Text-to-video: top-level `model`, `prompt`, `duration`, `size`; Seedance fields in `metadata`
- First frame: top-level `image`; role-tagged `metadata.content`
- First/last frames: top-level `images`; role-tagged `metadata.content`
- The reference adapter does not submit omni role images, reference video, or reference audio

## Design

1. Keep model identity `volcengine-seedance-2` and use a distinct wire id `gettoken-seedance-2`.
2. Allow ordered wire candidates per archetype: Volcengine native first, GetToken second.
3. Restrict the metadata extension to `gettoken.net` hosts; `/v1/video/generations` alone is not proof that another relay accepts GetToken fields.
4. Probe candidate routes with the existing non-billing GET endpoint probe.
5. Use a named request transform to choose top-level `image` versus `images` after template rendering. This avoids adding GetToken-specific state to the shared v0.21 task parameter projection.
6. Reuse the existing role-bearing Seedance archetype content objects for `metadata.content`.
7. Upgrade existing GetToken catalog entries during post-window startup maintenance.
8. Seed GetToken as an adapted, key-only platform service. This batch adds the verified Seedance model and both mappings; the vendor remains open for other GetToken models in later curated groups.
9. Consolidate legacy `gettoken.net` relay identities, models, mappings, and their saved credential into `gettoken` when doing so cannot overwrite a distinct canonical credential.
10. Keep the shared `volcengine-seedance-2` model identity while declaring GetToken's verified mode subset (`t2v`, first frame, first/last frame), so omni references never appear on this wire.

## Post-install Evidence

A packaged Preview configured through the generic relay flow normalized the create response to `id=13`, then received `HTTP 400 task_not_exist` from `GET /v1/video/generations/13`. A second packaged Preview repeated the same failure with `id=15`. The screenshots do not retain the raw create response, so they cannot establish where a different provider task handle lives. They do establish that an arbitrary numeric top-level `id` is not queryable in these runs.

The reference skill distinguishes a genuine GetToken provider handle (`task_...`) from local/envelope identifiers. More importantly, its documented zero-cost route check sends an invalid request that cannot create a task. Nomi must not use a paid create/poll cycle to verify this already-curated contract.

## Corrective Design

1. Treat a model as a catalog-managed wire only when trusted catalog state has all three facts: a registered `wireProfile`, an exact enabled model mapping matching that profile, and a saved base URL accepted by the profile host matcher. A host, model name, or arbitrary user mapping alone is not verification evidence.
2. For catalog-managed wires, connection health uses `probeNativeEndpoint`: sibling missing-route GET plus target bogus-task GET. `task_not_exist` for `__nomi_probe__` is positive route evidence because no task was created; it is never shown as a failed generation.
3. Block the persisted-connection provider-adapter boundary from staging or retrying catalog-managed models. This guarantees direct IPC and stale retry paths cannot reach docs compilation, paid create, or polling even if renderer state is stale.
4. Project catalog-managed readiness separately from `meta.adapter`. The model detail uses the existing ready state and exposes no generic auto-configure action. Stale adapter failure metadata cannot override a code-owned production mapping.
5. Add a one-time GetToken preset repair revision. When a usable GetToken credential already exists, clear stale adapter ownership and re-enable the canonical Seedance model and curated mappings once. Later explicit user disables remain respected because the repair revision prevents repeated activation.
6. On explicit key-only connection, atomically enable the canonical vendor and repair stale adapter-disabled curated rows before refreshing canvas options. Saving a key and becoming selectable are one domain operation, not two renderer writes.
7. Keep canvas filtering strict (`vendor enabled` + `credential enabled` + `model enabled`). The repair fixes catalog truth; the picker does not bypass readiness.

## Non-goals

- Do not call `/v1/chat/completions` for Seedance.
- Do not replace v0.21 frame-intent projection.
- Do not claim support for omni references absent from the verified contract.
- Do not make a paid real generation during automated validation.

## Rollback

Remove the GetToken profile and candidate registration. Existing catalog models can then fall back to generic New API transport after re-adding; no project document schema is changed.

## Live Generation Evidence and Multi-group Correction

The installed `v0.21.0-gettoken.3` successfully submitted a real 5-second, 720p, 16:9, no-audio text-to-video task. The first query returned `IN_PROGRESS`; the second query incorrectly used `/v1/video/generations/17` and failed with `task_not_exist`. Capturing the real responses established the exact ambiguity:

- Create returns both `id: "task_..."` and `task_id: "task_..."`.
- Query returns the immutable provider identity at `data.task_id`, while `data.id` is an unrelated numeric database row.
- Nomi correctly queried the provider ID once, then merged query-derived metadata over cached create metadata and replaced `task_id` with the numeric row.
- Resuming the original `task_...` directly completed successfully and produced a valid MP4.

The next correction therefore applies these invariants:

1. Provider task identity becomes immutable after create acceptance. Query responses may update status/output metadata, but cannot replace cached `task_id` or `query_id`.
2. A newly created manual connection allocates a distinct vendor key when the derived Base URL identity is already occupied. Adding models from an existing connection page continues to reuse that explicit vendor key.
3. This supports relay group credentials generically: the same host can have independently named credentials and model sets without overwriting each other.
4. Existing strict canvas projection remains unchanged. Once the second connection has enabled text/image models and its own credential, those models appear in chat/image selectors beside other providers.
5. GetToken alias migration continues to merge only historical host-derived aliases; explicit `gettoken-2`, `gettoken-3`, and marked credential-scoped connections remain separate.
6. Only the exact official-host `qwen-image-2.0` contract proven by a real `/v1/images/generations` response is promoted to production. Discovered Pro/Max variants stay unverified until their wire contracts are tested.
7. Equivalent endpoint spellings are URL-normalized before credential identity comparison, so default ports and trailing slashes remain idempotent.
8. No new persistent control is added. Users create the second group through the existing add-connection flow and manage models through the existing connection detail flow.

## Verification

- Contract tests for route, auth-safe request rendering, text, first-frame, and first/last bodies
- Response normalization tests for documented task id, status, and result URL shapes
- Query-cache regression proving numeric query envelope IDs cannot replace the accepted provider task ID
- Same-host registration tests proving new connections receive distinct identities while explicit existing-connection additions reuse identity
- Canvas option tests proving text and Qwen Image models from the second credential appear with strict readiness filters intact
- Reachability test proving first/last modes remain usable and omni references remain blocked
- Startup migration test proving native probe fallback selects GetToken and persists the distinct wire id
- Real installed-app Seedance generation plus a real second-group text/image task
- Related regression tests, typecheck, full Vitest, lint ratchet, structural gates, and production build
