import { z } from 'zod';

import { CHARACTER_CARD_SCHEMA } from './card-schema';
import { CHARACTER_EDIT_FIELD_KEY_SCHEMA, CHARACTER_EDIT_PROPOSAL_SCHEMA } from './character-edit-proposal';
import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from './generation-stream-contracts';

export const CHARACTER_ASSISTANT_FOCUS_KIND_SCHEMA = z.enum(['card', 'field']);
export const CHARACTER_ASSISTANT_FOCUS_KINDS = CHARACTER_ASSISTANT_FOCUS_KIND_SCHEMA.enum;

export const CHARACTER_ASSISTANT_FOCUS_SCHEMA = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(CHARACTER_ASSISTANT_FOCUS_KINDS.card),
  }),
  z.object({
    kind: z.literal(CHARACTER_ASSISTANT_FOCUS_KINDS.field),
    fieldKey: CHARACTER_EDIT_FIELD_KEY_SCHEMA,
  }),
]);

export const CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KIND_SCHEMA = z.enum(['manga_synthesis']);
export const CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KINDS = CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_KIND_SCHEMA.enum;

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
  'propose_character_fields',
  'propose_tags',
  'propose_alternate_greetings',
  'propose_custom_fields',
  'propose_character_book',
]);
export const CHARACTER_ASSISTANT_TOOL_NAMES = CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA.enum;

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
});

export const CHARACTER_ASSISTANT_STREAM_EVENT_TYPE_SCHEMA = z.enum([
  'text-delta',
  'tool-call-start',
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
});

export const CHARACTER_ASSISTANT_ERROR_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_ASSISTANT_STREAM_EVENT_TYPES.error),
  message: z.string(),
});

export const CHARACTER_ASSISTANT_STREAM_EVENT_SCHEMA = z.discriminatedUnion('type', [
  CHARACTER_ASSISTANT_TEXT_DELTA_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_TOOL_CALL_START_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_PROPOSAL_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_TOOL_CALL_ERROR_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_COMPLETE_EVENT_SCHEMA,
  CHARACTER_ASSISTANT_ERROR_EVENT_SCHEMA,
]);

export type CharacterAssistantFocus = z.infer<typeof CHARACTER_ASSISTANT_FOCUS_SCHEMA>;
export type CharacterAssistantToolName = z.infer<typeof CHARACTER_ASSISTANT_TOOL_NAME_SCHEMA>;
export type iCharacterAssistantContextAttachment = z.infer<typeof CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA>;
export type iCharacterAssistantMessage = z.infer<typeof CHARACTER_ASSISTANT_MESSAGE_SCHEMA>;
export type iCharacterAssistantStreamRequest = z.infer<typeof CHARACTER_ASSISTANT_STREAM_REQUEST_SCHEMA>;
export type iCharacterAssistantStreamEvent = z.infer<typeof CHARACTER_ASSISTANT_STREAM_EVENT_SCHEMA>;
