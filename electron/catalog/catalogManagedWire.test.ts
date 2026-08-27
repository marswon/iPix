import { describe, expect, it } from "vitest";
import { applyBuiltinSeeds } from "./seedBuiltins";
import { catalogManagedWireContract, catalogManagedWireIdentity } from "./catalogManagedWire";
import type { CatalogState } from "./types";

const NOW = "2026-08-28T00:00:00.000Z";

function seeded(): CatalogState {
  return applyBuiltinSeeds({ version: 10, vendors: [], models: [], mappings: [], apiKeysByVendor: {} }, NOW).state;
}

describe("catalog-managed wire contract", () => {
  it("recognizes the exact registered GetToken profile and curated mappings", () => {
    const contract = catalogManagedWireContract(seeded(), "gettoken", "doubao-seedance-2-0-260128");
    expect(contract?.profile.id).toBe("gettoken-seedance-2");
    expect(contract?.mappings.map((mapping) => mapping.taskKind).sort()).toEqual(["image_to_video", "text_to_video"]);
  });

  it("rejects host mismatch, disabled mappings, and unowned metadata", () => {
    const wrongHost = seeded();
    wrongHost.vendors.find((vendor) => vendor.key === "gettoken")!.baseUrlHint = "https://relay.example.com";
    expect(catalogManagedWireContract(wrongHost, "gettoken", "doubao-seedance-2-0-260128")).toBeNull();
    expect(catalogManagedWireIdentity(wrongHost, "gettoken", "doubao-seedance-2-0-260128")).not.toBeNull();

    const disabled = seeded();
    for (const mapping of disabled.mappings) if (mapping.vendorKey === "gettoken") mapping.enabled = false;
    expect(catalogManagedWireContract(disabled, "gettoken", "doubao-seedance-2-0-260128")).toBeNull();
    expect(catalogManagedWireIdentity(disabled, "gettoken", "doubao-seedance-2-0-260128")).not.toBeNull();

    const unowned = seeded();
    const model = unowned.models.find((candidate) => candidate.vendorKey === "gettoken")!;
    model.meta = { ...(model.meta || {}), catalogManagedWire: false };
    expect(catalogManagedWireContract(unowned, "gettoken", model.modelKey)).toBeNull();
  });
});
