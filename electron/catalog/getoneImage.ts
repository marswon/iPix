import { isJsonRecord } from "../jsonUtils";
import type { CatalogState, HttpOperation, Mapping, Vendor } from "./types";

const GETONE_HOSTS = new Set(["getone.ai", "www.getone.ai"]);
const GPT_IMAGE_RE = /(^|[/_-])gpt[_-]?image/i;
const PROMPT_REQUIREMENT = "\n\nOutput requirement: use an exact {{request.params.aspect_ratio}} aspect ratio.";

function isGetOne(vendor: Vendor | undefined): boolean {
  try {
    return Boolean(vendor?.baseUrlHint && GETONE_HOSTS.has(new URL(vendor.baseUrlHint).hostname.toLowerCase()));
  } catch {
    return false;
  }
}

function promptWithRequirements(prompt: unknown): string {
  const source = typeof prompt === "string" && prompt.trim() ? prompt : "{{request.prompt}}";
  return source.includes("Output requirement: use an exact") ? source : `${source}${PROMPT_REQUIREMENT}`;
}

/** GetOne currently ignores GPT Image structured size fields but follows an explicit ratio in the prompt. */
export function applyGetOneImageOperation(operation: HttpOperation): HttpOperation {
  if (operation.multipart) {
    const fields = { ...(operation.multipart.fields || {}) };
    return {
      ...operation,
      multipart: { ...operation.multipart, fields: { ...fields, prompt: promptWithRequirements(fields.prompt) } },
    };
  }
  const body = isJsonRecord(operation.body) ? operation.body : {};
  return { ...operation, body: { ...body, prompt: promptWithRequirements(body.prompt) } };
}

export function shouldApplyGetOneImageContract(input: {
  baseUrl: string | null | undefined;
  modelKey: string;
  taskKind: string;
}): boolean {
  let hostname = "";
  try {
    hostname = new URL(String(input.baseUrl || "")).hostname.toLowerCase();
  } catch {
    return false;
  }
  return GETONE_HOSTS.has(hostname) && GPT_IMAGE_RE.test(input.modelKey) &&
    (input.taskKind === "text_to_image" || input.taskKind === "image_edit");
}

function repairMapping(mapping: Mapping, vendor: Vendor | undefined): Mapping {
  if (!isGetOne(vendor) || !mapping.modelKey || !GPT_IMAGE_RE.test(mapping.modelKey) ||
      (mapping.taskKind !== "text_to_image" && mapping.taskKind !== "image_edit")) return mapping;
  const create = applyGetOneImageOperation(mapping.create);
  return JSON.stringify(create) === JSON.stringify(mapping.create)
    ? mapping
    : { ...mapping, create, updatedAt: new Date().toISOString() };
}

/** Idempotently repairs already-saved GetOne mappings without replacing connection identity or credentials. */
export function repairGetOneImageContracts(state: CatalogState): { state: CatalogState; changed: boolean } {
  const vendors = new Map(state.vendors.map((vendor) => [vendor.key, vendor]));
  let changed = false;
  const mappings = state.mappings.map((mapping) => {
    const repaired = repairMapping(mapping, vendors.get(mapping.vendorKey));
    if (repaired !== mapping) changed = true;
    return repaired;
  });
  return { state: changed ? { ...state, mappings } : state, changed };
}
