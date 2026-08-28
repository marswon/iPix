import { NEWAPI_IMAGE_CREATE_OP } from "./newapiTransport";
import type { ParamMap } from "./paramTranslate";
import type { CatalogState, HttpOperation, Mapping, ProfileKind } from "./types";

const GETTOKEN_HOST = "www.gettoken.net";
export const GETTOKEN_QWEN_STANDARD_MODEL = "qwen-image-2.0";
export const GETTOKEN_QWEN_PRO_MODEL = "qwen-image-2.0-pro";
const VERIFIED_REVISION = "catalog:gettoken-qwen-images:v2";

const JSON_HEADERS = { Authorization: "Bearer {{user_api_key}}", "Content-Type": "application/json" };
const GETTOKEN_QWEN_IMAGE_PARAM_MAP: ParamMap = {
  rules: [{ wire: "size", fromMany: ["size", "aspect_ratio", "resolution"], transform: "ratioAliasResToOpenAiSize" }],
};

export const GETTOKEN_QWEN_IMAGE_CREATE_OP: HttpOperation = {
  ...NEWAPI_IMAGE_CREATE_OP,
  paramMap: GETTOKEN_QWEN_IMAGE_PARAM_MAP,
};

export const GETTOKEN_QWEN_IMAGE_EDIT_OP: HttpOperation = {
  method: "POST",
  path: "/v1/images/generations",
  headers: JSON_HEADERS,
  body: {
    model: "{{model.modelKey}}",
    prompt: "{{request.prompt}}",
    size: "{{request.params.size}}",
    n: "{{request.params.n}}",
    image_urls: "{{request.params.image_urls}}",
    response_format: "url",
  },
  response_mapping: { image_url: "data[*].url" },
  paramMap: GETTOKEN_QWEN_IMAGE_PARAM_MAP,
};

export function isOfficialGetTokenEndpoint(baseUrl: string | null | undefined): boolean {
  try {
    const endpoint = new URL(String(baseUrl || ""));
    return endpoint.origin === `https://${GETTOKEN_HOST}` && !endpoint.username && !endpoint.password &&
      !endpoint.search && !endpoint.hash && (endpoint.pathname === "/" || endpoint.pathname === "");
  } catch {
    return false;
  }
}

export function verifiedGetTokenQwenModes(
  baseUrl: string | null | undefined,
  modelKey: string,
): readonly ProfileKind[] | null {
  if (!isOfficialGetTokenEndpoint(baseUrl)) return null;
  const normalized = modelKey.trim().toLowerCase();
  if (normalized === GETTOKEN_QWEN_STANDARD_MODEL) return ["text_to_image"];
  if (normalized === GETTOKEN_QWEN_PRO_MODEL) return ["text_to_image", "image_edit"];
  return null;
}

export function getTokenQwenOperation(taskKind: ProfileKind): HttpOperation {
  return taskKind === "image_edit" ? GETTOKEN_QWEN_IMAGE_EDIT_OP : GETTOKEN_QWEN_IMAGE_CREATE_OP;
}

function mappingFor(
  existing: Mapping | undefined,
  vendorKey: string,
  modelKey: string,
  taskKind: "text_to_image" | "image_edit",
  label: string,
  now: string,
): Mapping {
  return {
    id: existing?.id || `catalog:${vendorKey}:${modelKey}:${taskKind}`,
    vendorKey,
    modelKey,
    taskKind,
    name: `${label} · ${taskKind === "image_edit" ? "参考图改图" : "文生图"}`,
    enabled: true,
    create: getTokenQwenOperation(taskKind),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

function operationMatches(actual: HttpOperation | undefined, expected: HttpOperation): boolean {
  return Boolean(actual && JSON.stringify(actual) === JSON.stringify(expected));
}

/** Startup self-heal for stale adaptive Qwen Pro chat mappings on official GetToken connections. */
export function repairGetTokenQwenImageContracts(state: CatalogState, now: string): boolean {
  const officialVendorKeys = new Set(
    state.vendors.filter((vendor) => isOfficialGetTokenEndpoint(vendor.baseUrlHint)).map((vendor) => vendor.key),
  );
  let changed = false;
  for (let index = 0; index < state.models.length; index += 1) {
    const model = state.models[index];
    if (!officialVendorKeys.has(model.vendorKey) || model.modelKey.trim().toLowerCase() !== GETTOKEN_QWEN_PRO_MODEL) continue;
    const meta = model.meta && typeof model.meta === "object" && !Array.isArray(model.meta)
      ? model.meta as Record<string, unknown>
      : {};
    const adapter = meta.adapter && typeof meta.adapter === "object" && !Array.isArray(meta.adapter)
      ? meta.adapter as Record<string, unknown>
      : {};
    const imageOptions = meta.imageOptions && typeof meta.imageOptions === "object" && !Array.isArray(meta.imageOptions)
      ? meta.imageOptions as Record<string, unknown>
      : {};
    const textMapping = state.mappings.find((mapping) => mapping.vendorKey === model.vendorKey &&
      mapping.modelKey === model.modelKey && mapping.taskKind === "text_to_image");
    const editMapping = state.mappings.find((mapping) => mapping.vendorKey === model.vendorKey &&
      mapping.modelKey === model.modelKey && mapping.taskKind === "image_edit");
    if (adapter.activeRevision === VERIFIED_REVISION && imageOptions.supportsReferenceImages === true &&
      textMapping?.enabled && operationMatches(textMapping.create, GETTOKEN_QWEN_IMAGE_CREATE_OP) &&
      editMapping?.enabled && operationMatches(editMapping.create, GETTOKEN_QWEN_IMAGE_EDIT_OP)) continue;
    const verifiedModes = (["text_to_image", "image_edit"] as const).map((taskKind) => ({
      taskKind,
      state: "verified",
      attempts: 1,
      verifiedAt: now,
    }));
    state.models[index] = {
      ...model,
      meta: {
        ...meta,
        imageOptions: { ...imageOptions, supportsReferenceImages: true },
        adapter: { state: "verified", activeRevision: VERIFIED_REVISION, modes: verifiedModes, updatedAt: now },
      },
      updatedAt: now,
    };
    for (const taskKind of ["text_to_image", "image_edit"] as const) {
      const existingIndex = state.mappings.findIndex((mapping) =>
        mapping.vendorKey === model.vendorKey && mapping.modelKey === model.modelKey && mapping.taskKind === taskKind);
      const existing = existingIndex >= 0 ? state.mappings[existingIndex] : undefined;
      const replacement = mappingFor(existing, model.vendorKey, model.modelKey, taskKind, model.labelZh, now);
      if (existingIndex >= 0) state.mappings[existingIndex] = replacement;
      else state.mappings.unshift(replacement);
    }
    changed = true;
  }
  return changed;
}
