import path from "node:path";

const LEGACY_DATA_NAMES: Record<string, string> = {
  ipix: "Nomi",
  "ipix preview": "Nomi Preview",
};

/** Keep existing settings, credentials, and task history after the user-visible rebrand. */
export function compatibleUserDataPath(appDataRoot: string, productName: string): string | null {
  const legacyName = LEGACY_DATA_NAMES[String(productName || "").trim().toLowerCase()];
  return legacyName ? path.join(appDataRoot, legacyName) : null;
}

export function preserveLegacyUserData(app: {
  getName(): string;
  getPath(name: "appData"): string;
  setPath(name: "userData", value: string): void;
}): void {
  const compatiblePath = compatibleUserDataPath(app.getPath("appData"), app.getName());
  if (compatiblePath) app.setPath("userData", compatiblePath);
}
