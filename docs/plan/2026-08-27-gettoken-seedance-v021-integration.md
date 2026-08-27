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

A packaged Preview configured through the generic relay flow normalized the create response to `id=13`, then received `HTTP 400 task_not_exist` from `GET /v1/video/generations/13`. This establishes that the single generic verification attempt failed, but the screenshot does not retain the raw create response or timing, so it cannot diagnose task-id shape versus an upstream visibility race. Do not speculate by removing supported response paths. Because this is an independently verified preset contract, its onboarding should not depend on a paid generic create/poll check; users enter only their key.

## Non-goals

- Do not call `/v1/chat/completions` for Seedance.
- Do not replace v0.21 frame-intent projection.
- Do not claim support for omni references absent from the verified contract.
- Do not make a paid real generation during automated validation.

## Rollback

Remove the GetToken profile and candidate registration. Existing catalog models can then fall back to generic New API transport after re-adding; no project document schema is changed.

## Verification

- Contract tests for route, auth-safe request rendering, text, first-frame, and first/last bodies
- Response normalization tests for documented task id, status, and result URL shapes
- Reachability test proving first/last modes remain usable and omni references remain blocked
- Startup migration test proving native probe fallback selects GetToken and persists the distinct wire id
- Related regression tests, typecheck, full Vitest, lint ratchet, structural gates, and production build
