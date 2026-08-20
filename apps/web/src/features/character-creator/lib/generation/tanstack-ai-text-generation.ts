import { chat, EventType } from '@tanstack/ai';
import type { AnyServerTool, AnyTextAdapter, ChatMiddleware, ModelMessage, StreamChunk, UIMessage } from '@tanstack/ai';
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible';
import { createOpenRouterText } from '@tanstack/ai-openrouter';

import { normalizeOpenAiCompatibleBaseUrl } from '../provider/openai-compatible-endpoint';
import type { ProviderPolicyResolution } from '../provider/provider-policy-resolver';
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

export interface iCharacterChatOptions {
  adapter: AnyTextAdapter;
  messages: Array<ModelMessage | UIMessage>;
  systemPrompts: string[];
  modelOptions?: Record<string, unknown>;
  abortController: AbortController;
  stream: true;
  tools?: ReadonlyArray<AnyServerTool>;
  agentLoopStrategy?: NonNullable<Parameters<typeof chat>[0]['agentLoopStrategy']>;
  middleware?: ChatMiddleware[];
}

export type iCharacterChat = (options: iCharacterChatOptions) => AsyncIterable<StreamChunk>;

type OpenRouterTextConfig = NonNullable<Parameters<typeof createOpenRouterText>[2]>;

export interface iCharacterOpenRouterHttpClient {
  request: (request: Request) => Promise<Response>;
}

type iOpenRouterTextConfig = Omit<OpenRouterTextConfig, 'httpClient'> & {
  httpClient: iCharacterOpenRouterHttpClient;
};

export interface iCharacterTextGenerationDependencies {
  chat: iCharacterChat;
  openaiCompatibleText: (model: string, config: Parameters<typeof openaiCompatibleText>[1]) => AnyTextAdapter;
  createOpenRouterText: (model: string, apiKey: string, config: iOpenRouterTextConfig) => AnyTextAdapter;
  createOpenRouterHttpClient: () => iCharacterOpenRouterHttpClient;
}

export interface iCharacterTextGenerationService {
  createCharacterTextAdapter: (options: iCharacterTextAdapterOptions) => AnyTextAdapter;
  streamCharacterText: (options: iStreamCharacterTextOptions) => { textStream: ReadableStream<string> };
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
  const structuredOutputStream = adapter.structuredOutputStream?.bind(adapter);
  const supportsCombinedToolsAndSchema = adapter.supportsCombinedToolsAndSchema?.bind(adapter);

  return {
    ...adapter,
    chatStream: (options) => repairToolCallArguments(adapter.chatStream(options)),
    structuredOutput: async (options) => adapter.structuredOutput(options),
    ...(structuredOutputStream ? { structuredOutputStream } : {}),
    ...(supportsCombinedToolsAndSchema ? { supportsCombinedToolsAndSchema } : {}),
  };
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

export function createAgentRoleModelOptions(
  endpoint: string,
  generationSettings: iCharacterModelOptions,
  policyResolution: ProviderPolicyResolution,
) {
  if (!policyResolution.isEligible) {
    throw new Error(`Agent role endpoint is ineligible: ${policyResolution.failures[0]?.reason ?? 'unknown'}.`);
  }

  const modelOptions = createCharacterModelOptions(endpoint, generationSettings);
  if (policyResolution.isLocal || !policyResolution.routing) return modelOptions;

  return {
    ...modelOptions,
    provider: {
      only: policyResolution.routing.only,
      allowFallbacks: policyResolution.routing.allowFallbacks,
      dataCollection: policyResolution.routing.dataCollection,
      zdr: policyResolution.routing.zdr,
      requireParameters: policyResolution.routing.requireParameters,
    },
  };
}

async function* streamTextEvents(
  { signal, ...options }: iStreamCharacterTextOptions,
  dependencies: iCharacterTextGenerationDependencies,
  createAdapter: (options: iCharacterTextAdapterOptions) => AnyTextAdapter,
) {
  const { abortController, abort } = createAbortController(signal);
  const stream = dependencies.chat({
    adapter: createAdapter(options),
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

function createDefaultOpenRouterText(model: string, apiKey: string, config: iOpenRouterTextConfig): AnyTextAdapter {
  return createOpenRouterText(model as Parameters<typeof createOpenRouterText>[0], apiKey, {
    ...config,
    httpClient: config.httpClient as NonNullable<OpenRouterTextConfig['httpClient']>,
  });
}

const DEFAULT_CHARACTER_TEXT_GENERATION_DEPENDENCIES: iCharacterTextGenerationDependencies = {
  chat: (options) => chat(options),
  openaiCompatibleText: (model, config) => openaiCompatibleText(model, config),
  createOpenRouterText: createDefaultOpenRouterText,
  createOpenRouterHttpClient: () => createOpenRouterErrorPreservingHttpClient(),
};

export function createCharacterTextGenerationService(
  dependencies: iCharacterTextGenerationDependencies = DEFAULT_CHARACTER_TEXT_GENERATION_DEPENDENCIES,
): iCharacterTextGenerationService {
  const createAdapter = ({ endpoint, apiKey, model }: iCharacterTextAdapterOptions) => {
    const normalizedEndpoint = normalizeOpenAiCompatibleBaseUrl(endpoint);

    if (normalizedEndpoint.toLowerCase().includes('openrouter.ai/api')) {
      return withRepairedToolCallArguments(
        dependencies.createOpenRouterText(model.trim(), apiKey.trim(), {
          httpClient: dependencies.createOpenRouterHttpClient(),
        }),
      );
    }

    return withRepairedToolCallArguments(
      dependencies.openaiCompatibleText(model.trim(), {
        name: 'character-creator',
        baseURL: normalizedEndpoint,
        apiKey: apiKey.trim(),
        dangerouslyAllowBrowser: true,
      }),
    );
  };

  return {
    createCharacterTextAdapter: createAdapter,
    streamCharacterText: (options) => ({
      textStream: toTextReadableStream(
        suppressGenerationAbort(streamTextEvents(options, dependencies, createAdapter), options.signal),
      ),
    }),
  };
}

const DEFAULT_CHARACTER_TEXT_GENERATION_SERVICE = createCharacterTextGenerationService();

export function streamCharacterText(options: iStreamCharacterTextOptions) {
  return DEFAULT_CHARACTER_TEXT_GENERATION_SERVICE.streamCharacterText(options);
}

export function createCharacterTextAdapter(options: iCharacterTextAdapterOptions) {
  return DEFAULT_CHARACTER_TEXT_GENERATION_SERVICE.createCharacterTextAdapter(options);
}
