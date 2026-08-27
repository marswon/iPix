import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  decryptApiKeyRecord: vi.fn(() => "gettoken-key"),
  probeNativeEndpoint: vi.fn(async (_baseUrl: string, path: string) => ({
    exists: path === "/v1/video/generations",
    detail: path,
  })),
  upsertModelCatalogMapping: vi.fn(),
  upsertModelCatalogModel: vi.fn(),
}));

vi.mock("./secrets", () => ({ decryptApiKeyRecord: mocks.decryptApiKeyRecord }));
vi.mock("./nativeEndpointProbe", () => ({ probeNativeEndpoint: mocks.probeNativeEndpoint }));
vi.mock("./catalogStore", () => ({
  listModelCatalogMappings: () => [
    {
      vendorKey: "gettoken-relay",
      taskKind: "text_to_video",
      create: { method: "POST", path: "/v1/video/generations" },
    },
    {
      vendorKey: "gettoken-relay",
      modelKey: "doubao-seedance-2-0-260128",
      taskKind: "text_to_video",
      create: { method: "POST", path: "/api/v3/contents/generations/tasks" },
    },
  ],
  listModelCatalogModels: () => [
    {
      modelKey: "doubao-seedance-2-0-260128",
      vendorKey: "gettoken-relay",
      labelZh: "Seedance 2",
      kind: "video",
      enabled: true,
      meta: {
        wireProfile: "volcengine-seedance-2",
        archetypeId: "volcengine-seedance-2",
      },
      createdAt: "now",
      updatedAt: "now",
    },
  ],
  listModelCatalogVendors: () => [
    {
      key: "gettoken-relay",
      name: "GetToken",
      enabled: true,
      baseUrlHint: "https://www.gettoken.net/v1",
      authType: "bearer",
    },
  ],
  readCatalog: () => ({
    version: 9,
    vendors: [],
    models: [],
    mappings: [],
    apiKeysByVendor: {
      "gettoken-relay": {
        vendorKey: "gettoken-relay",
        apiKey: "encrypted-keychain-payload",
        enc: "safeStorage",
        enabled: true,
        createdAt: "now",
        updatedAt: "now",
      },
    },
  }),
  upsertModelCatalogMapping: mocks.upsertModelCatalogMapping,
  upsertModelCatalogModel: mocks.upsertModelCatalogModel,
}));

import { upgradeRelayModelsToNativeWire } from "./relayNativeWireUpgrade";

describe("GetToken Seedance startup wire migration", () => {
  it("原生端点不存在时继续探测 GetToken，并持久化独立 wire id", async () => {
    const result = await upgradeRelayModelsToNativeWire();

    expect(mocks.probeNativeEndpoint.mock.calls.map((call) => call[1])).toEqual([
      "/api/v3/contents/generations/tasks",
      "/v1/video/generations",
    ]);
    expect(mocks.upsertModelCatalogMapping).toHaveBeenCalledTimes(2);
    expect(mocks.upsertModelCatalogMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        taskKind: "text_to_video",
        modelKey: "doubao-seedance-2-0-260128",
        create: expect.objectContaining({ path: "/v1/video/generations" }),
      }),
    );
    expect(mocks.upsertModelCatalogMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        taskKind: "image_to_video",
        modelKey: "doubao-seedance-2-0-260128",
        create: expect.objectContaining({ request_transform: "gettoken-seedance-frames" }),
      }),
    );
    expect(mocks.upsertModelCatalogModel).toHaveBeenCalledWith(
      expect.objectContaining({
        modelKey: "doubao-seedance-2-0-260128",
        meta: expect.objectContaining({
          wireProfile: "gettoken-seedance-2",
          archetypeId: "volcengine-seedance-2",
        }),
      }),
    );
    expect(result).toEqual([expect.objectContaining({ upgraded: true, archetypeId: "volcengine-seedance-2" })]);
  });
});
