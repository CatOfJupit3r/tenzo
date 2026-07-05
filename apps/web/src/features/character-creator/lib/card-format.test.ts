import { describe, expect, it } from 'vitest';

import { parseCharacterCardJson, serializeCharacterCard, toHybridCharacterCard } from './card-format';

describe('card-format', () => {
  it('normalizes V1 cards into V2 shape with defaults', () => {
    const card = parseCharacterCardJson(
      JSON.stringify({
        name: 'Archivist',
        description: 'Keeps every secret.',
        personality: 'Measured',
        scenario: 'Inside a silent library.',
        first_mes: 'Welcome back.',
        mes_example: '<START>Archivist: The index is ready.',
      }),
    );

    expect(card.spec).toBe('chara_card_v2');
    expect(card.spec_version).toBe('2.0');
    expect(card.data.creator_notes).toBe('');
    expect(card.data.alternate_greetings).toEqual([]);
    expect(card.data.extensions.custom_fields).toEqual([]);
  });

  it('preserves extension data and exports hybrid V1 plus V2 fields', () => {
    const card = parseCharacterCardJson(
      JSON.stringify({
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: 'Fire Keeper',
          description: 'A quiet guide.',
          personality: 'Warm',
          scenario: 'A shrine at dusk.',
          first_mes: 'The coals are steady tonight.',
          mes_example: '<START>Fire Keeper: I can keep watch.',
          creator_notes: 'Keep the voice understated.',
          system_prompt: '',
          post_history_instructions: '',
          alternate_greetings: ['The shrine is open.'],
          tags: ['fantasy', 'guardian'],
          creator: 'Tenzo',
          character_version: '1.2',
          extensions: {
            custom_fields: [{ id: 'field-1', label: 'Weapon', value: 'Lantern spear' }],
            unknown_extension: { keep: true },
          },
          character_book: {
            extensions: { keep_book: true },
            entries: [
              {
                keys: ['ember'],
                content: 'Embers answer her call.',
                extensions: { keep_entry: true },
                enabled: true,
                insertion_order: 10,
              },
            ],
          },
        },
      }),
    );

    expect(card.data.extensions.unknown_extension).toEqual({ keep: true });
    expect(card.data.character_book?.extensions).toEqual({ keep_book: true });
    expect(card.data.character_book?.entries[0]?.extensions).toEqual({ keep_entry: true });

    const hybridCard = toHybridCharacterCard(card);
    expect(hybridCard.name).toBe(card.data.name);
    expect(hybridCard.description).toBe(card.data.description);

    const roundTripCard = parseCharacterCardJson(serializeCharacterCard(card));
    expect(roundTripCard.data.extensions.unknown_extension).toEqual({ keep: true });
    expect(roundTripCard.data.character_book?.extensions).toEqual({ keep_book: true });
    expect(roundTripCard.data.character_book?.entries[0]?.extensions).toEqual({ keep_entry: true });
  });
});
