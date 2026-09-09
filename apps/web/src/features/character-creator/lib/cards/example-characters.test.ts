import { describe, expect, it } from 'vitest';

import { IMPORTED_CARD_SOURCE_KINDS } from '@~/features/character-creator/lib/cards/card-file-enums';
import {
  EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY,
  toPromptExampleCharacter,
} from '@~/features/character-creator/lib/cards/example-characters';

import { createEmptyCharacterCard } from '../../constants/card-defaults';

describe('example-characters', () => {
  it('maps only the selected fields into prompt context', () => {
    const card = createEmptyCharacterCard();
    card.data.name = 'Ash Walker';
    card.data.description = 'A patient guide through ruined kingdoms.';
    card.data.alternate_greetings = ['Stay close to the embers.'];
    card.data.extensions.custom_fields = [{ id: 'tone', label: 'Tone', value: 'Measured' }];

    const promptExample = toPromptExampleCharacter({
      id: 'example-1',
      fileName: 'ash-walker.json',
      sourceKind: IMPORTED_CARD_SOURCE_KINDS.JSON,
      card,
      includedFieldKeys: [
        EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.NAME,
        EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.ALTERNATE_GREETINGS,
      ],
    });

    expect(promptExample.name).toBe('Ash Walker');
    expect(promptExample.description).toBeUndefined();
    expect(promptExample.alternate_greetings).toEqual(['Stay close to the embers.']);
    expect(promptExample.custom_fields).toBeUndefined();
  });
});
