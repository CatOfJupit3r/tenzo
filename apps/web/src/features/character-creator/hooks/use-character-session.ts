import { useAtom } from 'jotai';
import { useCallback } from 'react';

import { characterCardAtom, exampleCharactersAtom } from '../atoms/character-session.atom';
import { createEmptyCharacterCard } from '../constants/card-defaults';
import type { CharacterCard, CharacterTextFieldKey, CustomField } from '../lib/card-schema';
import { sanitizeExampleCharacterIncludedFieldKeys } from '../lib/example-characters';
import type { ExampleCharacterContextFieldKey, iStoredExampleCharacter } from '../lib/example-characters';

export function useCharacterSession() {
  const [card, setCard] = useAtom(characterCardAtom);
  const [exampleCharacters, setExampleCharacters] = useAtom(exampleCharactersAtom);

  const updateField = useCallback(
    (key: CharacterTextFieldKey, value: string) => {
      setCard((prev) => ({ ...prev, data: { ...prev.data, [key]: value } }));
    },
    [setCard],
  );

  const updateTags = useCallback(
    (tags: string[]) => {
      setCard((prev) => ({ ...prev, data: { ...prev.data, tags } }));
    },
    [setCard],
  );

  const addGreeting = useCallback(() => {
    setCard((prev) => ({
      ...prev,
      data: { ...prev.data, alternate_greetings: [...prev.data.alternate_greetings, ''] },
    }));
  }, [setCard]);

  const updateGreeting = useCallback(
    (index: number, value: string) => {
      setCard((prev) => {
        const alternateGreetings = [...prev.data.alternate_greetings];
        alternateGreetings[index] = value;
        return { ...prev, data: { ...prev.data, alternate_greetings: alternateGreetings } };
      });
    },
    [setCard],
  );

  const removeGreeting = useCallback(
    (index: number) => {
      setCard((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          alternate_greetings: prev.data.alternate_greetings.filter((_, i) => i !== index),
        },
      }));
    },
    [setCard],
  );

  const reorderGreetings = useCallback(
    (fromIndex: number, toIndex: number) => {
      setCard((prev) => {
        const alternateGreetings = [...prev.data.alternate_greetings];
        if (toIndex < 0 || toIndex >= alternateGreetings.length) return prev;
        const [moved] = alternateGreetings.splice(fromIndex, 1);
        if (moved === undefined) return prev;
        alternateGreetings.splice(toIndex, 0, moved);
        return { ...prev, data: { ...prev.data, alternate_greetings: alternateGreetings } };
      });
    },
    [setCard],
  );

  const addCustomField = useCallback(() => {
    setCard((prev) => {
      const customField: CustomField = { id: crypto.randomUUID(), label: '', value: '' };
      return {
        ...prev,
        data: {
          ...prev.data,
          extensions: {
            ...prev.data.extensions,
            custom_fields: [...prev.data.extensions.custom_fields, customField],
          },
        },
      };
    });
  }, [setCard]);

  const updateCustomField = useCallback(
    (id: string, patch: Partial<Pick<CustomField, 'label' | 'value'>>) => {
      setCard((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          extensions: {
            ...prev.data.extensions,
            custom_fields: prev.data.extensions.custom_fields.map((field) =>
              field.id === id ? { ...field, ...patch } : field,
            ),
          },
        },
      }));
    },
    [setCard],
  );

  const removeCustomField = useCallback(
    (id: string) => {
      setCard((prev) => ({
        ...prev,
        data: {
          ...prev.data,
          extensions: {
            ...prev.data.extensions,
            custom_fields: prev.data.extensions.custom_fields.filter((field) => field.id !== id),
          },
        },
      }));
    },
    [setCard],
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
      setCard(nextCard);
    },
    [setCard],
  );

  const resetCard = useCallback(() => {
    setCard(createEmptyCharacterCard());
  }, [setCard]);

  return {
    card,
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
    addExampleCharacters,
    updateExampleCharacterIncludedFields,
    removeExampleCharacter,
    replaceCard,
    resetCard,
  };
}
