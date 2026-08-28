import { describe, expect, it } from "vitest";
import {
  GETTOKEN_QWEN_IMAGE_CREATE_OP,
  GETTOKEN_QWEN_IMAGE_EDIT_OP,
  repairGetTokenQwenImageContracts,
} from "./gettokenQwenImage";
import { applyParamMap } from "./paramTranslate";
import type { CatalogState } from "./types";

const now = "2026-08-28T01:00:00.000Z";

function staleCatalog(baseUrlHint = "https://www.gettoken.net"): CatalogState {
  return {
    version: 10,
    vendors: [{
      key: "gettoken-2",
      name: "gettoken2",
      enabled: true,
      baseUrlHint,
      authType: "bearer",
      createdAt: now,
      updatedAt: now,
    }],
    models: [{
      vendorKey: "gettoken-2",
      modelKey: "qwen-image-2.0-pro",
      modelAlias: "qwen-image-2.0-pro",
      labelZh: "Qwen Image 2.0 Pro",
      kind: "image",
      enabled: true,
      meta: {
        imageOptions: { supportsReferenceImages: false },
        adapter: { state: "partial", activeRevision: "adaptive:stale", modes: [] },
      },
      createdAt: now,
      updatedAt: now,
    }],
    mappings: [{
      id: "stale-edit",
      vendorKey: "gettoken-2",
      modelKey: "qwen-image-2.0-pro",
      taskKind: "image_edit",
      name: "stale edit",
      enabled: true,
      create: {
        method: "POST",
        path: "/v1/chat/completions",
        body: { messages: [] },
        response_mapping: { image_url: "choices.0.message.images.0.url" },
      },
      createdAt: now,
      updatedAt: now,
    }],
    apiKeysByVendor: {
      "gettoken-2": {
        vendorKey: "gettoken-2",
        apiKey: "encrypted-credential",
        enc: "safeStorage",
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  };
}

describe("GetToken Qwen Image contract repair", () => {
  it("replaces a stale chat edit mapping and adds the proven text mapping", () => {
    const state = staleCatalog();
    const credentialBefore = JSON.stringify(state.apiKeysByVendor);
    expect(repairGetTokenQwenImageContracts(state, now)).toBe(true);
    expect(state.models[0]).toMatchObject({
      enabled: true,
      meta: {
        imageOptions: { supportsReferenceImages: true },
        adapter: { state: "verified", activeRevision: "catalog:gettoken-qwen-images:v2" },
      },
    });
    expect(state.mappings.find((mapping) => mapping.taskKind === "image_edit")).toMatchObject({
      id: "stale-edit",
      create: {
        path: "/v1/images/generations",
        body: { image_urls: "{{request.params.image_urls}}" },
        paramMap: { rules: [{ wire: "size", fromMany: ["size", "aspect_ratio", "resolution"], transform: "ratioAliasResToOpenAiSize" }] },
      },
    });
    expect(state.mappings.find((mapping) => mapping.taskKind === "text_to_image")?.create).toMatchObject({
      path: "/v1/images/generations",
      paramMap: { rules: [{ wire: "size", fromMany: ["size", "aspect_ratio", "resolution"], transform: "ratioAliasResToOpenAiSize" }] },
    });
    expect(JSON.stringify(state.apiKeysByVendor)).toBe(credentialBefore);
    expect(repairGetTokenQwenImageContracts(state, "2026-08-28T02:00:00.000Z")).toBe(false);

    const edit = state.mappings.find((mapping) => mapping.taskKind === "image_edit");
    if (!edit) throw new Error("edit mapping missing");
    edit.create = { ...edit.create, response_mapping: { image_url: "wrong.path" } };
    expect(repairGetTokenQwenImageContracts(state, "2026-08-28T03:00:00.000Z")).toBe(true);
    expect(state.mappings.find((mapping) => mapping.taskKind === "image_edit")?.create.response_mapping)
      .toEqual({ image_url: "data[*].url" });
    expect(JSON.stringify(state.apiKeysByVendor)).toBe(credentialBefore);
  });

  it("preserves the persisted model-key casing in exact mappings", () => {
    const state = staleCatalog();
    state.models[0].modelKey = "Qwen-Image-2.0-Pro";
    state.mappings[0].modelKey = "Qwen-Image-2.0-Pro";
    expect(repairGetTokenQwenImageContracts(state, now)).toBe(true);
    expect(state.mappings.filter((mapping) => mapping.vendorKey === "gettoken-2").map((mapping) => mapping.modelKey))
      .toEqual(["Qwen-Image-2.0-Pro", "Qwen-Image-2.0-Pro"]);
  });

  it("translates both canvas and compatibility ratio shapes for text and edit", () => {
    for (const operation of [GETTOKEN_QWEN_IMAGE_CREATE_OP, GETTOKEN_QWEN_IMAGE_EDIT_OP]) {
      expect(applyParamMap(operation.paramMap, { size: "1:1", resolution: "1K" }).size).toBe("1024x1024");
      expect(applyParamMap(operation.paramMap, { aspect_ratio: "16:9", resolution: "2K" }).size).toBe("2048x1152");
    }
  });

  it.each([
    "https://api.gettoken.net",
    "https://www.gettoken.net:8443",
    "https://user@www.gettoken.net",
    "https://www.gettoken.net?relay=1",
    "https://www.gettoken.net/#alternate",
  ])("does not promote unverified endpoint variant %s", (endpoint) => {
    const state = staleCatalog(endpoint);
    expect(repairGetTokenQwenImageContracts(state, now)).toBe(false);
    expect(state.mappings[0].create.path).toBe("/v1/chat/completions");
  });
});
