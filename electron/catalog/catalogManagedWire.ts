import { nativeWireProfileById } from "./nativeWireProfiles";
import type { NativeWireProfile } from "./nativeWireProfiles";
import type { CatalogState, Mapping, Model, Vendor } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function sameContract(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mappingMatchesProfile(mapping: Mapping, profile: NativeWireProfile): boolean {
  const create = profile.create[mapping.taskKind];
  if (!create || !sameContract(mapping.create, create)) return false;
  if (!sameContract(mapping.query, profile.query)) return false;
  return sameContract(mapping.statusMapping, profile.statusMapping);
}

export type CatalogManagedWireIdentity = {
  vendor: Vendor;
  model: Model;
  profile: NativeWireProfile;
};

export type CatalogManagedWireContract = CatalogManagedWireIdentity & { mappings: Mapping[] };

/** Resolve code-owned identity even when its executable mapping is temporarily disabled or damaged. */
export function catalogManagedWireIdentity(
  state: CatalogState,
  vendorKey: string,
  modelKey: string,
): CatalogManagedWireIdentity | null {
  const vendor = state.vendors.find((candidate) => candidate.key === vendorKey);
  const model = state.models.find((candidate) => candidate.vendorKey === vendorKey && candidate.modelKey === modelKey);
  if (!vendor || !model) return null;
  const meta = asRecord(model.meta);
  if (meta.catalogManagedWire !== true || Number(meta.catalogPresetRevision || 0) <= 0) return null;
  const profile = nativeWireProfileById(typeof meta.wireProfile === "string" ? meta.wireProfile : "");
  if (!profile) return null;
  return { vendor, model, profile };
}

export function catalogManagedWireHostMatches(identity: CatalogManagedWireIdentity): boolean {
  const baseUrl = String(identity.vendor.baseUrlHint || "").trim();
  return !identity.profile.matchesBaseUrl || identity.profile.matchesBaseUrl(baseUrl);
}

export function catalogManagedWireMappings(
  state: CatalogState,
  identity: CatalogManagedWireIdentity,
  enabledOnly = true,
): Mapping[] {
  return state.mappings.filter(
    (mapping) =>
      (!enabledOnly || mapping.enabled) &&
      mapping.vendorKey === identity.vendor.key &&
      mapping.modelKey === identity.model.modelKey &&
      mappingMatchesProfile(mapping, identity.profile),
  );
}

/** A current contract additionally requires at least one exact enabled model mapping. */
export function catalogManagedWireContract(
  state: CatalogState,
  vendorKey: string,
  modelKey: string,
): CatalogManagedWireContract | null {
  const identity = catalogManagedWireIdentity(state, vendorKey, modelKey);
  if (!identity || !catalogManagedWireHostMatches(identity)) return null;
  const mappings = catalogManagedWireMappings(state, identity);
  return mappings.length > 0 ? { ...identity, mappings } : null;
}
