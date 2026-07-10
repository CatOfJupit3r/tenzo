import { tool } from 'ai';
import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import { CHARACTER_BOOK_SCHEMA, CHARACTER_TEXT_FIELD_KEY_SCHEMA, CUSTOM_FIELD_SCHEMA } from './card-schema';
import type { CharacterCard, CustomField } from './card-schema';
import { CHARACTER_ASSISTANT_FOCUS_KINDS, CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';
import type { CharacterAssistantFocus } from './character-assistant-contracts';
import type { iCharacterEditProposal } from './character-edit-proposal';

interface iCharacterAssistantProposalStore {
  getCard: () => CharacterCard;
  appendProposedCard: (input: {
    toolCallId: string;
    summary: string;
    proposedCard: CharacterCard;
  }) => iCharacterEditProposal;
}

const CHARACTER_FIELD_CHANGE_SCHEMA = z.object({
  fieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  value: z.string(),
});

const CUSTOM_FIELD_INPUT_SCHEMA = CUSTOM_FIELD_SCHEMA.partial({ id: true });

function normalizeCustomField(field: Partial<CustomField> & Pick<CustomField, 'label' | 'value'>): CustomField {
  const fieldId = field.id?.trim();

  return {
    id: fieldId === undefined || fieldId === '' ? generateUuid() : fieldId,
    label: field.label,
    value: field.value,
  };
}

function assertFocusAllowsField(focus: CharacterAssistantFocus, fieldKey: string) {
  if (focus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field && focus.fieldKey !== fieldKey) {
    throw new Error(`This run is focused on ${focus.fieldKey}; proposing changes to ${fieldKey} is not allowed.`);
  }
}

function createProposalResult(proposal: iCharacterEditProposal) {
  return {
    proposalId: proposal.id,
    summary: proposal.summary,
    patchCount: proposal.patches.length,
  };
}

export function createCharacterAssistantTools({
  focus,
  store,
}: {
  focus: CharacterAssistantFocus;
  store: iCharacterAssistantProposalStore;
}) {
  const readCharacterTool = tool({
    description: 'Read the current projected character card, including proposals already made during this run.',
    inputSchema: z.object({}),
    execute: async () => ({ card: store.getCard() }),
  });

  const proposeCharacterFieldsTool = tool({
    description:
      'Propose updates to one or more standard character text fields. Only include fields that genuinely need to change.',
    inputSchema: z.object({
      changes: z.array(CHARACTER_FIELD_CHANGE_SCHEMA).min(1),
      summary: z.string().trim().min(1),
    }),
    execute: async ({ changes, summary }, { toolCallId }) => {
      changes.forEach((change) => assertFocusAllowsField(focus, change.fieldKey));

      const proposedCard = structuredClone(store.getCard());
      changes.forEach((change) => {
        proposedCard.data[change.fieldKey] = change.value;
      });

      return createProposalResult(store.appendProposedCard({ toolCallId, summary, proposedCard }));
    },
  });

  const proposeTagsTool = tool({
    description: 'Propose a complete ordered replacement for the character tags.',
    inputSchema: z.object({
      tags: z.array(z.string()),
      summary: z.string().trim().min(1),
    }),
    execute: async ({ tags, summary }, { toolCallId }) => {
      assertFocusAllowsField(focus, 'tags');
      const proposedCard = structuredClone(store.getCard());
      proposedCard.data.tags = tags;

      return createProposalResult(store.appendProposedCard({ toolCallId, summary, proposedCard }));
    },
  });

  const proposeAlternateGreetingsTool = tool({
    description: 'Propose a complete ordered replacement for the alternate greetings.',
    inputSchema: z.object({
      greetings: z.array(z.string()),
      summary: z.string().trim().min(1),
    }),
    execute: async ({ greetings, summary }, { toolCallId }) => {
      assertFocusAllowsField(focus, 'alternate_greetings');
      const proposedCard = structuredClone(store.getCard());
      proposedCard.data.alternate_greetings = greetings;

      return createProposalResult(store.appendProposedCard({ toolCallId, summary, proposedCard }));
    },
  });

  const proposeCustomFieldsTool = tool({
    description:
      'Propose a complete ordered replacement for custom fields. Include the full desired list when adding, updating, removing, or reordering fields.',
    inputSchema: z.object({
      fields: z.array(CUSTOM_FIELD_INPUT_SCHEMA),
      summary: z.string().trim().min(1),
    }),
    execute: async ({ fields, summary }, { toolCallId }) => {
      assertFocusAllowsField(focus, 'custom_fields');
      const proposedCard = structuredClone(store.getCard());
      proposedCard.data.extensions.custom_fields = fields.map(normalizeCustomField);

      return createProposalResult(store.appendProposedCard({ toolCallId, summary, proposedCard }));
    },
  });

  const proposeCharacterBookTool = tool({
    description:
      'Propose the complete character book, including its metadata and ordered entries. Pass null to remove the character book.',
    inputSchema: z.object({
      characterBook: CHARACTER_BOOK_SCHEMA.nullable(),
      summary: z.string().trim().min(1),
    }),
    execute: async ({ characterBook, summary }, { toolCallId }) => {
      assertFocusAllowsField(focus, 'character_book');
      const proposedCard = structuredClone(store.getCard());

      if (characterBook === null) {
        delete proposedCard.data.character_book;
      } else {
        proposedCard.data.character_book = characterBook;
      }

      return createProposalResult(store.appendProposedCard({ toolCallId, summary, proposedCard }));
    },
  });

  return {
    [CHARACTER_ASSISTANT_TOOL_NAMES.read_character]: readCharacterTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields]: proposeCharacterFieldsTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags]: proposeTagsTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings]: proposeAlternateGreetingsTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields]: proposeCustomFieldsTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book]: proposeCharacterBookTool,
  };
}
