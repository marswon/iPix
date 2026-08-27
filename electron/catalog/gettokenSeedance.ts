import { firstString, isJsonRecord } from "../jsonUtils";
import { registerRequestTransform } from "../tasks/requestTransforms";
import type { NativeWireProfile } from "./nativeWireProfiles";
import { NEWAPI_STATUS_MAPPING } from "./newapiTransport";
import type { HttpOperation } from "./types";

const REQUEST_TRANSFORM = "gettoken-seedance-frames";

const JSON_HEADERS = {
  Authorization: "Bearer {{user_api_key}}",
  "Content-Type": "application/json",
};

const TASK_ID_PATHS = ["task_id", "id", "data.task_id", "data.id", "data.0.task_id", "data.0.id"];
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

function normalizeGetTokenSeedanceFrames(body: unknown): unknown {
  if (!isJsonRecord(body)) return body;
  const first = firstString(body._gettoken_first_frame);
  const last = firstString(body._gettoken_last_frame);
  const { _gettoken_first_frame: _first, _gettoken_last_frame: _last, ...clean } = body;
  if (last && !first) throw new Error("GetToken Seedance 首尾帧请求缺少首帧。");
  if (!first) return clean;

  const metadata = isJsonRecord(clean.metadata) ? clean.metadata : {};
  const existingContent = Array.isArray(metadata.content) ? metadata.content : [];
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
