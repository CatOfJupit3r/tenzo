import { EventType } from '@tanstack/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GENERATION_PROVIDERS } from './generation-config';
import {
  createCharacterModelOptions,
  createCharacterStructuredModelOptions,
  createCharacterTextAdapter,
  createCharacterToolModelOptions,
  streamCharacterText,
  withRepairedToolCallArguments,
} from './tanstack-ai-text-generation';

const { chatMock, createOpenRouterTextMock, openaiCompatibleTextMock } = vi.hoisted(() => ({
  chatMock: vi.fn(),
  createOpenRouterTextMock: vi.fn(() => ({ name: 'openrouter' })),
  openaiCompatibleTextMock: vi.fn(() => ({ name: 'openai-compatible' })),
}));

vi.mock('@tanstack/ai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@tanstack/ai')),
  chat: chatMock,
}));

vi.mock('@tanstack/ai-openai/compatible', () => ({
  openaiCompatibleText: openaiCompatibleTextMock,
}));

vi.mock('@tanstack/ai-openrouter', () => ({
  createOpenRouterText: createOpenRouterTextMock,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('TanStack AI text generation', () => {
  it('repairs streamed native tool-call arguments before the runtime parses them', async () => {
    const adapter = withRepairedToolCallArguments({
      chatStream: () =>
        (async function* streamChunks() {
          yield { type: EventType.TOOL_CALL_START, toolCallId: 'call-1', toolName: 'propose_character_fields' };
          yield { type: EventType.TOOL_CALL_ARGS, toolCallId: 'call-1', delta: "{changes:[{fieldKey:'descr" };
          yield { type: EventType.TOOL_CALL_ARGS, toolCallId: 'call-1', delta: "iption',value:'Ready'}]}" };
          yield { type: EventType.TOOL_CALL_END, toolCallId: 'call-1', toolName: 'propose_character_fields' };
        })(),
    } as never);

    const chunks = [];
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
    createCharacterTextAdapter({
      endpoint: 'http://localhost:5001',
      apiKey: 'local-key',
      model: 'local-model',
    });

    expect(openaiCompatibleTextMock).toHaveBeenCalledWith('local-model', {
      name: 'character-creator',
      baseURL: 'http://localhost:5001/v1',
      apiKey: 'local-key',
      dangerouslyAllowBrowser: true,
    });
  });

  it('uses the dedicated OpenRouter adapter and privacy routing', () => {
    createCharacterTextAdapter({
      endpoint: 'https://openrouter.ai/api',
      apiKey: 'sk-or-v1-test',
      model: 'anthropic/claude-sonnet-4',
    });

    expect(createOpenRouterTextMock).toHaveBeenCalledWith(
      'anthropic/claude-sonnet-4',
      'sk-or-v1-test',
      expect.objectContaining({
        httpClient: expect.objectContaining({ request: expect.any(Function) }),
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
    chatMock.mockReturnValue(
      (async function* streamChunks() {
        yield { type: EventType.TEXT_MESSAGE_CONTENT, delta: 'Tan' };
        yield { type: EventType.TEXT_MESSAGE_CONTENT, delta: 'Stack' };
      })(),
    );

    const result = streamCharacterText({
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
      if (chunk.done) {
        break;
      }
      text += chunk.value;
    }

    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: { name: 'openrouter' },
        messages: [{ role: 'user', content: 'A storm caller.' }],
        systemPrompts: ['Write character prose.'],
        stream: true,
      }),
    );
    expect(text).toBe('TanStack');
  });
});
