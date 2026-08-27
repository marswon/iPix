import { describe, expect, it } from "vitest";
import { buildHttpRequest, buildTemplateContext } from "../ai/requestPipeline";
import { firstMappedString, resolveTaskStatus, valuesFromMapping } from "../tasks/responseParsing";
import { applyRequestTransform } from "../tasks/requestTransforms";
import { draftShapeForKind } from "./catalogCommit";
import { GETTOKEN_SEEDANCE_PROFILE, isGetTokenBaseUrl } from "./gettokenSeedance";
import { builtinVendorKeyForHostname } from "./builtinVendorSeeds";
import {
  listVerifiedWireProfiles,
  nativeWireProfileById,
  nativeWireProfileId,
  nativeWireProfilesForArchetype,
} from "./nativeWireProfiles";
import { validateProfileRequestBeforeSpend } from "./profileHttpRequest";
import { modeSlotReach } from "./referenceReachability";
import { taskTemplateParams, unreachableReferenceLabels } from "./taskParams";
import type { HttpOperation } from "./types";

async function renderRequest(
  operation: HttpOperation,
  extras: Record<string, unknown>,
  providerMeta: Record<string, unknown> = {},
) {
  const request = { prompt: "镜头缓慢推进", extras };
  const params = taskTemplateParams(request);
  const context = buildTemplateContext({
    request,
    params,
    model: { modelKey: "doubao-seedance-2-0-260128" },
    modelKey: "doubao-seedance-2-0-260128",
    apiKey: "test-key",
    providerMeta,
  });
  const built = buildHttpRequest({
    baseUrl: "https://www.gettoken.net",
    authType: "bearer",
    apiKey: "test-key",
    context,
    operation,
  });
  const body = await applyRequestTransform(operation.request_transform, built.body, {
    baseUrl: "https://www.gettoken.net",
    request,
  });
  return { ...built, body };
}

const baseParams = {
  ratio: "9:16",
  resolution: "720p",
  duration: 5,
  generate_audio: true,
};

describe("GetToken Seedance wire profile", () => {
  it("把平台主域和子域统一到 canonical vendor 身份", () => {
    expect(builtinVendorKeyForHostname("gettoken.net")).toBe("gettoken");
    expect(builtinVendorKeyForHostname("www.gettoken.net")).toBe("gettoken");
    expect(builtinVendorKeyForHostname("api.gettoken.net")).toBe("gettoken");
  });

  it("只匹配 GetToken 主域及其子域，不污染其它 New API 中转", () => {
    expect(isGetTokenBaseUrl("https://www.gettoken.net/v1")).toBe(true);
    expect(isGetTokenBaseUrl("https://api.gettoken.net")).toBe(true);
    expect(isGetTokenBaseUrl("https://gettoken.net.evil.example")).toBe(false);
    expect(isGetTokenBaseUrl("https://relay.example.com/v1")).toBe(false);
  });

  it("同一 Seedance 档案保留原生优先，并可按独立 wire id 找回 GetToken 配方", () => {
    const profiles = nativeWireProfilesForArchetype("volcengine-seedance-2");
    expect(profiles.map(nativeWireProfileId)).toEqual(["volcengine-seedance-2", "gettoken-seedance-2"]);
    const allIds = listVerifiedWireProfiles().map(nativeWireProfileId);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds).toContain("gettoken-seedance-2");
    expect(nativeWireProfileById("gettoken-seedance-2")).toBe(GETTOKEN_SEEDANCE_PROFILE);
    expect(GETTOKEN_SEEDANCE_PROFILE.archetypeId).toBe("volcengine-seedance-2");
    expect(draftShapeForKind("video", "doubao-seedance-2-0-260128", null, GETTOKEN_SEEDANCE_PROFILE)).toMatchObject({
      wireProfileId: "gettoken-seedance-2",
      modelArchetypeId: "volcengine-seedance-2",
    });
  });

  it("创建和轮询都使用 GetToken 的 video/generations 路由", async () => {
    const created = await renderRequest(GETTOKEN_SEEDANCE_PROFILE.create.text_to_video!, baseParams);
    const queried = await renderRequest(GETTOKEN_SEEDANCE_PROFILE.query!, {}, { task_id: "task_123" });
    expect(created.method).toBe("POST");
    expect(created.url).toBe("https://www.gettoken.net/v1/video/generations");
    expect(queried.method).toBe("GET");
    expect(queried.url).toBe("https://www.gettoken.net/v1/video/generations/task_123");
  });

  it("文生视频按已验证契约发送顶层 size 与 Seedance metadata", async () => {
    const { body } = await renderRequest(GETTOKEN_SEEDANCE_PROFILE.create.text_to_video!, baseParams);
    expect(body).toEqual({
      model: "doubao-seedance-2-0-260128",
      prompt: "镜头缓慢推进",
      duration: 5,
      size: "9:16",
      metadata: {
        ratio: "9:16",
        resolution: "720p",
        generate_audio: true,
      },
    });
  });

  it("首帧模式同时发送 image 与 role=first_frame 的 metadata.content", async () => {
    const { body } = await renderRequest(GETTOKEN_SEEDANCE_PROFILE.create.image_to_video!, {
      ...baseParams,
      firstFrameUrl: "https://cdn.example/first.png",
      archetypeInput: {
        volcengine_first_image_content: {
          type: "image_url",
          image_url: { url: "https://cdn.example/first.png" },
          role: "first_frame",
        },
      },
    });
    expect(body).toMatchObject({
      image: "https://cdn.example/first.png",
      metadata: {
        content: [
          {
            type: "image_url",
            image_url: { url: "https://cdn.example/first.png" },
            role: "first_frame",
          },
        ],
      },
    });
    expect(body).not.toHaveProperty("images");
    expect(body).not.toHaveProperty("_gettoken_first_frame");
  });

  it("首尾帧模式发送 images，并在 metadata.content 中保留两个角色", async () => {
    const { body } = await renderRequest(GETTOKEN_SEEDANCE_PROFILE.create.image_to_video!, {
      ...baseParams,
      firstFrameUrl: "https://cdn.example/first.png",
      lastFrameUrl: "https://cdn.example/last.png",
      archetypeInput: {
        volcengine_first_role_image_content: {
          type: "image_url",
          image_url: { url: "https://cdn.example/first.png" },
          role: "first_frame",
        },
        volcengine_last_role_image_content: {
          type: "image_url",
          image_url: { url: "https://cdn.example/last.png" },
          role: "last_frame",
        },
      },
    });
    expect(body).toMatchObject({
      images: ["https://cdn.example/first.png", "https://cdn.example/last.png"],
      metadata: {
        content: [
          { image_url: { url: "https://cdn.example/first.png" }, role: "first_frame" },
          { image_url: { url: "https://cdn.example/last.png" }, role: "last_frame" },
        ],
      },
    });
    expect(body).not.toHaveProperty("image");
    expect(body).not.toHaveProperty("_gettoken_last_frame");
  });

  it("headless 首尾帧没有 archetypeInput 时仍补齐角色化 metadata.content", async () => {
    const { body } = await renderRequest(GETTOKEN_SEEDANCE_PROFILE.create.image_to_video!, {
      ...baseParams,
      firstFrameUrl: "https://cdn.example/first.png",
      lastFrameUrl: "https://cdn.example/last.png",
    });
    expect(body).toMatchObject({
      images: ["https://cdn.example/first.png", "https://cdn.example/last.png"],
      metadata: {
        content: [
          { image_url: { url: "https://cdn.example/first.png" }, role: "first_frame" },
          { image_url: { url: "https://cdn.example/last.png" }, role: "last_frame" },
        ],
      },
    });
  });

  it("缺首帧的尾帧请求在 spend 前验证边界被拒绝", async () => {
    await expect(
      validateProfileRequestBeforeSpend({
        vendor: {
          key: "gettoken-relay",
          name: "GetToken",
          baseUrlHint: "https://www.gettoken.net/v1",
          authType: "bearer",
          enabled: true,
        } as never,
        model: {
          vendorKey: "gettoken-relay",
          modelKey: "doubao-seedance-2-0-260128",
          kind: "video",
          enabled: true,
        } as never,
        apiKey: "test-key",
        request: {
          kind: "image_to_video",
          prompt: "镜头缓慢推进",
          extras: { ...baseParams, lastFrameUrl: "https://cdn.example/last.png" },
        } as never,
        operation: GETTOKEN_SEEDANCE_PROFILE.create.image_to_video!,
      }),
    ).rejects.toThrow("缺少首帧");
  });

  it("能力判据放行首帧/首尾帧，但不放行 omni 角色图", () => {
    const body = GETTOKEN_SEEDANCE_PROFILE.create.image_to_video!.body;
    expect(modeSlotReach([{ kind: "first_frame", inputKey: "volcengine_first_image_content" }], body)).toEqual([
      "full",
    ]);
    expect(
      modeSlotReach(
        [
          { kind: "first_frame", inputKey: "volcengine_first_role_image_content" },
          { kind: "last_frame", inputKey: "volcengine_last_role_image_content" },
        ],
        body,
      ),
    ).toEqual(["full", "full"]);
    expect(modeSlotReach([{ kind: "image_ref", inputKey: "volcengine_image_contents" }], body)).toEqual(["none"]);

    const request = {
      extras: {
        ...baseParams,
        referenceImages: ["https://cdn.example/character.png"],
        archetypeInput: {
          volcengine_image_contents: [
            {
              type: "image_url",
              image_url: { url: "https://cdn.example/character.png" },
              role: "reference_image",
            },
          ],
        },
      },
    };
    expect(unreachableReferenceLabels(request, body)).toContain("参考图");
  });

  it("兼容 skill 记录的 task id、嵌套状态和结果 URL 响应", () => {
    const createMapping = GETTOKEN_SEEDANCE_PROFILE.create.text_to_video!.response_mapping as Record<string, unknown>;
    expect(firstMappedString({ data: [{ task_id: "task_123" }] }, createMapping, "task_id")).toBe("task_123");

    const queryMapping = GETTOKEN_SEEDANCE_PROFILE.query!.response_mapping as Record<string, unknown>;
    const response = {
      code: "success",
      data: {
        status: "SUCCESS",
        data: { content: { video_url: "https://cdn.example/result.mp4" } },
      },
    };
    const urls = valuesFromMapping(response, queryMapping, "video_url");
    expect(urls).toContain("https://cdn.example/result.mp4");
    expect(
      resolveTaskStatus(response, queryMapping, GETTOKEN_SEEDANCE_PROFILE.statusMapping, urls as string[]),
    ).toEqual({
      status: "succeeded",
      unrecognizedStatus: "",
    });
  });
});
