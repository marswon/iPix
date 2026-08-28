# GetToken Seedance Task Identity and Result Repair

Date: 2026-08-28
Target release: `v0.21.0-gettoken.7`

## Observed Failures

- Adapter verification reached `GET /v1/video/generations/22` and received `HTTP 400 task_not_exist`.
- Canvas reported a terminal successful task with no video URL.
- GetToken Seedance 2.0 hid the `全能参考` mode even though the relay accepts Volcengine `reference_image` content.

## Live Contract Evidence

A paid 5-second 720p text-to-video probe against the configured GetToken credential established the current envelope without retaining task IDs, credentials, or signed URLs:

- Create: top-level `id` and `task_id` are provider `task_*` strings.
- Query: `data.id` is a numeric database row; `data.task_id` is the immutable provider handle.
- Terminal query: video URL is present at both `data.result_url` and `data.data.content.video_url`.
- A paid omni-reference probe with top-level `images` plus `metadata.content[].role=reference_image` was accepted, retained a provider `task_*` handle, and completed with a video URL.

## Root Causes

1. Adapter verification replaced accepted create metadata with query-derived metadata on every poll. A numeric query row could redirect the next poll even though the production task cache already protected task identity.
2. Credential-scoped official connections (`gettoken-2`, `gettoken-3`) were not included in startup contract repair, so older query mappings could survive upgrades and miss the current result URL paths.
3. The GetToken vendor specialization intentionally removed `omni` because the original skill only verified text/first/last-frame requests; the relay's supported `metadata.content` reference envelope had not been probed.

## Changes

- Keep the create-accepted provider handle immutable in adapter verification.
- Prioritize all explicit `task_id` paths before generic `id` paths.
- Increment the GetToken Seedance preset revision.
- Repair complete Seedance create/query/status contracts at startup for every official GetToken connection, preserving vendor keys, credentials, mapping IDs, and creation timestamps.
- Give video verification a 180-second/60-poll budget while retaining the five-minute adapter batch ceiling.
- Expose the existing Seedance `全能参考` mode for GetToken and carry image/video/audio reference content through the repaired `image_to_video` mapping; derive top-level `images` from role-tagged image references for New API routing.
- Add regression tests for numeric query IDs, simultaneous credential-scoped startup repair, result URL extraction, and verifier multi-poll identity preservation.

## Acceptance

- Focused unit and TypeScript checks pass.
- A real desktop-runtime Seedance task submits, polls with the original provider handle, reaches success, and exposes a readable `video/mp4` asset with an MP4 `ftyp` box.
- Full gates pass.
- Apple Silicon, Intel macOS, and Windows packages publish from one source SHA in `.7`.
