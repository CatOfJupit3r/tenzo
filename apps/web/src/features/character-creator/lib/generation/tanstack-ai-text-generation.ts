import { chat, EventType } from '@tanstack/ai';
import type { AnyTextAdapter, ModelMessage, StreamChunk } from '@tanstack/ai';
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible';
import { createOpenRouterText } from '@tanstack/ai-openrouter';

import { normalizeOpenAiCompatibleBaseUrl } from '../provider/openai-compatible-endpoint';
import { suppressGenerationAbort } from './abort-safe-stream';
import type { iCharacterGenerationStreamRequest } from './generation-stream-contracts';
import { repairJson } from './json-repair';
import { createOpenRouterErrorPreservingHttpClient } from './openrouter-stream-error';

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
  openRouterProvider?: string;
}

const OPENROUTER_PROVIDER_PRIVACY_OPTIONS = {
  dataCollection: 'deny',
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

async function* repairToolCallArguments(stream: AsyncIterable<StreamChunk>): AsyncGenerator<StreamChunk> {
  const argumentBuffers = new Map<string, string>();

  function* flushArguments(toolCallId: string) {
    const rawArguments = argumentBuffers.get(toolCallId);
    if (rawArguments === undefined) return;
    argumentBuffers.delete(toolCallId);

    let repairedArguments = rawArguments;
    try {
      repairedArguments = repairJson(rawArguments.trim() || '{}');
    } catch {
      // Preserve the provider payload so the runtime can report the original parse error.
    }
    yield { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: repairedArguments } as StreamChunk;
  }

  for await (const chunk of stream) {
    if (chunk.type === EventType.TOOL_CALL_ARGS) {
      argumentBuffers.set(chunk.toolCallId, `${argumentBuffers.get(chunk.toolCallId) ?? ''}${chunk.delta}`);
      continue;
    }
    if (chunk.type === EventType.TOOL_CALL_END) {
      if (chunk.input === undefined) yield* flushArguments(chunk.toolCallId);
      else argumentBuffers.delete(chunk.toolCallId);
    } else if (chunk.type === EventType.RUN_FINISHED) {
      for (const toolCallId of [...argumentBuffers.keys()]) yield* flushArguments(toolCallId);
    }
    yield chunk;
  }
}

export function withRepairedToolCallArguments(adapter: AnyTextAdapter): AnyTextAdapter {
  return new Proxy(adapter, {
    get(target, property) {
      if (property === 'chatStream') {
        return (options: Parameters<AnyTextAdapter['chatStream']>[0]) =>
          repairToolCallArguments(target.chatStream(options));
      }
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== 'function') return value;
      const method = value as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => Reflect.apply(method, target, args);
    },
  });
}

export function createCharacterTextAdapter({ endpoint, apiKey, model }: iCharacterTextAdapterOptions) {
  const normalizedEndpoint = normalizeOpenAiCompatibleBaseUrl(endpoint);

  if (normalizedEndpoint.toLowerCase().includes('openrouter.ai/api')) {
    return withRepairedToolCallArguments(
      createOpenRouterText(model.trim() as Parameters<typeof createOpenRouterText>[0], apiKey.trim(), {
        httpClient: createOpenRouterErrorPreservingHttpClient() as NonNullable<
          Parameters<typeof createOpenRouterText>[2]
        >['httpClient'],
      }),
    );
  }

  return withRepairedToolCallArguments(
    openaiCompatibleText(model.trim(), {
      name: 'character-creator',
      baseURL: normalizedEndpoint,
      apiKey: apiKey.trim(),
      dangerouslyAllowBrowser: true,
    }),
  );
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
    openRouterProvider,
  }: iCharacterModelOptions,
) {
  const isOpenRouter = normalizeOpenAiCompatibleBaseUrl(endpoint).toLowerCase().includes('openrouter.ai/api');

  if (isOpenRouter) {
    return {
      maxTokens: Math.max(1, Math.floor(maxTokens)),
      temperature,
      topP,
      frequencyPenalty,
      presencePenalty,
      provider: {
        ...OPENROUTER_PROVIDER_PRIVACY_OPTIONS,
        ...(openRouterProvider?.trim() ? { only: [openRouterProvider.trim()] } : {}),
      },
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

export function createCharacterStructuredModelOptions(endpoint: string, generationSettings: iCharacterModelOptions) {
  const modelOptions = createCharacterModelOptions(endpoint, generationSettings);
  const isOpenRouter = normalizeOpenAiCompatibleBaseUrl(endpoint).toLowerCase().includes('openrouter.ai/api');
  if (!isOpenRouter) {
    return modelOptions;
  }
  return {
    ...modelOptions,
    plugins: [{ id: 'response-healing' as const }],
    provider: {
      ...modelOptions.provider,
      requireParameters: true,
    },
  };
}

export function createCharacterToolModelOptions(endpoint: string, generationSettings: iCharacterModelOptions) {
  const modelOptions = createCharacterModelOptions(endpoint, generationSettings);
  const isOpenRouter = normalizeOpenAiCompatibleBaseUrl(endpoint).toLowerCase().includes('openrouter.ai/api');
  if (!isOpenRouter) {
    return modelOptions;
  }
  return {
    ...modelOptions,
    provider: {
      ...modelOptions.provider,
      requireParameters: true,
    },
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
    textStream: toTextReadableStream(suppressGenerationAbort(streamTextEvents(options), options.signal)),
  };
}
