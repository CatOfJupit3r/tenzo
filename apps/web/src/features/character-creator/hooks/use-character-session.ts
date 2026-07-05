import { useLiveQuery } from '@tanstack/react-db';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { activeCharacterIdAtom } from '../atoms/character-session.atom';
import { characterLibraryCollection } from '../collections/character-library.collection';
import { exampleCharactersCollection } from '../collections/example-characters.collection';
import { createEmptyCharacterCard } from '../constants/card-defaults';
import type { CharacterCard, CharacterTextFieldKey, CustomField } from '../lib/card-schema';
import {
  createCharacterLibraryItem,
  createDuplicateCharacterName,
  createEmptyCharacterLibraryItem,
  DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
} from '../lib/character-library';
import type {
  CharacterLibrarySource,
  iCharacterLibraryItem,
  iCharacterPortraitReference,
} from '../lib/character-library';
import { sanitizeExampleCharacterIncludedFieldKeys } from '../lib/example-characters';
import type { ExampleCharacterContextFieldKey, iStoredExampleCharacter } from '../lib/example-characters';
import {
  DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS,
  sanitizeCharacterGenerationPromptSettings,
} from '../lib/generation-config';
import type { iCharacterGenerationPromptSettings } from '../lib/generation-config';
import { ensurePortraitAssetLoaded } from '../lib/portrait-asset-cache';
import { renderPortraitThumbnailDataUrl } from '../lib/portrait-focal-point';
import { useCharacterLibraryList } from './use-character-library-list';

export function useCharacterSession() {
  const [activeCharacterId, setActiveCharacterId] = useAtom(activeCharacterIdAtom);
  const backfilledThumbnailIdsRef = useRef<Set<string>>(new Set());

  const { characterLibrary, isCharacterLibraryReady } = useCharacterLibraryList();

  const { data: exampleCharacters } = useLiveQuery((query) =>
    query.from({ example: exampleCharactersCollection }).orderBy(({ example }) => example.fileName, 'asc'),
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
        return;
      }

      characterLibraryCollection.update(activeCharacterKey, (draft) => {
        // The card schema applies defaults, so the draft's input type widens some
        // fields to optional; at runtime they are always populated.
        recipe(draft as iCharacterLibraryItem);
        draft.updatedAt = new Date().toISOString();
      });
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
      const customField: CustomField = { id: crypto.randomUUID(), label: '', value: '' };
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
    (nextCard: CharacterCard) => {
      mutateActiveCharacter((draft) => {
        draft.card = nextCard;
      });
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

  const removeCharacter = useCallback(
    (id: string) => {
      if (characterLibraryCollection.has(id)) {
        characterLibraryCollection.delete(id);
      }

      if (characterLibraryCollection.size === 0) {
        const fallbackCharacter = createEmptyCharacterLibraryItem();
        characterLibraryCollection.insert(fallbackCharacter);
        setActiveCharacterId(fallbackCharacter.id);
        return;
      }

      if (activeCharacterId === id) {
        const nextActiveCharacter = characterLibraryCollection.values().next().value;
        setActiveCharacterId(nextActiveCharacter?.id ?? DEFAULT_CHARACTER_LIBRARY_ITEM_ID);
      }
    },
    [activeCharacterId, setActiveCharacterId],
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
    setActiveCharacterPortrait,
  };
}
