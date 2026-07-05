import { z } from 'zod';

import type { iImportedCharacterCardFile } from './card-files';
import { CHARACTER_CARD_SCHEMA } from './card-schema';
import type { CharacterCard } from './card-schema';
import type { iPromptExampleCharacter } from './prompt-builder';

export const EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS = [
  'name',
  'description',
  'personality',
  'scenario',
  'first_mes',
  'mes_example',
  'alternate_greetings',
  'custom_fields',
] as const;

export const MAX_EXAMPLE_CHARACTER_COUNT = 5;

export type ExampleCharacterContextFieldKey = (typeof EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS)[number];

export const DEFAULT_EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS = [
  ...EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS,
] satisfies ExampleCharacterContextFieldKey[];

export const EXAMPLE_CHARACTER_CONTEXT_FIELD_LABELS = {
  name: 'Name',
  description: 'Description',
  personality: 'Personality',
  scenario: 'Scenario',
  first_mes: 'First Message',
  mes_example: 'Example Dialogue',
  alternate_greetings: 'Alternate Greetings',
  custom_fields: 'Custom Fields',
} satisfies Record<ExampleCharacterContextFieldKey, string>;

export const IMPORTED_CARD_SOURCE_KIND_SCHEMA = z.enum(['json', 'png']);

export const STORED_EXAMPLE_CHARACTER_SCHEMA = z.object({
  id: z.string(),
  fileName: z.string(),
  sourceKind: IMPORTED_CARD_SOURCE_KIND_SCHEMA,
  card: CHARACTER_CARD_SCHEMA,
  includedFieldKeys: z.array(z.enum(EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS)),
});

export interface iStoredExampleCharacter {
  id: string;
  fileName: string;
  sourceKind: iImportedCharacterCardFile['sourceKind'];
  card: CharacterCard;
  includedFieldKeys: ExampleCharacterContextFieldKey[];
}

function isExampleCharacterContextFieldKey(value: string): value is ExampleCharacterContextFieldKey {
  return (EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS as readonly string[]).includes(value);
}

function hasTextContent(value: string | undefined) {
  return Boolean(value?.trim());
}

export function sanitizeExampleCharacterIncludedFieldKeys(
  fieldKeys: readonly string[],
): ExampleCharacterContextFieldKey[] {
  const uniqueFieldKeys = new Set<ExampleCharacterContextFieldKey>();

  fieldKeys.forEach((fieldKey) => {
    if (isExampleCharacterContextFieldKey(fieldKey)) {
      uniqueFieldKeys.add(fieldKey);
    }
  });

  return [...uniqueFieldKeys];
}

export function createStoredExampleCharacter(importedCardFile: iImportedCharacterCardFile): iStoredExampleCharacter {
  return {
    id: crypto.randomUUID(),
    fileName: importedCardFile.fileName,
    sourceKind: importedCardFile.sourceKind,
    card: importedCardFile.card,
    includedFieldKeys: [...DEFAULT_EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS],
  };
}

export function getExampleCharacterDisplayName(exampleCharacter: iStoredExampleCharacter): string {
  const trimmedName = exampleCharacter.card.data.name.trim();

  if (trimmedName !== '') {
    return trimmedName;
  }

  return exampleCharacter.fileName.replace(/\.[^.]+$/, '') || 'Untitled example';
}

export function hasExampleCharacterContextField(
  exampleCharacter: iStoredExampleCharacter,
  fieldKey: ExampleCharacterContextFieldKey,
): boolean {
  const { data } = exampleCharacter.card;

  switch (fieldKey) {
    case 'name':
    case 'description':
    case 'personality':
    case 'scenario':
    case 'first_mes':
    case 'mes_example':
      return hasTextContent(data[fieldKey]);
    case 'alternate_greetings':
      return data.alternate_greetings.some((greeting) => greeting.trim() !== '');
    case 'custom_fields':
      return data.extensions.custom_fields.some((field) => field.label.trim() !== '' || field.value.trim() !== '');
    default:
      return false;
  }
}

export function toPromptExampleCharacter(exampleCharacter: iStoredExampleCharacter): iPromptExampleCharacter {
  const includedFieldKeys = new Set(sanitizeExampleCharacterIncludedFieldKeys(exampleCharacter.includedFieldKeys));
  const { data } = exampleCharacter.card;

  return {
    name: includedFieldKeys.has('name') ? data.name : undefined,
    description: includedFieldKeys.has('description') ? data.description : undefined,
    personality: includedFieldKeys.has('personality') ? data.personality : undefined,
    scenario: includedFieldKeys.has('scenario') ? data.scenario : undefined,
    first_mes: includedFieldKeys.has('first_mes') ? data.first_mes : undefined,
    mes_example: includedFieldKeys.has('mes_example') ? data.mes_example : undefined,
    alternate_greetings: includedFieldKeys.has('alternate_greetings')
      ? data.alternate_greetings.filter((greeting) => greeting.trim() !== '')
      : undefined,
    custom_fields: includedFieldKeys.has('custom_fields')
      ? data.extensions.custom_fields.filter((field) => field.label.trim() !== '' || field.value.trim() !== '')
      : undefined,
  };
}
