import { z } from 'zod';

import { GUIDED_STEP_ID_SCHEMA } from '../constants/guided-flow';
import { CHARACTER_CARD_SCHEMA } from './card-schema';
import { CHARACTER_EDIT_FIELD_KEY_SCHEMA, CHARACTER_EDIT_PROPOSAL_SCHEMA } from './character-edit-proposal';
import { STORED_FIELD_TEMPLATE_SCHEMA } from './field-templates';
import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from './generation-stream-contracts';

export const CHARACTER_ASSISTANT_FOCUS_KIND_SCHEMA = z.enum(['card', 'field', 'fields']);
export const CHARACTER_ASSISTANT_FOCUS_KINDS = CHARACTER_ASSISTANT_FOCUS_KIND_SCHEMA.enum;

export const CHARACTER_ASSISTANT_FOCUS_SCHEMA = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(CHARACTER_ASSISTANT_FOCUS_KINDS.card),
  }),
  z.object({
    kind: z.literal(CHARACTER_ASSISTANT_FOCUS_KINDS.field),
    fieldKey: CHARACTER_EDIT_FIELD_KEY_SCHEMA,
  }),
  z.object({
    kind: z.literal(CHARACTER_ASSISTANT_FOCUS_KINDS.fields),
    fieldKeys: z.array(CHARACTER_EDIT_FIELD_KEY_SCHEMA).min(1),
  }),
]);

export const CHARACTER_ASSISTANT_ATTACHMENT_KINDS = {
  imageAnalysis: 'image-analysis',
} as const;

export const CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KIND_SCHEMA = z.string().trim().min(1);

export const CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA = z.object({
  id: z.string().trim().min(1),
  kind: CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KIND_SCHEMA,
  title: z.string().trim().min(1),
  content: z.string().trim().min(1).max(12_000),
  warnings: z.array(z.string().trim().min(1)),
  confidence: z.number().min(0).max(1).nullable(),
});

export const CHARACTER_ASSISTANT_MESSAGE_ROLE_SCHEMA = z.enum(['user', 'assistant']);
export const CHARACTER_ASSISTANT_MESSAGE_ROLES = CHARACTER_ASSISTANT_MESSAGE_ROLE_SCHEMA.enum;

export const CHARACTER_ASSISTANT_MESSAGE_SCHEMA = z.object({
  id: z.string(),
  role: CHARACTER_ASSISTANT_MESSAGE_ROLE_SCHEMA,
  content: z.string(),
  createdAt: z.string(),
});

export const CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA = z.enum([
  'read_character',
  'record_concept',
  'propose_character_fields',
  'propose_tags',
  'propose_alternate_greetings',
  'propose_custom_fields',
  'propose_character_book',
]);
export const CHARACTER_ASSISTANT_TOOL_NAMES = CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA.enum;

export const CHARACTER_CONCEPT_SCHEMA = z.object({
  premise: z.string().trim().min(1).max(600),
  archetype: z.string(),
  keyTraits: z.array(z.string()).max(8),
  flaws: z.array(z.string()).max(6),
  nameCandidates: z.array(z.string()).max(5),
  suggestedTags: z.array(z.string()).max(10),
});

export const CHAT_TEMPLATE_REF_SCHEMA = STORED_FIELD_TEMPLATE_SCHEMA.pick({
  id: true,
  name: true,
  mode: true,
  fieldKeys: true,
  content: true,
});

export type iCharacterConcept = z.infer<typeof CHARACTER_CONCEPT_SCHEMA>;
export type iChatTemplateRef = z.infer<typeof CHAT_TEMPLATE_REF_SCHEMA>;

const CHARACTER_ASSISTANT_GENERATION_SETTINGS_SCHEMA = CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA.omit({
  instructions: true,
  messages: true,
});

export const CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA = CHARACTER_ASSISTANT_GENERATION_SETTINGS_SCHEMA.extend({
  characterId: z.string().trim().min(1),
  card: CHARACTER_CARD_SCHEMA,
  focus: CHARACTER_ASSISTANT_FOCUS_SCHEMA,
  messages: z.array(CHARACTER_ASSISTANT_MESSAGE_SCHEMA).min(1),
  generalCharacterIdea: z.string().optional(),
  contextAttachments: z.array(CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA).max(8).optional().default([]),
  guidedStep: GUIDED_STEP_ID_SCHEMA.optional(),
  concept: CHARACTER_CONCEPT_SCHEMA.optional(),
  templates: z.array(CHAT_TEMPLATE_REF_SCHEMA).max(4).optional().default([]),
});

export const CHARACTER_ASSISTANT_STREAM_EVENT_TYPE_SCHEMA = z.enum([
  'text-delta',
  'tool-call-start',
  'concept-recorded',
  'proposal',
  'tool-call-error',
  'complete',
  'error',
]);
export const CHARACTER_ASSISTANT_STREAM_EVENT_TYPES = CHARACTER_ASSISTANT_STREAM_EVENT_TYPE_SCHEMA.enum;

export const CHARACTER_ASSISTANT_TEXT_DELTA_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['text-delta']),
  textDelta: z.string(),
});

export const CHARACTER_ASSISTANT_TOOL_CALL_START_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['tool-call-start']),
  toolCallId: z.string(),
  toolName: CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA,
});

export const CHARACTER_ASSISTANT_CONCEPT_RECORDED_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['concept-recorded']),
  concept: CHARACTER_CONCEPT_SCHEMA,
});

export const CHARACTER_ASSISTANT_PROPOSAL_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_ASSISTANT_STREAM_EVENT_TYPES.proposal),
  proposal: CHARACTER_EDIT_PROPOSAL_SCHEMA,
});

export const CHARACTER_ASSISTANT_TOOL_CALL_ERROR_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_ASSISTANT_STREAM_EVENT_TYPES['tool-call-error']),
  toolCallId: z.string(),
  toolName: CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA,
  message: z.string(),
});

export const CHARACTER_ASSISTANT_COMPLETE_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_ASSISTANT_STREAM_EVENT_TYPES.complete),
  assistantMessage: z.string(),
  proposals: z.array(CHARACTER_EDIT_PROPOSAL_SCHEMA),
  concept: CHARACTER_CONCEPT_SCHEMA.optional(),
});

export const CHARACTER_ASSISTANT_ERROR_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_ASSISTANT_STREAM_EVENT_TYPES.error),
  message: z.string(),
});

export const CHARACTER_ASSISTANT_STREAM_EVENT_SCHEMA = z.discriminatedUnion('type', [
  CHARACTER_ASSISTANT_TEXT_DELTA_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_TOOL_CALL_START_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_CONCEPT_RECORDED_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_PROPOSAL_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_TOOL_CALL_ERROR_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_COMPLETE_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_ERROR_EVENT_SCHEMA,
]);

export type CharacterAssistantFocus = z.infer<typeof CHARACTER_ASSISTANT_FOCUS_SCHEMA>;
export type CharacterAssistantToolName = z.infer<typeof CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA>;
export type iCharacterAssistantContextAttachment = z.infer<typeof CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA>;
export type iCharacterAssistantConcept = z.infer<typeof CHARACTER_CONCEPT_SCHEMA>;
export type iCharacterAssistantMessage = z.infer<typeof CHARACTER_ASSISTANT_MESSAGE_SCHEMA>;
export type iCharacterAssistantStreamRequest = z.infer<typeof CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA>;
export type iCharacterAssistantStreamEvent = z.infer<typeof CHARACTER_ASSISTANT_STREAM_EVENT_SCHEMA>;
