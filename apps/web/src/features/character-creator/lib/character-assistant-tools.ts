import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import {
  CHARACTER_BOOK_SCHEMA,
  CHARACTER_CARD_SCHEMA,
  CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  CUSTOM_FIELD_SCHEMA,
} from './card-schema';
import type { CharacterCard, CustomField } from './card-schema';
import {
  CHARACTER_ASSISTANT_FOCUS_KINDS,
  CHARACTER_ASSISTANT_TOOL_NAMES,
  CHARACTER_CONCEPT_SCHEMA,
} from './character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  CharacterAssistantToolName,
  iCharacterConcept,
} from './character-assistant-contracts';
import type { iCharacterEditProposal } from './character-edit-proposal';

interface iCharacterAssistantProposalStore {
  getCard: () => CharacterCard;
  appendProposedCard: (input: {
    toolCallId: string;
    summary: string;
    proposedCard: CharacterCard;
  }) => iCharacterEditProposal;
  recordConcept?: (concept: iCharacterConcept) => void;
}

const CHARACTER_FIELD_CHANGE_SCHEMA = z.object({
  fieldKey: CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  value: z.string(),
});

const CUSTOM_FIELD_INPUT_SCHEMA = CUSTOM_FIELD_SCHEMA.partial({ id: true });
const PROPOSAL_RESULT_SCHEMA = z.object({
  proposalId: z.string(),
  summary: z.string(),
  patchCount: z.number().int().nonnegative(),
});

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

  if (
    focus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.fields &&
    !focus.fieldKeys.some((allowedFieldKey) => allowedFieldKey === fieldKey)
  ) {
    throw new Error(`This run does not allow proposing changes to ${fieldKey}.`);
  }
}

function createProposalResult(proposal: iCharacterEditProposal) {
  return {
    proposalId: proposal.id,
    summary: proposal.summary ?? '',
    patchCount: proposal.patches.length,
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
  const readCharacterTool = toolDefinition({
    name: CHARACTER_ASSISTANT_TOOL_NAMES.read_character,
    description: 'Read the current projected character card, including proposals already made during this run.',
    inputSchema: z.object({}),
    outputSchema: z.object({ card: CHARACTER_CARD_SCHEMA }),
  }).server(async () => ({ card: store.getCard() }));

  const recordConceptTool = toolDefinition({
    name: CHARACTER_ASSISTANT_TOOL_NAMES.record_concept,
    description: 'Record the structured concept established for this character creation flow.',
    inputSchema: CHARACTER_CONCEPT_SCHEMA,
    outputSchema: z.object({ isRecorded: z.literal(true), premise: z.string() }),
  }).server(async (concept) => {
    if (!store.recordConcept) {
      throw new Error('Concept recording is unavailable for this run.');
    }

    store.recordConcept(concept);
    return { isRecorded: true, premise: concept.premise };
  });

  const proposeCharacterFieldsTool = toolDefinition({
    name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
    description:
      'Propose updates to one or more standard character text fields. Only include fields that genuinely need to change.',
    inputSchema: z.object({
      changes: z.array(CHARACTER_FIELD_CHANGE_SCHEMA).min(1),
      summary: z.string().trim().min(1),
    }),
    outputSchema: PROPOSAL_RESULT_SCHEMA,
  }).server(async ({ changes, summary }, context) => {
    changes.forEach((change) => assertFocusAllowsField(focus, change.fieldKey));

    const proposedCard = structuredClone(store.getCard());
    changes.forEach((change) => {
      proposedCard.data[change.fieldKey] = change.value;
    });

    return createProposalResult(
      store.appendProposedCard({ toolCallId: context?.toolCallId ?? generateUuid(), summary, proposedCard }),
    );
  });

  const proposeTagsTool = toolDefinition({
    name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags,
    description: 'Propose a complete ordered replacement for the character tags.',
    inputSchema: z.object({
      tags: z.array(z.string()),
      summary: z.string().trim().min(1),
    }),
    outputSchema: PROPOSAL_RESULT_SCHEMA,
  }).server(async ({ tags, summary }, context) => {
    assertFocusAllowsField(focus, 'tags');
    const proposedCard = structuredClone(store.getCard());
    proposedCard.data.tags = tags;

    return createProposalResult(
      store.appendProposedCard({ toolCallId: context?.toolCallId ?? generateUuid(), summary, proposedCard }),
    );
  });

  const proposeAlternateGreetingsTool = toolDefinition({
    name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings,
    description:
      'Create, add, revise, remove, or reorder alternate greetings by proposing the complete ordered list. Preserve worthwhile existing greetings unless the user asks to replace them.',
    inputSchema: z.object({
      greetings: z.array(z.string()),
      summary: z.string().trim().min(1),
    }),
    outputSchema: PROPOSAL_RESULT_SCHEMA,
  }).server(async ({ greetings, summary }, context) => {
    assertFocusAllowsField(focus, 'alternate_greetings');
    const proposedCard = structuredClone(store.getCard());
    proposedCard.data.alternate_greetings = greetings;

    return createProposalResult(
      store.appendProposedCard({ toolCallId: context?.toolCallId ?? generateUuid(), summary, proposedCard }),
    );
  });

  const proposeCustomFieldsTool = toolDefinition({
    name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields,
    description:
      'Propose a complete ordered replacement for custom fields. Include the full desired list when adding, updating, removing, or reordering fields.',
    inputSchema: z.object({
      fields: z.array(CUSTOM_FIELD_INPUT_SCHEMA),
      summary: z.string().trim().min(1),
    }),
    outputSchema: PROPOSAL_RESULT_SCHEMA,
  }).server(async ({ fields, summary }, context) => {
    assertFocusAllowsField(focus, 'custom_fields');
    const proposedCard = structuredClone(store.getCard());
    proposedCard.data.extensions.custom_fields = fields.map(normalizeCustomField);

    return createProposalResult(
      store.appendProposedCard({ toolCallId: context?.toolCallId ?? generateUuid(), summary, proposedCard }),
    );
  });

  const proposeCharacterBookTool = toolDefinition({
    name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book,
    description:
      'Propose the complete character book, including its metadata and ordered entries. Pass null to remove the character book.',
    inputSchema: z.object({
      characterBook: CHARACTER_BOOK_SCHEMA.nullable(),
      summary: z.string().trim().min(1),
    }),
    outputSchema: PROPOSAL_RESULT_SCHEMA,
  }).server(async ({ characterBook, summary }, context) => {
    assertFocusAllowsField(focus, 'character_book');
    const proposedCard = structuredClone(store.getCard());

    if (characterBook === null) {
      delete proposedCard.data.character_book;
    } else {
      proposedCard.data.character_book = characterBook;
    }

    return createProposalResult(
      store.appendProposedCard({ toolCallId: context?.toolCallId ?? generateUuid(), summary, proposedCard }),
    );
  });

  const allTools = {
    [CHARACTER_ASSISTANT_TOOL_NAMES.read_character]: readCharacterTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.record_concept]: recordConceptTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields]: proposeCharacterFieldsTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags]: proposeTagsTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings]: proposeAlternateGreetingsTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields]: proposeCustomFieldsTool,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book]: proposeCharacterBookTool,
  };

  const defaultToolNames = Object.values(CHARACTER_ASSISTANT_TOOL_NAMES).filter(
    (toolName) => toolName !== CHARACTER_ASSISTANT_TOOL_NAMES.record_concept,
  );
  const selectedToolNames = new Set(allowedToolNames ?? defaultToolNames);
  return Object.fromEntries(
    Object.entries(allTools).filter(([toolName]) => selectedToolNames.has(toolName as CharacterAssistantToolName)),
  ) as typeof allTools;
}
