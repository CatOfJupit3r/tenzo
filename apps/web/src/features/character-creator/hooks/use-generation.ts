import { useServerFn } from '@tanstack/react-start';
import { useAtom } from 'jotai';
import { startTransition, useCallback, useMemo, useRef, useState } from 'react';

import { characterGenerationSettingsAtom } from '../atoms/character-generation.atom';
import {
  buildProviderErrorMessage,
  executeBrowserChatCompletionsRequest,
  readChatCompletionsResponse,
} from '../lib/api-client';
import type { CharacterCard } from '../lib/card-schema';
import { requestChatCompletionsProxy } from '../lib/chat-completions-proxy';
import { decodeStoredSecret, encodeStoredSecret, REQUEST_MODES } from '../lib/generation-config';
import type { iCharacterGenerationSettings } from '../lib/generation-config';
import { buildGenerationMessages, getGenerationTargetKey } from '../lib/prompt-builder';
import type { iFieldGenerationTarget, iPromptExampleCharacter } from '../lib/prompt-builder';
import { getPrefilled, parseResponse } from '../lib/response-parser';

interface iFieldGenerationRuntimeState {
  isGenerating: boolean;
  errorMessage: string | null;
}

interface iGenerateFieldOptions {
  card: CharacterCard;
  target: iFieldGenerationTarget;
  onValueChange: (value: string) => void;
  isContinuation?: boolean;
  exampleCharacters?: iPromptExampleCharacter[];
}

function removeFieldInstruction(instructions: Record<string, string>, instructionKey: string) {
  const { [instructionKey]: _removedInstruction, ...remainingInstructions } = instructions;
  return remainingInstructions;
}

export function useGeneration() {
  const [generationSettings, setGenerationSettings] = useAtom(characterGenerationSettingsAtom);
  const requestProxy = useServerFn(requestChatCompletionsProxy);
  const [runtimeStates, setRuntimeStates] = useState<Record<string, iFieldGenerationRuntimeState>>({});
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const apiKey = useMemo(
    () => decodeStoredSecret(generationSettings.apiKeyCiphertext),
    [generationSettings.apiKeyCiphertext],
  );

  const setFieldRuntimeState = useCallback((fieldKey: string, nextState: iFieldGenerationRuntimeState) => {
    setRuntimeStates((prev) => ({ ...prev, [fieldKey]: nextState }));
  }, []);

  const updateGenerationSettings = useCallback(
    (patch: Partial<Omit<iCharacterGenerationSettings, 'fieldInstructions' | 'apiKeyCiphertext'>>) => {
      setGenerationSettings((prev) => ({ ...prev, ...patch }));
    },
    [setGenerationSettings],
  );

  const updateApiKey = useCallback(
    (nextApiKey: string) => {
      setGenerationSettings((prev) => ({
        ...prev,
        apiKeyCiphertext: encodeStoredSecret(nextApiKey.trim()),
      }));
    },
    [setGenerationSettings],
  );

  const getFieldInstruction = useCallback(
    (fieldKey: string) => generationSettings.fieldInstructions[fieldKey] ?? '',
    [generationSettings.fieldInstructions],
  );

  const updateFieldInstruction = useCallback(
    (fieldKey: string, value: string) => {
      setGenerationSettings((prev) => ({
        ...prev,
        fieldInstructions: value.trim()
          ? { ...prev.fieldInstructions, [fieldKey]: value }
          : removeFieldInstruction(prev.fieldInstructions, fieldKey),
      }));
    },
    [setGenerationSettings],
  );

  const removeCustomFieldInstruction = useCallback(
    (customFieldId: string) => {
      const instructionKey = `custom:${customFieldId}`;
      setGenerationSettings((prev) => ({
        ...prev,
        fieldInstructions: removeFieldInstruction(prev.fieldInstructions, instructionKey),
      }));
    },
    [setGenerationSettings],
  );

  const removeAlternateGreetingInstruction = useCallback(
    (index: number) => {
      setGenerationSettings((prev) => {
        const nextInstructions = Object.entries(prev.fieldInstructions).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            if (!key.startsWith('alternate_greetings:')) {
              acc[key] = value;
              return acc;
            }

            const instructionIndex = Number.parseInt(key.split(':')[1] ?? '', 10);
            if (Number.isNaN(instructionIndex) || instructionIndex === index) {
              return acc;
            }

            const nextKey = instructionIndex > index ? `alternate_greetings:${instructionIndex - 1}` : key;
            acc[nextKey] = value;
            return acc;
          },
          {},
        );

        return { ...prev, fieldInstructions: nextInstructions };
      });
    },
    [setGenerationSettings],
  );

  const reorderAlternateGreetingInstructions = useCallback(
    (fromIndex: number, toIndex: number) => {
      setGenerationSettings((prev) => {
        const nextInstructions = { ...prev.fieldInstructions };
        const fromKey = `alternate_greetings:${fromIndex}`;
        const toKey = `alternate_greetings:${toIndex}`;
        const fromValue = nextInstructions[fromKey];
        const toValue = nextInstructions[toKey];

        if (fromValue === undefined && toValue === undefined) {
          return prev;
        }

        if (fromValue === undefined) {
          delete nextInstructions[toKey];
        } else {
          nextInstructions[toKey] = fromValue;
        }

        if (toValue === undefined) {
          delete nextInstructions[fromKey];
        } else {
          nextInstructions[fromKey] = toValue;
        }

        return { ...prev, fieldInstructions: nextInstructions };
      });
    },
    [setGenerationSettings],
  );

  const clearDynamicFieldInstructions = useCallback(() => {
    setGenerationSettings((prev) => ({
      ...prev,
      fieldInstructions: Object.fromEntries(
        Object.entries(prev.fieldInstructions).filter(
          ([key]) => !key.startsWith('alternate_greetings:') && !key.startsWith('custom:'),
        ),
      ),
    }));
  }, [setGenerationSettings]);

  const cancelGeneration = useCallback((fieldKey: string) => {
    abortControllersRef.current[fieldKey]?.abort();
  }, []);

  const generateField = useCallback(
    async ({ card, target, onValueChange, isContinuation = false, exampleCharacters = [] }: iGenerateFieldOptions) => {
      if (!generationSettings.endpoint.trim()) {
        throw new Error('Set an API endpoint before generating.');
      }

      if (!generationSettings.model.trim()) {
        throw new Error('Set a model name before generating.');
      }

      if (!apiKey.trim()) {
        throw new Error('Set an API key before generating.');
      }

      const fieldKey = getGenerationTargetKey(target);
      const abortController = new AbortController();
      abortControllersRef.current[fieldKey] = abortController;
      setFieldRuntimeState(fieldKey, { isGenerating: true, errorMessage: null });

      if (!isContinuation) {
        startTransition(() => {
          onValueChange('');
        });
      }

      let streamedAssistantText = '';

      try {
        const requestData = {
          endpoint: generationSettings.endpoint,
          apiKey,
          model: generationSettings.model,
          maxTokens: generationSettings.maxTokens,
          messages: buildGenerationMessages({
            card,
            target,
            outputFormat: generationSettings.outputFormat,
            userInstructions: getFieldInstruction(fieldKey),
            exampleCharacters,
          }),
        };

        const response =
          generationSettings.requestMode === REQUEST_MODES.browser
            ? await executeBrowserChatCompletionsRequest(requestData, abortController.signal)
            : await requestProxy({ data: requestData, signal: abortController.signal });

        if (!response.ok) {
          throw new Error(await buildProviderErrorMessage(response));
        }

        await readChatCompletionsResponse({
          response,
          signal: abortController.signal,
          onContent: (content) => {
            streamedAssistantText += content;

            try {
              const rawResponse = isContinuation
                ? `${getPrefilled(target.value, generationSettings.outputFormat)}${streamedAssistantText}`
                : streamedAssistantText;
              const parsedResponse = parseResponse(rawResponse, generationSettings.outputFormat);
              startTransition(() => {
                onValueChange(parsedResponse);
              });
            } catch {
              // Partial structured responses are expected mid-stream.
            }
          },
        });

        const finalRawResponse = isContinuation
          ? `${getPrefilled(target.value, generationSettings.outputFormat)}${streamedAssistantText}`
          : streamedAssistantText;
        const finalParsedResponse = parseResponse(finalRawResponse, generationSettings.outputFormat);

        startTransition(() => {
          onValueChange(finalParsedResponse);
        });

        setFieldRuntimeState(fieldKey, { isGenerating: false, errorMessage: null });
      } catch (error) {
        if (abortController.signal.aborted) {
          setFieldRuntimeState(fieldKey, { isGenerating: false, errorMessage: null });
          return;
        }

        const errorMessage = error instanceof Error ? error.message : 'Generation failed.';
        setFieldRuntimeState(fieldKey, { isGenerating: false, errorMessage });
        throw error;
      } finally {
        delete abortControllersRef.current[fieldKey];
      }
    },
    [apiKey, generationSettings, getFieldInstruction, requestProxy, setFieldRuntimeState],
  );

  const getFieldRuntime = useCallback(
    (fieldKey: string): iFieldGenerationRuntimeState =>
      runtimeStates[fieldKey] ?? { isGenerating: false, errorMessage: null },
    [runtimeStates],
  );

  return {
    generationSettings,
    apiKey,
    updateApiKey,
    updateGenerationSettings,
    getFieldInstruction,
    updateFieldInstruction,
    removeCustomFieldInstruction,
    removeAlternateGreetingInstruction,
    reorderAlternateGreetingInstructions,
    clearDynamicFieldInstructions,
    generateField,
    cancelGeneration,
    getFieldRuntime,
  };
}
