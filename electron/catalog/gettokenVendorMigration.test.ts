import { describe, expect, it, vi } from "vitest";
import type { CatalogState } from "./types";

vi.mock("./secrets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./secrets")>();
  return {
    ...actual,
    decryptApiKeyRecord: (record: Parameters<typeof actual.decryptApiKeyRecord>[0]) =>
      record?.enc === "safeStorage" && record.apiKey.startsWith("same-key-cipher:")
        ? "same-plaintext-key"
        : actual.decryptApiKeyRecord(record),
    decryptCustomSecretValue: (record: Parameters<typeof actual.decryptCustomSecretValue>[0]) =>
      record?.value.startsWith("same-config-cipher:") ? "same-config-value" : actual.decryptCustomSecretValue(record),
  };
});
import { migrateGetTokenVendorAliases } from "./gettokenVendorMigration";

const NOW = "2026-08-28T00:00:00.000Z";

function key(vendorKey: string, apiKey: string) {
  return { vendorKey, apiKey, enc: "plain" as const, enabled: true, createdAt: NOW, updatedAt: NOW };
}

function legacyState(): CatalogState {
  return {
    version: 10,
    vendors: [{
      key: "www-gettoken-net", name: "My GetToken", enabled: true, baseUrlHint: "https://www.gettoken.net/v1",
      authType: "bearer", createdAt: NOW, updatedAt: NOW,
    }],
    models: [
      { modelKey: "doubao-seedance-2-0-260128", vendorKey: "www-gettoken-net", labelZh: "My Seedance", kind: "video", enabled: false, createdAt: NOW, updatedAt: NOW },
      { modelKey: "another-gettoken-model", vendorKey: "www-gettoken-net", labelZh: "Other model", kind: "text", enabled: true, createdAt: NOW, updatedAt: NOW },
    ],
    mappings: [{
      id: "legacy-gettoken-chat", vendorKey: "www-gettoken-net", taskKind: "chat", modelKey: "another-gettoken-model",
      name: "Other model chat", enabled: true, create: { method: "POST", path: "/v1/chat/completions", body: {} },
      createdAt: NOW, updatedAt: NOW,
    }],
    apiKeysByVendor: { "www-gettoken-net": key("www-gettoken-net", "encrypted-key") },
  };
}

describe("GetToken vendor identity migration", () => {
  it("moves the saved key and every existing model/mapping to the canonical platform", () => {
    const { state, changed } = migrateGetTokenVendorAliases(legacyState());
    expect(changed).toBe(true);
    expect(state.vendors.map((vendor) => vendor.key)).toEqual(["gettoken"]);
    expect(state.vendors[0]).toMatchObject({ name: "GetToken", baseUrlHint: "https://www.gettoken.net/v1" });
    expect(state.apiKeysByVendor.gettoken).toMatchObject({ vendorKey: "gettoken", apiKey: "encrypted-key" });
    expect(state.apiKeysByVendor["www-gettoken-net"]).toBeUndefined();
    expect(state.models.map((model) => [model.vendorKey, model.modelKey])).toEqual([
      ["gettoken", "doubao-seedance-2-0-260128"],
      ["gettoken", "another-gettoken-model"],
    ]);
    expect(state.mappings[0]).toMatchObject({ vendorKey: "gettoken", modelKey: "another-gettoken-model" });
  });

  it("merges a legacy connection into an already-seeded keyless service without duplicating Seedance", () => {
    const legacy = legacyState();
    legacy.vendors.unshift({
      key: "gettoken", name: "GetToken", enabled: true, baseUrlHint: "https://www.gettoken.net",
      authType: "bearer", createdAt: NOW, updatedAt: NOW,
    });
    legacy.models.unshift({
      modelKey: "doubao-seedance-2-0-260128", vendorKey: "gettoken", labelZh: "Seedance 2.0", kind: "video", enabled: true,
      meta: { archetypeId: "volcengine-seedance-2", wireProfile: "gettoken-seedance-2" }, createdAt: NOW, updatedAt: NOW,
    });
    const { state } = migrateGetTokenVendorAliases(legacy);
    expect(state.vendors.filter((vendor) => vendor.key === "gettoken")).toHaveLength(1);
    expect(state.models.filter((model) => model.vendorKey === "gettoken" && model.modelKey === "doubao-seedance-2-0-260128")).toHaveLength(1);
    expect(state.models.find((model) => model.modelKey === "doubao-seedance-2-0-260128")).toMatchObject({
      labelZh: "My Seedance", enabled: false,
      meta: { archetypeId: "volcengine-seedance-2", wireProfile: "gettoken-seedance-2" },
    });
    expect(state.apiKeysByVendor.gettoken?.apiKey).toBe("encrypted-key");
  });

  it("recognizes separately encrypted copies of the same key and preserves both custom-config sets", () => {
    const legacy = legacyState();
    legacy.vendors.unshift({
      key: "gettoken", name: "GetToken", enabled: true, baseUrlHint: "https://www.gettoken.net",
      authType: "bearer", createdAt: NOW, updatedAt: NOW,
    });
    legacy.apiKeysByVendor.gettoken = {
      ...key("gettoken", "same-key-cipher:canonical"), enc: "safeStorage",
      customConfig: {
        canonicalOnly: { value: "canonical-config", enc: "safeStorage" },
        shared: { value: "same-config-cipher:canonical", enc: "safeStorage" },
      },
    };
    legacy.apiKeysByVendor["www-gettoken-net"] = {
      ...key("www-gettoken-net", "same-key-cipher:alias"), enc: "safeStorage",
      customConfig: {
        aliasOnly: { value: "alias-config", enc: "safeStorage" },
        shared: { value: "same-config-cipher:alias", enc: "safeStorage" },
      },
    };
    const { state } = migrateGetTokenVendorAliases(legacy);
    expect(state.vendors.map((vendor) => vendor.key)).toEqual(["gettoken"]);
    expect(Object.keys(state.apiKeysByVendor.gettoken?.customConfig || {}).sort()).toEqual(["aliasOnly", "canonicalOnly", "shared"]);
  });

  it("does not merge colliding custom-config fields whose values cannot be proven equal", () => {
    const legacy = legacyState();
    legacy.vendors.unshift({
      key: "gettoken", name: "GetToken", enabled: true, baseUrlHint: "https://www.gettoken.net",
      authType: "bearer", createdAt: NOW, updatedAt: NOW,
    });
    legacy.apiKeysByVendor.gettoken = {
      ...key("gettoken", "same-key"), customConfig: { region: { value: "cn", enc: "safeStorage" } },
    };
    legacy.apiKeysByVendor["www-gettoken-net"] = {
      ...key("www-gettoken-net", "same-key"), customConfig: { region: { value: "us", enc: "safeStorage" } },
    };
    const { state, changed } = migrateGetTokenVendorAliases(legacy);
    expect(changed).toBe(false);
    expect(state.vendors.map((vendor) => vendor.key)).toEqual(["gettoken", "www-gettoken-net"]);
  });

  it("does not overwrite or merge a legacy connection carrying a distinct credential", () => {
    const legacy = legacyState();
    legacy.vendors.unshift({
      key: "gettoken", name: "GetToken", enabled: true, baseUrlHint: "https://www.gettoken.net",
      authType: "bearer", createdAt: NOW, updatedAt: NOW,
    });
    legacy.apiKeysByVendor.gettoken = key("gettoken", "different-key");
    const { state, changed } = migrateGetTokenVendorAliases(legacy);
    expect(changed).toBe(false);
    expect(state.vendors.map((vendor) => vendor.key)).toEqual(["gettoken", "www-gettoken-net"]);
    expect(state.apiKeysByVendor.gettoken?.apiKey).toBe("different-key");
    expect(state.apiKeysByVendor["www-gettoken-net"]?.apiKey).toBe("encrypted-key");
  });
});
