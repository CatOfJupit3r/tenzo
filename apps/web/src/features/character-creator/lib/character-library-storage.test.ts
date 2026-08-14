import { describe, expect, it } from 'vitest';

import { createCharacterLibraryItem } from './character-library';
import { characterLibraryStorageParser } from './character-library-storage';

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

    const parsed = characterLibraryStorageParser.parse(storedValue) as Record<
      string,
      { versionKey: string; data: typeof character }
    >;

    expect(parsed[`s:${character.id}`]?.data.card.data.name).toBe('Recovered character');
    expect(parsed[`s:${character.id}`]?.data.promptSettings.fieldTemplateIds).toEqual({});
  });

  it('does not let one malformed entry hide valid saved characters', () => {
    const character = createCharacterLibraryItem();
    character.card.data.name = 'Still here';

    const parsed = characterLibraryStorageParser.parse(
      JSON.stringify({
        broken: { versionKey: 'broken', data: null },
        [`s:${character.id}`]: { versionKey: 'valid', data: character },
      }),
    ) as Record<string, { data: typeof character }>;

    expect(Object.keys(parsed)).toEqual([`s:${character.id}`]);
    expect(parsed[`s:${character.id}`]?.data.card.data.name).toBe('Still here');
  });
});
