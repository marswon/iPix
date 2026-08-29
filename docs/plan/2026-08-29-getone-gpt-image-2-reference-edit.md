# GetOne GPT Image 2 Reference Edit Repair

## Failure

A saved OpenAI-compatible GetOne connection can verify `gpt-image-2` text generation through `POST /v1/images/generations`, while automatic adapter verification writes `image_edit` as JSON chat at `POST /v1/chat/completions`. GetOne rejects that request because this image model is not available on Chat Completions.

The catalog already knows the standard GPT Image edit contract: multipart `POST /v1/images/edits` with one or more binary `image[]` parts. A historical v6-to-v7 migration repairs older catalogs, but a bad mapping created after the catalog reached v7 is never revisited.

## Evidence Before Editing

- Saved vendor: OpenAI-compatible `https://www.getone.ai` with an encrypted local credential.
- Model: `gpt-image-2`.
- Working mapping: `text_to_image -> POST /v1/images/generations`.
- Broken mapping: `image_edit -> POST /v1/chat/completions`.
- Provider response: the model is unsupported on Chat Completions.
- Real size probes show GetOne ignores `size: 3840x2160` and returns 1536x1024 (3:2), but the same request with an explicit 16:9 prompt requirement returns 1672x941 (16:9). The adapter therefore carries selected ratio/resolution into the prompt while retaining structured size for future provider compatibility; it does not claim that 1672x941 is native 4K.
- Contract reference: OpenAI Images Edit uses multipart `POST /v1/images/edits`; Nomi already implements that standard in `OPENAI_MULTIPART_IMAGE_EDIT_OP`.

## Scope

1. Probe the real GetOne `/v1/images/edits` endpoint without an image, then submit one paid reference edit if the endpoint is present.
2. Reproduce the reported `4K + 16:9` text-generation output, capture the actual wire parameters, download the result, and assert its pixel ratio instead of trusting HTTP success.
3. Make relay image-edit protocol repair idempotent at catalog read/startup, not only behind an old version transition.
4. Preserve mapping IDs, vendor credentials, model identity, working text generation, and unrelated providers/models.
5. Ensure the automatic adapter cannot leave a verified GPT Image family model on chat after catalog persistence/startup.
6. Add unit, migration/startup, and real desktop journey coverage.

## Non-Goals

- No new UI or GetOne-only model archetype.
- No credential replacement or connection recreation.
- No change to chat-based image models such as Nano Banana.
- No release publication unless explicitly requested after the fix is verified and pushed.

## Acceptance Gates

- Missing-image endpoint probe positively identifies multipart edits without paid generation.
- A real GetOne reference-image edit returns a decodable image asset.
- A real `4K + 16:9` text generation produces a 16:9 asset and the probe reads actual output dimensions; native 4K is not claimed while GetOne returns 1672x941.
- Restart/read repairs a post-v7 exact `gpt-image-2` chat mapping in place and marks reference images supported.
- Existing text generation remains unchanged.
- Focused tests, desktop E2E, secret scan, diff check, and full `pnpm run gates` pass.
- Changes are committed and pushed only to `personal/codex/gettoken-seedance-v021`.

## Rollback

Revert the repair commit. Because repair preserves mapping IDs and credentials and changes only the operation/meta contract for known non-chat GPT Image families, rollback does not require catalog deletion or key migration.
