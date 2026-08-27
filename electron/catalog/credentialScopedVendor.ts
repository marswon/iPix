import { decryptApiKeyRecord } from "./secrets";
import type { CatalogState } from "./types";

function normalizedEndpoint(value: string): string {
  const raw = String(value || "").trim();
  try {
    const url = new URL(raw);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

/** A catalog vendor is one credential-bearing account, even when several accounts share a host. */
export function resolveCredentialScopedVendorKey(
  input: {
    derivedVendorKey: string;
    baseUrl: string;
    apiKey: string;
    authType: string;
  },
  state: CatalogState,
): string {
  const requested = input.derivedVendorKey.trim();
  const endpoint = normalizedEndpoint(input.baseUrl);
  const sameEndpoint = state.vendors.filter((vendor) => normalizedEndpoint(vendor.baseUrlHint || "") === endpoint);
  if (input.authType === "none") {
    return sameEndpoint.find((vendor) => vendor.key === requested)?.key || requested;
  }

  for (const vendor of sameEndpoint) {
    const saved = decryptApiKeyRecord(state.apiKeysByVendor[vendor.key]);
    if (saved && saved === input.apiKey) return vendor.key;
  }
  if (!state.vendors.some((vendor) => vendor.key === requested)) return requested;

  let suffix = 2;
  let candidate = `${requested}-${suffix}`;
  while (state.vendors.some((vendor) => vendor.key === candidate)) candidate = `${requested}-${++suffix}`;
  return candidate;
}
