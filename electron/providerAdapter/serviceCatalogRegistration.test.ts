import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let userDataRoot = "";
vi.mock("electron", () => ({
  app: { getPath: () => userDataRoot, getAppPath: () => process.cwd() },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  },
}));

import { mutateCatalog, readCatalog } from "../catalog/catalogStore";
import { decryptApiKeyRecord } from "../catalog/secrets";
import { registerProviderConnection } from "./registration";
import { defaultCatalog } from "./serviceCatalog";

const roots: string[] = [];
const now = "2026-08-28T00:00:00.000Z";

beforeEach(() => {
  userDataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nomi-provider-groups-"));
  roots.push(userDataRoot);
});

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function registerSecondGroup(apiKey = "key-general") {
  return registerProviderConnection({
    rawInput: {
      vendorName: "GetToken 通用",
      baseUrl: "https://www.gettoken.net/",
      apiKey,
      authType: "bearer",
      providerKind: "openai-compatible",
      models: [
        { modelKey: "qwen3.5-flash", kind: "text" },
        { modelKey: "qwen-image-2.0", kind: "image" },
      ],
    },
    catalog: defaultCatalog,
    now: () => now,
  });
}

describe("credential-scoped provider registration", () => {
  it("keeps two credentials on the same endpoint and activates verified GetToken text/image transports", () => {
    mutateCatalog((tx) => {
      tx.upsertVendor({
        key: "gettoken",
        name: "GetToken Seedance",
        baseUrlHint: "https://www.gettoken.net",
        authType: "bearer",
        enabled: true,
      });
      tx.upsertApiKey("gettoken", { apiKey: "key-seedance", enabled: true });
    });

    const registration = registerSecondGroup();
    expect(registration).toMatchObject({
      vendorKey: "gettoken-2",
      vendorName: "GetToken 通用",
      selectedModelKeys: ["qwen3.5-flash", "qwen-image-2.0"],
    });

    const state = readCatalog();
    expect(
      state.vendors
        .filter((vendor) => vendor.baseUrlHint === "https://www.gettoken.net")
        .map((vendor) => vendor.key)
        .sort(),
    ).toEqual(["gettoken", "gettoken-2"]);
    expect(state.vendors.find((vendor) => vendor.key === "gettoken-2")?.meta).toMatchObject({
      credentialScopedConnection: true,
    });
    expect(decryptApiKeyRecord(state.apiKeysByVendor.gettoken)).toBe("key-seedance");
    expect(decryptApiKeyRecord(state.apiKeysByVendor["gettoken-2"])).toBe("key-general");
    expect(
      state.models
        .filter((model) => model.vendorKey === "gettoken-2")
        .map((model) => [model.modelKey, model.enabled])
        .sort(),
    ).toEqual([
      ["qwen-image-2.0", true],
      ["qwen3.5-flash", true],
    ]);
    expect(state.mappings).toContainEqual(
      expect.objectContaining({
        vendorKey: "gettoken-2",
        modelKey: "qwen-image-2.0",
        taskKind: "text_to_image",
        enabled: true,
        create: expect.objectContaining({ method: "POST", path: "/v1/images/generations" }),
      }),
    );
  });

  it("reuses the credential's persisted sibling identity and allocates around collisions", () => {
    mutateCatalog((tx) => {
      tx.upsertVendor({
        key: "gettoken",
        name: "Seedance",
        baseUrlHint: "https://www.gettoken.net",
        authType: "bearer",
        enabled: true,
      });
      tx.upsertApiKey("gettoken", { apiKey: "key-seedance", enabled: true });
      tx.upsertVendor({
        key: "gettoken-2",
        name: "Other group",
        baseUrlHint: "https://www.gettoken.net",
        authType: "bearer",
        enabled: true,
      });
      tx.upsertApiKey("gettoken-2", { apiKey: "key-other", enabled: true });
    });

    expect(registerSecondGroup("key-other").vendorKey).toBe("gettoken-2");
    expect(registerSecondGroup("key-third").vendorKey).toBe("gettoken-3");
  });

  it("installs the real-verified GetToken Qwen Pro edit contract", () => {
    const registration = registerProviderConnection({
      rawInput: {
        vendorName: "GetToken Pro",
        baseUrl: "https://www.gettoken.net",
        apiKey: "variant-key",
        authType: "bearer",
        models: [{ modelKey: "qwen-image-2.0-pro", kind: "image" }],
      },
      catalog: defaultCatalog,
      now: () => now,
    });
    const state = readCatalog();
    expect(state.models.find((model) => model.vendorKey === registration.vendorKey)).toMatchObject({
      enabled: true,
      meta: {
        imageOptions: { supportsReferenceImages: true },
        adapter: {
          state: "verified",
          modes: [
            { taskKind: "text_to_image", state: "verified" },
            { taskKind: "image_edit", state: "verified" },
          ],
        },
      },
    });
    expect(state.mappings.find((mapping) => mapping.vendorKey === registration.vendorKey &&
      mapping.taskKind === "image_edit")).toMatchObject({
      modelKey: "qwen-image-2.0-pro",
      create: {
        method: "POST",
        path: "/v1/images/generations",
        body: { image_urls: "{{request.params.image_urls}}" },
        response_mapping: { image_url: "data[*].url" },
      },
    });
  });

  it("does not promote unverified GetToken image variants or alternate hosts", () => {
    const unverifiedVariant = registerProviderConnection({
      rawInput: {
        vendorName: "GetToken",
        baseUrl: "https://www.gettoken.net",
        apiKey: "variant-key",
        authType: "bearer",
        models: [{ modelKey: "qwen-image-max", kind: "image" }],
      },
      catalog: defaultCatalog,
      now: () => now,
    });
    const alternateHost = registerProviderConnection({
      rawInput: {
        vendorName: "GetToken alternate",
        baseUrl: "https://api.gettoken.net",
        apiKey: "alternate-key",
        authType: "bearer",
        models: [{ modelKey: "qwen-image-2.0-pro", kind: "image" }],
      },
      catalog: defaultCatalog,
      now: () => now,
    });

    const state = readCatalog();
    for (const vendorKey of [unverifiedVariant.vendorKey, alternateHost.vendorKey]) {
      expect(state.models.find((model) => model.vendorKey === vendorKey)?.enabled).toBe(false);
      expect(state.mappings.some((mapping) => mapping.vendorKey === vendorKey)).toBe(false);
    }
  });

  it("treats default ports and trailing slashes as the same credential endpoint", () => {
    mutateCatalog((tx) => {
      tx.upsertVendor({
        key: "relay-test",
        name: "Relay",
        baseUrlHint: "https://relay.test/v1",
        authType: "bearer",
        enabled: true,
      });
      tx.upsertApiKey("relay-test", { apiKey: "same-key", enabled: true });
    });

    const registration = registerProviderConnection({
      rawInput: {
        vendorName: "Relay",
        baseUrl: "https://relay.test:443/v1/",
        apiKey: "same-key",
        authType: "bearer",
        models: [],
      },
      catalog: defaultCatalog,
      now: () => now,
    });
    expect(registration.vendorKey).toBe("relay-test");
    expect(readCatalog().vendors.filter((vendor) => vendor.baseUrlHint?.includes("relay.test"))).toHaveLength(1);
  });

  it("honors an explicit existing connection identity without invoking sibling allocation", () => {
    const resolver = vi.fn(() => "must-not-be-used");
    const catalog = { ...defaultCatalog, resolveRegistrationVendorKey: resolver };
    mutateCatalog((tx) => {
      tx.upsertVendor({
        key: "saved-connection",
        name: "Saved",
        baseUrlHint: "https://www.gettoken.net",
        authType: "bearer",
        enabled: true,
      });
      tx.upsertApiKey("saved-connection", { apiKey: "saved-key", enabled: true });
      tx.upsertModel({
        vendorKey: "saved-connection",
        modelKey: "qwen-image-2.0",
        labelZh: "Qwen Image 2.0",
        kind: "image",
        enabled: false,
        meta: { adapter: { state: "unverified", modes: [] } },
      });
    });

    const registration = registerProviderConnection({
      rawInput: {
        catalogVendorKey: "saved-connection",
        preserveExistingCredential: true,
        vendorName: "Saved",
        baseUrl: "https://www.gettoken.net",
        apiKey: "",
        authType: "bearer",
        models: [
          { modelKey: "qwen3.5-flash", kind: "text" },
          { modelKey: "qwen-image-2.0", kind: "image" },
        ],
      },
      catalog,
      now: () => now,
    });
    expect(registration.vendorKey).toBe("saved-connection");
    expect(resolver).not.toHaveBeenCalled();
    const state = readCatalog();
    expect(decryptApiKeyRecord(state.apiKeysByVendor["saved-connection"])).toBe("saved-key");
    expect(
      state.models.find((model) => model.vendorKey === "saved-connection" && model.modelKey === "qwen-image-2.0")
        ?.enabled,
    ).toBe(true);
    expect(state.mappings).toContainEqual(
      expect.objectContaining({
        vendorKey: "saved-connection",
        modelKey: "qwen-image-2.0",
        taskKind: "text_to_image",
        enabled: true,
      }),
    );
  });
});
