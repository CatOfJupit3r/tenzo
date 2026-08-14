import { z } from 'zod';

import { CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA } from '../generation/generation-stream-contracts';
import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA,
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
} from './character-assistant-contracts';

interface iGenerateDiscoveryDirectionsOptions extends Omit<
  z.infer<typeof CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA>,
  'instructions' | 'messages'
> {
  originalPremise: string;
  category: z.infer<typeof CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA>;
  signal?: AbortSignal;
}

const DISCOVERY_REQUEST_SCHEMA = CHARACTER_GENERATION_STREAM_REQUEST_SCHEMA.omit({
  instructions: true,
  messages: true,
}).extend({
  originalPremise: z.string().trim().min(1),
  category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
});

const DISCOVERY_RESPONSE_SCHEMA = z.object({
  cards: z.array(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA.extend({ sourceCardId: z.null() })).length(3),
});

export type iCharacterAssistantDiscoveryDirectionCard = z.infer<
  typeof CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA
>;

export async function generateCharacterAssistantDiscoveryDirections(
  options: iGenerateDiscoveryDirectionsOptions,
): Promise<readonly iCharacterAssistantDiscoveryDirectionCard[]> {
  const payload = DISCOVERY_REQUEST_SCHEMA.parse(options);

  const response = await fetch('/api/character-assistant-discovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error((await response.text()).trim() || 'Discovery directions could not be generated.');
  }

  const body = DISCOVERY_RESPONSE_SCHEMA.parse((await response.json()) as unknown);
  return body.cards;
}
