import { describe, expect, it } from 'vitest';

import { createCharacterLibraryItem, getCharacterLibraryItemSummary } from './character-library';

describe('getCharacterLibraryItemSummary', () => {
  it('uses a bounded, single-line description summary', () => {
    const character = createCharacterLibraryItem();
    character.card.data.description = `  A watchful archivist.\n\n${'Keeps careful records. '.repeat(10)}`;

    const summary = getCharacterLibraryItemSummary(character);

    expect(summary.length).toBeLessThanOrEqual(140);
    expect(summary).not.toContain('\n');
    expect(summary).toMatch(/^A watchful archivist\. Keeps careful records\./);
    expect(summary).toMatch(/\.\.\.$/);
  });

  it('does not expose unrelated character fields when the description is absent', () => {
    const character = createCharacterLibraryItem();
    character.card.data.personality = 'Secret personality notes';
    character.card.data.scenario = 'Private scenario draft';
    character.card.data.first_mes = 'Raw opening message';
    character.card.data.creator_notes = 'Internal creator notes';

    expect(getCharacterLibraryItemSummary(character)).toBe('Ready for details, dialogue, and portrait work.');
  });
});
