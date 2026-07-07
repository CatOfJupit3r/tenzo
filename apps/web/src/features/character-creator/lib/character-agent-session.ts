import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import { CHARACTER_CARD_SCHEMA } from './card-schema';

export const CHARACTER_AGENT_MESSAGE_ROLE_SCHEMA = z.enum(['user', 'assistant']);
export const CHARACTER_AGENT_MESSAGE_ROLES = CHARACTER_AGENT_MESSAGE_ROLE_SCHEMA.enum;
export type CharacterAgentMessageRole = z.infer<typeof CHARACTER_AGENT_MESSAGE_ROLE_SCHEMA>;

export const CHARACTER_AGENT_TOOL_NAME_SCHEMA = z.enum([
  'read_character',
  'update_character_fields',
  'replace_tags',
  'replace_alternate_greetings',
  'replace_custom_fields',
]);
export const CHARACTER_AGENT_TOOL_NAMES = CHARACTER_AGENT_TOOL_NAME_SCHEMA.enum;
export type CharacterAgentToolName = z.infer<typeof CHARACTER_AGENT_TOOL_NAME_SCHEMA>;

export const CHARACTER_AGENT_MESSAGE_SCHEMA = z.object({
  id: z.string(),
  role: CHARACTER_AGENT_MESSAGE_ROLE_SCHEMA,
  content: z.string(),
  createdAt: z.string(),
});

export const CHARACTER_AGENT_TOOL_EVENT_STATUS_SCHEMA = z.enum(['pending', 'done', 'error']);
export const CHARACTER_AGENT_TOOL_EVENT_STATUSES = CHARACTER_AGENT_TOOL_EVENT_STATUS_SCHEMA.enum;
export type CharacterAgentToolEventStatus = z.infer<typeof CHARACTER_AGENT_TOOL_EVENT_STATUS_SCHEMA>;

export const CHARACTER_AGENT_TOOL_EVENT_SCHEMA = z.object({
  id: z.string(),
  toolCallId: z.string(),
  toolName: CHARACTER_AGENT_TOOL_NAME_SCHEMA,
  status: CHARACTER_AGENT_TOOL_EVENT_STATUS_SCHEMA,
  inputSummary: z.string(),
  outputSummary: z.string(),
  createdAt: z.string(),
});

export const CHARACTER_AGENT_SESSION_SCHEMA = z.object({
  id: z.string(),
  characterId: z.string(),
  draftCard: CHARACTER_CARD_SCHEMA,
  messages: z.array(CHARACTER_AGENT_MESSAGE_SCHEMA),
  toolEvents: z.array(CHARACTER_AGENT_TOOL_EVENT_SCHEMA),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type iCharacterAgentMessage = z.infer<typeof CHARACTER_AGENT_MESSAGE_SCHEMA>;
export type iCharacterAgentToolEvent = z.infer<typeof CHARACTER_AGENT_TOOL_EVENT_SCHEMA>;
export type iCharacterAgentSession = z.infer<typeof CHARACTER_AGENT_SESSION_SCHEMA>;

export function createCharacterAgentSession({
  characterId,
  card,
}: {
  characterId: string;
  card: z.infer<typeof CHARACTER_CARD_SCHEMA>;
}): iCharacterAgentSession {
  const now = new Date().toISOString();

  return {
    id: generateUuid(),
    characterId,
    draftCard: structuredClone(card),
    messages: [],
    toolEvents: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createCharacterAgentMessage({
  role,
  content,
}: {
  role: CharacterAgentMessageRole;
  content: string;
}): iCharacterAgentMessage {
  return {
    id: generateUuid(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function createCharacterAgentToolEvent({
  toolCallId,
  toolName,
  inputSummary,
  outputSummary,
}: {
  toolCallId: string;
  toolName: CharacterAgentToolName;
  inputSummary: string;
  outputSummary: string;
}): iCharacterAgentToolEvent {
  return {
    id: generateUuid(),
    toolCallId,
    toolName,
    status: CHARACTER_AGENT_TOOL_EVENT_STATUSES.done,
    inputSummary,
    outputSummary,
    createdAt: new Date().toISOString(),
  };
}

export function createPendingCharacterAgentToolEvent({
  toolCallId,
  toolName,
}: {
  toolCallId: string;
  toolName: CharacterAgentToolName;
}): iCharacterAgentToolEvent {
  return {
    id: generateUuid(),
    toolCallId,
    toolName,
    status: CHARACTER_AGENT_TOOL_EVENT_STATUSES.pending,
    inputSummary: '',
    outputSummary: '',
    createdAt: new Date().toISOString(),
  };
}

export function createFailedCharacterAgentToolEvent({
  toolCallId,
  toolName,
  message,
}: {
  toolCallId: string;
  toolName: CharacterAgentToolName;
  message: string;
}): iCharacterAgentToolEvent {
  return {
    id: generateUuid(),
    toolCallId,
    toolName,
    status: CHARACTER_AGENT_TOOL_EVENT_STATUSES.error,
    inputSummary: '',
    outputSummary: message,
    createdAt: new Date().toISOString(),
  };
}
