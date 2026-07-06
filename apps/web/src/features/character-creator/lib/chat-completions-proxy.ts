import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

import {
  buildChatCompletionsHeaders,
  buildChatCompletionsPayload,
  normalizeChatCompletionsEndpoint,
} from './api-client';
import {
  FREQUENCY_PENALTY_RANGE,
  MIN_P_RANGE,
  PRESENCE_PENALTY_RANGE,
  TEMPERATURE_RANGE,
  TOP_K_RANGE,
  TOP_P_RANGE,
} from './generation-config';

const generationMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string(),
});

const chatCompletionsProxyInputSchema = z.object({
  endpoint: z.string().trim().min(1),
  apiKey: z.string().trim().min(1),
  model: z.string().trim().min(1),
  maxTokens: z.number().int().positive(),
  messages: z.array(generationMessageSchema).min(1),
  temperature: z.number().min(TEMPERATURE_RANGE.min).max(TEMPERATURE_RANGE.max),
  topP: z.number().min(TOP_P_RANGE.min).max(TOP_P_RANGE.max),
  frequencyPenalty: z.number().min(FREQUENCY_PENALTY_RANGE.min).max(FREQUENCY_PENALTY_RANGE.max),
  presencePenalty: z.number().min(PRESENCE_PENALTY_RANGE.min).max(PRESENCE_PENALTY_RANGE.max),
  topK: z.number().min(TOP_K_RANGE.min).max(TOP_K_RANGE.max),
  minP: z.number().min(MIN_P_RANGE.min).max(MIN_P_RANGE.max),
  shouldSendDisabledSamplers: z.boolean().optional(),
});

export const requestChatCompletionsProxy = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => chatCompletionsProxyInputSchema.parse(data))
  .handler(async ({ data, signal }) => {
    const providerResponse = await fetch(normalizeChatCompletionsEndpoint(data.endpoint), {
      method: 'POST',
      headers: buildChatCompletionsHeaders(data.apiKey),
      body: JSON.stringify(buildChatCompletionsPayload(data)),
      signal,
    });

    const responseHeaders = new Headers(providerResponse.headers);
    responseHeaders.set('Cache-Control', 'no-store');

    return new Response(providerResponse.body, {
      status: providerResponse.status,
      statusText: providerResponse.statusText,
      headers: responseHeaders,
    });
  });
