import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { selectTaskMapping } from "./types";

let mockedUserDataRoot = "";
const tempRoots: string[] = [];

vi.mock("electron", () => ({
  app: { getPath: () => mockedUserDataRoot, getAppPath: () => process.cwd() },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}));

beforeEach(() => {
  mockedUserDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nomi-gettoken-commit-"));
  tempRoots.push(mockedUserDataRoot);
  vi.resetModules();
});

afterEach(() => {
  for (const root of tempRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("GetToken Seedance onboarding commit", () => {
  it("把 wire 身份、模型档案和两条调用 mapping 一起落库", async () => {
    const { commitManualOpenAiCompatibleModels } = await import("./catalogCommit");
    const { listModelCatalogMappings, listModelCatalogModels } = await import("./catalogStore");

    const result = commitManualOpenAiCompatibleModels({
      vendorName: "GetToken",
      baseUrl: "https://www.gettoken.net/v1",
      apiKey: "test-key",
      models: [
        {
          id: "doubao-seedance-2-0-260128",
          displayName: "Seedance 2.0",
          kind: "video",
          wireProfileId: "gettoken-seedance-2",
        },
      ],
    });

    expect(result.vendorKey).toBe("gettoken");
    const model = listModelCatalogModels().find(
      (candidate) => candidate.vendorKey === result.vendorKey && candidate.modelKey === "doubao-seedance-2-0-260128",
    );
    expect(model?.meta).toMatchObject({
      wireProfile: "gettoken-seedance-2",
      archetypeId: "volcengine-seedance-2",
    });

    const mappings = listModelCatalogMappings();
    const textMapping = selectTaskMapping(mappings, result.vendorKey, "text_to_video", "doubao-seedance-2-0-260128");
    const imageMapping = selectTaskMapping(mappings, result.vendorKey, "image_to_video", "doubao-seedance-2-0-260128");
    expect(textMapping?.create.path).toBe("/v1/video/generations");
    expect(imageMapping?.create.path).toBe("/v1/video/generations");
    expect(imageMapping?.create.request_transform).toBe("gettoken-seedance-frames");
  });
});
