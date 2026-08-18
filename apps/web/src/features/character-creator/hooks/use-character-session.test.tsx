import { expect, it, vi } from 'vitest';

import type { CharacterBook } from '../lib/cards/card-schema';
import {
  addCharacterBookEntry,
  createEmptyCharacterBook,
  removeCharacterBookEntry,
  reorderCharacterBookEntries,
  updateCharacterBook,
  updateCharacterBookEntry,
} from '../lib/cards/character-book-operations';
import { createEmptyCharacterLibraryItem, DEFAULT_CHARACTER_LIBRARY_ITEM_ID } from '../lib/cards/character-library';
import { createCharacterBookService } from './character-book-service';

it('creates, edits, reorders, and removes character book entries without dropping extensions', () => {
  const character = createEmptyCharacterLibraryItem(DEFAULT_CHARACTER_LIBRARY_ITEM_ID);
  character.card.data.character_book = {
    name: 'Imported lore',
    extensions: { book_plugin: { retained: true } },
    entries: [
      {
        keys: ['first'],
        content: 'First entry',
        extensions: { entry_plugin: 'retained' },
        enabled: true,
        insertion_order: 4,
        priority: 20,
      },
    ],
  };

  let characterBook: CharacterBook | undefined = character.card.data.character_book;
  characterBook = addCharacterBookEntry(characterBook);
  characterBook = updateCharacterBook(characterBook, { description: 'Edited description' });
  characterBook = updateCharacterBookEntry(characterBook, 0, {
    keys: ['first', 'updated'],
    content: 'Edited entry',
    enabled: false,
  });
  characterBook = reorderCharacterBookEntries(characterBook, 1, 0);

  expect(characterBook).toMatchObject({
    name: 'Imported lore',
    description: 'Edited description',
    extensions: { book_plugin: { retained: true } },
  });
  expect(characterBook?.entries[1]).toEqual({
    keys: ['first', 'updated'],
    content: 'Edited entry',
    extensions: { entry_plugin: 'retained' },
    enabled: false,
    insertion_order: 4,
    priority: 20,
  });

  characterBook = removeCharacterBookEntry(characterBook, 0);
  expect(characterBook?.entries).toHaveLength(1);
});

it('applies character-book operations through a narrow mutation port', () => {
  const character = createEmptyCharacterLibraryItem(DEFAULT_CHARACTER_LIBRARY_ITEM_ID);
  const mutate = vi.fn((recipe: (book: CharacterBook | undefined) => CharacterBook | undefined) => {
    character.card.data.character_book = recipe(character.card.data.character_book);
  });
  const service = createCharacterBookService({ mutate });

  service.create();
  service.addEntry();
  service.update({ description: 'A concise lore book.' });
  service.updateEntry(0, { content: 'Stored entry' });

  expect(mutate).toHaveBeenCalledTimes(4);
  expect(character.card.data.character_book).toEqual({
    description: 'A concise lore book.',
    extensions: {},
    entries: [
      {
        keys: [],
        content: 'Stored entry',
        extensions: {},
        enabled: true,
        insertion_order: 0,
      },
    ],
  });

  service.remove();
  expect(character.card.data.character_book).toBeUndefined();
  expect(createEmptyCharacterBook()).toEqual({ extensions: {}, entries: [] });
});
