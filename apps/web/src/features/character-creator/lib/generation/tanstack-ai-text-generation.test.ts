import { EventType } from '@tanstack/ai';
import type { AnyTextAdapter, StreamChunk } from '@tanstack/ai';
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible';
import { describe, expect, it } from 'vitest';

import { GENERATION_PROVIDERS } from './generation-config';
import { createOpenRouterErrorPreservingHttpClient } from './openrouter-stream-error';
import {
  createCharacterModelOptions,
  createCharacterStructuredModelOptions,
  createCharacterTextGenerationService,
  createCharacterToolModelOptions,
  withRepairedToolCallArguments,
} from './tanstack-ai-text-generation';
import type { iCharacterChatOptions, iCharacterTextGenerationDependencies } from './tanstack-ai-text-generation';

function createHarness() {
  const chatCalls: iCharacterChatOptions[] = [];
  const openAiCalls: Array<{ model: string; config: Parameters<typeof openaiCompatibleText>[1] }> = [];
  const openRouterCalls: Array<{ model: string; apiKey: string; config: Record<string, unknown> }> = [];
  let stream: AsyncIterable<StreamChunk> = {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<StreamChunk>> {
          return { done: true, value: undefined };
        },
      };
    },
  };
  const adapter = openaiCompatibleText('test-model', {
    name: 'character-creator',
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'key',
    dangerouslyAllowBrowser: true,
  });
  const dependencies: iCharacterTextGenerationDependencies = {
    chat: (options) => {
      chatCalls.push(options);
      return stream;
    },
    openaiCompatibleText: (model, config) => {
      openAiCalls.push({ model, config });
      return adapter;
    },
    createOpenRouterText: (model, apiKey, config) => {
      openRouterCalls.push({ model, apiKey, config });
      return adapter;
    },
    createOpenRouterHttpClient: createOpenRouterErrorPreservingHttpClient,
  };
  return {
    chatCalls,
    openAiCalls,
    openRouterCalls,
    setStream(value: AsyncIterable<StreamChunk>) {
      stream = value;
    },
    service: createCharacterTextGenerationService(dependencies),
  };
}

describe('TanStack AI text generation', () => {
  it('preserves prototype-backed structured output capabilities', async () => {
    const structuredValue = { cards: [{ title: 'Structured card' }] };
    const adapter = Object.assign(
      Object.create({
        async structuredOutput(this: AnyTextAdapter) {
          expect(this).toBe(adapter);
          return { data: structuredValue, rawText: JSON.stringify(structuredValue) };
        },
        supportsCombinedToolsAndSchema(this: AnyTextAdapter) {
          expect(this).toBe(adapter);
          return true;
        },
      }) as AnyTextAdapter,
      {
        kind: 'text' as const,
        name: 'prototype-adapter',
        model: 'test-model',
        chatStream: () =>
          (async function* completedStream(): AsyncGenerator<StreamChunk> {
            yield { type: EventType.RUN_FINISHED } as StreamChunk;
          })(),
      },
    );

    const repairedAdapter = withRepairedToolCallArguments(adapter);

    await expect(repairedAdapter.structuredOutput({} as never)).resolves.toEqual({
      data: structuredValue,
      rawText: JSON.stringify(structuredValue),
    });
    expect(repairedAdapter.supportsCombinedToolsAndSchema?.()).toBe(true);
  });

  it('repairs streamed native tool-call arguments before the runtime parses them', async () => {
    const adapter = withRepairedToolCallArguments(
      Object.assign(
        openaiCompatibleText('test-model', {
          name: 'character-creator',
          baseURL: 'http://localhost:11434/v1',
          apiKey: 'key',
          dangerouslyAllowBrowser: true,
        }),
        {
          chatStream: () =>
            (async function* streamChunks(): AsyncGenerator<StreamChunk> {
              yield {
                type: EventType.TOOL_CALL_START,
                toolCallId: 'call-1',
                toolCallName: 'propose_character_fields',
              } as StreamChunk;
              yield {
                type: EventType.TOOL_CALL_ARGS,
                toolCallId: 'call-1',
                delta: "{changes:[{fieldKey:'descr",
              } as StreamChunk;
              yield {
                type: EventType.TOOL_CALL_ARGS,
                toolCallId: 'call-1',
                delta: "iption',value:'Ready'}]}",
              } as StreamChunk;
              yield {
                type: EventType.TOOL_CALL_END,
                toolCallId: 'call-1',
                toolCallName: 'propose_character_fields',
              } as StreamChunk;
            })(),
        },
      ),
    );

    const chunks: StreamChunk[] = [];
    for await (const chunk of adapter.chatStream({} as never)) chunks.push(chunk);

    expect(chunks).toEqual([
      expect.objectContaining({ type: EventType.TOOL_CALL_START }),
      {
        type: EventType.TOOL_CALL_ARGS,
        toolCallId: 'call-1',
        delta: '{"changes":[{"fieldKey":"description","value":"Ready"}]}',
      },
      expect.objectContaining({ type: EventType.TOOL_CALL_END }),
    ]);
  });

  it('creates a typed OpenAI-compatible adapter with a normalized endpoint', () => {
    const harness = createHarness();
    harness.service.createCharacterTextAdapter({
      endpoint: 'http://localhost:5001',
      apiKey: 'local-key',
      model: 'local-model',
    });

    expect(harness.openAiCalls).toHaveLength(1);
    expect(harness.openAiCalls[0]).toEqual({
      model: 'local-model',
      config: {
        name: 'character-creator',
        baseURL: 'http://localhost:5001/v1',
        apiKey: 'local-key',
        dangerouslyAllowBrowser: true,
      },
    });
  });

  it('uses the dedicated OpenRouter adapter and privacy routing', () => {
    const harness = createHarness();
    harness.service.createCharacterTextAdapter({
      endpoint: 'https://openrouter.ai/api',
      apiKey: 'sk-or-v1-test',
      model: 'anthropic/claude-sonnet-4',
    });

    expect(harness.openRouterCalls).toHaveLength(1);
    expect(harness.openRouterCalls[0]).toEqual(
      expect.objectContaining({
        model: 'anthropic/claude-sonnet-4',
        apiKey: 'sk-or-v1-test',
        config: expect.objectContaining({ httpClient: expect.objectContaining({ request: expect.any(Function) }) }),
      }),
    );
    expect(
      createCharacterModelOptions('https://openrouter.ai/api', {
        maxTokens: 400,
        temperature: 0.8,
        topP: 0.9,
        frequencyPenalty: 0,
        presencePenalty: 0,
        topK: 0,
        minP: 0,
      }),
    ).toMatchObject({
      maxTokens: 400,
      provider: { dataCollection: 'deny', zdr: true },
    });
  });

  it('enables OpenRouter response healing and parameter-aware routing for structured output', () => {
    expect(
      createCharacterStructuredModelOptions('https://openrouter.ai/api', {
        maxTokens: 400,
        temperature: 0.8,
        topP: 0.9,
        frequencyPenalty: 0,
        presencePenalty: 0,
        topK: 0,
        minP: 0,
      }),
    ).toMatchObject({
      plugins: [{ id: 'response-healing' }],
      provider: { dataCollection: 'deny', zdr: true, requireParameters: true },
    });
  });

  it('restricts OpenRouter tool requests to providers that support every requested parameter', () => {
    expect(
      createCharacterToolModelOptions('https://openrouter.ai/api', {
        maxTokens: 400,
        temperature: 0.8,
        topP: 0.9,
        frequencyPenalty: 0,
        presencePenalty: 0,
        topK: 0,
        minP: 0,
      }),
    ).toMatchObject({
      provider: { dataCollection: 'deny', zdr: true, requireParameters: true },
    });
  });

  it('restricts OpenRouter requests to the selected routing provider', () => {
    expect(
      createCharacterModelOptions('https://openrouter.ai/api', {
        maxTokens: 400,
        temperature: 0.8,
        topP: 0.9,
        frequencyPenalty: 0,
        presencePenalty: 0,
        topK: 0,
        minP: 0,
        openRouterProvider: 'parasail',
      }),
    ).toMatchObject({
      provider: { dataCollection: 'deny', zdr: true, only: ['parasail'] },
    });
  });

  it('passes compatible-provider samplers using native wire names', () => {
    expect(
      createCharacterModelOptions('http://localhost:5001', {
        maxTokens: 500,
        temperature: 0.7,
        topP: 0.8,
        frequencyPenalty: 0.1,
        presencePenalty: 0.2,
        topK: 40,
        minP: 0.05,
      }),
    ).toEqual({
      max_tokens: 500,
      temperature: 0.7,
      top_p: 0.8,
      frequency_penalty: 0.1,
      presence_penalty: 0.2,
      top_k: 40,
      min_p: 0.05,
    });
  });

  it('streams text events through TanStack AI', async () => {
    const harness = createHarness();
    harness.setStream(
      (async function* streamChunks(): AsyncGenerator<StreamChunk> {
        yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'message-1', delta: 'Tan' } as StreamChunk;
        yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'message-1', delta: 'Stack' } as StreamChunk;
      })(),
    );

    const result = harness.service.streamCharacterText({
      provider: GENERATION_PROVIDERS.openrouter,
      endpoint: 'https://openrouter.ai/api',
      apiKey: 'sk-or-v1-test',
      model: 'anthropic/claude-sonnet-4',
      maxTokens: 400,
      messages: [
        { role: 'system', content: 'Write character prose.' },
        { role: 'user', content: 'A storm caller.' },
      ],
      temperature: 0.8,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      topK: 0,
      minP: 0,
    });
    const reader = result.textStream.getReader();
    let text = '';

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += chunk.value;
    }

    expect(harness.chatCalls).toHaveLength(1);
    expect(harness.chatCalls[0]).toEqual(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'A storm caller.' }],
        systemPrompts: ['Write character prose.'],
        stream: true,
      }),
    );
    expect(text).toBe('TanStack');
  });
});
