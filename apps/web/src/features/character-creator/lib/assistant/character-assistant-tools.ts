import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import {
  CHARACTER_BOOK_SCHEMA,
  CHARACTER_CARD_SCHEMA,
  CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  CUSTOM_FIELD_SCHEMA,
} from '../cards/card-schema';
import type { CharacterCard, CustomField } from '../cards/card-schema';
import { CHARACTER_EDIT_PROPOSAL_SCHEMA } from '../proposals/character-edit-proposal';
import type { iCharacterEditProposal } from '../proposals/character-edit-proposal';
import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA,
  CHARACTER_ASSISTANT_FOCUS_KINDS,
  CHARACTER_ASSISTANT_TOOL_NAMES,
  CHARACTER_CONCEPT_SCHEMA,
} from './character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  CharacterAssistantToolName,
  iCharacterAssistantDiscoveryDirectionCard,
  iCharacterConcept,
} from './character-assistant-contracts';

export interface iCharacterAssistantProposalStore {
  getCard: () => CharacterCard;
  appendProposedCard: (input: {
    toolCallId: string;
    summary: string;
    proposedCard: CharacterCard;
  }) => iCharacterEditProposal;
  suggestDirections?: (premise?: string) => Promise<{ cards: iCharacterAssistantDiscoveryDirectionCard[] }>;
}

export const CHARACTER_FIELD_CHANGE_SCHEMA = z.object({ fieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA, value: z.string() });
export const PROPOSE_CHARACTER_FIELDS_INPUT_SCHEMA = z.object({
  changes: z.array(CHARACTER_FIELD_CHANGE_SCHEMA).min(1),
  summary: z.string().trim().min(1),
});
export const PROPOSE_TAGS_INPUT_SCHEMA = z.object({ tags: z.array(z.string()), summary: z.string().trim().min(1) });
export const PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA = z.object({
  greetings: z.array(z.string()),
  summary: z.string().trim().min(1),
});
export const PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA = z.object({
  fields: z.array(CUSTOM_FIELD_SCHEMA.partial({ id: true })),
  summary: z.string().trim().min(1),
});
export const PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA = z.object({
  characterBook: CHARACTER_BOOK_SCHEMA.nullable(),
  summary: z.string().trim().min(1),
});
export const PROPOSAL_TOOL_RESULT_SCHEMA = z.object({ proposal: CHARACTER_EDIT_PROPOSAL_SCHEMA });
export const CONCEPT_TOOL_RESULT_SCHEMA = z.object({ concept: CHARACTER_CONCEPT_SCHEMA });
export const SUGGEST_DIRECTIONS_INPUT_SCHEMA = z.object({ premise: z.string().trim().max(600).optional() });
export const SUGGEST_DIRECTIONS_RESULT_SCHEMA = z.object({
  cards: z.array(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA),
});

function normalizeCustomField(field: Partial<CustomField> & Pick<CustomField, 'label' | 'value'>): CustomField {
  let fieldId = field.id?.trim();
  fieldId ??= generateUuid();
  if (fieldId === '') fieldId = generateUuid();
  return { id: fieldId, label: field.label, value: field.value };
}

function assertFocusAllowsField(focus: CharacterAssistantFocus, fieldKey: string) {
  if (focus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field && focus.fieldKey !== fieldKey)
    throw new Error(`This run is focused on ${focus.fieldKey}; proposing changes to ${fieldKey} is not allowed.`);
  if (focus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.fields && !focus.fieldKeys.includes(fieldKey as never))
    throw new Error(`This run does not allow proposing changes to ${fieldKey}.`);
}

export function createProposalFromChanges({
  store,
  focus,
  toolCallId,
  summary,
  updateCard,
  fieldKeys,
}: {
  store: iCharacterAssistantProposalStore;
  focus: CharacterAssistantFocus;
  toolCallId?: string;
  summary: string;
  updateCard: (card: CharacterCard) => unknown;
  fieldKeys: readonly string[];
}) {
  fieldKeys.forEach((fieldKey) => assertFocusAllowsField(focus, fieldKey));
  const proposedCard = structuredClone(store.getCard());
  updateCard(proposedCard);
  return { proposal: store.appendProposedCard({ toolCallId: toolCallId ?? generateUuid(), summary, proposedCard }) };
}

export function recordConcept(concept: iCharacterConcept) {
  return { concept };
}

export function createCharacterAssistantActionHandlers({
  focus,
  store,
}: {
  focus: CharacterAssistantFocus;
  store: iCharacterAssistantProposalStore;
}) {
  return {
    readCharacter: () => ({ card: store.getCard() }),
    recordConcept: (concept: iCharacterConcept) => recordConcept(concept),
    proposeCharacterFields: (input: z.infer<typeof PROPOSE_CHARACTER_FIELDS_INPUT_SCHEMA>, toolCallId?: string) =>
      createProposalFromChanges({
        store,
        focus,
        toolCallId,
        summary: input.summary,
        fieldKeys: input.changes.map((change) => change.fieldKey),
        updateCard: (card) =>
          input.changes.forEach((change) => {
            card.data[change.fieldKey] = change.value;
          }),
      }),
    proposeTags: (input: z.infer<typeof PROPOSE_TAGS_INPUT_SCHEMA>, toolCallId?: string) =>
      createProposalFromChanges({
        store,
        focus,
        toolCallId,
        summary: input.summary,
        fieldKeys: ['tags'],
        updateCard: (card) => {
          card.data.tags = input.tags;
        },
      }),
    proposeAlternateGreetings: (input: z.infer<typeof PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA>, toolCallId?: string) =>
      createProposalFromChanges({
        store,
        focus,
        toolCallId,
        summary: input.summary,
        fieldKeys: ['alternate_greetings'],
        updateCard: (card) => {
          card.data.alternate_greetings = input.greetings;
        },
      }),
    proposeCustomFields: (input: z.infer<typeof PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA>, toolCallId?: string) =>
      createProposalFromChanges({
        store,
        focus,
        toolCallId,
        summary: input.summary,
        fieldKeys: ['custom_fields'],
        updateCard: (card) => {
          card.data.extensions.custom_fields = input.fields.map(normalizeCustomField);
        },
      }),
    proposeCharacterBook: (input: z.infer<typeof PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA>, toolCallId?: string) =>
      createProposalFromChanges({
        store,
        focus,
        toolCallId,
        summary: input.summary,
        fieldKeys: ['character_book'],
        updateCard: (card) => {
          card.data.character_book = input.characterBook ?? undefined;
        },
      }),
    suggestDirections: async (input: z.infer<typeof SUGGEST_DIRECTIONS_INPUT_SCHEMA>) => {
      if (!store.suggestDirections) throw new Error('Character discovery is unavailable for this run.');
      return store.suggestDirections(input.premise);
    },
  };
}

export function createCharacterAssistantTools({
  focus,
  store,
  allowedToolNames,
}: {
  focus: CharacterAssistantFocus;
  store: iCharacterAssistantProposalStore;
  allowedToolNames?: readonly CharacterAssistantToolName[];
}) {
  const handlers = createCharacterAssistantActionHandlers({ focus, store });
  const allTools = {
    [CHARACTER_ASSISTANT_TOOL_NAMES.read_character]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.read_character,
      description: 'Read the current projected character card.',
      inputSchema: z.object({}),
      outputSchema: z.object({ card: CHARACTER_CARD_SCHEMA }),
    }).server(async () => handlers.readCharacter()),
    [CHARACTER_ASSISTANT_TOOL_NAMES.record_concept]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.record_concept,
      description: 'Record the structured character concept.',
      inputSchema: CHARACTER_CONCEPT_SCHEMA,
      outputSchema: CONCEPT_TOOL_RESULT_SCHEMA,
    }).server(async (input) => handlers.recordConcept(input)),
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
      description: 'Propose updates to standard character text fields.',
      inputSchema: PROPOSE_CHARACTER_FIELDS_INPUT_SCHEMA,
      outputSchema: PROPOSAL_TOOL_RESULT_SCHEMA,
    }).server(async (input, context) => handlers.proposeCharacterFields(input, context?.toolCallId)),
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags,
      description: 'Propose a complete ordered replacement for tags.',
      inputSchema: PROPOSE_TAGS_INPUT_SCHEMA,
      outputSchema: PROPOSAL_TOOL_RESULT_SCHEMA,
    }).server(async (input, context) => handlers.proposeTags(input, context?.toolCallId)),
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings,
      description: 'Propose a complete ordered replacement for alternate greetings.',
      inputSchema: PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA,
      outputSchema: PROPOSAL_TOOL_RESULT_SCHEMA,
    }).server(async (input, context) => handlers.proposeAlternateGreetings(input, context?.toolCallId)),
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields,
      description: 'Propose a complete ordered replacement for custom fields.',
      inputSchema: PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA,
      outputSchema: PROPOSAL_TOOL_RESULT_SCHEMA,
    }).server(async (input, context) => handlers.proposeCustomFields(input, context?.toolCallId)),
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book,
      description: 'Propose a complete character book or null to remove it.',
      inputSchema: PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA,
      outputSchema: PROPOSAL_TOOL_RESULT_SCHEMA,
    }).server(async (input, context) => handlers.proposeCharacterBook(input, context?.toolCallId)),
    [CHARACTER_ASSISTANT_TOOL_NAMES.suggest_character_directions]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.suggest_character_directions,
      description: 'Generate varied selectable character directions. The premise is optional.',
      inputSchema: SUGGEST_DIRECTIONS_INPUT_SCHEMA,
      outputSchema: SUGGEST_DIRECTIONS_RESULT_SCHEMA,
    }).server(async (input) => handlers.suggestDirections(input)),
  };
  const selected = new Set(allowedToolNames ?? Object.keys(allTools));
  return Object.fromEntries(
    Object.entries(allTools).filter(([name]) => selected.has(name as CharacterAssistantToolName)),
  );
}
