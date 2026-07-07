import { describe, expect, it } from 'vitest';

import {
  buildExportedCharacterCard,
  extractTenzoCardMetadata,
  parseCharacterCardJson,
  serializeCharacterCard,
  TENZO_CARD_EXTENSION_KEY,
  toHybridCharacterCard,
} from './card-format';
import type { CharacterCard } from './card-schema';
import { EXPORT_DETAIL_LEVELS } from './export-settings';
import type { iCharacterGenerationPromptSettings } from './generation-config';

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

describe('card export detail levels', () => {
  function createCardWithTenzoData(): CharacterCard {
    return parseCharacterCardJson(
      JSON.stringify({
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
          name: 'Fire Keeper',
          description: 'A quiet guide.',
          extensions: {
            custom_fields: [{ id: 'field-1', label: 'Weapon', value: 'Lantern spear' }],
            unknown_extension: { keep: true },
          },
        },
      }),
    );
  }

  const promptSettings: iCharacterGenerationPromptSettings = {
    generalCharacterIdea: 'A calm guardian of embers.',
    fieldInstructions: { 'field:description': 'Keep it short.' },
    fieldShouldUseGeneralCharacterIdea: { 'field:description': true },
    fieldTemplateIds: {},
  };
  const cropRect = { x: 10, y: 20, width: 200, height: 300 };

  it('strips tenzo-specific data on minimal export', () => {
    const exportedCard = buildExportedCharacterCard(createCardWithTenzoData(), {
      detailLevel: EXPORT_DETAIL_LEVELS.minimal,
      promptSettings,
      portraitCropRect: cropRect,
    });

    expect(exportedCard.data.extensions).toEqual({ unknown_extension: { keep: true } });
  });

  it('keeps custom fields and common metadata but not per-field guidance on tenzo_metadata export', () => {
    const exportedCard = buildExportedCharacterCard(createCardWithTenzoData(), {
      detailLevel: EXPORT_DETAIL_LEVELS.tenzo_metadata,
      promptSettings,
      portraitCropRect: cropRect,
    });

    const tenzoExtension = exportedCard.data.extensions[TENZO_CARD_EXTENSION_KEY] as Record<string, unknown>;
    expect(exportedCard.data.extensions.unknown_extension).toEqual({ keep: true });
    expect(exportedCard.data.extensions.custom_fields).toBeUndefined();
    expect(tenzoExtension.custom_fields).toEqual([{ id: 'field-1', label: 'Weapon', value: 'Lantern spear' }]);
    expect(tenzoExtension.portrait_crop_rect).toEqual(cropRect);
    expect(tenzoExtension.general_character_idea).toBe(promptSettings.generalCharacterIdea);
    expect(tenzoExtension.field_instructions).toBeUndefined();
  });

  it('round-trips custom fields, crop rect, and generation guidance through a full export', () => {
    const jsonText = serializeCharacterCard(createCardWithTenzoData(), {
      detailLevel: EXPORT_DETAIL_LEVELS.full,
      promptSettings,
      portraitCropRect: cropRect,
    });

    const rawCard: unknown = JSON.parse(jsonText);
    const importedCard = parseCharacterCardJson(jsonText);
    const tenzoMetadata = extractTenzoCardMetadata(rawCard);

    expect(importedCard.data.extensions.custom_fields).toEqual([
      { id: 'field-1', label: 'Weapon', value: 'Lantern spear' },
    ]);
    expect(importedCard.data.extensions[TENZO_CARD_EXTENSION_KEY]).toBeUndefined();
    expect(importedCard.data.extensions.unknown_extension).toEqual({ keep: true });
    expect(tenzoMetadata.cropRect).toEqual(cropRect);
    expect(tenzoMetadata.promptSettings).toEqual(promptSettings);
  });
});
