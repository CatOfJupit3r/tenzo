import { useAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { localStorageApi } from '@~/db/storage';

import { activeCharacterIdAtom, characterLibraryAtom, exampleCharactersAtom } from '../atoms/character-session.atom';
import { createEmptyCharacterCard } from '../constants/card-defaults';
import type { CharacterCard, CharacterTextFieldKey, CustomField } from '../lib/card-schema';
import {
  CHARACTER_LIBRARY_SOURCES,
  DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
  createDuplicateCharacterName,
  createCharacterLibraryItem,
  createEmptyCharacterLibraryItem,
  hasMeaningfulCharacterCardData,
  sanitizeCharacterLibrary,
  sanitizeCharacterPortraitReference,
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
  sanitizeCharacterGenerationSettings,
} from '../lib/generation-config';
import type { iCharacterGenerationPromptSettings } from '../lib/generation-config';

const CHARACTER_LIBRARY_STORAGE_KEY = 'tenzo:character-creator:library';
const LEGACY_CARD_STORAGE_KEY = 'tenzo:character-creator:card';
const LEGACY_PORTRAIT_STORAGE_KEY = 'tenzo:character-creator:portrait';
const LEGACY_GENERATION_SETTINGS_STORAGE_KEY = 'tenzo:character-creator:generation-settings';

function parseStoredJsonValue(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function touchCharacter(
  character: iCharacterLibraryItem,
  patch: Partial<iCharacterLibraryItem>,
): iCharacterLibraryItem {
  return {
    ...character,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

function migrateLegacyCharacterLibraryItem(): iCharacterLibraryItem | null {
  const legacyCardValue = parseStoredJsonValue(localStorageApi.getItem(LEGACY_CARD_STORAGE_KEY));
  const legacyPortraitValue = parseStoredJsonValue(localStorageApi.getItem(LEGACY_PORTRAIT_STORAGE_KEY));
  const legacyGenerationSettingsValue = parseStoredJsonValue(
    localStorageApi.getItem(LEGACY_GENERATION_SETTINGS_STORAGE_KEY),
  );
  const legacyGenerationSettings = sanitizeCharacterGenerationSettings(legacyGenerationSettingsValue);

  if (!legacyCardValue || typeof legacyCardValue !== 'object') {
    return null;
  }

  const legacyLibrary = sanitizeCharacterLibrary([
    {
      id: DEFAULT_CHARACTER_LIBRARY_ITEM_ID,
      card: legacyCardValue,
      portrait: sanitizeCharacterPortraitReference(legacyPortraitValue),
      promptSettings: sanitizeCharacterGenerationPromptSettings(legacyGenerationSettings),
      source: CHARACTER_LIBRARY_SOURCES.manual,
    },
  ]);

  const migratedCharacter = legacyLibrary[0];

  if (!migratedCharacter) {
    return null;
  }

  if (!hasMeaningfulCharacterCardData(migratedCharacter.card) && migratedCharacter.portrait === null) {
    return null;
  }

  return migratedCharacter;
}

export function useCharacterSession() {
  const [characterLibrary, setCharacterLibrary] = useAtom(characterLibraryAtom);
  const [activeCharacterId, setActiveCharacterId] = useAtom(activeCharacterIdAtom);
  const [exampleCharacters, setExampleCharacters] = useAtom(exampleCharactersAtom);
  const hasInitializedLibraryRef = useRef(false);

  useEffect(() => {
    if (hasInitializedLibraryRef.current) {
      return;
    }

    hasInitializedLibraryRef.current = true;

    const hasStoredLibrary = localStorageApi.getItem(CHARACTER_LIBRARY_STORAGE_KEY) !== null;

    if (hasStoredLibrary) {
      return;
    }

    const migratedCharacter = migrateLegacyCharacterLibraryItem();

    if (migratedCharacter) {
      setCharacterLibrary([migratedCharacter]);
      setActiveCharacterId(migratedCharacter.id);
    }
  }, [setActiveCharacterId, setCharacterLibrary]);

  useEffect(() => {
    if (characterLibrary.length > 0) {
      return;
    }

    const fallbackCharacter = createEmptyCharacterLibraryItem();
    setCharacterLibrary([fallbackCharacter]);
    setActiveCharacterId(fallbackCharacter.id);
  }, [characterLibrary.length, setActiveCharacterId, setCharacterLibrary]);

  const activeCharacter = useMemo(
    () => characterLibrary.find((character) => character.id === activeCharacterId) ?? characterLibrary[0] ?? null,
    [activeCharacterId, characterLibrary],
  );

  useEffect(() => {
    if (!activeCharacter) {
      return;
    }

    if (activeCharacter.id !== activeCharacterId) {
      setActiveCharacterId(activeCharacter.id);
    }
  }, [activeCharacter, activeCharacterId, setActiveCharacterId]);

  const card = activeCharacter?.card ?? createEmptyCharacterCard();
  const promptSettings = activeCharacter?.promptSettings ?? DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS;
  const portraitReference = activeCharacter?.portrait ?? null;

  const updateActiveCharacter = useCallback(
    (updater: (character: iCharacterLibraryItem) => iCharacterLibraryItem) => {
      setCharacterLibrary((prev) =>
        prev.map((character) => (character.id === activeCharacter?.id ? updater(character) : character)),
      );
    },
    [activeCharacter?.id, setCharacterLibrary],
  );

  const updateField = useCallback(
    (key: CharacterTextFieldKey, value: string) => {
      updateActiveCharacter((character) =>
        touchCharacter(character, {
          card: { ...character.card, data: { ...character.card.data, [key]: value } },
        }),
      );
    },
    [updateActiveCharacter],
  );

  const updateTags = useCallback(
    (tags: string[]) => {
      updateActiveCharacter((character) =>
        touchCharacter(character, {
          card: { ...character.card, data: { ...character.card.data, tags } },
        }),
      );
    },
    [updateActiveCharacter],
  );

  const addGreeting = useCallback(() => {
    updateActiveCharacter((character) =>
      touchCharacter(character, {
        card: {
          ...character.card,
          data: {
            ...character.card.data,
            alternate_greetings: [...character.card.data.alternate_greetings, ''],
          },
        },
      }),
    );
  }, [updateActiveCharacter]);

  const updateGreeting = useCallback(
    (index: number, value: string) => {
      updateActiveCharacter((character) => {
        const alternateGreetings = [...character.card.data.alternate_greetings];
        alternateGreetings[index] = value;

        return touchCharacter(character, {
          card: { ...character.card, data: { ...character.card.data, alternate_greetings: alternateGreetings } },
        });
      });
    },
    [updateActiveCharacter],
  );

  const removeGreeting = useCallback(
    (index: number) => {
      updateActiveCharacter((character) =>
        touchCharacter(character, {
          card: {
            ...character.card,
            data: {
              ...character.card.data,
              alternate_greetings: character.card.data.alternate_greetings.filter(
                (_, itemIndex) => itemIndex !== index,
              ),
            },
          },
        }),
      );
    },
    [updateActiveCharacter],
  );

  const reorderGreetings = useCallback(
    (fromIndex: number, toIndex: number) => {
      updateActiveCharacter((character) => {
        const alternateGreetings = [...character.card.data.alternate_greetings];

        if (toIndex < 0 || toIndex >= alternateGreetings.length) {
          return character;
        }

        const [movedGreeting] = alternateGreetings.splice(fromIndex, 1);

        if (movedGreeting === undefined) {
          return character;
        }

        alternateGreetings.splice(toIndex, 0, movedGreeting);

        return touchCharacter(character, {
          card: { ...character.card, data: { ...character.card.data, alternate_greetings: alternateGreetings } },
        });
      });
    },
    [updateActiveCharacter],
  );

  const addCustomField = useCallback(() => {
    updateActiveCharacter((character) => {
      const customField: CustomField = { id: crypto.randomUUID(), label: '', value: '' };

      return touchCharacter(character, {
        card: {
          ...character.card,
          data: {
            ...character.card.data,
            extensions: {
              ...character.card.data.extensions,
              custom_fields: [...character.card.data.extensions.custom_fields, customField],
            },
          },
        },
      });
    });
  }, [updateActiveCharacter]);

  const updateCustomField = useCallback(
    (id: string, patch: Partial<Pick<CustomField, 'label' | 'value'>>) => {
      updateActiveCharacter((character) =>
        touchCharacter(character, {
          card: {
            ...character.card,
            data: {
              ...character.card.data,
              extensions: {
                ...character.card.data.extensions,
                custom_fields: character.card.data.extensions.custom_fields.map((field) =>
                  field.id === id ? { ...field, ...patch } : field,
                ),
              },
            },
          },
        }),
      );
    },
    [updateActiveCharacter],
  );

  const removeCustomField = useCallback(
    (id: string) => {
      updateActiveCharacter((character) =>
        touchCharacter(character, {
          card: {
            ...character.card,
            data: {
              ...character.card.data,
              extensions: {
                ...character.card.data.extensions,
                custom_fields: character.card.data.extensions.custom_fields.filter((field) => field.id !== id),
              },
            },
          },
        }),
      );
    },
    [updateActiveCharacter],
  );

  const updatePromptSettings = useCallback(
    (updater: (settings: iCharacterGenerationPromptSettings) => iCharacterGenerationPromptSettings) => {
      updateActiveCharacter((character) =>
        touchCharacter(character, {
          promptSettings: sanitizeCharacterGenerationPromptSettings(updater(character.promptSettings)),
        }),
      );
    },
    [updateActiveCharacter],
  );

  const addExampleCharacters = useCallback(
    (nextExampleCharacters: iStoredExampleCharacter[]) => {
      setExampleCharacters((prev) => [...prev, ...nextExampleCharacters]);
    },
    [setExampleCharacters],
  );

  const updateExampleCharacterIncludedFields = useCallback(
    (id: string, includedFieldKeys: ExampleCharacterContextFieldKey[]) => {
      setExampleCharacters((prev) =>
        prev.map((exampleCharacter) =>
          exampleCharacter.id === id
            ? {
                ...exampleCharacter,
                includedFieldKeys: sanitizeExampleCharacterIncludedFieldKeys(includedFieldKeys),
              }
            : exampleCharacter,
        ),
      );
    },
    [setExampleCharacters],
  );

  const removeExampleCharacter = useCallback(
    (id: string) => {
      setExampleCharacters((prev) => prev.filter((exampleCharacter) => exampleCharacter.id !== id));
    },
    [setExampleCharacters],
  );

  const replaceCard = useCallback(
    (nextCard: CharacterCard) => {
      updateActiveCharacter((character) => touchCharacter(character, { card: nextCard }));
    },
    [updateActiveCharacter],
  );

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

      setCharacterLibrary((prev) => [...prev, nextCharacter]);
      setActiveCharacterId(nextCharacter.id);

      return nextCharacter.id;
    },
    [setActiveCharacterId, setCharacterLibrary],
  );

  const selectCharacter = useCallback(
    (id: string) => {
      setActiveCharacterId(id);
    },
    [setActiveCharacterId],
  );

  const duplicateCharacter = useCallback(
    ({
      id,
      portrait,
    }: {
      id: string;
      portrait?: iCharacterPortraitReference | null;
    }) => {
      const characterToDuplicate = characterLibrary.find((character) => character.id === id);

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

      setCharacterLibrary((prev) => [...prev, nextCharacter]);
      setActiveCharacterId(nextCharacter.id);

      return nextCharacter.id;
    },
    [characterLibrary, setActiveCharacterId, setCharacterLibrary],
  );

  const removeCharacter = useCallback(
    (id: string) => {
      setCharacterLibrary((prev) => {
        const filteredCharacters = prev.filter((character) => character.id !== id);

        if (filteredCharacters.length > 0) {
          return filteredCharacters;
        }

        return [createEmptyCharacterLibraryItem()];
      });

      if (activeCharacterId === id) {
        const nextActiveCharacter = characterLibrary.find((character) => character.id !== id);
        setActiveCharacterId(nextActiveCharacter?.id ?? DEFAULT_CHARACTER_LIBRARY_ITEM_ID);
      }
    },
    [activeCharacterId, characterLibrary, setActiveCharacterId, setCharacterLibrary],
  );

  const setActiveCharacterPortrait = useCallback(
    (portrait: iCharacterPortraitReference | null) => {
      updateActiveCharacter((character) => touchCharacter(character, { portrait }));
    },
    [updateActiveCharacter],
  );

  const replacePromptSettings = useCallback(
    (nextPromptSettings: iCharacterGenerationPromptSettings) => {
      updateActiveCharacter((character) =>
        touchCharacter(character, {
          promptSettings: sanitizeCharacterGenerationPromptSettings(nextPromptSettings),
        }),
      );
    },
    [updateActiveCharacter],
  );

  return {
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
