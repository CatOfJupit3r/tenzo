import type { ModelMessage } from '@tanstack/ai';
import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import { GUIDED_STEP_IDS } from '../constants/guided-flow';
import type { GuidedStepId } from '../constants/guided-step-id';
import { CHARACTER_BOOK_SCHEMA, CHARACTER_TEXT_FIELD_KEYS, CUSTOM_FIELD_SCHEMA } from './card-schema';
import type { CharacterCard, CustomField } from './card-schema';
import { CHARACTER_ASSISTANT_FOCUS_KINDS } from './character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  iCharacterAssistantContextAttachment,
  iCharacterAssistantDiscoveryContext,
  iCharacterAssistantStreamRequest,
  iCharacterConcept,
  iChatTemplateRef,
} from './character-assistant-contracts';
import { buildCharacterAssistantInstructions } from './character-assistant-runtime.server';
import { CHARACTER_EDIT_FIELD_KEYS, createCharacterEditPatches } from './character-edit-proposal';
import type { CharacterEditFieldKey } from './character-edit-proposal';
import { generateValidatedObject } from './structured-output.server';
import { createCharacterModelOptions, createCharacterTextAdapter } from './tanstack-ai-text-generation';

interface iGenerateStructuredCharacterAssistantOptions {
  card: CharacterCard;
  focus: CharacterAssistantFocus;
  contextAttachments: iCharacterAssistantContextAttachment[];
  apiKey: string;
  generationSettings: Pick<
    iCharacterAssistantStreamRequest,
    | 'endpoint'
    | 'model'
    | 'maxTokens'
    | 'temperature'
    | 'topP'
    | 'frequencyPenalty'
    | 'presencePenalty'
    | 'topK'
    | 'minP'
  >;
  shouldSendDisabledSamplers?: boolean;
  generalCharacterIdea?: string;
  guidedStep?: GuidedStepId;
  concept?: iCharacterConcept | null;
  discoveryContext?: iCharacterAssistantDiscoveryContext;
  templates?: iChatTemplateRef[];
  messages: ModelMessage[];
  abortSignal?: AbortSignal;
}

export interface iStructuredCharacterAssistantResult {
  assistantMessage: string;
  concept: iCharacterConcept | undefined;
  proposedCard: CharacterCard;
  summary: string;
  hasChanges: boolean;
}

const CUSTOM_FIELD_INPUT_SCHEMA = CUSTOM_FIELD_SCHEMA.partial({ id: true });
const COMPACT_CHARACTER_CONCEPT_SCHEMA = z.object({
  premise: z.string().trim().min(1).max(240),
  archetype: z.string().max(80),
  keyTraits: z.array(z.string().max(60)).max(5),
  flaws: z.array(z.string().max(80)).max(3),
  nameCandidates: z.array(z.string().max(80)).max(3),
  suggestedTags: z.array(z.string().max(50)).max(6),
});
const CHARACTER_BOOK_CHANGE_SCHEMA = z.object({
  shouldChange: z.boolean(),
  value: CHARACTER_BOOK_SCHEMA.nullable(),
});

function getAllowedFieldKeys(focus: CharacterAssistantFocus): CharacterEditFieldKey[] {
  if (focus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.field) {
    return [focus.fieldKey];
  }

  if (focus.kind === CHARACTER_ASSISTANT_FOCUS_KINDS.fields) {
    return [...focus.fieldKeys];
  }

  return Object.values(CHARACTER_EDIT_FIELD_KEYS);
}

export function createCharacterAssistantResponseSchema(
  allowedFieldKeys: readonly CharacterEditFieldKey[],
  guidedStep?: GuidedStepId,
) {
  const changeShape: Record<string, z.ZodType> = {};

  allowedFieldKeys.forEach((fieldKey) => {
    if (CHARACTER_TEXT_FIELD_KEYS.some((textFieldKey) => textFieldKey === fieldKey)) {
      changeShape[fieldKey] = z.string().nullable().optional();
      return;
    }

    if (fieldKey === CHARACTER_EDIT_FIELD_KEYS.tags || fieldKey === CHARACTER_EDIT_FIELD_KEYS.alternate_greetings) {
      changeShape[fieldKey] = z.array(z.string()).nullable().optional();
      return;
    }

    if (fieldKey === CHARACTER_EDIT_FIELD_KEYS.custom_fields) {
      changeShape[fieldKey] = z.array(CUSTOM_FIELD_INPUT_SCHEMA).nullable().optional();
      return;
    }

    changeShape[fieldKey] = CHARACTER_BOOK_CHANGE_SCHEMA.optional();
  });

  return z.object({
    assistantMessage: z.string().trim().min(1).max(400),
    concept: guidedStep === GUIDED_STEP_IDS.concept ? COMPACT_CHARACTER_CONCEPT_SCHEMA.nullable() : z.null(),
    changes: z.object(changeShape),
  });
}

function normalizeCustomField(field: z.infer<typeof CUSTOM_FIELD_INPUT_SCHEMA>): CustomField {
  const fieldId = field.id?.trim();

  return {
    id: fieldId === undefined || fieldId === '' ? generateUuid() : fieldId,
    label: field.label,
    value: field.value,
  };
}

function applyStructuredChanges(
  card: CharacterCard,
  changes: Record<string, unknown>,
  allowedFieldKeys: readonly CharacterEditFieldKey[],
) {
  const proposedCard = structuredClone(card);

  allowedFieldKeys.forEach((fieldKey) => {
    const value = changes[fieldKey];

    if (CHARACTER_TEXT_FIELD_KEYS.some((textFieldKey) => textFieldKey === fieldKey)) {
      if (typeof value === 'string') {
        proposedCard.data[fieldKey as (typeof CHARACTER_TEXT_FIELD_KEYS)[number]] = value;
      }
      return;
    }

    if (fieldKey === CHARACTER_EDIT_FIELD_KEYS.tags && Array.isArray(value)) {
      proposedCard.data.tags = z.array(z.string()).parse(value);
      return;
    }

    if (fieldKey === CHARACTER_EDIT_FIELD_KEYS.alternate_greetings && Array.isArray(value)) {
      proposedCard.data.alternate_greetings = z.array(z.string()).parse(value);
      return;
    }

    if (fieldKey === CHARACTER_EDIT_FIELD_KEYS.custom_fields && Array.isArray(value)) {
      proposedCard.data.extensions.custom_fields = z
        .array(CUSTOM_FIELD_INPUT_SCHEMA)
        .parse(value)
        .map(normalizeCustomField);
      return;
    }

    if (fieldKey === CHARACTER_EDIT_FIELD_KEYS.character_book) {
      if (value === undefined) {
        return;
      }

      const characterBookChange = CHARACTER_BOOK_CHANGE_SCHEMA.parse(value);
      if (!characterBookChange.shouldChange) {
        return;
      }

      if (characterBookChange.value === null) {
        delete proposedCard.data.character_book;
      } else {
        proposedCard.data.character_book = characterBookChange.value;
      }
    }
  });

  return proposedCard;
}

export async function generateStructuredCharacterAssistant({
  card,
  focus,
  contextAttachments,
  apiKey,
  generationSettings,
  shouldSendDisabledSamplers = false,
  generalCharacterIdea = '',
  guidedStep,
  concept = null,
  discoveryContext,
  templates = [],
  messages,
  abortSignal,
}: iGenerateStructuredCharacterAssistantOptions): Promise<iStructuredCharacterAssistantResult> {
  const allowedFieldKeys = getAllowedFieldKeys(focus);
  const responseSchema = createCharacterAssistantResponseSchema(allowedFieldKeys, guidedStep);
  const nullableChangeInstructions = allowedFieldKeys.map((fieldKey) => {
    if (fieldKey === CHARACTER_EDIT_FIELD_KEYS.character_book) {
      return `${fieldKey}: omit it to preserve it; otherwise set shouldChange to true with a value to replace or remove it.`;
    }

    if (fieldKey === CHARACTER_EDIT_FIELD_KEYS.alternate_greetings) {
      return `${fieldKey}: omit it to preserve it; otherwise provide the complete ordered list, including worthwhile existing greetings and any new greetings requested.`;
    }

    return `${fieldKey}: omit it to preserve it, otherwise provide its complete replacement value.`;
  });
  const system = [
    buildCharacterAssistantInstructions({
      card,
      focus,
      contextAttachments,
      generalCharacterIdea,
      guidedStep,
      concept,
      discoveryContext,
      templates,
      shouldUseProposalTools: false,
    }),
    'Return one schema-backed response for the application.',
    'In changes, include only fields that should change.',
    'Put every requested card edit in changes. Never claim an edit was made when its changes value preserves the field.',
    'When the user asks only for advice, analysis, or clarification, preserve every field.',
    'Be compact: assistantMessage must be one sentence under 40 words.',
    `Allowed fields for this response: ${allowedFieldKeys.join(', ')}.`,
    ...nullableChangeInstructions,
    guidedStep === GUIDED_STEP_IDS.concept
      ? [
          'Record a non-null concept whenever the user supplied a usable character premise.',
          'Keep the concept compact: premise under 40 words, archetype under 8 words, 2-4 keyTraits, 1-2 flaws, 1-2 nameCandidates, and 2-5 suggestedTags.',
        ].join('\n')
      : 'The concept value must be null for this response.',
    'Current character card:',
    JSON.stringify(card),
  ].join('\n');
  const output = await generateValidatedObject({
    adapter: createCharacterTextAdapter({
      endpoint: generationSettings.endpoint,
      apiKey,
      model: generationSettings.model,
    }),
    schema: responseSchema,
    schemaDescription: 'A user-facing response plus reviewable edits limited to the allowed character fields.',
    system,
    messages,
    modelOptions: createCharacterModelOptions(generationSettings.endpoint, {
      ...generationSettings,
      maxTokens: Math.min(4_000, Math.max(1_600, generationSettings.maxTokens)),
      temperature: Math.min(0.4, generationSettings.temperature),
      shouldSendDisabledSamplers,
    }),
    abortSignal,
  });
  const { changes } = output;
  const proposedCard = applyStructuredChanges(card, changes, allowedFieldKeys);

  return {
    assistantMessage: output.assistantMessage,
    concept: output.concept ?? undefined,
    proposedCard,
    summary: output.assistantMessage.slice(0, 240),
    hasChanges: createCharacterEditPatches(card, proposedCard).length > 0,
  };
}
