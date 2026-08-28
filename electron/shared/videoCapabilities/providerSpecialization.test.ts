import { describe, expect, it } from "vitest";
import type { ModelArchetype } from "./types";
import { capabilityProviderKey } from "./providerSpecialization";

const archetype = {
  id: "fixture",
  family: "fixture",
  label: "Fixture",
  kind: "video",
  defaultModeId: "base",
  transportTaskKind: "text_to_video",
  identifierPatterns: ["fixture"],
  modes: [
    { id: "base", intent: "text", vendorTerm: "Base", hint: "base mode", promptRequired: true, transportTaskKind: "text_to_video", slots: [], params: [], vendorParams: { relay: [] } },
    { id: "future", intent: "single", vendorTerm: "Future", hint: "future mode", promptRequired: true, transportTaskKind: "image_to_video", slots: [], params: [] },
  ],
  vendorModeIds: { relay: ["base"] },
} satisfies ModelArchetype;

describe("capabilityProviderKey", () => {
  it("inherits an explicitly declared family contract for credential-scoped numeric suffixes", () => {
    expect(capabilityProviderKey(archetype, "relay-2")).toBe("relay");
    expect(capabilityProviderKey(archetype, "relay-17")).toBe("relay");
  });

  it("keeps exact and unrelated provider identities unchanged", () => {
    expect(capabilityProviderKey(archetype, "relay")).toBe("relay");
    expect(capabilityProviderKey(archetype, "other-2")).toBe("other-2");
  });
});
