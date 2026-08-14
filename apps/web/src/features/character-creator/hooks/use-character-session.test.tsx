import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'jotai';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

import { createEmptyCharacterLibraryItem, DEFAULT_CHARACTER_LIBRARY_ITEM_ID } from '../lib/character-library';
import type { iCharacterLibraryItem } from '../lib/character-library';
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
    import('../lib/character-library'),
  ]);

  return { activeCharacterIdAtom: atom(defaultCharacterId) };
});

vi.mock('../collections/character-library.collection', () => ({
  characterLibraryCollection: {
    has: vi.fn(() => true),
    update: sessionTestState.updateCharacter,
  },
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

function createDeferredPersistence() {
  let resolvePersistence: (value: boolean) => unknown = () => false;
  let rejectPersistence: (reason?: unknown) => unknown = () => false;
  const promise = new Promise<boolean>((resolve, reject) => {
    resolvePersistence = resolve;
    rejectPersistence = reject;
  });

  return { promise, rejectPersistence, resolvePersistence };
}

function CharacterSessionTestProvider({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>;
}

it('tracks persistence completion and failure independently for each character', async () => {
  const firstCharacter = createEmptyCharacterLibraryItem(DEFAULT_CHARACTER_LIBRARY_ITEM_ID);
  const secondCharacter = createEmptyCharacterLibraryItem('second-character');
  sessionTestState.characterLibrary = [firstCharacter, secondCharacter];
  const firstPersistence = createDeferredPersistence();
  const secondPersistence = createDeferredPersistence();

  sessionTestState.updateCharacter
    .mockImplementationOnce((_id, recipe) => {
      recipe(firstCharacter);
      return { isPersisted: { promise: firstPersistence.promise } };
    })
    .mockImplementationOnce((_id, recipe) => {
      recipe(secondCharacter);
      return { isPersisted: { promise: secondPersistence.promise } };
    });

  const { result } = renderHook(() => useCharacterSession(), { wrapper: CharacterSessionTestProvider });

  act(() => result.current.updateField('name', 'First character'));
  expect(result.current.isSaving).toBe(true);
  expect(result.current.hasPersistedEdits).toBe(false);

  await act(async () => {
    firstPersistence.resolvePersistence(true);
    await firstPersistence.promise;
  });

  expect(result.current.isSaving).toBe(false);
  expect(result.current.hasPersistedEdits).toBe(true);
  expect(result.current.lastSavedAt).toBeInstanceOf(Date);

  act(() => result.current.selectCharacter(secondCharacter.id));
  await waitFor(() => expect(result.current.activeCharacterId).toBe(secondCharacter.id));
  expect(result.current.hasPersistedEdits).toBe(false);
  expect(result.current.lastSavedAt).toBeNull();

  act(() => result.current.updateField('name', 'Second character'));
  expect(result.current.isSaving).toBe(true);

  await act(async () => {
    secondPersistence.rejectPersistence(new Error('Storage unavailable'));
    await expect(secondPersistence.promise).rejects.toThrow('Storage unavailable');
  });

  expect(result.current.isSaving).toBe(false);
  expect(result.current.hasPersistedEdits).toBe(false);
  expect(result.current.saveErrorMessage).toBe('Changes could not be saved locally.');
});

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
