import { EventType } from '@tanstack/ai';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCharacterLanguageModel, streamCharacterText } from './ai-sdk-text-generation';
import { GENERATION_PROVIDERS } from './generation-config';

const { chatMock, createOpenRouterTextMock } = vi.hoisted(() => ({
  chatMock: vi.fn(),
  createOpenRouterTextMock: vi.fn(() => ({ name: 'openrouter' })),
}));

vi.mock('@tanstack/ai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@tanstack/ai')),
  chat: chatMock,
}));

vi.mock('@tanstack/ai-openrouter', () => ({
  createOpenRouterText: createOpenRouterTextMock,
}));

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
        stream: true,
      }),
    );
    expect(text).toBe('OpenRouter');
  });
});
