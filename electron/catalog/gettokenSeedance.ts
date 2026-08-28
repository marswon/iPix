import { firstString, isJsonRecord } from "../jsonUtils";
import { registerRequestTransform } from "../tasks/requestTransforms";
import type { NativeWireProfile } from "./nativeWireProfiles";
import { NEWAPI_STATUS_MAPPING } from "./newapiTransport";
import type { CatalogState, HttpOperation, Mapping } from "./types";
import { isOfficialGetTokenEndpoint } from "./gettokenQwenImage";

const REQUEST_TRANSFORM = "gettoken-seedance-frames";
export const GETTOKEN_PRESET_REVISION = 4;

const JSON_HEADERS = {
  Authorization: "Bearer {{user_api_key}}",
  "Content-Type": "application/json",
};

const TASK_ID_PATHS = ["task_id", "data.task_id", "data.0.task_id", "id", "data.id", "data.0.id"];
const STATUS_PATHS = ["status", "task_status", "data.status", "data.task_status", "data.0.status"];
const VIDEO_URL_PATHS = [
  "data[*].url",
  "data.url",
  "data.result_url",
  "data.data.content.video_url",
  "data.data.result_url",
  "data.data.url",
  "content.video_url",
  "result.video_url",
  "result.url",
  "video_url",
  "result_url",
  "url",
  "output.video_url",
  "output.url",
];

function referenceImageUrls(content: unknown[]): string[] {
  return content.flatMap((item) => {
    if (!isJsonRecord(item) || item.role !== "reference_image" || !isJsonRecord(item.image_url)) return [];
    const url = firstString(item.image_url.url);
    return url ? [url] : [];
  });
}

function normalizeGetTokenSeedanceFrames(body: unknown): unknown {
  if (!isJsonRecord(body)) return body;
  const first = firstString(body._gettoken_first_frame);
  const last = firstString(body._gettoken_last_frame);
  const { _gettoken_first_frame: _first, _gettoken_last_frame: _last, ...clean } = body;
  if (last && !first) throw new Error("GetToken Seedance 首尾帧请求缺少首帧。");

  const metadata = isJsonRecord(clean.metadata) ? clean.metadata : {};
  const existingContent = Array.isArray(metadata.content) ? metadata.content : [];
  if (!first) {
    const images = referenceImageUrls(existingContent);
    return images.length > 0 ? { ...clean, images } : clean;
  }
  const content =
    existingContent.length > 0
      ? existingContent
      : [
          { type: "image_url", image_url: { url: first }, role: "first_frame" },
          ...(last ? [{ type: "image_url", image_url: { url: last }, role: "last_frame" }] : []),
        ];
  const withContent = { ...clean, metadata: { ...metadata, content } };
  if (last) return { ...withContent, images: [first, last] };
  return { ...withContent, image: first };
}

registerRequestTransform(REQUEST_TRANSFORM, normalizeGetTokenSeedanceFrames, (body) => {
  normalizeGetTokenSeedanceFrames(body);
});

function createOperation(withFrames: boolean): HttpOperation {
  return {
    method: "POST",
    path: "/v1/video/generations",
    headers: JSON_HEADERS,
    ...(withFrames ? { request_transform: REQUEST_TRANSFORM } : {}),
    body: {
      model: "{{model.modelKey}}",
      prompt: "{{request.prompt}}",
      duration: "{{request.params.duration}}",
      size: "{{request.params.ratio}}",
      ...(withFrames
        ? {
            _gettoken_first_frame: "{{request.params.first_frame_url}}",
            _gettoken_last_frame: "{{request.params.last_frame_url}}",
          }
        : {}),
      metadata: {
        ratio: "{{request.params.ratio}}",
        resolution: "{{request.params.resolution}}",
        generate_audio: "{{request.params.generate_audio}}",
        ...(withFrames
          ? {
              content: [
                "{{request.params.volcengine_first_image_content}}",
                "{{request.params.volcengine_first_role_image_content}}",
                "{{request.params.volcengine_last_role_image_content}}",
                "{{request.params.volcengine_image_contents}}",
                "{{request.params.volcengine_video_contents}}",
                "{{request.params.volcengine_audio_contents}}",
              ],
            }
          : {}),
      },
    },
    response_mapping: { task_id: TASK_ID_PATHS, status: STATUS_PATHS },
    provider_meta_mapping: { task_id: TASK_ID_PATHS },
  };
}

export const GETTOKEN_SEEDANCE_QUERY_OP: HttpOperation = {
  method: "GET",
  path: "/v1/video/generations/{{providerMeta.task_id}}",
  headers: { Authorization: "Bearer {{user_api_key}}" },
  response_mapping: {
    task_id: TASK_ID_PATHS,
    status: STATUS_PATHS,
    video_url: VIDEO_URL_PATHS,
    error_message: ["error.message", "message", "msg", "error_message", "detail", "data.error.message"],
  },
};

/** Other New API relays may reject GetToken's metadata extension, so route shape alone is insufficient. */
export function isGetTokenBaseUrl(baseUrl: string): boolean {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "gettoken.net" || hostname.endsWith(".gettoken.net");
  } catch {
    return false;
  }
}

export const GETTOKEN_VENDOR_SEED = {
  key: "gettoken",
  name: "GetToken",
  baseUrl: "https://www.gettoken.net",
  hostSuffixes: ["gettoken.net"] as const,
  authType: "bearer" as const,
};

export const GETTOKEN_SEEDANCE_MODEL_SEED = {
  modelKey: "doubao-seedance-2-0-260128",
  labelZh: "Seedance 2.0",
  kind: "video" as const,
  archetypeId: "volcengine-seedance-2",
  meta: {
    wireProfile: "gettoken-seedance-2",
    catalogManagedWire: true,
    catalogPresetRevision: GETTOKEN_PRESET_REVISION,
  },
};

export const GETTOKEN_SEEDANCE_PROFILE: NativeWireProfile = {
  id: "gettoken-seedance-2",
  archetypeId: "volcengine-seedance-2",
  wireName: "GetToken Seedance 2.0",
  probePath: "/v1/video/generations",
  matchesBaseUrl: isGetTokenBaseUrl,
  create: {
    text_to_video: createOperation(false),
    image_to_video: createOperation(true),
  },
  query: GETTOKEN_SEEDANCE_QUERY_OP,
  statusMapping: NEWAPI_STATUS_MAPPING,
};

function operationMatches(actual: HttpOperation | undefined, expected: HttpOperation): boolean {
  return Boolean(actual && JSON.stringify(actual) === JSON.stringify(expected));
}

function repairedMapping(
  existing: Mapping | undefined,
  vendorKey: string,
  modelKey: string,
  taskKind: "text_to_video" | "image_to_video",
  now: string,
): Mapping {
  return {
    id: existing?.id || `catalog:${vendorKey}:${modelKey}:${taskKind}`,
    vendorKey,
    modelKey,
    taskKind,
    name: existing?.name || `Seedance 2.0 · ${taskKind === "text_to_video" ? "文生视频" : "图生视频"}`,
    enabled: true,
    create: GETTOKEN_SEEDANCE_PROFILE.create[taskKind]!,
    query: GETTOKEN_SEEDANCE_QUERY_OP,
    statusMapping: NEWAPI_STATUS_MAPPING,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

/** Startup self-heal for stale Seedance mappings on every credential-scoped official GetToken connection. */
export function repairGetTokenSeedanceContracts(state: CatalogState, now: string): boolean {
  const officialVendorKeys = new Set(
    state.vendors.filter((vendor) => isOfficialGetTokenEndpoint(vendor.baseUrlHint)).map((vendor) => vendor.key),
  );
  let changed = false;
  for (let modelIndex = 0; modelIndex < state.models.length; modelIndex += 1) {
    const model = state.models[modelIndex];
    if (!officialVendorKeys.has(model.vendorKey) || model.modelKey !== GETTOKEN_SEEDANCE_MODEL_SEED.modelKey) continue;
    const meta = model.meta && typeof model.meta === "object" && !Array.isArray(model.meta)
      ? model.meta as Record<string, unknown>
      : {};
    const mappings = (["text_to_video", "image_to_video"] as const).map((taskKind) => state.mappings.find((mapping) =>
      mapping.vendorKey === model.vendorKey && mapping.modelKey === model.modelKey && mapping.taskKind === taskKind));
    const current = Number(meta.catalogPresetRevision || 0) >= GETTOKEN_PRESET_REVISION &&
      meta.wireProfile === GETTOKEN_SEEDANCE_PROFILE.id && mappings.every((mapping, index) => {
        const taskKind = index === 0 ? "text_to_video" : "image_to_video";
        return Boolean(mapping?.enabled && operationMatches(mapping.create, GETTOKEN_SEEDANCE_PROFILE.create[taskKind]!) &&
          operationMatches(mapping.query, GETTOKEN_SEEDANCE_QUERY_OP) &&
          JSON.stringify(mapping.statusMapping) === JSON.stringify(NEWAPI_STATUS_MAPPING));
      });
    if (current) continue;
    state.models[modelIndex] = {
      ...model,
      enabled: true,
      meta: {
        ...meta,
        wireProfile: GETTOKEN_SEEDANCE_PROFILE.id,
        archetypeId: GETTOKEN_SEEDANCE_PROFILE.archetypeId,
        catalogManagedWire: true,
        catalogPresetRevision: GETTOKEN_PRESET_REVISION,
      },
      updatedAt: now,
    };
    for (const taskKind of ["text_to_video", "image_to_video"] as const) {
      const mappingIndex = state.mappings.findIndex((mapping) =>
        mapping.vendorKey === model.vendorKey && mapping.modelKey === model.modelKey && mapping.taskKind === taskKind);
      const replacement = repairedMapping(mappingIndex >= 0 ? state.mappings[mappingIndex] : undefined,
        model.vendorKey, model.modelKey, taskKind, now);
      if (mappingIndex >= 0) state.mappings[mappingIndex] = replacement;
      else state.mappings.unshift(replacement);
    }
    changed = true;
  }
  return changed;
}
