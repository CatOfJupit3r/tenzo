import { chat, EventType } from '@tanstack/ai';
import type { ModelMessage } from '@tanstack/ai';
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible';
import { createOpenRouterText } from '@tanstack/ai-openrouter';

import type { iCharacterGenerationStreamRequest } from './generation-stream-contracts';
import { normalizeOpenAiCompatibleBaseUrl } from './openai-compatible-endpoint';

export interface iStreamCharacterTextOptions extends iCharacterGenerationStreamRequest {
  signal?: AbortSignal;
}

interface iCharacterTextAdapterOptions {
  endpoint: string;
  apiKey: string;
  model: string;
}

interface iCharacterModelOptions {
  maxTokens: number;
  temperature: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  topK: number;
  minP: number;
  shouldSendDisabledSamplers?: boolean;
}

const OPENROUTER_PROVIDER_PRIVACY_OPTIONS = {
  data_collection: 'deny',
  zdr: true,
} as const;

function buildSamplerOverrides({
  topK,
  minP,
  shouldSendDisabledSamplers = false,
}: Pick<iCharacterModelOptions, 'topK' | 'minP' | 'shouldSendDisabledSamplers'>) {
  return {
    ...(topK > 0 || shouldSendDisabledSamplers ? { top_k: topK } : {}),
    ...(minP > 0 || shouldSendDisabledSamplers ? { min_p: minP } : {}),
  };
}

function createAbortController(signal?: AbortSignal) {
  const abortController = new AbortController();
  const abort = () => abortController.abort(signal?.reason);

  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener('abort', abort, { once: true });
  }

  return { abortController, abort };
}

function readSystemPrompts({ messages, instructions }: Pick<iStreamCharacterTextOptions, 'messages' | 'instructions'>) {
  return [
    ...(instructions ? [instructions] : []),
    ...messages.filter((message) => message.role === 'system').map((message) => message.content),
  ];
}

function toModelMessages(messages: iCharacterGenerationStreamRequest['messages']): ModelMessage[] {
  return messages.flatMap((message) =>
    message.role === 'system' ? [] : [{ role: message.role, content: message.content }],
  );
}

function toTextReadableStream(iterable: AsyncIterable<string>) {
  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const content of iterable) {
          controller.enqueue(content);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export function createCharacterTextAdapter({ endpoint, apiKey, model }: iCharacterTextAdapterOptions) {
  const normalizedEndpoint = normalizeOpenAiCompatibleBaseUrl(endpoint);

  if (normalizedEndpoint.toLowerCase().includes('openrouter.ai/api')) {
    return createOpenRouterText(model.trim() as Parameters<typeof createOpenRouterText>[0], apiKey.trim());
  }

  return openaiCompatibleText(model.trim(), {
    name: 'character-creator',
    baseURL: normalizedEndpoint,
    apiKey: apiKey.trim(),
    dangerouslyAllowBrowser: true,
  });
}

export function createCharacterModelOptions(
  endpoint: string,
  {
    maxTokens,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    topK,
    minP,
    shouldSendDisabledSamplers = false,
  }: iCharacterModelOptions,
) {
  const isOpenRouter = normalizeOpenAiCompatibleBaseUrl(endpoint).toLowerCase().includes('openrouter.ai/api');

  if (isOpenRouter) {
    return {
      maxCompletionTokens: Math.max(1, Math.floor(maxTokens)),
      temperature,
      topP,
      frequencyPenalty,
      presencePenalty,
      provider: OPENROUTER_PROVIDER_PRIVACY_OPTIONS,
    };
  }

  return {
    max_tokens: Math.max(1, Math.floor(maxTokens)),
    temperature,
    top_p: topP,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
    ...buildSamplerOverrides({ topK, minP, shouldSendDisabledSamplers }),
  };
}

async function* streamTextEvents({ signal, ...options }: iStreamCharacterTextOptions) {
  const { abortController, abort } = createAbortController(signal);
  const stream = chat({
    adapter: createCharacterTextAdapter(options),
    messages: toModelMessages(options.messages),
    systemPrompts: readSystemPrompts(options),
    modelOptions: createCharacterModelOptions(options.endpoint, options),
    abortController,
    stream: true,
  });

  try {
    for await (const chunk of stream) {
      if (chunk.type === EventType.TEXT_MESSAGE_CONTENT && chunk.delta) {
        yield chunk.delta;
      } else if (chunk.type === EventType.RUN_ERROR) {
        throw new Error(chunk.message);
      }
    }
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

export function streamCharacterText(options: iStreamCharacterTextOptions) {
  return {
    textStream: toTextReadableStream(streamTextEvents(options)),
  };
}
