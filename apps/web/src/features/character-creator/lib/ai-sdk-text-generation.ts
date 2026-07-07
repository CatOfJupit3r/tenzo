import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import type { ModelMessage } from 'ai';

import type { iCharacterGenerationStreamRequest } from './generation-stream-contracts';
import { normalizeOpenAiCompatibleBaseUrl } from './openai-compatible-endpoint';

export interface iStreamCharacterTextOptions extends iCharacterGenerationStreamRequest {
  signal?: AbortSignal;
}

interface iCharacterLanguageModelOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  topK: number;
  minP: number;
  shouldSendDisabledSamplers?: boolean;
}

function toModelMessage(message: iCharacterGenerationStreamRequest['messages'][number]): ModelMessage {
  return {
    role: message.role,
    content: message.content,
  };
}

function buildSamplerOverrides({
  topK,
  minP,
  shouldSendDisabledSamplers = false,
}: Pick<iStreamCharacterTextOptions, 'topK' | 'minP' | 'shouldSendDisabledSamplers'>) {
  return {
    ...(topK > 0 || shouldSendDisabledSamplers ? { top_k: topK } : {}),
    ...(minP > 0 || shouldSendDisabledSamplers ? { min_p: minP } : {}),
  };
}

export function streamCharacterText({
  endpoint,
  apiKey,
  model,
  maxTokens,
  messages,
  temperature,
  topP,
  frequencyPenalty,
  presencePenalty,
  topK,
  minP,
  shouldSendDisabledSamplers = false,
  signal,
}: iStreamCharacterTextOptions) {
  return streamText({
    model: createCharacterLanguageModel({
      endpoint,
      apiKey,
      model,
      topK,
      minP,
      shouldSendDisabledSamplers,
    }),
    messages: messages.map(toModelMessage),
    maxOutputTokens: Math.max(1, Math.floor(maxTokens)),
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    abortSignal: signal,
  });
}

export function createCharacterLanguageModel({
  endpoint,
  apiKey,
  model,
  topK,
  minP,
  shouldSendDisabledSamplers = false,
}: iCharacterLanguageModelOptions) {
  const provider = createOpenAICompatible({
    name: 'characterCreator',
    baseURL: normalizeOpenAiCompatibleBaseUrl(endpoint),
    apiKey: apiKey.trim(),
    transformRequestBody: (body) => ({
      ...body,
      ...buildSamplerOverrides({
        topK,
        minP,
        shouldSendDisabledSamplers,
      }),
    }),
  });

  return provider.chatModel(model.trim());
}
