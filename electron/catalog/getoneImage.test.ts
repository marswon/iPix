import { describe, expect, it } from "vitest";
import { NEWAPI_IMAGE_CREATE_OP, OPENAI_MULTIPART_IMAGE_EDIT_OP } from "./newapiTransport";
import { applyGetOneImageOperation, repairGetOneImageContracts } from "./getoneImage";
import { CURRENT_CATALOG_VERSION, type CatalogState } from "./types";

const now = "2026-08-29T00:00:00.000Z";

function state(): CatalogState {
  return {
    version: CURRENT_CATALOG_VERSION,
    vendors: [{
      key: "www-getone-ai", name: "GetOne", enabled: true, baseUrlHint: "https://www.getone.ai",
      authType: "bearer", createdAt: now, updatedAt: now,
    }],
    models: [{
      vendorKey: "www-getone-ai", modelKey: "gpt-image-2", labelZh: "GPT Image 2", kind: "image",
      enabled: true, createdAt: now, updatedAt: now,
    }],
    mappings: [
      { id: "t2i", vendorKey: "www-getone-ai", modelKey: "gpt-image-2", taskKind: "text_to_image", name: "t2i", enabled: true, create: NEWAPI_IMAGE_CREATE_OP, createdAt: now, updatedAt: now },
      { id: "edit", vendorKey: "www-getone-ai", modelKey: "gpt-image-2", taskKind: "image_edit", name: "edit", enabled: true, create: OPENAI_MULTIPART_IMAGE_EDIT_OP, createdAt: now, updatedAt: now },
    ],
    apiKeysByVendor: { "www-getone-ai": { vendorKey: "www-getone-ai", apiKey: "ciphertext", enabled: true, enc: "safeStorage", createdAt: now, updatedAt: now } },
  };
}

describe("GetOne GPT Image empirical contract", () => {
  it("adds the selected ratio, but no unverified resolution promise, to both prompt wires", () => {
    expect(applyGetOneImageOperation(NEWAPI_IMAGE_CREATE_OP).body).toMatchObject({
      prompt: expect.stringContaining("{{request.params.aspect_ratio}} aspect ratio"),
    });
    const multipartPrompt = applyGetOneImageOperation(OPENAI_MULTIPART_IMAGE_EDIT_OP).multipart?.fields?.prompt;
    expect(multipartPrompt).toContain("{{request.params.aspect_ratio}} aspect ratio");
    expect(multipartPrompt).not.toContain("resolution");
  });

  it("repairs saved mappings in place and is idempotent", () => {
    const original = state();
    const first = repairGetOneImageContracts(original);
    expect(first.changed).toBe(true);
    expect(first.state.mappings.map((mapping) => mapping.id)).toEqual(["t2i", "edit"]);
    expect(first.state.apiKeysByVendor).toEqual(original.apiKeysByVendor);
    expect(JSON.stringify(first.state.mappings)).toContain("Output requirement: use an exact");
    expect(repairGetOneImageContracts(first.state).changed).toBe(false);
  });

  it("does not change an unrelated relay", () => {
    const unrelated = state();
    unrelated.vendors[0] = { ...unrelated.vendors[0], key: "relay", baseUrlHint: "https://relay.example" };
    unrelated.models[0] = { ...unrelated.models[0], vendorKey: "relay" };
    unrelated.mappings = unrelated.mappings.map((mapping) => ({ ...mapping, vendorKey: "relay" }));
    expect(repairGetOneImageContracts(unrelated)).toEqual({ state: unrelated, changed: false });
  });
});
