import { describe, expect, it } from 'vitest';

import { createCharacterLibraryItem } from './character-library';
import { readStoredCharacterLibrary } from './character-library-storage';

describe('character library storage', () => {
  it('hydrates saved characters through the compatibility sanitizer', () => {
    const character = createCharacterLibraryItem();
    character.card.data.name = 'Recovered character';
    const legacyPromptSettings = { ...character.promptSettings } as Partial<typeof character.promptSettings>;
    delete legacyPromptSettings.fieldTemplateIds;

    const storedValue = JSON.stringify({
      [`s:${character.id}`]: {
        versionKey: 'saved-version',
        data: { ...character, promptSettings: legacyPromptSettings },
      },
    });

    const parsed = readStoredCharacterLibrary(storedValue);

    expect(parsed[0]?.card.data.name).toBe('Recovered character');
    expect(parsed[0]?.promptSettings.fieldTemplateIds).toEqual({});
  });

  it('does not let one malformed entry hide valid saved characters', () => {
    const character = createCharacterLibraryItem();
    character.card.data.name = 'Still here';

    const parsed = readStoredCharacterLibrary(
      JSON.stringify({
        broken: { versionKey: 'broken', data: null },
        [`s:${character.id}`]: { versionKey: 'valid', data: character },
      }),
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.card.data.name).toBe('Still here');
  });
});
