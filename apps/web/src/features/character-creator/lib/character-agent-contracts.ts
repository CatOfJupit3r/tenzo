import { z } from 'zod';

import { CHARACTER_CARD_SCHEMA } from './card-schema';
import { CHARACTER_AGENT_MESSAGE_SCHEMA, CHARACTER_AGENT_TOOL_EVENT_SCHEMA } from './character-agent-session';
import {
  FREQUENCY_PENALTY_RANGE,
  MIN_P_RANGE,
  PRESENCE_PENALTY_RANGE,
  TEMPERATURE_RANGE,
  TOP_K_RANGE,
  TOP_P_RANGE,
} from './generation-config';

export const CHARACTER_AGENT_STREAM_REQUEST_SCHEMA = z.object({
  endpoint: z.string().trim().min(1),
  apiKey: z.string().trim().min(1),
  model: z.string().trim().min(1),
  maxTokens: z.number().int().positive(),
  temperature: z.number().min(TEMPERATURE_RANGE.min).max(TEMPERATURE_RANGE.max),
  topP: z.number().min(TOP_P_RANGE.min).max(TOP_P_RANGE.max),
  frequencyPenalty: z.number().min(FREQUENCY_PENALTY_RANGE.min).max(FREQUENCY_PENALTY_RANGE.max),
  presencePenalty: z.number().min(PRESENCE_PENALTY_RANGE.min).max(PRESENCE_PENALTY_RANGE.max),
  topK: z.number().min(TOP_K_RANGE.min).max(TOP_K_RANGE.max),
  minP: z.number().min(MIN_P_RANGE.min).max(MIN_P_RANGE.max),
  shouldSendDisabledSamplers: z.boolean().optional(),
  generalCharacterIdea: z.string().optional(),
  draftCard: CHARACTER_CARD_SCHEMA,
  messages: z.array(CHARACTER_AGENT_MESSAGE_SCHEMA).min(1),
});

export const CHARACTER_AGENT_STREAM_EVENT_TYPE_SCHEMA = z.enum(['text-delta', 'tool-event', 'complete', 'error']);
export const CHARACTER_AGENT_STREAM_EVENT_TYPES = CHARACTER_AGENT_STREAM_EVENT_TYPE_SCHEMA.enum;

export const CHARACTER_AGENT_TEXT_DELTA_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_AGENT_STREAM_EVENT_TYPES['text-delta']),
  textDelta: z.string(),
});

export const CHARACTER_AGENT_TOOL_EVENT_STREAM_SCHEMA = z.object({
  type: z.literal(CHARACTER_AGENT_STREAM_EVENT_TYPES['tool-event']),
  toolEvent: CHARACTER_AGENT_TOOL_EVENT_SCHEMA,
  draftCard: CHARACTER_CARD_SCHEMA,
});

export const CHARACTER_AGENT_COMPLETE_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_AGENT_STREAM_EVENT_TYPES.complete),
  assistantMessage: z.string(),
  draftCard: CHARACTER_CARD_SCHEMA,
});

export const CHARACTER_AGENT_ERROR_EVENT_SCHEMA = z.object({
  type: z.literal(CHARACTER_AGENT_STREAM_EVENT_TYPES.error),
  message: z.string(),
});

export const CHARACTER_AGENT_STREAM_EVENT_SCHEMA = z.discriminatedUnion('type', [
  CHARACTER_AGENT_TEXT_DELTA_EVENT_SCHEMA,
  CHARACTER_AGENT_TOOL_EVENT_STREAM_SCHEMA,
  CHARACTER_AGENT_COMPLETE_EVENT_SCHEMA,
  CHARACTER_AGENT_ERROR_EVENT_SCHEMA,
]);

export type iCharacterAgentStreamRequest = z.infer<typeof CHARACTER_AGENT_STREAM_REQUEST_SCHEMA>;
export type iCharacterAgentStreamEvent = z.infer<typeof CHARACTER_AGENT_STREAM_EVENT_SCHEMA>;
