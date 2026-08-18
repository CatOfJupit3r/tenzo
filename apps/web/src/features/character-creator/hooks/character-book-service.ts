import type { CharacterBook, CharacterBookEntry } from '../lib/cards/card-schema';
import {
  addCharacterBookEntry,
  createEmptyCharacterBook,
  removeCharacterBookEntry,
  reorderCharacterBookEntries,
  updateCharacterBook,
  updateCharacterBookEntry,
} from '../lib/cards/character-book-operations';

export interface iCharacterBookMutationPort {
  mutate: (recipe: (characterBook: CharacterBook | undefined) => CharacterBook | undefined) => unknown;
}

export interface iCharacterBookService {
  create: () => unknown;
  remove: () => unknown;
  update: (patch: Partial<Omit<CharacterBook, 'entries' | 'extensions'>>) => unknown;
  addEntry: () => unknown;
  updateEntry: (index: number, patch: Partial<Omit<CharacterBookEntry, 'extensions'>>) => unknown;
  removeEntry: (index: number) => unknown;
  reorderEntries: (fromIndex: number, toIndex: number) => unknown;
}

export function createCharacterBookService({ mutate }: iCharacterBookMutationPort): iCharacterBookService {
  return {
    create: () => mutate((characterBook) => characterBook ?? createEmptyCharacterBook()),
    remove: () => mutate(() => undefined),
    update: (patch) => mutate((characterBook) => updateCharacterBook(characterBook, patch)),
    addEntry: () => mutate((characterBook) => addCharacterBookEntry(characterBook)),
    updateEntry: (index, patch) => mutate((characterBook) => updateCharacterBookEntry(characterBook, index, patch)),
    removeEntry: (index) => mutate((characterBook) => removeCharacterBookEntry(characterBook, index)),
    reorderEntries: (fromIndex, toIndex) =>
      mutate((characterBook) => reorderCharacterBookEntries(characterBook, fromIndex, toIndex)),
  };
}
