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
import {
  decodeStoredSecret,
  encodeStoredSecret,
  REQUEST_MODES,
  sanitizeCharacterGenerationConnectionSettings,
  sanitizeCharacterGenerationSettings,
} from '../lib/generation-config';
import type { iCharacterGenerationConnectionSettings } from '../lib/generation-config';
import { buildGenerationMessages, getGenerationTargetKey } from '../lib/prompt-builder';
import type { iFieldGenerationTarget, iPromptExampleCharacter } from '../lib/prompt-builder';
import { probeProviderMetadata } from '../lib/provider-health';
import { requestProviderHealthProxy } from '../lib/provider-health-proxy';
import { getPrefilled, parseResponse } from '../lib/response-parser';
import { useCharacterSession } from './use-character-session';

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
  maxExampleContextCharacters?: number;
}

interface iConnectionHealthState {
  isChecking: boolean;
  errorMessage: string | null;
  providerName: string | null;
  providerKind: 'koboldcpp' | 'openai-compatible' | 'unknown' | null;
  availableModels: string[];
  detectedModel: string | null;
  detectedContextSize: number | null;
}

function removeFieldInstruction(instructions: Record<string, string>, instructionKey: string) {
  const { [instructionKey]: _removedInstruction, ...remainingInstructions } = instructions;
  return remainingInstructions;
}

function removeFieldShouldUseGeneralCharacterIdea(
  fieldShouldUseGeneralCharacterIdea: Record<string, boolean>,
  instructionKey: string,
) {
  const { [instructionKey]: shouldRemovePreference, ...remainingPreferences } = fieldShouldUseGeneralCharacterIdea;
  void shouldRemovePreference;
  return remainingPreferences;
}

export function useGeneration() {
  const [storedGenerationSettings, setGenerationSettings] = useAtom(characterGenerationSettingsAtom);
  const { promptSettings, updatePromptSettings } = useCharacterSession();
  const connectionSettings = useMemo(
    () => sanitizeCharacterGenerationConnectionSettings(storedGenerationSettings),
    [storedGenerationSettings],
  );
  const generationSettings = useMemo(
    () => sanitizeCharacterGenerationSettings({ ...connectionSettings, ...promptSettings }),
    [connectionSettings, promptSettings],
  );
  const requestProxy = useServerFn(requestChatCompletionsProxy);
  const requestProviderHealth = useServerFn(requestProviderHealthProxy);
  const [runtimeStates, setRuntimeStates] = useState<Record<string, iFieldGenerationRuntimeState>>({});
  const [connectionHealth, setConnectionHealth] = useState<iConnectionHealthState>({
    isChecking: false,
    errorMessage: null,
    providerName: null,
    providerKind: null,
    availableModels: [],
    detectedModel: null,
    detectedContextSize: null,
  });
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const apiKey = useMemo(
    () => decodeStoredSecret(connectionSettings.apiKeyCiphertext),
    [connectionSettings.apiKeyCiphertext],
  );

  const setFieldRuntimeState = useCallback((fieldKey: string, nextState: iFieldGenerationRuntimeState) => {
    setRuntimeStates((prev) => ({ ...prev, [fieldKey]: nextState }));
  }, []);

  const updateGenerationSettings = useCallback(
    (
      patch: Partial<
        Omit<
          iCharacterGenerationConnectionSettings,
          'apiKeyCiphertext' | 'fieldInstructions' | 'fieldShouldUseGeneralCharacterIdea' | 'generalCharacterIdea'
        >
      >,
    ) => {
      setGenerationSettings((prev) => ({ ...sanitizeCharacterGenerationConnectionSettings(prev), ...patch }));
    },
    [setGenerationSettings],
  );

  const updateApiKey = useCallback(
    (nextApiKey: string) => {
      setGenerationSettings((prev) => ({
        ...sanitizeCharacterGenerationConnectionSettings(prev),
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
      updatePromptSettings((prev) => ({
        ...prev,
        fieldInstructions: value.trim()
          ? { ...prev.fieldInstructions, [fieldKey]: value }
          : removeFieldInstruction(prev.fieldInstructions, fieldKey),
      }));
    },
    [updatePromptSettings],
  );

  const getGeneralCharacterIdea = useCallback(() => generationSettings.generalCharacterIdea, [generationSettings]);

  const updateGeneralCharacterIdea = useCallback(
    (value: string) => {
      updatePromptSettings((prev) => ({
        ...prev,
        generalCharacterIdea: value,
      }));
    },
    [updatePromptSettings],
  );

  const shouldUseGeneralCharacterIdea = useCallback(
    (fieldKey: string) => generationSettings.fieldShouldUseGeneralCharacterIdea[fieldKey] ?? true,
    [generationSettings.fieldShouldUseGeneralCharacterIdea],
  );

  const updateFieldShouldUseGeneralCharacterIdea = useCallback(
    (fieldKey: string, value: boolean) => {
      updatePromptSettings((prev) => ({
        ...prev,
        fieldShouldUseGeneralCharacterIdea: value
          ? removeFieldShouldUseGeneralCharacterIdea(prev.fieldShouldUseGeneralCharacterIdea, fieldKey)
          : { ...prev.fieldShouldUseGeneralCharacterIdea, [fieldKey]: false },
      }));
    },
    [updatePromptSettings],
  );

  const removeCustomFieldInstruction = useCallback(
    (customFieldId: string) => {
      const instructionKey = `custom:${customFieldId}`;

      updatePromptSettings((prev) => ({
        ...prev,
        fieldInstructions: removeFieldInstruction(prev.fieldInstructions, instructionKey),
        fieldShouldUseGeneralCharacterIdea: removeFieldShouldUseGeneralCharacterIdea(
          prev.fieldShouldUseGeneralCharacterIdea,
          instructionKey,
        ),
      }));
    },
    [updatePromptSettings],
  );

  const removeAlternateGreetingInstruction = useCallback(
    (index: number) => {
      updatePromptSettings((prev) => {
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
        const nextFieldShouldUseGeneralCharacterIdea = Object.entries(prev.fieldShouldUseGeneralCharacterIdea).reduce<
          Record<string, boolean>
        >((acc, [key, value]) => {
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
        }, {});

        return {
          ...prev,
          fieldInstructions: nextInstructions,
          fieldShouldUseGeneralCharacterIdea: nextFieldShouldUseGeneralCharacterIdea,
        };
      });
    },
    [updatePromptSettings],
  );

  const reorderAlternateGreetingInstructions = useCallback(
    (fromIndex: number, toIndex: number) => {
      updatePromptSettings((prev) => {
        const nextInstructions = { ...prev.fieldInstructions };
        const nextFieldShouldUseGeneralCharacterIdea = { ...prev.fieldShouldUseGeneralCharacterIdea };
        const fromKey = `alternate_greetings:${fromIndex}`;
        const toKey = `alternate_greetings:${toIndex}`;
        const fromValue = nextInstructions[fromKey];
        const toValue = nextInstructions[toKey];
        const shouldUseGeneralIdeaFromSourceField = nextFieldShouldUseGeneralCharacterIdea[fromKey];
        const shouldUseGeneralIdeaFromTargetField = nextFieldShouldUseGeneralCharacterIdea[toKey];

        if (
          fromValue === undefined &&
          toValue === undefined &&
          shouldUseGeneralIdeaFromSourceField === undefined &&
          shouldUseGeneralIdeaFromTargetField === undefined
        ) {
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

        if (shouldUseGeneralIdeaFromSourceField === undefined) {
          delete nextFieldShouldUseGeneralCharacterIdea[toKey];
        } else {
          nextFieldShouldUseGeneralCharacterIdea[toKey] = shouldUseGeneralIdeaFromSourceField;
        }

        if (shouldUseGeneralIdeaFromTargetField === undefined) {
          delete nextFieldShouldUseGeneralCharacterIdea[fromKey];
        } else {
          nextFieldShouldUseGeneralCharacterIdea[fromKey] = shouldUseGeneralIdeaFromTargetField;
        }

        return {
          ...prev,
          fieldInstructions: nextInstructions,
          fieldShouldUseGeneralCharacterIdea: nextFieldShouldUseGeneralCharacterIdea,
        };
      });
    },
    [updatePromptSettings],
  );

  const clearDynamicFieldInstructions = useCallback(() => {
    updatePromptSettings((prev) => ({
      ...prev,
      fieldInstructions: Object.fromEntries(
        Object.entries(prev.fieldInstructions).filter(
          ([key]) => !key.startsWith('alternate_greetings:') && !key.startsWith('custom:'),
        ),
      ),
      fieldShouldUseGeneralCharacterIdea: Object.fromEntries(
        Object.entries(prev.fieldShouldUseGeneralCharacterIdea).filter(
          ([key]) => !key.startsWith('alternate_greetings:') && !key.startsWith('custom:'),
        ),
      ),
    }));
  }, [updatePromptSettings]);

  const cancelGeneration = useCallback((fieldKey: string) => {
    abortControllersRef.current[fieldKey]?.abort();
  }, []);

  const probeConnection = useCallback(async () => {
    if (!connectionSettings.endpoint.trim()) {
      throw new Error('Set an API endpoint before running a health check.');
    }

    setConnectionHealth((prev) => ({
      ...prev,
      isChecking: true,
      errorMessage: null,
    }));

    try {
      const requestData = {
        endpoint: connectionSettings.endpoint,
        apiKey,
        requestMode: connectionSettings.requestMode,
      };
      const result =
        connectionSettings.requestMode === REQUEST_MODES.browser
          ? await probeProviderMetadata(requestData)
          : await requestProviderHealth({ data: requestData });

      const nextModel =
        result.currentModel ??
        (connectionSettings.model.trim() && result.models.includes(connectionSettings.model.trim())
          ? connectionSettings.model.trim()
          : (result.models[0] ?? null));

      setConnectionHealth({
        isChecking: false,
        errorMessage: null,
        providerName: result.providerName,
        providerKind: result.providerKind,
        availableModels: result.models,
        detectedModel: nextModel,
        detectedContextSize: result.contextSize,
      });

      setGenerationSettings((prev) => ({
        ...sanitizeCharacterGenerationConnectionSettings(prev),
        model: nextModel ?? sanitizeCharacterGenerationConnectionSettings(prev).model,
        contextSize: result.contextSize ?? sanitizeCharacterGenerationConnectionSettings(prev).contextSize,
      }));

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Health check failed.';
      setConnectionHealth((prev) => ({
        ...prev,
        isChecking: false,
        errorMessage,
      }));
      throw error;
    }
  }, [
    apiKey,
    connectionSettings.endpoint,
    connectionSettings.model,
    connectionSettings.requestMode,
    requestProviderHealth,
    setGenerationSettings,
  ]);

  const generateField = useCallback(
    async ({
      card,
      target,
      onValueChange,
      isContinuation = false,
      exampleCharacters = [],
      maxExampleContextCharacters,
    }: iGenerateFieldOptions) => {
      if (!connectionSettings.endpoint.trim()) {
        throw new Error('Set an API endpoint before generating.');
      }

      if (!connectionSettings.model.trim()) {
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
          endpoint: connectionSettings.endpoint,
          apiKey,
          model: connectionSettings.model,
          maxTokens: connectionSettings.maxTokens,
          messages: buildGenerationMessages({
            card,
            target,
            outputFormat: connectionSettings.outputFormat,
            generalCharacterIdea: promptSettings.generalCharacterIdea,
            shouldUseGeneralCharacterIdea: shouldUseGeneralCharacterIdea(fieldKey),
            userInstructions: getFieldInstruction(fieldKey),
            exampleCharacters,
            maxExampleContextCharacters,
          }),
        };

        const response =
          connectionSettings.requestMode === REQUEST_MODES.browser
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
                ? `${getPrefilled(target.value, connectionSettings.outputFormat)}${streamedAssistantText}`
                : streamedAssistantText;
              const parsedResponse = parseResponse(rawResponse, connectionSettings.outputFormat);

              startTransition(() => {
                onValueChange(parsedResponse);
              });
            } catch {
              // Partial structured responses are expected mid-stream.
            }
          },
        });

        const finalRawResponse = isContinuation
          ? `${getPrefilled(target.value, connectionSettings.outputFormat)}${streamedAssistantText}`
          : streamedAssistantText;
        const finalParsedResponse = parseResponse(finalRawResponse, connectionSettings.outputFormat);

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
    [
      apiKey,
      connectionSettings,
      getFieldInstruction,
      promptSettings.generalCharacterIdea,
      requestProxy,
      shouldUseGeneralCharacterIdea,
      setFieldRuntimeState,
    ],
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
    getGeneralCharacterIdea,
    updateGeneralCharacterIdea,
    getFieldInstruction,
    updateFieldInstruction,
    shouldUseGeneralCharacterIdea,
    updateFieldShouldUseGeneralCharacterIdea,
    removeCustomFieldInstruction,
    removeAlternateGreetingInstruction,
    reorderAlternateGreetingInstructions,
    clearDynamicFieldInstructions,
    connectionHealth,
    probeConnection,
    generateField,
    cancelGeneration,
    getFieldRuntime,
  };
}
