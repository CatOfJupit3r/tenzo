import { EventType } from '@tanstack/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCharacterLanguageModel, streamCharacterText } from './ai-sdk-text-generation';
import { GENERATION_PROVIDERS } from './generation-config';

const { chatMock, createOpenAICompatibleMock, createOpenRouterTextMock, transformRequestBodyMock } = vi.hoisted(() => ({
  chatMock: vi.fn(),
  createOpenAICompatibleMock: vi.fn(),
  createOpenRouterTextMock: vi.fn(() => ({ name: 'openrouter' })),
  transformRequestBodyMock: vi.fn(),
}));

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
}));

vi.mock('@tanstack/ai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@tanstack/ai')),
  chat: chatMock,
}));

vi.mock('@tanstack/ai-openrouter', () => ({
  createOpenRouterText: createOpenRouterTextMock,
}));

beforeEach(() => {
  createOpenAICompatibleMock.mockImplementation((options) => {
    transformRequestBodyMock.mockImplementation(options.transformRequestBody);

    return {
      chatModel: vi.fn(() => ({ supportsStructuredOutputs: options.supportsStructuredOutputs })),
    };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AI SDK text generation', () => {
  it('advertises JSON Schema structured output support to compatible chat models', () => {
    const model = createCharacterLanguageModel({
      endpoint: 'http://localhost:5001',
      apiKey: '',
      model: 'local-model',
      topK: 0,
      minP: 0,
    });

    expect(Reflect.get(model, 'supportsStructuredOutputs')).toBe(true);
  });

  it('streams OpenRouter text through the TanStack AI adapter using the supplied key and model', async () => {
    chatMock.mockReturnValue(
      (async function* streamChunks() {
        yield { type: EventType.TEXT_MESSAGE_CONTENT, delta: 'Open' };
        yield { type: EventType.TEXT_MESSAGE_CONTENT, delta: 'Router' };
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

    expect(createOpenRouterTextMock).toHaveBeenCalledWith('anthropic/claude-sonnet-4', 'sk-or-v1-test');
    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        adapter: { name: 'openrouter' },
        messages: [{ role: 'user', content: 'A storm caller.' }],
        systemPrompts: ['Write character prose.'],
        modelOptions: expect.objectContaining({
          provider: {
            data_collection: 'deny',
            zdr: true,
          },
        }),
        stream: true,
      }),
    );
    expect(text).toBe('OpenRouter');
  });

  it('enforces OpenRouter privacy routing for compatible model requests', () => {
    createCharacterLanguageModel({
      endpoint: 'https://openrouter.ai/api',
      apiKey: 'sk-or-v1-test',
      model: 'thedrummer/cydonia-24b-v4.1',
      topK: 0,
      minP: 0,
    });

    expect(transformRequestBodyMock({ messages: [] })).toEqual({
      messages: [],
      provider: {
        data_collection: 'deny',
        zdr: true,
      },
    });
  });
});
