import { CHARACTER_TEXT_FIELD_KEYS } from './card-schema';
import type { CharacterCard, CharacterTextFieldKey, CustomField } from './card-schema';

export const CHARACTER_CARD_LIST_FIELD_KEYS = ['tags', 'alternate_greetings'] as const;
export type CharacterCardListFieldKey = (typeof CHARACTER_CARD_LIST_FIELD_KEYS)[number];

export type CharacterCardChangedFieldKey = CharacterTextFieldKey | CharacterCardListFieldKey | 'custom_fields';

export interface iCharacterCardTextFieldDiff {
  kind: 'text';
  fieldKey: CharacterTextFieldKey;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface iCharacterCardListFieldDiff {
  kind: 'list';
  fieldKey: CharacterCardListFieldKey;
  label: string;
  oldValue: string[];
  newValue: string[];
}

export interface iCharacterCardCustomFieldsDiff {
  kind: 'custom-fields';
  fieldKey: 'custom_fields';
  label: string;
  oldValue: CustomField[];
  newValue: CustomField[];
}

export type iCharacterCardFieldDiff =
  | iCharacterCardTextFieldDiff
  | iCharacterCardListFieldDiff
  | iCharacterCardCustomFieldsDiff;

const TEXT_FIELD_LABELS: Record<CharacterTextFieldKey, string> = {
  name: 'Name',
  description: 'Description',
  personality: 'Personality',
  scenario: 'Scenario',
  first_mes: 'First Message',
  mes_example: 'Example Dialogue',
  creator_notes: 'Creator Notes',
  system_prompt: 'System Prompt',
  post_history_instructions: 'Post-History Instructions',
  creator: 'Creator',
  character_version: 'Version',
};

const LIST_FIELD_LABELS: Record<CharacterCardListFieldKey, string> = {
  tags: 'Tags',
  alternate_greetings: 'Alternate Greetings',
};

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function areCustomFieldsEqual(left: CustomField[], right: CustomField[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function computeCharacterCardFieldDiffs(
  liveCard: CharacterCard,
  draftCard: CharacterCard,
): iCharacterCardFieldDiff[] {
  const diffs: iCharacterCardFieldDiff[] = [];

  CHARACTER_TEXT_FIELD_KEYS.forEach((fieldKey) => {
    const oldValue = liveCard.data[fieldKey];
    const newValue = draftCard.data[fieldKey];

    if (oldValue !== newValue) {
      diffs.push({
        kind: 'text',
        fieldKey,
        label: TEXT_FIELD_LABELS[fieldKey],
        oldValue,
        newValue,
      });
    }
  });

  CHARACTER_CARD_LIST_FIELD_KEYS.forEach((fieldKey) => {
    const oldValue = liveCard.data[fieldKey];
    const newValue = draftCard.data[fieldKey];

    if (!areStringArraysEqual(oldValue, newValue)) {
      diffs.push({
        kind: 'list',
        fieldKey,
        label: LIST_FIELD_LABELS[fieldKey],
        oldValue,
        newValue,
      });
    }
  });

  const oldCustomFields = liveCard.data.extensions.custom_fields;
  const newCustomFields = draftCard.data.extensions.custom_fields;

  if (!areCustomFieldsEqual(oldCustomFields, newCustomFields)) {
    diffs.push({
      kind: 'custom-fields',
      fieldKey: 'custom_fields',
      label: 'Custom Fields',
      oldValue: oldCustomFields,
      newValue: newCustomFields,
    });
  }

  return diffs;
}

export function applyCharacterCardFieldChanges(
  liveCard: CharacterCard,
  draftCard: CharacterCard,
  fieldKeys: readonly CharacterCardChangedFieldKey[],
): CharacterCard {
  const nextCard = structuredClone(liveCard);

  fieldKeys.forEach((fieldKey) => {
    if (fieldKey === 'tags') {
      nextCard.data.tags = structuredClone(draftCard.data.tags);
      return;
    }

    if (fieldKey === 'alternate_greetings') {
      nextCard.data.alternate_greetings = structuredClone(draftCard.data.alternate_greetings);
      return;
    }

    if (fieldKey === 'custom_fields') {
      nextCard.data.extensions.custom_fields = structuredClone(draftCard.data.extensions.custom_fields);
      return;
    }

    nextCard.data[fieldKey] = draftCard.data[fieldKey];
  });

  return nextCard;
}
