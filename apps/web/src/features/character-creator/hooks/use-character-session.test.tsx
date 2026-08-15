import { act, renderHook } from '@testing-library/react';
import { Provider } from 'jotai';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

import { createEmptyCharacterLibraryItem, DEFAULT_CHARACTER_LIBRARY_ITEM_ID } from '../lib/cards/character-library';
import type { iCharacterLibraryItem } from '../lib/cards/character-library';
import { useCharacterSession } from './use-character-session';

type iCharacterUpdate = (
  id: string,
  recipe: (draft: iCharacterLibraryItem) => unknown,
) => { isPersisted: { promise: Promise<unknown> } };

const sessionTestState = vi.hoisted(() => ({
  characterLibrary: [] as iCharacterLibraryItem[],
  updateCharacter: vi.fn<iCharacterUpdate>(),
}));

vi.mock('@~/db/persistent-collection', () => ({
  usePersistentCollection: vi.fn(() => []),
}));

vi.mock('../atoms/character-session.atom', async () => {
  const [{ atom }, { DEFAULT_CHARACTER_LIBRARY_ITEM_ID: defaultCharacterId }] = await Promise.all([
    import('jotai'),
    import('../lib/cards/character-library'),
  ]);

  return { activeCharacterIdAtom: atom(defaultCharacterId) };
});

vi.mock('../collections/character-library.collection', () => ({
  characterLibraryCollection: {
    has: vi.fn(() => true),
    update: sessionTestState.updateCharacter,
  },
}));

vi.mock('../collections/character-assistant-composer-drafts.collection', () => ({
  removeCharacterAssistantComposerDraft: vi.fn(),
}));

vi.mock('../collections/character-assistant-sessions.collection', () => ({
  removeCharacterAssistantSession: vi.fn(),
}));

vi.mock('../collections/example-characters.collection', () => ({
  exampleCharactersCollection: {},
}));

vi.mock('./use-character-library-list', () => ({
  useCharacterLibraryList: () => ({
    characterLibrary: sessionTestState.characterLibrary,
    isCharacterLibraryReady: true,
  }),
}));

function CharacterSessionTestProvider({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>;
}

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
  sessionTestState.characterLibrary = [character];
  sessionTestState.updateCharacter.mockImplementation((_id, recipe) => {
    recipe(character);
    return {
      isPersisted: {
        promise: new Promise(() => {
          // Persistence remains pending so it cannot update hook state after this synchronous test.
        }),
      },
    };
  });

  const { result } = renderHook(() => useCharacterSession(), { wrapper: CharacterSessionTestProvider });

  act(() => result.current.addCharacterBookEntry());
  act(() => result.current.updateCharacterBook({ description: 'Edited description' }));
  act(() =>
    result.current.updateCharacterBookEntry(0, {
      keys: ['first', 'updated'],
      content: 'Edited entry',
      enabled: false,
    }),
  );
  act(() => result.current.reorderCharacterBookEntries(1, 0));

  expect(character.card.data.character_book).toMatchObject({
    name: 'Imported lore',
    description: 'Edited description',
    extensions: { book_plugin: { retained: true } },
  });
  expect(character.card.data.character_book?.entries[1]).toEqual({
    keys: ['first', 'updated'],
    content: 'Edited entry',
    extensions: { entry_plugin: 'retained' },
    enabled: false,
    insertion_order: 4,
    priority: 20,
  });

  act(() => result.current.removeCharacterBookEntry(0));
  expect(character.card.data.character_book?.entries).toHaveLength(1);

  act(() => result.current.removeCharacterBook());
  expect(character.card.data.character_book).toBeUndefined();

  act(() => result.current.createCharacterBook());
  expect(character.card.data.character_book).toEqual({ extensions: {}, entries: [] });
});
