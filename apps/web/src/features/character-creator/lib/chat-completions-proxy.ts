import { createServerFn } from '@tanstack/react-start';
import z from 'zod';

import {
  buildChatCompletionsHeaders,
  buildChatCompletionsPayload,
  normalizeChatCompletionsEndpoint,
} from './api-client';

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
