import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import {
  CHARACTER_BOOK_SCHEMA,
  CHARACTER_BOOK_ENTRY_SCHEMA,
  CHARACTER_CARD_SCHEMA,
  CHARACTER_TEXT_FIELD_KEYS,
  CHARACTER_TEXT_FIELD_KEY_SCHEMA,
  CUSTOM_FIELD_SCHEMA,
} from '../cards/card-schema';
import type { CharacterCard, CustomField, CharacterTextFieldKey } from '../cards/card-schema';
import { doesValueMatchStrictFieldTemplate } from '../cards/field-template-enforcement';
import { getTemplateFieldKeyForTargetKey, TEMPLATE_FIELD_KEYS, TEMPLATE_MODES } from '../cards/field-templates';
import type { TemplateFieldKey } from '../cards/field-templates';
import type { CharacterAssistantFieldEditing } from '../generation/generation-config';
import { CHARACTER_EDIT_FIELD_KEYS } from '../proposals/character-edit-proposal';
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
  iChatTemplateRef,
} from './character-assistant-contracts';
import { PROPOSAL_TOOL_RESULT_SCHEMA } from './character-assistant-tool-results';

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
const TOOL_SUMMARY_SCHEMA = z.string().trim().default('Character update');
const ASSISTANT_CHARACTER_BOOK_ENTRY_SCHEMA = CHARACTER_BOOK_ENTRY_SCHEMA.extend({
  keys: z.array(z.string()).default([]),
  content: z.string().default(''),
  extensions: z.record(z.string(), z.unknown()).default({}),
  enabled: z.boolean().default(true),
  insertion_order: z.number().default(0),
});
const ASSISTANT_CHARACTER_BOOK_SCHEMA = CHARACTER_BOOK_SCHEMA.extend({
  extensions: z.record(z.string(), z.unknown()).default({}),
  entries: z.array(ASSISTANT_CHARACTER_BOOK_ENTRY_SCHEMA).default([]),
});

export const PROPOSE_CHARACTER_FIELDS_INPUT_SCHEMA = z.object({
  changes: z.array(CHARACTER_FIELD_CHANGE_SCHEMA).min(1),
  summary: TOOL_SUMMARY_SCHEMA,
});

function doesFocusAllowField(focus: CharacterAssistantFocus | undefined, fieldKey: string) {
  if (!focus || focus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.card) return true;
  if (focus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field) return focus.fieldKey === fieldKey;
  return focus.fieldKeys.some((focusedFieldKey) => focusedFieldKey === fieldKey);
}

export function getAllowedCharacterAssistantTextFieldKeys(
  fieldShouldAllowAssistantEditing?: Readonly<CharacterAssistantFieldEditing>,
  focus?: CharacterAssistantFocus,
) {
  return CHARACTER_TEXT_FIELD_KEYS.filter(
    (fieldKey) => fieldShouldAllowAssistantEditing?.[fieldKey] !== false && doesFocusAllowField(focus, fieldKey),
  );
}

export function createProposeCharacterFieldsInputSchema(
  fieldShouldAllowAssistantEditing?: Readonly<CharacterAssistantFieldEditing>,
  focus?: CharacterAssistantFocus,
) {
  const enabledFieldKeys = getAllowedCharacterAssistantTextFieldKeys(fieldShouldAllowAssistantEditing, focus);
  if (enabledFieldKeys.length === 0) return null;

  const enabledFieldKeySchema = z.enum(enabledFieldKeys as [CharacterTextFieldKey, ...CharacterTextFieldKey[]]);
  return z.object({
    changes: z.array(z.object({ fieldKey: enabledFieldKeySchema, value: z.string() })).min(1),
    summary: TOOL_SUMMARY_SCHEMA,
  });
}

export function getAllowedCharacterAssistantToolNames(
  fieldShouldAllowAssistantEditing?: Readonly<CharacterAssistantFieldEditing>,
  focus?: CharacterAssistantFocus,
): CharacterAssistantToolName[] {
  const toolNames: CharacterAssistantToolName[] = [
    CHARACTER_ASSISTANT_TOOL_NAMES.read_character,
    CHARACTER_ASSISTANT_TOOL_NAMES.record_concept,
    CHARACTER_ASSISTANT_TOOL_NAMES.suggest_character_directions,
  ];
  if (getAllowedCharacterAssistantTextFieldKeys(fieldShouldAllowAssistantEditing, focus).length > 0) {
    toolNames.push(CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields);
  }
  if (
    fieldShouldAllowAssistantEditing?.[CHARACTER_EDIT_FIELD_KEYS.tags] !== false &&
    doesFocusAllowField(focus, CHARACTER_EDIT_FIELD_KEYS.tags)
  ) {
    toolNames.push(CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags);
  }
  if (
    fieldShouldAllowAssistantEditing?.[CHARACTER_EDIT_FIELD_KEYS.alternate_greetings] !== false &&
    doesFocusAllowField(focus, CHARACTER_EDIT_FIELD_KEYS.alternate_greetings)
  ) {
    toolNames.push(CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings);
  }
  if (
    fieldShouldAllowAssistantEditing?.[CHARACTER_EDIT_FIELD_KEYS.custom_fields] !== false &&
    doesFocusAllowField(focus, CHARACTER_EDIT_FIELD_KEYS.custom_fields)
  ) {
    toolNames.push(CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields);
  }
  if (
    fieldShouldAllowAssistantEditing?.[CHARACTER_EDIT_FIELD_KEYS.character_book] !== false &&
    doesFocusAllowField(focus, CHARACTER_EDIT_FIELD_KEYS.character_book)
  ) {
    toolNames.push(CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book);
  }
  return toolNames;
}
export const PROPOSE_TAGS_INPUT_SCHEMA = z.object({
  tags: z.array(z.string()).default([]),
  summary: TOOL_SUMMARY_SCHEMA,
});
export const PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA = z.object({
  greetings: z.array(z.string()).default([]),
  summary: TOOL_SUMMARY_SCHEMA,
});
export const PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA = z.object({
  fields: z
    .array(
      CUSTOM_FIELD_SCHEMA.extend({
        id: z.string().optional(),
        label: z.string().default('Custom field'),
        value: z.string().default(''),
      }),
    )
    .default([]),
  summary: TOOL_SUMMARY_SCHEMA,
});
export const PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA = z.object({
  characterBook: ASSISTANT_CHARACTER_BOOK_SCHEMA.nullable().default(null),
  summary: TOOL_SUMMARY_SCHEMA,
});
export const CONCEPT_TOOL_RESULT_SCHEMA = z.object({ concept: CHARACTER_CONCEPT_SCHEMA });
export const SUGGEST_DIRECTIONS_INPUT_SCHEMA = z.object({ premise: z.string().trim().optional() });
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

function getTemplateFieldKeyForProposalField(fieldKey: string): TemplateFieldKey | null {
  if (fieldKey === CHARACTER_EDIT_FIELD_KEYS.alternate_greetings) {
    return TEMPLATE_FIELD_KEYS.alternate_greeting;
  }

  return getTemplateFieldKeyForTargetKey(`field:${fieldKey}`);
}

function assertStrictTemplateCompliance({
  fieldKeys,
  proposedCard,
  templates,
}: {
  fieldKeys: readonly string[];
  proposedCard: CharacterCard;
  templates: readonly iChatTemplateRef[];
}) {
  fieldKeys.forEach((fieldKey) => {
    const templateFieldKey = getTemplateFieldKeyForProposalField(fieldKey);
    if (!templateFieldKey) {
      return;
    }

    const strictTemplate = templates.find(
      (template) => template.mode === TEMPLATE_MODES.strict && template.fieldKeys.includes(templateFieldKey),
    );
    if (!strictTemplate) {
      return;
    }

    const proposedValues =
      fieldKey === CHARACTER_EDIT_FIELD_KEYS.alternate_greetings
        ? proposedCard.data.alternate_greetings
        : [proposedCard.data[templateFieldKey as keyof typeof proposedCard.data]];
    const isCompliant = proposedValues.every(
      (proposedValue): proposedValue is string =>
        typeof proposedValue === 'string' && doesValueMatchStrictFieldTemplate(strictTemplate.content, proposedValue),
    );

    if (isCompliant) {
      return;
    }

    throw new Error(
      `The proposed ${fieldKey} value does not match strict template "${strictTemplate.name}". ` +
        `Preserve this skeleton exactly:\n${strictTemplate.content}\n` +
        'Fill only {{gen:label}} slots; do not alter the literal text outside those slots.',
    );
  });
}

export function createProposalFromChanges({
  store,
  focus,
  toolCallId,
  summary,
  updateCard,
  fieldKeys,
  templates = [],
}: {
  store: iCharacterAssistantProposalStore;
  focus: CharacterAssistantFocus;
  toolCallId?: string;
  summary: string;
  updateCard: (card: CharacterCard) => unknown;
  fieldKeys: readonly string[];
  templates?: readonly iChatTemplateRef[];
}) {
  fieldKeys.forEach((fieldKey) => assertFocusAllowsField(focus, fieldKey));
  const proposedCard = structuredClone(store.getCard());
  updateCard(proposedCard);
  assertStrictTemplateCompliance({ fieldKeys, proposedCard, templates });
  const proposal = store.appendProposedCard({ toolCallId: toolCallId ?? generateUuid(), summary, proposedCard });
  if (proposal.patches.length === 0) {
    return {
      proposal: null,
      isNoOp: true,
      message: 'No changes were needed because the requested fields already match the current card.',
    };
  }
  return { proposal, isNoOp: false };
}

export function recordConcept(concept: iCharacterConcept) {
  return { concept };
}

export function createCharacterAssistantActionHandlers({
  focus,
  store,
  templates = [],
}: {
  focus: CharacterAssistantFocus;
  store: iCharacterAssistantProposalStore;
  templates?: readonly iChatTemplateRef[];
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
        templates,
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
        templates,
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
        templates,
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
        templates,
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
        templates,
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
  templates = [],
  allowedToolNames,
  fieldShouldAllowAssistantEditing,
}: {
  focus: CharacterAssistantFocus;
  store: iCharacterAssistantProposalStore;
  templates?: readonly iChatTemplateRef[];
  allowedToolNames?: readonly CharacterAssistantToolName[];
  fieldShouldAllowAssistantEditing?: Readonly<CharacterAssistantFieldEditing>;
}) {
  const handlers = createCharacterAssistantActionHandlers({ focus, store, templates });
  const characterFieldsInputSchema = createProposeCharacterFieldsInputSchema(fieldShouldAllowAssistantEditing, focus);
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
    }).server(async (input) => handlers.recordConcept(CHARACTER_CONCEPT_SCHEMA.parse(input))),
    ...(characterFieldsInputSchema
      ? {
          [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields]: toolDefinition({
            name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields,
            description: 'Propose updates to enabled standard character text fields.',
            inputSchema: characterFieldsInputSchema,
            outputSchema: PROPOSAL_TOOL_RESULT_SCHEMA,
          }).server(async (input, context) =>
            handlers.proposeCharacterFields(characterFieldsInputSchema.parse(input), context?.toolCallId),
          ),
        }
      : {}),
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags,
      description: 'Propose a complete ordered replacement for tags.',
      inputSchema: PROPOSE_TAGS_INPUT_SCHEMA,
      outputSchema: PROPOSAL_TOOL_RESULT_SCHEMA,
    }).server(async (input, context) =>
      handlers.proposeTags(PROPOSE_TAGS_INPUT_SCHEMA.parse(input), context?.toolCallId),
    ),
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings,
      description: 'Propose a complete ordered replacement for alternate greetings.',
      inputSchema: PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA,
      outputSchema: PROPOSAL_TOOL_RESULT_SCHEMA,
    }).server(async (input, context) =>
      handlers.proposeAlternateGreetings(PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA.parse(input), context?.toolCallId),
    ),
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields,
      description: 'Propose a complete ordered replacement for custom fields.',
      inputSchema: PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA,
      outputSchema: PROPOSAL_TOOL_RESULT_SCHEMA,
    }).server(async (input, context) =>
      handlers.proposeCustomFields(PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA.parse(input), context?.toolCallId),
    ),
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book,
      description: 'Propose a complete character book or null to remove it.',
      inputSchema: PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA,
      outputSchema: PROPOSAL_TOOL_RESULT_SCHEMA,
    }).server(async (input, context) =>
      handlers.proposeCharacterBook(PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA.parse(input), context?.toolCallId),
    ),
    [CHARACTER_ASSISTANT_TOOL_NAMES.suggest_character_directions]: toolDefinition({
      name: CHARACTER_ASSISTANT_TOOL_NAMES.suggest_character_directions,
      description: 'Generate varied selectable character directions. The premise is optional.',
      inputSchema: SUGGEST_DIRECTIONS_INPUT_SCHEMA,
      outputSchema: SUGGEST_DIRECTIONS_RESULT_SCHEMA,
    }).server(async (input) => handlers.suggestDirections(input)),
  };
  const editableToolNames = new Set(getAllowedCharacterAssistantToolNames(fieldShouldAllowAssistantEditing, focus));
  const selected = new Set(allowedToolNames ?? Object.keys(allTools));
  return Object.fromEntries(
    Object.entries(allTools).filter(
      ([name]) =>
        selected.has(name as CharacterAssistantToolName) && editableToolNames.has(name as CharacterAssistantToolName),
    ),
  );
}
