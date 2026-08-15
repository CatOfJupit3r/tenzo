import { useAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { usePersistentCollection } from '@~/db/persistent-collection';
import { generateUuid } from '@~/utils/uuid';

import { activeCharacterIdAtom } from '../atoms/character-session.atom';
import { removeCharacterAssistantComposerDraft } from '../collections/character-assistant-composer-drafts.collection';
import { removeCharacterAssistantSession } from '../collections/character-assistant-sessions.collection';
import { characterLibraryCollection } from '../collections/character-library.collection';
import { exampleCharactersCollection } from '../collections/example-characters.collection';
import { createEmptyCharacterCard } from '../constants/card-defaults';
import type {
  CharacterBook,
  CharacterBookEntry,
  CharacterCard,
  CharacterTextFieldKey,
  CustomField,
} from '../lib/cards/card-schema';
import {
  createCharacterLibraryItem,
  createDuplicateCharacterName,
  createEmptyCharacterLibraryItem,
  DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
} from '../lib/cards/character-library';
import type {
  CharacterLibrarySource,
  iCharacterLibraryItem,
  iCharacterPortraitReference,
} from '../lib/cards/character-library';
import { sanitizeExampleCharacterIncludedFieldKeys } from '../lib/cards/example-characters';
import type { ExampleCharacterContextFieldKey, iStoredExampleCharacter } from '../lib/cards/example-characters';
import { deleteCharacterAssetBlob } from '../lib/cards/image-store';
import {
  DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS,
  sanitizeCharacterGenerationPromptSettings,
} from '../lib/generation/generation-config';
import type { iCharacterGenerationPromptSettings } from '../lib/generation/generation-config';
import { ensurePortraitAssetLoaded } from '../lib/portrait/portrait-asset-cache';
import { renderPortraitThumbnailDataUrl } from '../lib/portrait/portrait-focal-point';
import { useCharacterLibraryList } from './use-character-library-list';

export function useCharacterSession() {
  const [activeCharacterId, setActiveCharacterId] = useAtom(activeCharacterIdAtom);
  const backfilledThumbnailIdsRef = useRef<Set<string>>(new Set());

  const { characterLibrary, isCharacterLibraryReady } = useCharacterLibraryList();

  const storedExampleCharacters = usePersistentCollection(exampleCharactersCollection);
  const exampleCharacters = useMemo(
    () => [...storedExampleCharacters].sort((first, second) => first.fileName.localeCompare(second.fileName)),
    [storedExampleCharacters],
  );

  const activeCharacter = useMemo(
    () => characterLibrary.find((character) => character.id === activeCharacterId) ?? characterLibrary[0] ?? null,
    [activeCharacterId, characterLibrary],
  );

  useEffect(() => {
    if (activeCharacter && activeCharacter.id !== activeCharacterId) {
      setActiveCharacterId(activeCharacter.id);
    }
  }, [activeCharacter, activeCharacterId, setActiveCharacterId]);

  useEffect(() => {
    characterLibrary.forEach((character) => {
      if (
        !character.portrait ||
        character.portrait.thumbnailDataUrl ||
        backfilledThumbnailIdsRef.current.has(character.id)
      ) {
        return;
      }

      backfilledThumbnailIdsRef.current.add(character.id);
      const { cropRect } = character.portrait;

      void ensurePortraitAssetLoaded(character.portrait.assetId).then(async (entry) => {
        if (!entry.blob) {
          return;
        }

        const thumbnailDataUrl = await renderPortraitThumbnailDataUrl(entry.blob, cropRect);

        if (characterLibraryCollection.has(character.id)) {
          characterLibraryCollection.update(character.id, (draft) => {
            if (draft.portrait) {
              draft.portrait.thumbnailDataUrl = thumbnailDataUrl;
            }
          });
        }
      });
    });
  }, [characterLibrary]);

  const card = activeCharacter?.card ?? createEmptyCharacterCard();
  const promptSettings = activeCharacter?.promptSettings ?? DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS;
  const portraitReference = activeCharacter?.portrait ?? null;
  const activeCharacterKey = activeCharacter?.id ?? null;
  const mutateActiveCharacter = useCallback(
    (recipe: (draft: iCharacterLibraryItem) => unknown) => {
      if (!activeCharacterKey || !characterLibraryCollection.has(activeCharacterKey)) {
        return null;
      }

      const transaction = characterLibraryCollection.update(activeCharacterKey, (draft) => {
        // The card schema applies defaults, so the draft's input type widens some
        // fields to optional; at runtime they are always populated.
        recipe(draft);
        draft.updatedAt = new Date().toISOString();
      });

      return transaction;
    },
    [activeCharacterKey],
  );

  const updateField = useCallback(
    (key: CharacterTextFieldKey, value: string) => {
      mutateActiveCharacter((draft) => {
        draft.card.data[key] = value;
      });
    },
    [mutateActiveCharacter],
  );

  const updateTags = useCallback(
    (tags: string[]) => {
      mutateActiveCharacter((draft) => {
        draft.card.data.tags = tags;
      });
    },
    [mutateActiveCharacter],
  );

  const addGreeting = useCallback(() => {
    mutateActiveCharacter((draft) => {
      draft.card.data.alternate_greetings.push('');
    });
  }, [mutateActiveCharacter]);

  const updateGreeting = useCallback(
    (index: number, value: string) => {
      mutateActiveCharacter((draft) => {
        draft.card.data.alternate_greetings[index] = value;
      });
    },
    [mutateActiveCharacter],
  );

  const removeGreeting = useCallback(
    (index: number) => {
      mutateActiveCharacter((draft) => {
        draft.card.data.alternate_greetings.splice(index, 1);
      });
    },
    [mutateActiveCharacter],
  );

  const reorderGreetings = useCallback(
    (fromIndex: number, toIndex: number) => {
      mutateActiveCharacter((draft) => {
        const alternateGreetings = draft.card.data.alternate_greetings;

        if (toIndex < 0 || toIndex >= alternateGreetings.length) {
          return;
        }

        const [movedGreeting] = alternateGreetings.splice(fromIndex, 1);

        if (movedGreeting === undefined) {
          return;
        }

        alternateGreetings.splice(toIndex, 0, movedGreeting);
      });
    },
    [mutateActiveCharacter],
  );

  const addCustomField = useCallback(() => {
    mutateActiveCharacter((draft) => {
      const customField: CustomField = { id: generateUuid(), label: '', value: '' };
      draft.card.data.extensions.custom_fields.push(customField);
    });
  }, [mutateActiveCharacter]);

  const updateCustomField = useCallback(
    (id: string, patch: Partial<Pick<CustomField, 'label' | 'value'>>) => {
      mutateActiveCharacter((draft) => {
        const customField = draft.card.data.extensions.custom_fields.find((field) => field.id === id);

        if (customField) {
          Object.assign(customField, patch);
        }
      });
    },
    [mutateActiveCharacter],
  );

  const removeCustomField = useCallback(
    (id: string) => {
      mutateActiveCharacter((draft) => {
        draft.card.data.extensions.custom_fields = draft.card.data.extensions.custom_fields.filter(
          (field) => field.id !== id,
        );
      });
    },
    [mutateActiveCharacter],
  );

  const createCharacterBook = useCallback(() => {
    mutateActiveCharacter((draft) => {
      draft.card.data.character_book ??= { extensions: {}, entries: [] };
    });
  }, [mutateActiveCharacter]);

  const removeCharacterBook = useCallback(() => {
    mutateActiveCharacter((draft) => {
      delete draft.card.data.character_book;
    });
  }, [mutateActiveCharacter]);

  const updateCharacterBook = useCallback(
    (patch: Partial<Omit<CharacterBook, 'entries' | 'extensions'>>) => {
      mutateActiveCharacter((draft) => {
        if (draft.card.data.character_book) {
          Object.assign(draft.card.data.character_book, patch);
        }
      });
    },
    [mutateActiveCharacter],
  );

  const addCharacterBookEntry = useCallback(() => {
    mutateActiveCharacter((draft) => {
      const characterBook = draft.card.data.character_book;

      if (!characterBook) {
        return;
      }

      characterBook.entries.push({
        keys: [],
        content: '',
        extensions: {},
        enabled: true,
        insertion_order: characterBook.entries.length,
      });
    });
  }, [mutateActiveCharacter]);

  const updateCharacterBookEntry = useCallback(
    (index: number, patch: Partial<Omit<CharacterBookEntry, 'extensions'>>) => {
      mutateActiveCharacter((draft) => {
        const entry = draft.card.data.character_book?.entries[index];

        if (entry) {
          Object.assign(entry, patch);
        }
      });
    },
    [mutateActiveCharacter],
  );

  const removeCharacterBookEntry = useCallback(
    (index: number) => {
      mutateActiveCharacter((draft) => {
        draft.card.data.character_book?.entries.splice(index, 1);
      });
    },
    [mutateActiveCharacter],
  );

  const reorderCharacterBookEntries = useCallback(
    (fromIndex: number, toIndex: number) => {
      mutateActiveCharacter((draft) => {
        const entries = draft.card.data.character_book?.entries;

        if (!entries || toIndex < 0 || toIndex >= entries.length) {
          return;
        }

        const [movedEntry] = entries.splice(fromIndex, 1);

        if (movedEntry) {
          entries.splice(toIndex, 0, movedEntry);
        }
      });
    },
    [mutateActiveCharacter],
  );

  const updatePromptSettings = useCallback(
    (updater: (settings: iCharacterGenerationPromptSettings) => iCharacterGenerationPromptSettings) => {
      mutateActiveCharacter((draft) => {
        draft.promptSettings = sanitizeCharacterGenerationPromptSettings(updater(draft.promptSettings));
      });
    },
    [mutateActiveCharacter],
  );

  const replacePromptSettings = useCallback(
    (nextPromptSettings: iCharacterGenerationPromptSettings) => {
      mutateActiveCharacter((draft) => {
        draft.promptSettings = sanitizeCharacterGenerationPromptSettings(nextPromptSettings);
      });
    },
    [mutateActiveCharacter],
  );

  const replaceCard = useCallback(
    async (nextCard: CharacterCard) => {
      const transaction = mutateActiveCharacter((draft) => {
        draft.card = nextCard;
      });

      if (!transaction) {
        throw new Error('The active character is unavailable.');
      }

      await transaction.isPersisted.promise;
    },
    [mutateActiveCharacter],
  );

  const setActiveCharacterPortrait = useCallback(
    (portrait: iCharacterPortraitReference | null) => {
      mutateActiveCharacter((draft) => {
        draft.portrait = portrait;
      });
    },
    [mutateActiveCharacter],
  );

  const addExampleCharacters = useCallback((nextExampleCharacters: iStoredExampleCharacter[]) => {
    nextExampleCharacters.forEach((exampleCharacter) => {
      exampleCharactersCollection.insert(exampleCharacter);
    });
  }, []);

  const updateExampleCharacterIncludedFields = useCallback(
    (id: string, includedFieldKeys: ExampleCharacterContextFieldKey[]) => {
      if (!exampleCharactersCollection.has(id)) {
        return;
      }

      exampleCharactersCollection.update(id, (draft) => {
        draft.includedFieldKeys = sanitizeExampleCharacterIncludedFieldKeys(includedFieldKeys);
      });
    },
    [],
  );

  const removeExampleCharacter = useCallback((id: string) => {
    if (exampleCharactersCollection.has(id)) {
      exampleCharactersCollection.delete(id);
    }
  }, []);

  const createCharacter = useCallback(
    ({
      card: nextCard,
      portrait,
      promptSettings: nextPromptSettings,
      source,
    }: {
      card?: CharacterCard;
      portrait?: iCharacterPortraitReference | null;
      promptSettings?: iCharacterGenerationPromptSettings;
      source?: CharacterLibrarySource;
    } = {}) => {
      const nextCharacter = createCharacterLibraryItem({
        card: nextCard,
        portrait,
        promptSettings: nextPromptSettings,
        source,
      });

      characterLibraryCollection.insert(nextCharacter);
      setActiveCharacterId(nextCharacter.id);

      return nextCharacter.id;
    },
    [setActiveCharacterId],
  );

  const selectCharacter = useCallback(
    (id: string) => {
      setActiveCharacterId(id);
    },
    [setActiveCharacterId],
  );

  const duplicateCharacter = useCallback(
    ({ id, portrait }: { id: string; portrait?: iCharacterPortraitReference | null }) => {
      const characterToDuplicate = characterLibraryCollection.get(id);

      if (!characterToDuplicate) {
        return null;
      }

      const nextCharacter = createCharacterLibraryItem({
        card: structuredClone(characterToDuplicate.card),
        promptSettings: structuredClone(characterToDuplicate.promptSettings),
        portrait: portrait ?? characterToDuplicate.portrait,
        source: characterToDuplicate.source,
      });

      nextCharacter.card.data.name = createDuplicateCharacterName(characterToDuplicate.card.data.name);

      characterLibraryCollection.insert(nextCharacter);
      setActiveCharacterId(nextCharacter.id);

      return nextCharacter.id;
    },
    [setActiveCharacterId],
  );

  const removeCharacterRecord = useCallback(
    async (id: string) => {
      const persistenceTasks: Promise<unknown>[] = [];
      if (characterLibraryCollection.has(id)) {
        persistenceTasks.push(characterLibraryCollection.delete(id).isPersisted.promise);
      }

      if (characterLibraryCollection.size === 0) {
        const fallbackCharacter = createEmptyCharacterLibraryItem();
        persistenceTasks.push(characterLibraryCollection.insert(fallbackCharacter).isPersisted.promise);
        setActiveCharacterId(fallbackCharacter.id);
      } else {
        const nextActiveCharacter = characterLibraryCollection.values().next().value;
        setActiveCharacterId((currentActiveCharacterId) =>
          currentActiveCharacterId === id
            ? (nextActiveCharacter?.id ?? DEFAULT_CHARACTER_LIBRARY_ITEM_ID)
            : currentActiveCharacterId,
        );
      }

      await Promise.all(persistenceTasks);
    },
    [setActiveCharacterId],
  );

  const removeCharacter = useCallback(
    async (id: string) => {
      const characterToRemove = characterLibraryCollection.get(id);
      await Promise.all([
        characterToRemove?.portrait ? deleteCharacterAssetBlob(characterToRemove.portrait.assetId) : Promise.resolve(),
        removeCharacterAssistantComposerDraft(id),
        removeCharacterAssistantSession(id),
        removeCharacterRecord(id),
      ]);
    },
    [removeCharacterRecord],
  );

  const discardProvisionalCharacter = useCallback(
    async (id: string) => {
      const characterToRemove = characterLibraryCollection.get(id);
      await Promise.all([
        Promise.allSettled([
          characterToRemove?.portrait
            ? deleteCharacterAssetBlob(characterToRemove.portrait.assetId)
            : Promise.resolve(),
        ]),
        removeCharacterAssistantComposerDraft(id),
        removeCharacterAssistantSession(id),
        removeCharacterRecord(id),
      ]);
    },
    [removeCharacterRecord],
  );

  return {
    isCharacterLibraryReady,
    characterLibrary,
    activeCharacterId: activeCharacter?.id ?? DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
    card,
    promptSettings,
    portraitReference,
    exampleCharacters,
    updateField,
    updateTags,
    addGreeting,
    updateGreeting,
    removeGreeting,
    reorderGreetings,
    addCustomField,
    updateCustomField,
    removeCustomField,
    createCharacterBook,
    removeCharacterBook,
    updateCharacterBook,
    addCharacterBookEntry,
    updateCharacterBookEntry,
    removeCharacterBookEntry,
    reorderCharacterBookEntries,
    updatePromptSettings,
    replacePromptSettings,
    addExampleCharacters,
    updateExampleCharacterIncludedFields,
    removeExampleCharacter,
    replaceCard,
    createCharacter,
    selectCharacter,
    duplicateCharacter,
    removeCharacter,
    discardProvisionalCharacter,
    setActiveCharacterPortrait,
  };
}
