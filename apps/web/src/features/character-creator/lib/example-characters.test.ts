import { describe, expect, it } from 'vitest';

import { createEmptyCharacterCard } from '../constants/card-defaults';
import { toPromptExampleCharacter } from './example-characters';

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
      sourceKind: 'json',
      card,
      includedFieldKeys: ['name', 'alternate_greetings'],
    });

    expect(promptExample.name).toBe('Ash Walker');
    expect(promptExample.description).toBeUndefined();
    expect(promptExample.alternate_greetings).toEqual(['Stay close to the embers.']);
    expect(promptExample.custom_fields).toBeUndefined();
  });
});
