import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { chat, EventType } from '@tanstack/ai';
import { createOpenRouterText } from '@tanstack/ai-openrouter';
import { streamText } from 'ai';
import type { ModelMessage } from 'ai';

import { GENERATION_PROVIDERS } from './generation-config';
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

function readInstructionText(instructions: iStreamCharacterTextOptions['instructions']) {
  if (!instructions) {
    return [];
  }

  if (typeof instructions === 'string') {
    return [instructions];
  }

  const instructionMessages = Array.isArray(instructions) ? instructions : [instructions];

  return instructionMessages.map((message) => message.content);
}

async function* streamOpenRouterText({
  apiKey,
  model,
  maxTokens,
  messages,
  temperature,
  topP,
  frequencyPenalty,
  presencePenalty,
  signal,
  instructions,
}: iStreamCharacterTextOptions) {
  const abortController = new AbortController();
  const abort = () => abortController.abort(signal?.reason);

  if (signal?.aborted) {
    abort();
  } else {
    signal?.addEventListener('abort', abort, { once: true });
  }

  const systemPrompts = [
    ...readInstructionText(instructions),
    ...messages.filter((message) => message.role === 'system').map((message) => message.content),
  ];
  const stream = chat({
    adapter: createOpenRouterText(model.trim() as Parameters<typeof createOpenRouterText>[0], apiKey.trim()),
    messages: messages.flatMap((message) =>
      message.role === 'system' ? [] : [{ role: message.role, content: message.content }],
    ),
    systemPrompts,
    modelOptions: {
      maxCompletionTokens: Math.max(1, Math.floor(maxTokens)),
      temperature,
      topP,
      frequencyPenalty,
      presencePenalty,
    },
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

export function streamCharacterText({
  provider,
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
  instructions,
}: iStreamCharacterTextOptions) {
  if (provider === GENERATION_PROVIDERS.openrouter) {
    return {
      textStream: toTextReadableStream(
        streamOpenRouterText({
          provider,
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
          shouldSendDisabledSamplers,
          signal,
          instructions,
        }),
      ),
    };
  }

  return streamText({
    model: createCharacterLanguageModel({
      endpoint,
      apiKey,
      model,
      topK,
      minP,
      shouldSendDisabledSamplers,
    }),
    instructions,
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
    supportsStructuredOutputs: true,
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
