import { describe, expect, it, vi } from 'vitest';

import { CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES } from '@~/features/character-creator/lib/assistant/character-assistant-contracts';
import { GENERATION_PROVIDERS } from '@~/features/character-creator/lib/generation/generation-config';

import { handleCharacterAssistantDiscoveryRequest } from '../../../../routes/api/character-assistant-discovery';

const { generateValidatedObjectMock } = vi.hoisted(() => ({
  generateValidatedObjectMock: vi.fn(),
}));

vi.mock('@~/features/character-creator/lib/generation/structured-output.server', () => ({
  generateValidatedObject: generateValidatedObjectMock,
}));

vi.mock('@~/features/character-creator/lib/generation/tanstack-ai-text-generation', () => ({
  createCharacterTextAdapter: vi.fn(() => ({})),
  createCharacterStructuredModelOptions: vi.fn(() => ({})),
}));

const BASE_REQUEST = {
  provider: GENERATION_PROVIDERS.koboldcpp,
  endpoint: 'http://localhost:11434',
  apiKey: 'key',
  model: 'gpt-4.1-mini',
  maxTokens: 300,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  topK: 0,
  minP: 0,
  originalPremise: 'A quiet librarian hides a map in a broken clock.',
  category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
};

function createRequest(payload: typeof BASE_REQUEST) {
  return new Request('http://localhost/api/character-assistant-discovery', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('character assistant discovery generation route', () => {
  it('returns three scoping cards for a single requested category', async () => {
    generateValidatedObjectMock.mockResolvedValueOnce({
      cards: [
        {
          title: 'Candid and careful',
          description: 'The character keeps emotional distance, but still answers every question directly.',
        },
        {
          title: 'Dry and precise',
          description: 'The character speaks in clear clauses and trims every sentence to its core.',
        },
        {
          title: 'Quietly theatrical',
          description: 'The character layers humor over anxiety, then reveals an old wound at the end.',
        },
      ],
    });

    const response = await handleCharacterAssistantDiscoveryRequest({
      request: createRequest({ ...BASE_REQUEST, category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone }),
    });
    const body = (await response.json()) as { cards: unknown[] };

    expect(response.status).toBe(200);
    expect(body.cards).toHaveLength(3);
    expect(
      body.cards.every(
        (card) => (card as { category: string }).category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
      ),
    ).toBe(true);
  });

  it('rejects malformed output when cards are materially duplicate', async () => {
    generateValidatedObjectMock.mockResolvedValueOnce({
      cards: [
        {
          title: 'Candid and careful',
          description: 'The character keeps emotional distance, but still answers every question directly.',
        },
        {
          title: 'Candid and careful',
          description: 'The character keeps emotional distance, but still answers every question directly.',
        },
        {
          title: 'Dry and precise',
          description: 'The character speaks in clear clauses and trims every sentence to its core.',
        },
      ],
    });

    const response = await handleCharacterAssistantDiscoveryRequest({
      request: createRequest({ ...BASE_REQUEST, category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone }),
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toContain('non-distinct');
  });

  it('returns a request-validation error for an unbounded premise', async () => {
    const response = await handleCharacterAssistantDiscoveryRequest({
      request: createRequest({ ...BASE_REQUEST, originalPremise: '' }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
