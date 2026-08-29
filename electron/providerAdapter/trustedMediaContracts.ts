import { applyGetOneImageOperation, shouldApplyGetOneImageContract } from "../catalog/getoneImage";
import { newapiImageEditProfileForModel } from "../catalog/newapiTransport";
import type { AdapterModeDraft, ProviderAdapterDraft } from "./types";
import { withAuthHeader } from "./builtinOpenAiCompatibleDraft";

function trustedImageEditMode(
  mode: AdapterModeDraft,
  modelKey: string,
  authType: ProviderAdapterDraft["provider"]["authType"],
): AdapterModeDraft {
  const profile = newapiImageEditProfileForModel(modelKey);
  if (profile.protocol !== "openai-multipart-edits") return mode;
  return {
    ...mode,
    create: withAuthHeader(profile.operation, authType),
    referenceParam: "reference_images",
    referenceShape: "array",
  };
}

/**
 * Binary multipart operations are intentionally excluded from AI-generated drafts.
 * Once documentation has established an image_edit mode, project it onto Nomi's
 * audited standard transport for model families whose wire contract is known.
 */
export function applyTrustedMediaContracts(draft: ProviderAdapterDraft): ProviderAdapterDraft {
  let changed = false;
  const models = draft.models.map((model) => {
    if (model.kind !== "image") return model;
    let modelChanged = false;
    const modes = model.modes.map((mode) => {
      const trusted = mode.taskKind === "image_edit"
        ? trustedImageEditMode(mode, model.modelKey, draft.provider.authType)
        : mode;
      const create = shouldApplyGetOneImageContract({
        baseUrl: draft.provider.baseUrl,
        modelKey: model.modelKey,
        taskKind: mode.taskKind,
      }) ? applyGetOneImageOperation(trusted.create) : trusted.create;
      if (trusted !== mode || create !== trusted.create) modelChanged = true;
      return create === trusted.create ? trusted : { ...trusted, create };
    });
    if (!modelChanged) return model;
    changed = true;
    return { ...model, modes };
  });
  return changed ? { ...draft, models } : draft;
}
