import { VOLCENGINE_SEEDANCE_QUERY_OP, VOLCENGINE_SEEDANCE_STATUS_MAPPING, VOLCENGINE_VIDEO_MODELS } from "./volcengineVideos";
import { VOLCENGINE_IMAGE_MODELS } from "./volcengineImages";
import { GETTOKEN_SEEDANCE_PROFILE } from "./gettokenSeedance";
import type { HttpOperation, ProfileKind } from "./types";

// ---------------------------------------------------------------------------
// 「认得出的模型走它的原生报文」注册表（通用中转接入用）。
//
// 为什么需要：Nomi 的 UI 参数由**模型档案**驱动，档案只认模型身份、与从哪家接入无关（同一模型
// 不管走哪个渠道，用户看到的应是同一套能力）。但真正发出去的报文由渠道模板决定——「用户自建
// 中转」走的是通用最小模板 {model, prompt, duration, size, image}。于是界面给一整套（变体/比例/
// 生成音频/首尾帧/角色图/参考视频/参考音频），线上只发得出一小截，连了边的参考素材被静默丢。
//
// 而 new-api 这类中转普遍**同时**代理厂商原生端点（用户那家的 §6.2 明确推荐 /api/v3/…）。
// 所以：接入时若模型命中内置档案，就探一下这家有没有该档案的原生端点，有就直接复用**已验证的
// 那份原生报文**（只换地址）。通用做法，不是给某一家打补丁（P4）。
//
// 单一真相源：op 一律**引用**各 vendor 模块里已有的常量，绝不在这里复制形状（P1）。
// ---------------------------------------------------------------------------

export type NativeWireProfile = {
  /** 传输配方身份。缺省与 archetypeId 相同；同一模型档案有多条 wire 时必须显式区分。 */
  id?: string;
  /** 命中哪个档案（src/config/modelArchetypes 的 archetype.id）。 */
  archetypeId: string;
  /** 拼进 mapping.name 的渠道名（与内置种子的中文 name 同性质，非 UI 文案）。 */
  wireName: string;
  /**
   * 探测用的**真实端点路径**（会被 nativeEndpointProbe 拿去和「查无此路由」的哨兵响应比对）。
   * 用 GET 探（不产生任务、不计费）。
   */
  probePath: string;
  /** 服务商扩展 wire 的适用边界，防止把私有 metadata 发给其它同路由中转。 */
  matchesBaseUrl?: (baseUrl: string) => boolean;
  /** 按 taskKind 的 create op。 */
  create: Partial<Record<ProfileKind, HttpOperation>>;
  /** 轮询 op（异步任务）。 */
  query?: HttpOperation;
  statusMapping?: Record<string, string[]>;
};

export function nativeWireProfileId(profile: NativeWireProfile): string {
  return profile.id || profile.archetypeId;
}

/** 把一组 mapping 转成「从主机根拼」的 create 表。原生端点不在 /v1 命名空间下；
 *  中转用户常把地址填成 .../v1 → 必须从主机根拼（hostRootJoin 负责剥版本段 + 折叠重叠段）。 */
function hostRootCreateOps(mappings: ReadonlyArray<{ taskKind: ProfileKind; create: HttpOperation }>) {
  const create: Partial<Record<ProfileKind, HttpOperation>> = {};
  for (const mapping of mappings) create[mapping.taskKind] = { ...mapping.create, pathFrom: "host-root" };
  return create;
}

/** 火山方舟视频原生（Seedance 全 family）。中转代理方舟时可直接用这套：首/尾帧、角色图、参考视频、
 *  参考音频、generate_audio、ratio、resolution 全在，与用户那家中转文档 §6.2 逐字对得上。
 *
 *  **按 archetypeId 分组自动派生**，不是手写枚举：新增一个 Seedance 档案（2.5 就是这么进来的）
 *  只要进了 VOLCENGINE_VIDEO_MODELS 就自动有原生 profile。手写枚举必漂——漏一个的症状是
 *  「那个模型经中转接入后静默退回通用最小模板」，本地测不出来。 */
function volcengineSeedanceProfiles(): NativeWireProfile[] {
  const byArchetype = new Map<string, typeof VOLCENGINE_VIDEO_MODELS>();
  for (const model of VOLCENGINE_VIDEO_MODELS) {
    byArchetype.set(model.archetypeId, [...(byArchetype.get(model.archetypeId) ?? []), model]);
  }
  return [...byArchetype.entries()].map(([archetypeId, models]) => ({
    archetypeId,
    wireName: "火山方舟原生",
    probePath: "/api/v3/contents/generations/tasks",
    // 同一档案下各模型共用同形 op（model 字段是动态值），取任一即可。
    create: hostRootCreateOps(models[0].mappings),
    query: { ...VOLCENGINE_SEEDANCE_QUERY_OP, pathFrom: "host-root" as const },
    statusMapping: VOLCENGINE_SEEDANCE_STATUS_MAPPING,
  }));
}

/**
 * 火山方舟原生（Seedream 图像）。**同步**族：只有 create、无轮询。
 *
 * 为什么要它：通用中转的改图走 `chat/completions` 多模态（chat_image_parts）——那是给聊天模型用的路，
 * 而 Seedream 不是聊天模型。于是「中转代理了方舟、但 Nomi 仍把 Seedream 当聊天模型改图」= 改图不按原图
 * 甚至直接失败。原生形状里改图是 `image ← image_urls`（整数组），已在 volcengineImages 真实 E2E 出图验证。
 *
 * 与视频 profile 同在 `/api/v3` 命名空间——中转若代理了方舟视频，通常同时代理图像，探测会各探各的。
 * 同一档案下各模型共用同一份 op（model 字段是 `{{model.modelKey}}` 动态值），故取任一模型的 mappings 即可。
 * 同视频侧：**按 archetypeId 分组自动派生**（5.0 pro 就是这么进来的），不手写枚举。
 */
function volcengineSeedreamProfiles(): NativeWireProfile[] {
  const byArchetype = new Map<string, typeof VOLCENGINE_IMAGE_MODELS>();
  for (const model of VOLCENGINE_IMAGE_MODELS) {
    byArchetype.set(model.archetypeId, [...(byArchetype.get(model.archetypeId) ?? []), model]);
  }
  return [...byArchetype.entries()].map(([archetypeId, models]) => ({
    archetypeId,
    wireName: "火山方舟原生",
    probePath: "/api/v3/images/generations",
    create: hostRootCreateOps(models[0].mappings),
  }));
}

const NATIVE_PROFILES: NativeWireProfile[] = [
  ...volcengineSeedanceProfiles(),
  ...volcengineSeedreamProfiles(),
];

// 同一模型可有多条已验证 wire。顺序就是优先级：厂商原生优先，服务商扩展其次。
const PROFILES: NativeWireProfile[] = [...NATIVE_PROFILES, GETTOKEN_SEEDANCE_PROFILE];

/** 按档案 id 查首选 wire；无网络上下文的旧调用保持厂商原生优先。 */
export function nativeWireProfileForArchetype(archetypeId: string | null | undefined): NativeWireProfile | null {
  return nativeWireProfilesForArchetype(archetypeId)[0] ?? null;
}

/** 接入和启动迁移按优先级探测同一模型档案可用的 wire。 */
export function nativeWireProfilesForArchetype(archetypeId: string | null | undefined): NativeWireProfile[] {
  const id = String(archetypeId || "").trim();
  if (!id) return [];
  return PROFILES.filter((profile) => profile.archetypeId === id);
}

/** 已落库的 meta.wireProfile 用独立 id 精确找回 transport，不能退化成模型档案猜测。 */
export function nativeWireProfileById(profileId: string | null | undefined): NativeWireProfile | null {
  const id = String(profileId || "").trim();
  if (!id) return null;
  return PROFILES.find((profile) => nativeWireProfileId(profile) === id) ?? null;
}

/** 全部厂商原生配方（host-root 拼接不变量测试用）。 */
export function listNativeWireProfiles(): NativeWireProfile[] {
  return NATIVE_PROFILES;
}

/** 全部已验证 wire（含服务商扩展）；跨 profile 身份和完整性测试用。 */
export function listVerifiedWireProfiles(): NativeWireProfile[] {
  return PROFILES;
}
