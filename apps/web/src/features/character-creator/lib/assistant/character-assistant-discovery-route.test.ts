import { describe, expect, it } from 'vitest';

import { CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES } from '@~/features/character-creator/lib/assistant/character-assistant-contracts';
import type { iCharacterDiscoveryDirectionsService } from '@~/features/character-creator/lib/assistant/discovery-directions.server';
import { GENERATION_PROVIDERS } from '@~/features/character-creator/lib/generation/generation-config';

import {
  createCharacterAssistantDiscoveryRequestHandler,
  MAX_DISCOVERY_PREMISE_LENGTH,
} from '../../../../routes/api/character-assistant-discovery';

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

function createService(
  cards: Awaited<ReturnType<iCharacterDiscoveryDirectionsService['generateCharacterDiscoveryCategory']>>,
) {
  const discoveryService: Pick<iCharacterDiscoveryDirectionsService, 'generateCharacterDiscoveryCategory'> = {
    generateCharacterDiscoveryCategory: async () => cards,
  };
  return discoveryService;
}

describe('character assistant discovery generation route', () => {
  it('returns three scoping cards for a single requested category', async () => {
    const response = await createCharacterAssistantDiscoveryRequestHandler(
      createService([
        {
          id: 'card-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
          title: 'Candid and careful',
          description: 'The character keeps emotional distance, but still answers every question directly.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'card-2',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
          title: 'Dry and precise',
          description: 'The character speaks in clear clauses and trims every sentence to its core.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'card-3',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
          title: 'Quietly theatrical',
          description: 'The character layers humor over anxiety, then reveals an old wound at the end.',
          sourceCardId: null,
          isUserAuthored: false,
        },
      ]),
    )({ request: createRequest(BASE_REQUEST) });
    const body = (await response.json()) as { cards: unknown[] };

    expect(response.status).toBe(200);
    expect(body.cards).toHaveLength(3);
    expect(
      body.cards.every(
        (card) => (card as { category: string }).category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
      ),
    ).toBe(true);
  });

  it('returns a server error when the discovery service rejects materially duplicate cards', async () => {
    const discoveryService: Pick<iCharacterDiscoveryDirectionsService, 'generateCharacterDiscoveryCategory'> = {
      generateCharacterDiscoveryCategory: async () => {
        throw new Error('The model returned non-distinct direction cards.');
      },
    };

    const response = await createCharacterAssistantDiscoveryRequestHandler(discoveryService)({
      request: createRequest(BASE_REQUEST),
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toContain('non-distinct');
  });

  it('returns a request-validation error for an over-limit premise', async () => {
    const response = await createCharacterAssistantDiscoveryRequestHandler(createService([]))({
      request: createRequest({
        ...BASE_REQUEST,
        originalPremise: 'x'.repeat(MAX_DISCOVERY_PREMISE_LENGTH + 1),
      }),
    });

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
