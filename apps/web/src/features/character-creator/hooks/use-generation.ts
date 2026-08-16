import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useAtom } from 'jotai';
import { startTransition, useCallback, useMemo, useRef, useState } from 'react';

import { INTERVALS } from '@~/constants/dates';

import { characterGenerationSettingsAtom } from '../atoms/character-generation.atom';
import type { CharacterCard } from '../lib/cards/card-schema';
import { TEMPLATE_MODES } from '../lib/cards/field-templates';
import {
  decodeStoredSecret,
  encodeStoredSecret,
  REQUEST_MODES,
  sanitizeCharacterGenerationConnectionSettings,
  sanitizeCharacterGenerationSettings,
} from '../lib/generation/generation-config';
import type { iCharacterGenerationConnectionSettings } from '../lib/generation/generation-config';
import { getPrefilled, parseResponse } from '../lib/generation/response-parser';
import { parseSlotResponse, renderStrictTemplate } from '../lib/generation/strict-template-renderer';
import { streamCharacterText } from '../lib/generation/tanstack-ai-text-generation';
import { buildGenerationErrorMessage, readTextResponseStream } from '../lib/generation/text-response-stream';
import { GENERATION_MODES, GENERATION_TARGET_KINDS, getGenerationTargetKey } from '../lib/prompt/generation-contracts';
import type {
  GenerationMode,
  iFieldGenerationTarget,
  iPromptExampleCharacter,
  iPromptFieldTemplate,
} from '../lib/prompt/generation-contracts';
import { characterPromptPipeline } from '../lib/prompt/prompt-pipeline';
import { SeededRandom } from '../lib/prompt/seeded-random';
import type { iModelCapabilities, iModelProviderOption } from '../lib/provider/model-capabilities';
import { probeProviderMetadata, PROVIDER_KINDS } from '../lib/provider/provider-health';
import type { iProviderModelOption, ProviderKind } from '../lib/provider/provider-health';
import { requestProviderHealthProxy } from '../lib/provider/provider-health-proxy';
import { useCharacterSession } from './use-character-session';

interface iFieldGenerationRuntimeState {
  isGenerating: boolean;
  errorMessage: string | null;
}

interface iGenerateFieldOptions {
  card: CharacterCard;
  target: iFieldGenerationTarget;
  onValueChange: (value: string) => void;
  mode?: GenerationMode;
  fieldTemplate?: iPromptFieldTemplate | null;
  exampleCharacters?: iPromptExampleCharacter[];
  maxExampleContextCharacters?: number;
}

interface iConnectionHealthState {
  isChecking: boolean;
  hasCompletedCheck: boolean;
  errorMessage: string | null;
  providerName: string | null;
  providerKind: ProviderKind | null;
  availableModels: iProviderModelOption[];
  detectedModel: string | null;
  detectedContextSize: number | null;
  modelContextSizes: Record<string, number>;
  modelCapabilities: Record<string, iModelCapabilities>;
  modelProviders: iModelProviderOption[];
}

const PROVIDER_HEALTH_QUERY_KEY = 'provider-health';

function getCredentialCacheKey(apiKey: string) {
  let hash = 0;

  for (let index = 0; index < apiKey.length; index += 1) {
    hash = (hash * 31 + apiKey.charCodeAt(index)) % 2_147_483_647;
  }

  return `${apiKey.length}:${hash.toString(36)}`;
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

function reindexAlternateGreetingRecord<T>(record: Record<string, T>, removedIndex: number) {
  return Object.entries(record).reduce<Record<string, T>>((acc, [key, value]) => {
    if (!key.startsWith('alternate_greetings:')) {
      acc[key] = value;
      return acc;
    }

    const instructionIndex = Number.parseInt(key.split(':')[1] ?? '', 10);

    if (Number.isNaN(instructionIndex) || instructionIndex === removedIndex) {
      return acc;
    }

    const nextKey = instructionIndex > removedIndex ? `alternate_greetings:${instructionIndex - 1}` : key;
    acc[nextKey] = value;
    return acc;
  }, {});
}

function swapRecordKeys<T>(record: Record<string, T>, fromKey: string, toKey: string) {
  const nextRecord = { ...record };
  const fromValue = nextRecord[fromKey];
  const toValue = nextRecord[toKey];

  if (fromValue === undefined) {
    delete nextRecord[toKey];
  } else {
    nextRecord[toKey] = fromValue;
  }

  if (toValue === undefined) {
    delete nextRecord[fromKey];
  } else {
    nextRecord[fromKey] = toValue;
  }

  return nextRecord;
}

export function useGeneration() {
  const queryClient = useQueryClient();
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
  const requestProviderHealth = useServerFn(requestProviderHealthProxy);
  const [runtimeStates, setRuntimeStates] = useState<Record<string, iFieldGenerationRuntimeState>>({});
  const [connectionHealth, setConnectionHealth] = useState<iConnectionHealthState>({
    isChecking: false,
    hasCompletedCheck: false,
    errorMessage: null,
    providerName: null,
    providerKind: null,
    availableModels: [],
    detectedModel: null,
    detectedContextSize: null,
    modelContextSizes: {},
    modelCapabilities: {},
    modelProviders: [],
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

  const getFieldTemplateId = useCallback(
    (fieldKey: string) => generationSettings.fieldTemplateIds[fieldKey] ?? null,
    [generationSettings.fieldTemplateIds],
  );

  const updateFieldTemplateId = useCallback(
    (fieldKey: string, templateId: string | null) => {
      updatePromptSettings((prev) => ({
        ...prev,
        fieldTemplateIds: templateId
          ? { ...prev.fieldTemplateIds, [fieldKey]: templateId }
          : removeFieldInstruction(prev.fieldTemplateIds, fieldKey),
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
        fieldTemplateIds: removeFieldInstruction(prev.fieldTemplateIds, instructionKey),
      }));
    },
    [updatePromptSettings],
  );

  const removeAlternateGreetingInstruction = useCallback(
    (index: number) => {
      updatePromptSettings((prev) => ({
        ...prev,
        fieldInstructions: reindexAlternateGreetingRecord(prev.fieldInstructions, index),
        fieldShouldUseGeneralCharacterIdea: reindexAlternateGreetingRecord(
          prev.fieldShouldUseGeneralCharacterIdea,
          index,
        ),
        fieldTemplateIds: reindexAlternateGreetingRecord(prev.fieldTemplateIds, index),
      }));
    },
    [updatePromptSettings],
  );

  const reorderAlternateGreetingInstructions = useCallback(
    (fromIndex: number, toIndex: number) => {
      updatePromptSettings((prev) => {
        const fromKey = `alternate_greetings:${fromIndex}`;
        const toKey = `alternate_greetings:${toIndex}`;

        return {
          ...prev,
          fieldInstructions: swapRecordKeys(prev.fieldInstructions, fromKey, toKey),
          fieldShouldUseGeneralCharacterIdea: swapRecordKeys(prev.fieldShouldUseGeneralCharacterIdea, fromKey, toKey),
          fieldTemplateIds: swapRecordKeys(prev.fieldTemplateIds, fromKey, toKey),
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
      fieldTemplateIds: Object.fromEntries(
        Object.entries(prev.fieldTemplateIds).filter(
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
      hasCompletedCheck: false,
      errorMessage: null,
    }));

    try {
      const requestData = {
        endpoint: connectionSettings.endpoint,
        apiKey,
        requestMode: connectionSettings.requestMode,
        model: connectionSettings.model,
        openRouterProvider: connectionSettings.openRouterProvider,
      };
      const result = await queryClient.fetchQuery({
        queryKey: [
          PROVIDER_HEALTH_QUERY_KEY,
          connectionSettings.requestMode,
          connectionSettings.endpoint,
          connectionSettings.model,
          connectionSettings.openRouterProvider,
          getCredentialCacheKey(apiKey),
        ],
        queryFn: async () =>
          connectionSettings.requestMode === REQUEST_MODES.browser
            ? probeProviderMetadata(requestData)
            : requestProviderHealth({ data: requestData }),
        staleTime: INTERVALS.FIVE_MINUTES,
        gcTime: INTERVALS.THIRTY_MINUTES,
      });

      const nextModel =
        result.currentModel ??
        (connectionSettings.model.trim() &&
        result.models.some((model) => model.value === connectionSettings.model.trim())
          ? connectionSettings.model.trim()
          : (result.models[0]?.value ?? null));

      setConnectionHealth({
        isChecking: false,
        hasCompletedCheck: true,
        errorMessage: null,
        providerName: result.providerName,
        providerKind: result.providerKind,
        availableModels: result.models,
        detectedModel: nextModel,
        detectedContextSize: result.contextSize,
        modelContextSizes: result.modelContextSizes,
        modelCapabilities: result.modelCapabilities,
        modelProviders: result.modelProviders,
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
    connectionSettings.openRouterProvider,
    connectionSettings.requestMode,
    queryClient,
    requestProviderHealth,
    setGenerationSettings,
  ]);

  const generateField = useCallback(
    async ({
      card,
      target,
      onValueChange,
      mode = GENERATION_MODES.generate,
      fieldTemplate = null,
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

      const isContinuation = mode === GENERATION_MODES.continue;
      const strictTemplate = !isContinuation && fieldTemplate?.mode === TEMPLATE_MODES.strict ? fieldTemplate : null;

      if (!isContinuation) {
        startTransition(() => {
          onValueChange('');
        });
      }

      const parseStreamedResponse = (streamedText: string) => {
        if (strictTemplate) {
          return renderStrictTemplate(strictTemplate.content, parseSlotResponse(streamedText));
        }

        const rawResponse = isContinuation
          ? `${getPrefilled(target.value, connectionSettings.outputFormat)}${streamedText}`
          : streamedText;
        return parseResponse(rawResponse, connectionSettings.outputFormat);
      };

      let streamedAssistantText = '';

      try {
        const promptResult = characterPromptPipeline.build({
          card,
          target,
          outputFormat: connectionSettings.outputFormat,
          seed: SeededRandom.generateSeed(),
          mode,
          globalCharacterInstruction: connectionSettings.globalCharacterInstruction,
          generalCharacterIdea: promptSettings.generalCharacterIdea,
          shouldUseGeneralCharacterIdea:
            target.kind !== GENERATION_TARGET_KINDS['general-character-idea'] &&
            shouldUseGeneralCharacterIdea(fieldKey),
          userInstructions: getFieldInstruction(fieldKey),
          fieldTemplate,
          exampleCharacters,
          maxExampleContextCharacters,
        });
        const requestData = {
          provider: connectionSettings.provider,
          endpoint: connectionSettings.endpoint,
          apiKey,
          model: connectionSettings.model,
          openRouterProvider: connectionSettings.openRouterProvider,
          maxTokens: connectionSettings.maxTokens,
          temperature: connectionSettings.temperature,
          topP: connectionSettings.topP,
          frequencyPenalty: connectionSettings.frequencyPenalty,
          presencePenalty: connectionSettings.presencePenalty,
          topK: connectionSettings.topK,
          minP: connectionSettings.minP,
          shouldSendDisabledSamplers: connectionHealth.providerKind === PROVIDER_KINDS.koboldcpp,
          messages: promptResult.messages,
        };

        if (connectionSettings.requestMode === REQUEST_MODES.browser) {
          const result = streamCharacterText({
            ...requestData,
            signal: abortController.signal,
          });

          for await (const content of result.textStream) {
            streamedAssistantText += content;

            try {
              const parsedResponse = parseStreamedResponse(streamedAssistantText);

              startTransition(() => {
                onValueChange(parsedResponse);
              });
            } catch {
              // Partial structured responses are expected mid-stream.
            }
          }
        } else {
          const response = await fetch('/api/character-generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData),
            signal: abortController.signal,
          });

          if (!response.ok) {
            throw new Error(await buildGenerationErrorMessage(response));
          }

          await readTextResponseStream({
            response,
            signal: abortController.signal,
            onContent: (content) => {
              streamedAssistantText += content;

              try {
                const parsedResponse = parseStreamedResponse(streamedAssistantText);

                startTransition(() => {
                  onValueChange(parsedResponse);
                });
              } catch {
                // Partial structured responses are expected mid-stream.
              }
            },
          });
        }

        const finalParsedResponse = parseStreamedResponse(streamedAssistantText);

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
      connectionHealth.providerKind,
      connectionSettings,
      getFieldInstruction,
      promptSettings.generalCharacterIdea,
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
    getFieldTemplateId,
    updateFieldTemplateId,
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
