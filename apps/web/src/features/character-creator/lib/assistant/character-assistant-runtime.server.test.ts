import { EventType } from '@tanstack/ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import { streamCharacterAssistant } from './character-assistant-runtime.server';

const { chatMock } = vi.hoisted(() => ({ chatMock: vi.fn() }));

vi.mock('@tanstack/ai', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@tanstack/ai')),
  chat: chatMock,
}));

beforeEach(() => {
  chatMock.mockReset();
  chatMock.mockReturnValue({
    async *[Symbol.asyncIterator]() {
      yield { type: EventType.RUN_STARTED, runId: 'test-run' };
    },
  });
});

describe('native character assistant tools', () => {
  it('runs the tool loop without a separate structured-output finalization request', () => {
    const card = createEmptyCharacterCard();

    streamCharacterAssistant({
      card,
      focus: { kind: 'card' },
      contextAttachments: [],
      apiKey: 'test-key',
      generationSettings: {
        endpoint: 'https://openrouter.ai/api/v1',
        model: 'test/model',
        openRouterProvider: 'nextbit',
        maxTokens: 2_000,
        temperature: 1,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        topK: 0,
        minP: 0,
      },
      store: {
        getCard: () => card,
        appendProposedCard: vi.fn(),
      },
      messages: [{ role: 'user', content: 'Propose a name.' }],
      maxSteps: 8,
    });

    expect(chatMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.any(Array),
        stream: true,
      }),
    );
    expect(chatMock.mock.calls[0]?.[0]).not.toHaveProperty('outputSchema');
  });
});
