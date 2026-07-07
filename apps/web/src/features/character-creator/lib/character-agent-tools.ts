import { tool } from 'ai';
import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import { CHARACTER_TEXT_FIELD_KEY_SCHEMA, CUSTOM_FIELD_SCHEMA } from './card-schema';
import type { CharacterCard, CustomField, CHARACTER_TEXT_FIELD_KEYS } from './card-schema';
import { createCharacterAgentToolEvent, CHARACTER_AGENT_TOOL_NAMES } from './character-agent-session';

interface iCharacterAgentDraftStore {
  getDraftCard: () => CharacterCard;
  replaceDraftCard: (card: CharacterCard) => void;
  appendToolEvent: (event: ReturnType<typeof createCharacterAgentToolEvent>) => void;
}

const CHARACTER_FIELD_CHANGE_SCHEMA = z.object({
  fieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  value: z.string(),
});

const CUSTOM_FIELD_INPUT_SCHEMA = CUSTOM_FIELD_SCHEMA.partial({ id: true });

function summarizeDraftCard(card: CharacterCard) {
  const characterName = card.data.name.trim() ? card.data.name : 'Untitled';

  return `"${characterName}" | ${card.data.tags.length} tags | ${card.data.alternate_greetings.length} greetings | ${card.data.extensions.custom_fields.length} custom fields`;
}

function summarizeFieldChanges(
  changes: Array<{
    fieldKey: (typeof CHARACTER_TEXT_FIELD_KEYS)[number];
    value: string;
  }>,
) {
  return changes.map((change) => change.fieldKey).join(', ');
}

function normalizeCustomField(field: Partial<CustomField> & Pick<CustomField, 'label' | 'value'>): CustomField {
  const fieldId = field.id?.trim();
  const normalizedFieldId = fieldId === '' ? undefined : fieldId;

  return {
    id: normalizedFieldId ?? generateUuid(),
    label: field.label,
    value: field.value,
  };
}

export function createCharacterAgentTools(store: iCharacterAgentDraftStore) {
  const readCharacterTool = tool({
    description:
      'Read the current editable character draft before making changes. Use this to inspect the whole card state.',
    inputSchema: z.object({}),
    execute: async () => {
      const draftCard = store.getDraftCard();

      store.appendToolEvent(
        createCharacterAgentToolEvent({
          toolName: CHARACTER_AGENT_TOOL_NAMES.read_character,
          inputSummary: 'Read the current draft',
          outputSummary: summarizeDraftCard(draftCard),
        }),
      );

      return {
        card: draftCard,
      };
    },
  });

  const updateCharacterFieldsTool = tool({
    description:
      'Update one or more standard character text fields such as name, description, personality, scenario, or creator notes.',
    inputSchema: z.object({
      changes: z.array(CHARACTER_FIELD_CHANGE_SCHEMA).min(1),
    }),
    execute: async ({ changes }) => {
      const nextDraftCard = structuredClone(store.getDraftCard());

      changes.forEach((change) => {
        nextDraftCard.data[change.fieldKey] = change.value;
      });

      store.replaceDraftCard(nextDraftCard);
      store.appendToolEvent(
        createCharacterAgentToolEvent({
          toolName: CHARACTER_AGENT_TOOL_NAMES.update_character_fields,
          inputSummary: summarizeFieldChanges(changes),
          outputSummary: `Updated ${changes.length} standard fields`,
        }),
      );

      return {
        updatedFieldKeys: changes.map((change) => change.fieldKey),
        summary: `Updated ${changes.length} standard fields.`,
      };
    },
  });

  const replaceTagsTool = tool({
    description: 'Replace the character tag list with a new ordered list of tags.',
    inputSchema: z.object({
      tags: z.array(z.string()),
    }),
    execute: async ({ tags }) => {
      const nextDraftCard = structuredClone(store.getDraftCard());
      nextDraftCard.data.tags = tags;

      store.replaceDraftCard(nextDraftCard);
      store.appendToolEvent(
        createCharacterAgentToolEvent({
          toolName: CHARACTER_AGENT_TOOL_NAMES.replace_tags,
          inputSummary: `Set ${tags.length} tags`,
          outputSummary: tags.length > 0 ? tags.join(', ') : 'Cleared all tags',
        }),
      );

      return {
        tagCount: tags.length,
        summary: `Draft now has ${tags.length} tags.`,
      };
    },
  });

  const replaceAlternateGreetingsTool = tool({
    description: 'Replace the full alternate greetings list with a new ordered list.',
    inputSchema: z.object({
      greetings: z.array(z.string()),
    }),
    execute: async ({ greetings }) => {
      const nextDraftCard = structuredClone(store.getDraftCard());
      nextDraftCard.data.alternate_greetings = greetings;

      store.replaceDraftCard(nextDraftCard);
      store.appendToolEvent(
        createCharacterAgentToolEvent({
          toolName: CHARACTER_AGENT_TOOL_NAMES.replace_alternate_greetings,
          inputSummary: `Set ${greetings.length} alternate greetings`,
          outputSummary: greetings.length > 0 ? `First greeting: ${greetings[0]}` : 'Cleared all alternate greetings',
        }),
      );

      return {
        greetingCount: greetings.length,
        summary: `Draft now has ${greetings.length} alternate greetings.`,
      };
    },
  });

  const replaceCustomFieldsTool = tool({
    description:
      'Replace the full custom field list. Supply the complete final list when adding, updating, reordering, or removing custom fields.',
    inputSchema: z.object({
      fields: z.array(CUSTOM_FIELD_INPUT_SCHEMA),
    }),
    execute: async ({ fields }) => {
      const nextDraftCard = structuredClone(store.getDraftCard());
      nextDraftCard.data.extensions.custom_fields = fields.map(normalizeCustomField);

      store.replaceDraftCard(nextDraftCard);
      store.appendToolEvent(
        createCharacterAgentToolEvent({
          toolName: CHARACTER_AGENT_TOOL_NAMES.replace_custom_fields,
          inputSummary: `Set ${fields.length} custom fields`,
          outputSummary:
            fields.length > 0
              ? fields.map((field) => (field.label.trim() ? field.label : 'Untitled field')).join(', ')
              : 'Cleared all custom fields',
        }),
      );

      return {
        fieldCount: fields.length,
        summary: `Draft now has ${fields.length} custom fields.`,
      };
    },
  });

  return {
    [CHARACTER_AGENT_TOOL_NAMES.read_character]: readCharacterTool,
    [CHARACTER_AGENT_TOOL_NAMES.update_character_fields]: updateCharacterFieldsTool,
    [CHARACTER_AGENT_TOOL_NAMES.replace_tags]: replaceTagsTool,
    [CHARACTER_AGENT_TOOL_NAMES.replace_alternate_greetings]: replaceAlternateGreetingsTool,
    [CHARACTER_AGENT_TOOL_NAMES.replace_custom_fields]: replaceCustomFieldsTool,
  };
}
