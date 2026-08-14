import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

export const TEMPLATE_MODE_SCHEMA = z.enum(['prompt', 'strict']);
export const TEMPLATE_MODES = TEMPLATE_MODE_SCHEMA.enum;
export type TemplateMode = z.infer<typeof TEMPLATE_MODE_SCHEMA>;

export const TEMPLATE_MODE_LABELS = {
  [TEMPLATE_MODES.prompt]: 'Prompt guidance',
  [TEMPLATE_MODES.strict]: 'Strict skeleton',
} satisfies Record<TemplateMode, string>;

export const TEMPLATE_FIELD_KEY_SCHEMA = z.enum([
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'creator_notes',
  'system_prompt',
  'post_history_instructions',
  'alternate_greeting',
  'custom_field',
]);
export const TEMPLATE_FIELD_KEYS = TEMPLATE_FIELD_KEY_SCHEMA.enum;
export type TemplateFieldKey = z.infer<typeof TEMPLATE_FIELD_KEY_SCHEMA>;

export const TEMPLATE_FIELD_KEY_LABELS = {
  [TEMPLATE_FIELD_KEYS.description]: 'Description',
  [TEMPLATE_FIELD_KEYS.personality]: 'Personality',
  [TEMPLATE_FIELD_KEYS.scenario]: 'Scenario',
  [TEMPLATE_FIELD_KEYS.first_mes]: 'First Message',
  [TEMPLATE_FIELD_KEYS.mes_example]: 'Example Dialogue',
  [TEMPLATE_FIELD_KEYS.creator_notes]: 'Creator Notes',
  [TEMPLATE_FIELD_KEYS.system_prompt]: 'System Prompt',
  [TEMPLATE_FIELD_KEYS.post_history_instructions]: 'Post-History Instructions',
  [TEMPLATE_FIELD_KEYS.alternate_greeting]: 'Alternate Greetings',
  [TEMPLATE_FIELD_KEYS.custom_field]: 'Custom Fields',
} satisfies Record<TemplateFieldKey, string>;

/** Template field keys where the {{original}} macro is meaningful. */
export const TEMPLATE_FIELD_KEYS_ALLOWING_ORIGINAL_MACRO: readonly TemplateFieldKey[] = [
  TEMPLATE_FIELD_KEYS.system_prompt,
  TEMPLATE_FIELD_KEYS.post_history_instructions,
];

export const STORED_FIELD_TEMPLATE_SCHEMA = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  mode: TEMPLATE_MODE_SCHEMA,
  fieldKeys: z.array(TEMPLATE_FIELD_KEY_SCHEMA),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type iStoredFieldTemplate = z.infer<typeof STORED_FIELD_TEMPLATE_SCHEMA>;

export interface iFieldTemplateViewModel extends iStoredFieldTemplate {
  isBuiltIn: boolean;
}

export interface iTemplateSlot {
  label: string;
  hint: string;
}

export const TEMPLATE_SLOT_PATTERN = /\{\{\s*gen:([^:{}]+?)(?::([^{}]*?))?\s*\}\}/gi;
const ORIGINAL_MACRO_PATTERN = /\{\{\s*original\s*\}\}/i;

export function normalizeTemplateSlotLabel(label: string) {
  return label.trim().toLowerCase();
}

/** Returns slots in order of first appearance; repeated labels collapse into one slot. */
export function parseTemplateSlots(content: string): iTemplateSlot[] {
  const slotsByLabel = new Map<string, iTemplateSlot>();

  for (const match of content.matchAll(TEMPLATE_SLOT_PATTERN)) {
    const label = match[1]?.trim() ?? '';

    if (!label) {
      continue;
    }

    const normalizedLabel = normalizeTemplateSlotLabel(label);
    const hint = match[2]?.trim() ?? '';
    const existingSlot = slotsByLabel.get(normalizedLabel);

    if (!existingSlot) {
      slotsByLabel.set(normalizedLabel, { label, hint });
    } else if (!existingSlot.hint && hint) {
      existingSlot.hint = hint;
    }
  }

  return [...slotsByLabel.values()];
}

export interface iFieldTemplateValidationInput {
  name: string;
  mode: TemplateMode;
  fieldKeys: TemplateFieldKey[];
  content: string;
}

export function validateFieldTemplate(template: iFieldTemplateValidationInput): string[] {
  const issues: string[] = [];

  if (!template.name.trim()) {
    issues.push('Template name is required.');
  }

  if (!template.content.trim()) {
    issues.push('Template content is empty.');
  }

  if (template.fieldKeys.length === 0) {
    issues.push('Bind the template to at least one field.');
  }

  if (template.mode === TEMPLATE_MODES.strict && parseTemplateSlots(template.content).length === 0) {
    issues.push('Strict templates need at least one {{gen:label}} slot for the AI to fill.');
  }

  if (ORIGINAL_MACRO_PATTERN.test(template.content)) {
    const disallowedFieldKeys = template.fieldKeys.filter(
      (fieldKey) => !TEMPLATE_FIELD_KEYS_ALLOWING_ORIGINAL_MACRO.includes(fieldKey),
    );

    if (disallowedFieldKeys.length > 0) {
      const disallowedLabels = disallowedFieldKeys.map((fieldKey) => TEMPLATE_FIELD_KEY_LABELS[fieldKey]).join(', ');
      issues.push(
        `The {{original}} macro only works in prompt override fields; remove it or unbind: ${disallowedLabels}.`,
      );
    }
  }

  return issues;
}

export interface iCreateStoredFieldTemplateInput {
  name: string;
  description?: string;
  mode: TemplateMode;
  fieldKeys: TemplateFieldKey[];
  content: string;
}

export function sanitizeTemplateFieldKeys(fieldKeys: readonly string[]): TemplateFieldKey[] {
  const uniqueFieldKeys = new Set<TemplateFieldKey>();

  fieldKeys.forEach((fieldKey) => {
    const parsedFieldKey = TEMPLATE_FIELD_KEY_SCHEMA.safeParse(fieldKey);

    if (parsedFieldKey.success) {
      uniqueFieldKeys.add(parsedFieldKey.data);
    }
  });

  return [...uniqueFieldKeys];
}

export function createStoredFieldTemplate({
  name,
  description = '',
  mode,
  fieldKeys,
  content,
}: iCreateStoredFieldTemplateInput): iStoredFieldTemplate {
  const now = new Date().toISOString();

  return {
    id: generateUuid(),
    name,
    description,
    mode,
    fieldKeys: sanitizeTemplateFieldKeys(fieldKeys),
    content,
    createdAt: now,
    updatedAt: now,
  };
}

/** Maps a generation-target key ("field:description", "alternate_greetings:0", "custom:<id>") to its template field key. */
export function getTemplateFieldKeyForTargetKey(targetKey: string): TemplateFieldKey | null {
  if (targetKey.startsWith('alternate_greetings:')) {
    return TEMPLATE_FIELD_KEYS.alternate_greeting;
  }

  if (targetKey.startsWith('custom:')) {
    return TEMPLATE_FIELD_KEYS.custom_field;
  }

  const parsedFieldKey = TEMPLATE_FIELD_KEY_SCHEMA.safeParse(targetKey.replace(/^field:/, ''));
  return parsedFieldKey.success ? parsedFieldKey.data : null;
}
