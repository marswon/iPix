import path from "node:path";
import { describe, expect, it } from "vitest";
import { compatibleUserDataPath, preserveLegacyUserData } from "./brandCompatibility";

describe("iPix brand compatibility", () => {
  it("keeps stable and preview builds on their historical settings roots", () => {
    expect(compatibleUserDataPath("/app-data", "iPix")).toBe(path.join("/app-data", "Nomi"));
    expect(compatibleUserDataPath("/app-data", "iPix Preview")).toBe(path.join("/app-data", "Nomi Preview"));
  });

  it("applies the compatible path before Electron opens settings", () => {
    const writes: string[] = [];
    preserveLegacyUserData({
      getName: () => "iPix Preview",
      getPath: () => "/app-data",
      setPath: (_name, value) => writes.push(value),
    });
    expect(writes).toEqual([path.join("/app-data", "Nomi Preview")]);
  });

  it("does not redirect unrelated product names", () => {
    expect(compatibleUserDataPath("/app-data", "Other App")).toBeNull();
  });
});
