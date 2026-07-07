import { z } from 'zod';

import {
  FREQUENCY_PENALTY_RANGE,
  MIN_P_RANGE,
  PRESENCE_PENALTY_RANGE,
  TEMPERATURE_RANGE,
  TOP_K_RANGE,
  TOP_P_RANGE,
} from './generation-config';

export const GENERATION_STREAM_MESSAGE_SCHEMA = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

export const CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA = z.object({
  endpoint: z.string().trim().min(1),
  apiKey: z.string().trim().min(1),
  model: z.string().trim().min(1),
  maxTokens: z.number().int().positive(),
  messages: z.array(GENERATION_STREAM_MESSAGE_SCHEMA).min(1),
  temperature: z.number().min(TEMPERATURE_RANGE.min).max(TEMPERATURE_RANGE.max),
  topP: z.number().min(TOP_P_RANGE.min).max(TOP_P_RANGE.max),
  frequencyPenalty: z.number().min(FREQUENCY_PENALTY_RANGE.min).max(FREQUENCY_PENALTY_RANGE.max),
  presencePenalty: z.number().min(PRESENCE_PENALTY_RANGE.min).max(PRESENCE_PENALTY_RANGE.max),
  topK: z.number().min(TOP_K_RANGE.min).max(TOP_K_RANGE.max),
  minP: z.number().min(MIN_P_RANGE.min).max(MIN_P_RANGE.max),
  shouldSendDisabledSamplers: z.boolean().optional(),
});

export type iCharacterGenerationStreamRequest = z.infer<typeof CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA>;
