import type { CharacterBook, CharacterBookEntry } from './card-schema';

export function createEmptyCharacterBook(): CharacterBook {
  return { extensions: {}, entries: [] };
}

export function updateCharacterBook(
  characterBook: CharacterBook | undefined,
  patch: Partial<Omit<CharacterBook, 'entries' | 'extensions'>>,
): CharacterBook | undefined {
  return characterBook ? { ...characterBook, ...patch } : characterBook;
}

export function addCharacterBookEntry(characterBook: CharacterBook | undefined): CharacterBook | undefined {
  if (!characterBook) {
    return characterBook;
  }

  return {
    ...characterBook,
    entries: [
      ...characterBook.entries,
      {
        keys: [],
        content: '',
        extensions: {},
        enabled: true,
        insertion_order: characterBook.entries.length,
      },
    ],
  };
}

export function updateCharacterBookEntry(
  characterBook: CharacterBook | undefined,
  index: number,
  patch: Partial<Omit<CharacterBookEntry, 'extensions'>>,
): CharacterBook | undefined {
  if (!characterBook?.entries[index]) {
    return characterBook;
  }

  return {
    ...characterBook,
    entries: characterBook.entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...patch } : entry)),
  };
}

export function removeCharacterBookEntry(
  characterBook: CharacterBook | undefined,
  index: number,
): CharacterBook | undefined {
  if (!characterBook || index < 0 || index >= characterBook.entries.length) {
    return characterBook;
  }

  return {
    ...characterBook,
    entries: characterBook.entries.filter((_entry, entryIndex) => entryIndex !== index),
  };
}

export function reorderCharacterBookEntries(
  characterBook: CharacterBook | undefined,
  fromIndex: number,
  toIndex: number,
): CharacterBook | undefined {
  if (
    !characterBook ||
    fromIndex < 0 ||
    fromIndex >= characterBook.entries.length ||
    toIndex < 0 ||
    toIndex >= characterBook.entries.length
  ) {
    return characterBook;
  }

  const entries = [...characterBook.entries];
  const [movedEntry] = entries.splice(fromIndex, 1);
  if (!movedEntry) {
    return characterBook;
  }

  entries.splice(toIndex, 0, movedEntry);
  return { ...characterBook, entries };
}
