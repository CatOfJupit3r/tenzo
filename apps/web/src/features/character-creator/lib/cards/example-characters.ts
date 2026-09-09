import { z } from 'zod';

import {
  CHARACTER_CARD_SCHEMA,
  CHARACTER_FIELD_KEY_ENUM,
  CHARACTER_FIELD_KEYS,
} from '@~/features/character-creator/lib/cards/card-schema';
import { generateUuid } from '@~/utils/uuid';

import type { iPromptExampleCharacter } from '../prompt/generation-contracts';
import { IMPORTED_CARD_SOURCE_KIND_SCHEMA } from './card-file-enums';
import type { iImportedCharacterCardFile } from './card-files';
import type { CharacterCard } from './card-schema';

export const EXAMPLE_CHARACTER_CONTEXT_FIELD_ENUM = CHARACTER_FIELD_KEY_ENUM.pick([
  CHARACTER_FIELD_KEYS.NAME,
  CHARACTER_FIELD_KEYS.DESCRIPTION,
  CHARACTER_FIELD_KEYS.PERSONALITY,
  CHARACTER_FIELD_KEYS.SCENARIO,
  CHARACTER_FIELD_KEYS.FIRST_MES,
  CHARACTER_FIELD_KEYS.MES_EXAMPLE,
  CHARACTER_FIELD_KEYS.ALTERNATE_GREETINGS,
  CHARACTER_FIELD_KEYS.CUSTOM_FIELDS,
]);
export const EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY = EXAMPLE_CHARACTER_CONTEXT_FIELD_ENUM.rawEnum;
export const EXAMPLE_CHARACTER_CONTEXT_FIELD_KEYS = EXAMPLE_CHARACTER_CONTEXT_FIELD_ENUM.rawValues;

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

export const STORED_EXAMPLE_CHARACTER_SCHEMA = z.object({
  id: z.string(),
  fileName: z.string(),
  sourceKind: IMPORTED_CARD_SOURCE_KIND_SCHEMA,
  card: CHARACTER_CARD_SCHEMA,
  includedFieldKeys: z.array(z.enum(EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY)),
});

export interface iStoredExampleCharacter {
  id: string;
  fileName: string;
  sourceKind: iImportedCharacterCardFile['sourceKind'];
  card: CharacterCard;
  includedFieldKeys: ExampleCharacterContextFieldKey[];
}

function isExampleCharacterContextFieldKey(value: string): value is ExampleCharacterContextFieldKey {
  return EXAMPLE_CHARACTER_CONTEXT_FIELD_ENUM.is(value);
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
    id: generateUuid(),
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
    case EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.NAME:
    case EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.DESCRIPTION:
    case EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.PERSONALITY:
    case EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.SCENARIO:
    case EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.FIRST_MES:
    case EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.MES_EXAMPLE:
      return hasTextContent(data[fieldKey]);
    case EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.ALTERNATE_GREETINGS:
      return data.alternate_greetings.some((greeting) => greeting.trim() !== '');
    case EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.CUSTOM_FIELDS:
      return data.extensions.custom_fields.some((field) => field.label.trim() !== '' || field.value.trim() !== '');
    default:
      return false;
  }
}

export function toPromptExampleCharacter(exampleCharacter: iStoredExampleCharacter): iPromptExampleCharacter {
  const includedFieldKeys = new Set(sanitizeExampleCharacterIncludedFieldKeys(exampleCharacter.includedFieldKeys));
  const { data } = exampleCharacter.card;

  return {
    name: includedFieldKeys.has(EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.NAME) ? data.name : undefined,
    description: includedFieldKeys.has(EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.DESCRIPTION) ? data.description : undefined,
    personality: includedFieldKeys.has(EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.PERSONALITY) ? data.personality : undefined,
    scenario: includedFieldKeys.has(EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.SCENARIO) ? data.scenario : undefined,
    first_mes: includedFieldKeys.has(EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.FIRST_MES) ? data.first_mes : undefined,
    mes_example: includedFieldKeys.has(EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.MES_EXAMPLE) ? data.mes_example : undefined,
    alternate_greetings: includedFieldKeys.has(EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.ALTERNATE_GREETINGS)
      ? data.alternate_greetings.filter((greeting) => greeting.trim() !== '')
      : undefined,
    custom_fields: includedFieldKeys.has(EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.CUSTOM_FIELDS)
      ? data.extensions.custom_fields.filter((field) => field.label.trim() !== '' || field.value.trim() !== '')
      : undefined,
  };
}
