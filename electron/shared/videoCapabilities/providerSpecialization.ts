import type { ModelArchetype } from "./types";

function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function declaresProviderContract(archetype: ModelArchetype, provider: string): boolean {
  if (hasOwn(archetype.vendorModeIds || {}, provider)) return true;
  return archetype.modes.some((mode) => hasOwn(mode.vendorParams || {}, provider));
}

/** Credential-scoped `vendor-2` connections inherit only an explicitly declared `vendor` capability contract. */
export function capabilityProviderKey(archetype: ModelArchetype, rawProvider: string | null | undefined): string {
  const provider = typeof rawProvider === "string" ? rawProvider.trim() : "";
  if (!provider || declaresProviderContract(archetype, provider)) return provider;
  const family = provider.replace(/-\d+$/, "");
  return family !== provider && declaresProviderContract(archetype, family) ? family : provider;
}
