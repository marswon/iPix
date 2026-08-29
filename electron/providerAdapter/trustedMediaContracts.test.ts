import { describe, expect, it } from "vitest";
import type { ProviderAdapterDraft } from "./types";
import { applyTrustedMediaContracts } from "./trustedMediaContracts";

function draftFor(modelKey: string, baseUrl = "https://relay.example"): ProviderAdapterDraft {
  return {
    provider: { baseUrl, authType: "bearer" },
    sources: [{ url: "https://relay.example/docs", evidence: "image edit docs" }],
    models: [{
      modelKey,
      labelZh: modelKey,
      kind: "image",
      modes: [{
        taskKind: "image_edit",
        create: {
          method: "POST",
          path: "/v1/chat/completions",
          headers: { Authorization: "Bearer {{user_api_key}}", "Content-Type": "application/json" },
          body: { model: "{{model.modelKey}}", prompt: "{{request.prompt}}" },
        },
        referenceParam: "image_url",
        referenceShape: "single",
        sourceUrls: ["https://relay.example/docs"],
      }],
    }],
  };
}

describe("applyTrustedMediaContracts", () => {
  it("projects a documented GPT Image edit mode onto the audited multipart transport", () => {
    const trusted = applyTrustedMediaContracts(draftFor("gpt-image-2"));
    const mode = trusted.models[0].modes[0];
    expect(mode.create.path).toBe("/v1/images/edits");
    expect(mode.create.multipart).toMatchObject({ imageField: "image[]", multiple: true });
    expect(mode.create.headers).toEqual({ Authorization: "Bearer {{user_api_key}}" });
    expect(mode.referenceParam).toBe("reference_images");
    expect(mode.referenceShape).toBe("array");
  });

  it("adds GetOne's empirically required prompt ratio to the trusted edit wire", () => {
    const trusted = applyTrustedMediaContracts(draftFor("gpt-image-2", "https://www.getone.ai"));
    expect(trusted.models[0].modes[0].create.multipart?.fields?.prompt).toContain("{{request.params.aspect_ratio}} aspect ratio");
  });

  it("does not rewrite chat-based image model contracts", () => {
    const draft = draftFor("nano-banana-pro");
    expect(applyTrustedMediaContracts(draft)).toBe(draft);
    expect(draft.models[0].modes[0].create.path).toBe("/v1/chat/completions");
  });
});
