import { DEFAULT_FIELD_TEMPLATE_IDS } from '../../constants/default-field-templates';
import { FIELD_TEMPLATE_SELECTION_NONE, getTemplateFieldKeyForTargetKey } from './field-templates';

export interface iResolveEffectiveFieldTemplateIdOptions {
  fieldTemplateIds: Readonly<Record<string, string>>;
  shouldUseDefaultFieldTemplates: boolean;
  targetKey: string;
}

function getDefaultFieldTemplateId(targetKey: string) {
  const directTemplateId = DEFAULT_FIELD_TEMPLATE_IDS[targetKey];

  if (directTemplateId !== undefined) {
    return directTemplateId;
  }

  const templateFieldKey = getTemplateFieldKeyForTargetKey(targetKey);

  return templateFieldKey ? (DEFAULT_FIELD_TEMPLATE_IDS[`field:${templateFieldKey}`] ?? null) : null;
}

export function resolveEffectiveFieldTemplateId({
  fieldTemplateIds,
  shouldUseDefaultFieldTemplates,
  targetKey,
}: iResolveEffectiveFieldTemplateIdOptions): string | null {
  const selectedTemplateId = fieldTemplateIds[targetKey];

  if (selectedTemplateId !== undefined) {
    return selectedTemplateId === FIELD_TEMPLATE_SELECTION_NONE ? null : selectedTemplateId || null;
  }

  if (!shouldUseDefaultFieldTemplates) {
    return null;
  }

  return getDefaultFieldTemplateId(targetKey);
}
