import { isGetTokenBaseUrl } from "./gettokenSeedance";
import { decryptApiKeyRecord, decryptCustomSecretValue, type ApiKeyRecord } from "./secrets";
import type { CatalogState, Mapping, Model } from "./types";

const CANONICAL_KEY = "gettoken";

function sameModel(left: Model, right: Model): boolean {
  return left.vendorKey === right.vendorKey && left.modelKey === right.modelKey;
}

function sameMapping(left: Mapping, right: Mapping): boolean {
  return left.vendorKey === right.vendorKey
    && left.taskKind === right.taskKind
    && (left.modelKey || undefined) === (right.modelKey || undefined);
}

function mergeModel(canonical: Model, legacy: Model): Model {
  return {
    ...canonical,
    ...legacy,
    vendorKey: CANONICAL_KEY,
    meta: { ...(legacy.meta || {}), ...(canonical.meta || {}) },
  };
}

function mergeMapping(canonical: Mapping, legacy: Mapping): Mapping {
  return {
    ...legacy,
    ...canonical,
    name: legacy.name ?? canonical.name,
    enabled: legacy.enabled,
    createdAt: legacy.createdAt,
    vendorKey: CANONICAL_KEY,
  };
}

function uniqueMappingId(mappings: readonly Mapping[], requested: string, legacyKey: string): string {
  if (!mappings.some((mapping) => mapping.id === requested)) return requested;
  let suffix = 1;
  let candidate = `${requested}-migrated-${legacyKey}`;
  while (mappings.some((mapping) => mapping.id === candidate)) candidate = `${requested}-migrated-${legacyKey}-${suffix++}`;
  return candidate;
}

function sameCustomSecret(left: NonNullable<ApiKeyRecord["customConfig"]>[string], right: NonNullable<ApiKeyRecord["customConfig"]>[string]): boolean {
  if (left.enc === right.enc && left.value === right.value) return true;
  const leftPlain = decryptCustomSecretValue(left);
  const rightPlain = decryptCustomSecretValue(right);
  return Boolean(leftPlain) && leftPlain === rightPlain;
}

function credentialsCanMerge(canonical: ApiKeyRecord | undefined, alias: ApiKeyRecord | undefined): boolean {
  if (!canonical || !alias) return true;
  if (canonical.apiKey && alias.apiKey) {
    const exact = canonical.enc === alias.enc && canonical.apiKey === alias.apiKey;
    if (!exact) {
      const canonicalPlain = decryptApiKeyRecord(canonical);
      const aliasPlain = decryptApiKeyRecord(alias);
      if (!canonicalPlain || canonicalPlain !== aliasPlain) return false;
    }
  }
  const canonicalConfig = canonical.customConfig || {};
  const aliasConfig = alias.customConfig || {};
  return Object.keys(canonicalConfig).every((name) => !aliasConfig[name] || sameCustomSecret(canonicalConfig[name], aliasConfig[name]));
}

function mergeCredential(canonical: ApiKeyRecord | undefined, alias: ApiKeyRecord): ApiKeyRecord {
  const primary = canonical?.apiKey ? canonical : alias;
  const customConfig = { ...(alias.customConfig || {}), ...(canonical?.customConfig || {}) };
  return {
    ...primary,
    vendorKey: CANONICAL_KEY,
    ...(Object.keys(customConfig).length > 0 ? { customConfig } : {}),
  };
}

/** Consolidate legacy GetToken relay identities without overwriting a distinct saved credential. */
export function migrateGetTokenVendorAliases(state: CatalogState): { state: CatalogState; changed: boolean } {
  const aliases = state.vendors.filter((vendor) => vendor.key !== CANONICAL_KEY && isGetTokenBaseUrl(vendor.baseUrlHint || ""));
  if (aliases.length === 0) return { state, changed: false };

  const vendors = [...state.vendors];
  const models = [...state.models];
  const mappings = [...state.mappings];
  const apiKeysByVendor = { ...(state.apiKeysByVendor || {}) };
  let canonical = vendors.find((vendor) => vendor.key === CANONICAL_KEY);

  if (!canonical) {
    const preferred = aliases.find((vendor) => apiKeysByVendor[vendor.key]) ?? aliases[0];
    const index = vendors.findIndex((vendor) => vendor.key === preferred.key);
    canonical = { ...preferred, key: CANONICAL_KEY, name: "GetToken" };
    vendors[index] = canonical;
  }

  let changed = false;
  for (const alias of aliases) {
    if (alias.key === canonical.key) continue;
    const canonicalCredential = apiKeysByVendor[CANONICAL_KEY];
    const aliasCredential = apiKeysByVendor[alias.key];
    if (!credentialsCanMerge(canonicalCredential, aliasCredential)) continue;

    const canonicalIndex = vendors.findIndex((vendor) => vendor.key === CANONICAL_KEY);
    vendors[canonicalIndex] = { ...alias, ...vendors[canonicalIndex], key: CANONICAL_KEY, name: "GetToken" };
    if (aliasCredential) apiKeysByVendor[CANONICAL_KEY] = mergeCredential(canonicalCredential, aliasCredential);
    delete apiKeysByVendor[alias.key];

    for (let index = models.length - 1; index >= 0; index -= 1) {
      const legacy = models[index];
      if (legacy.vendorKey !== alias.key) continue;
      const migrated = { ...legacy, vendorKey: CANONICAL_KEY };
      const duplicateIndex = models.findIndex((model, candidateIndex) => candidateIndex !== index && sameModel(model, migrated));
      if (duplicateIndex >= 0) models[duplicateIndex] = mergeModel(models[duplicateIndex], legacy);
      else models[index] = migrated;
      if (duplicateIndex >= 0) models.splice(index, 1);
    }

    for (let index = mappings.length - 1; index >= 0; index -= 1) {
      const legacy = mappings[index];
      if (legacy.vendorKey !== alias.key) continue;
      const migrated = { ...legacy, vendorKey: CANONICAL_KEY };
      const duplicateIndex = mappings.findIndex((mapping, candidateIndex) => candidateIndex !== index && sameMapping(mapping, migrated));
      if (duplicateIndex >= 0) {
        mappings[duplicateIndex] = mergeMapping(mappings[duplicateIndex], legacy);
        mappings.splice(index, 1);
      } else {
        mappings[index] = { ...migrated, id: uniqueMappingId(mappings.filter((_, candidateIndex) => candidateIndex !== index), legacy.id, alias.key) };
      }
    }

    const aliasIndex = vendors.findIndex((vendor) => vendor.key === alias.key);
    if (aliasIndex >= 0) vendors.splice(aliasIndex, 1);
    changed = true;
  }

  if (!changed) return { state, changed: false };
  return { state: { ...state, vendors, models, mappings, apiKeysByVendor }, changed: true };
}
