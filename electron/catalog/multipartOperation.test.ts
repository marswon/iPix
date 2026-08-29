import { describe, it, expect } from "vitest";
import { executeMultipartOperation, runMultipartProfileOperation } from "./multipartOperation";
import { OPENAI_MULTIPART_IMAGE_EDIT_OP } from "./newapiTransport";
import { taskTemplateParams } from "./taskParams";
import { applyParamMap } from "./paramTranslate";
import { buildTemplateContext } from "../ai/requestPipeline";

type AnyRec = Record<string, unknown>;

const spec = OPENAI_MULTIPART_IMAGE_EDIT_OP.multipart!;

function contextFor(prompt: string, extras: AnyRec, modelKey = "gpt-image-2"): AnyRec {
  return buildTemplateContext({
    request: { prompt },
    params: applyParamMap(OPENAI_MULTIPART_IMAGE_EDIT_OP.paramMap, taskTemplateParams({ extras })),
    model: { modelKey },
    modelKey,
    apiKey: "sk-test",
  }) as AnyRec;
}

// 假字节解析器：每个 URL 回一段可辨认的 bytes，记录被取过哪些 URL。
function fakeResolver(seen: string[]) {
  return async (url: string) => {
    seen.push(url);
    return { bytes: Buffer.from(`bytes:${url}`), contentType: "image/png", fileName: url.split("/").pop() || "x.png" };
  };
}

async function readForm(form: FormData): Promise<{ text: Record<string, string>; files: Array<{ field: string; name: string; size: number; type: string }> }> {
  const text: Record<string, string> = {};
  const files: Array<{ field: string; name: string; size: number; type: string }> = [];
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") text[key] = value;
    else files.push({ field: key, name: value.name, size: value.size, type: value.type });
  }
  return { text, files };
}

describe("multipart 图生图（/v1/images/edits）请求装配", () => {
  it("多参考图 → 每张一个 image[] 文件项 + 文本字段齐全，且丢空字段", async () => {
    const seen: string[] = [];
    let sent: FormData | null = null;
    const context = contextFor("把背景换成夜晚", {
      referenceImages: ["https://x/a.png", "https://x/b.png"],
      aspect_ratio: "1:1",
      resolution: "1K",
    });
    await executeMultipartOperation({
      multipart: spec,
      context,
      resolveImage: fakeResolver(seen),
      send: async (form) => { sent = form; return { data: [{ url: "https://out/1.png" }] }; },
    });
    expect(seen).toEqual(["https://x/a.png", "https://x/b.png"]);
    const { text, files } = await readForm(sent!);
    expect(text.model).toBe("gpt-image-2");
    expect(text.prompt).toBe("把背景换成夜晚");
    expect(text.size).toBe("1024x1024"); // 比例+清晰度派生像素
    expect(text.response_format).toBe("url");
    // quality 未选 → 不发空字段
    expect(text).not.toHaveProperty("quality");
    expect(files.map((f) => f.field)).toEqual(["image[]", "image[]"]);
    expect(files.map((f) => f.name)).toEqual(["a.png", "b.png"]);
    expect(files.every((f) => f.size > 0 && f.type === "image/png")).toBe(true);
  });

  it("缺参考图 → 抛人话错误（不发无图的 edits）", async () => {
    const context = contextFor("画只猫", {});
    await expect(
      executeMultipartOperation({ multipart: spec, context, resolveImage: fakeResolver([]), send: async () => ({}) }),
    ).rejects.toThrow(/参考图/);
  });

  it("取字节失败（resolver 返 null）→ 抛，不静默丢图发半套", async () => {
    const context = contextFor("改图", { referenceImages: ["https://x/a.png"] });
    await expect(
      executeMultipartOperation({ multipart: spec, context, resolveImage: async () => null, send: async () => ({}) }),
    ).rejects.toThrow(/取字节失败/);
  });

  it("single 模式只取首图", async () => {
    const seen: string[] = [];
    const context = contextFor("改图", { referenceImages: ["https://x/a.png", "https://x/b.png"] });
    await executeMultipartOperation({
      multipart: { ...spec, multiple: false, imageField: "image" },
      context,
      resolveImage: fakeResolver(seen),
      send: async () => ({}),
    });
    expect(seen).toEqual(["https://x/a.png"]);
  });

  it("完整分发优先使用 verifier 注入的本地素材 reader", async () => {
    let sent: FormData | null = null;
    await runMultipartProfileOperation({
      vendor: {
        key: "relay", name: "Relay", enabled: true, baseUrlHint: "https://relay.example", authType: "bearer",
        createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      },
      model: {
        vendorKey: "relay", modelKey: "gpt-image-2", labelZh: "GPT Image 2", kind: "image", enabled: true,
        createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
      },
      apiKey: "sk-test",
      request: { kind: "image_edit", prompt: "edit", extras: { referenceImages: ["nomi-local://adapter-test/reference.png"] } },
      operation: OPENAI_MULTIPART_IMAGE_EDIT_OP,
      localAssetReader: (url) => url.includes("adapter-test")
        ? { bytes: Buffer.from("fixture"), contentType: "image/png", fileName: "fixture.png" }
        : null,
    }, async (_url, _headers, _query, form) => {
      sent = form;
      return { data: [{ url: "https://out/1.png" }] };
    });
    const { files } = await readForm(sent!);
    expect(files).toEqual([{ field: "image[]", name: "fixture.png", size: 7, type: "image/png" }]);
  });

  it("preview 只留形状不含字节（不泄原图）", async () => {
    const context = contextFor("改图", { referenceImages: ["https://x/a.png"] });
    const out = await executeMultipartOperation({
      multipart: spec,
      context,
      resolveImage: fakeResolver([]),
      send: async () => ({ data: [{ url: "https://out/1.png" }] }),
    });
    const req = out.request as AnyRec;
    expect(req.multipart).toBe(true);
    expect((req.images as AnyRec[])[0]).toMatchObject({ fileName: "a.png", contentType: "image/png" });
    expect(JSON.stringify(req)).not.toContain("bytes:"); // 字节内容不进 preview
  });
});
