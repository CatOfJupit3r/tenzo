import { useLiveQuery } from '@tanstack/react-db';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { generateUuid } from '@~/utils/uuid';

import {
  addCustomizedGuidedDiscoveryCard,
  advanceGuidedStep,
  characterAssistantSessionsCollection,
  exitGuidedSession,
  finishGuidedDiscovery,
  removeGuidedAttachment,
  replaceGeneratedGuidedDiscoveryCardsByCategory,
  selectGuidedStep,
  startGuidedDiscovery,
  startGuidedSession,
  toggleGuidedDiscoveryCardSelection,
} from '../collections/character-assistant-sessions.collection';
import { GUIDED_STEP_DEFINITIONS, GUIDED_STEP_IDS } from '../constants/guided-flow';
import type { GuidedStepId } from '../constants/guided-flow';
import { CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES } from '../lib/character-assistant-contracts';
import type { iCharacterAssistantDiscoveryDirectionCategory } from '../lib/character-assistant-contracts';
import { generateCharacterAssistantDiscoveryDirections } from '../lib/character-assistant-discovery-client';
import {
  buildDeterministicDiscoveryHandoffSummary,
  hasDiscoveryHandoffSelections,
} from '../lib/character-assistant-discovery-state';
import { CHARACTER_ASSISTANT_SESSION_MODES } from '../lib/character-assistant-session';
import { analyzeCharacterImage } from '../lib/character-vision-client';
import type { iCharacterImageAnalysis } from '../lib/character-vision-contracts';
import { deleteCharacterAssetBlob } from '../lib/image-store';

type iDiscoveryCategoryGenerationState = Record<
  iCharacterAssistantDiscoveryDirectionCategory,
  {
    isRunning: boolean;
    errorMessage: string | null;
  }
>;

interface iUseGuidedCharacterFlowOptions {
  characterId: string;
  apiKey: string;
  endpoint: string;
  model: string;
  visionModel: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  topK: number;
  minP: number;
  updateGeneralCharacterIdea: (value: string) => void;
  workspace: {
    hasCompletedCurrentGuidedStepRun: boolean;
  };
}

const DISCOVERY_CATEGORIES = [
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['relationship-dynamic'],
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
] as const satisfies readonly iCharacterAssistantDiscoveryDirectionCategory[];

function createEmptyDiscoveryCategoryGenerationState() {
  const state = {} as iDiscoveryCategoryGenerationState;

  DISCOVERY_CATEGORIES.forEach((category) => {
    state[category] = { isRunning: false, errorMessage: null };
  });

  return state;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function createDiscoveryControllerMap() {
  const entries = DISCOVERY_CATEGORIES.map((category) => [category, null] as const);
  return Object.fromEntries(entries) as Record<iCharacterAssistantDiscoveryDirectionCategory, AbortController | null>;
}

export function useGuidedCharacterFlow({
  characterId,
  apiKey,
  endpoint,
  model,
  visionModel,
  maxTokens,
  temperature,
  topP,
  frequencyPenalty,
  presencePenalty,
  topK,
  minP,
  updateGeneralCharacterIdea,
  workspace,
}: iUseGuidedCharacterFlowOptions) {
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysisError, setImageAnalysisError] = useState<string | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<iCharacterImageAnalysis | null>(null);
  const [discoveryCategoryGenerationState, setDiscoveryCategoryGenerationState] =
    useState<iDiscoveryCategoryGenerationState>(createEmptyDiscoveryCategoryGenerationState);
  const discoveryControllersRef = useRef(createDiscoveryControllerMap());
  const { data: storedSessions } = useLiveQuery((query) =>
    query.from({ session: characterAssistantSessionsCollection }),
  );
  const session = useMemo(
    () => storedSessions.find((storedSession) => storedSession.id === characterId) ?? null,
    [characterId, storedSessions],
  );
  const savedGuidedState = session?.guided ?? null;
  const guidedState = session?.mode === CHARACTER_ASSISTANT_SESSION_MODES.guided ? session.guided : null;
  const discoveryState = guidedState?.discovery;
  const hasCompletedDiscovery = guidedState
    ? hasDiscoveryHandoffSelections(guidedState.discoveryHandoffSummary)
    : false;
  const isGuidedDiscoveryMode =
    guidedState?.currentStep === GUIDED_STEP_IDS.concept &&
    Boolean(discoveryState?.originalPremise.trim()) &&
    !hasCompletedDiscovery;
  const isGuidedComplete = Boolean(session?.mode === 'chat' && session.guided?.completedSteps.includes('review'));
  const currentStepDefinition = guidedState ? GUIDED_STEP_DEFINITIONS[guidedState.currentStep] : null;
  const hasPersistedCurrentGuidedStepRun = Boolean(guidedState?.completedSteps.includes(guidedState.currentStep));
  const canContinue = Boolean(
    currentStepDefinition &&
    (isGuidedDiscoveryMode
      ? guidedState?.discovery?.isReadyForHandoff
      : currentStepDefinition.isSkippable ||
        workspace.hasCompletedCurrentGuidedStepRun ||
        hasPersistedCurrentGuidedStepRun),
  );
  const discoveryHandoffSummary = guidedState ? buildDeterministicDiscoveryHandoffSummary(guidedState.discovery) : null;

  useEffect(
    () => () => {
      DISCOVERY_CATEGORIES.forEach((category) => {
        discoveryControllersRef.current[category]?.abort();
        discoveryControllersRef.current[category] = null;
      });
    },
    [],
  );

  const setCategoryGenerationState = useCallback(
    (
      category: iCharacterAssistantDiscoveryDirectionCategory,
      patch: Partial<iDiscoveryCategoryGenerationState[iCharacterAssistantDiscoveryDirectionCategory]>,
    ) => {
      setDiscoveryCategoryGenerationState((currentState) => ({
        ...currentState,
        [category]: {
          ...currentState[category],
          ...patch,
        },
      }));
    },
    [],
  );

  const generateDirectionsForCategory = useCallback(
    async (
      category: iCharacterAssistantDiscoveryDirectionCategory,
      originalPremise: string,
      targetCharacterId = characterId,
    ) => {
      const controller = new AbortController();
      const previousController = discoveryControllersRef.current[category];
      if (previousController) {
        previousController.abort();
      }

      discoveryControllersRef.current[category] = controller;
      setCategoryGenerationState(category, { isRunning: true, errorMessage: null });

      try {
        const cards = await generateCharacterAssistantDiscoveryDirections({
          endpoint,
          apiKey,
          model,
          maxTokens,
          temperature,
          topP,
          frequencyPenalty,
          presencePenalty,
          topK,
          minP,
          originalPremise,
          category,
          signal: controller.signal,
        });

        await replaceGeneratedGuidedDiscoveryCardsByCategory(targetCharacterId, category, cards);
      } catch (error) {
        if (!isAbortError(error)) {
          const message = error instanceof Error ? error.message : 'Discovery directions could not be regenerated.';
          setCategoryGenerationState(category, { errorMessage: message });
          throw error;
        }
      } finally {
        if (discoveryControllersRef.current[category] === controller) {
          discoveryControllersRef.current[category] = null;
        }

        setCategoryGenerationState(category, { isRunning: false });
      }
    },
    [
      apiKey,
      endpoint,
      frequencyPenalty,
      maxTokens,
      minP,
      model,
      presencePenalty,
      setCategoryGenerationState,
      topK,
      topP,
      temperature,
      characterId,
    ],
  );

  const startGuidedDiscoverySession = useCallback(
    async (originalPremise: string, targetCharacterId = characterId) => {
      const normalizedPremise = originalPremise.trim();
      if (!normalizedPremise) {
        throw new Error('Discovery premise must not be empty.');
      }

      setDiscoveryCategoryGenerationState(createEmptyDiscoveryCategoryGenerationState());
      await startGuidedSession(targetCharacterId);
      await startGuidedDiscovery(targetCharacterId, normalizedPremise);

      const generationTasks = DISCOVERY_CATEGORIES.map(async (category) => {
        try {
          await generateDirectionsForCategory(category, normalizedPremise, targetCharacterId);
        } catch (error) {
          setCategoryGenerationState(category, {
            errorMessage: error instanceof Error ? error.message : 'Discovery directions could not be regenerated.',
          });
        }
      });

      await Promise.allSettled(generationTasks);
    },
    [characterId, generateDirectionsForCategory, setCategoryGenerationState],
  );

  const continueToNextStep = useCallback(async () => {
    if (!canContinue) {
      return false;
    }

    if (isGuidedDiscoveryMode) {
      await finishGuidedDiscovery(characterId);
      setLatestAnalysis(null);
      return true;
    }

    await advanceGuidedStep(characterId);
    setLatestAnalysis(null);
    return true;
  }, [canContinue, characterId, isGuidedDiscoveryMode]);

  const skipStep = useCallback(async () => {
    if (!currentStepDefinition?.isSkippable) {
      return false;
    }

    await advanceGuidedStep(characterId);
    setLatestAnalysis(null);
    return true;
  }, [characterId, currentStepDefinition?.isSkippable]);

  const navigateToStep = useCallback(
    async (stepId: GuidedStepId) => {
      if (!savedGuidedState) {
        return false;
      }

      await selectGuidedStep(characterId, stepId);
      setLatestAnalysis(null);
      setImageAnalysisError(null);
      return true;
    },
    [characterId, savedGuidedState],
  );

  const analyzeImage = useCallback(
    async (file: File, userHint?: string) => {
      if (!currentStepDefinition?.isImageStepAllowed) {
        throw new Error('Image analysis is available during the appearance step.');
      }

      setIsAnalyzingImage(true);
      setImageAnalysisError(null);

      try {
        const result = await analyzeCharacterImage({
          characterId,
          file,
          endpoint,
          apiKey,
          model: visionModel,
          maxTokens,
          temperature,
          userHint,
        });
        setLatestAnalysis(result.analysis);
        return result.analysis;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The image could not be analyzed.';
        setImageAnalysisError(message);
        throw error;
      } finally {
        setIsAnalyzingImage(false);
      }
    },
    [apiKey, characterId, currentStepDefinition?.isImageStepAllowed, endpoint, maxTokens, temperature, visionModel],
  );

  const applyConceptToCard = useCallback(() => {
    const concept = guidedState?.concept;
    if (concept) {
      updateGeneralCharacterIdea(concept.premise);
    }
  }, [guidedState?.concept, updateGeneralCharacterIdea]);

  const removeImageAttachment = useCallback(
    async (attachmentId: string) => {
      await removeGuidedAttachment(characterId, attachmentId);
      await deleteCharacterAssetBlob(`guided-ref:${characterId}:${attachmentId}`);
      setLatestAnalysis(null);
    },
    [characterId],
  );

  const regenerateDiscoveryCategory = useCallback(
    async (category: iCharacterAssistantDiscoveryDirectionCategory) => {
      const normalizedPremise = discoveryState?.originalPremise.trim() ?? '';
      if (!normalizedPremise) {
        return;
      }

      await generateDirectionsForCategory(category, normalizedPremise);
    },
    [discoveryState?.originalPremise, generateDirectionsForCategory],
  );

  const toggleDiscoverySelection = useCallback(
    async (cardId: string) => {
      await toggleGuidedDiscoveryCardSelection(characterId, cardId);
    },
    [characterId],
  );

  const createDiscoveryCustomVariant = useCallback(
    async (sourceCardId: string, title: string, description: string) => {
      await addCustomizedGuidedDiscoveryCard(characterId, sourceCardId, {
        id: generateUuid(),
        title,
        description,
      });
    },
    [characterId],
  );

  const cancelDiscoveryGeneration = useCallback(
    (category: iCharacterAssistantDiscoveryDirectionCategory) => {
      const controller = discoveryControllersRef.current[category];
      if (controller) {
        controller.abort();
        discoveryControllersRef.current[category] = null;
      }

      setCategoryGenerationState(category, { isRunning: false });
    },
    [setCategoryGenerationState],
  );

  const openGuidedSession = useCallback(
    async (targetCharacterId = characterId) => {
      await startGuidedSession(targetCharacterId);
      setLatestAnalysis(null);
      setImageAnalysisError(null);
      setDiscoveryCategoryGenerationState(createEmptyDiscoveryCategoryGenerationState());
    },
    [characterId],
  );

  const restartGuidedSession = useCallback(async () => {
    await startGuidedSession(characterId);
    setLatestAnalysis(null);
    setImageAnalysisError(null);
    setDiscoveryCategoryGenerationState(createEmptyDiscoveryCategoryGenerationState());
  }, [characterId]);

  const leaveGuidedMode = useCallback(async () => {
    await exitGuidedSession(characterId);
  }, [characterId]);

  return {
    guidedState,
    savedGuidedState,
    isGuidedComplete,
    currentStepDefinition,
    canContinue,
    isAnalyzingImage,
    imageAnalysisError,
    latestAnalysis,
    continueToNextStep,
    skipStep,
    navigateToStep,
    analyzeImage,
    applyConceptToCard,
    removeImageAttachment,
    openGuidedSession,
    restartGuidedSession,
    exitGuidedMode: leaveGuidedMode,
    isGuidedDiscoveryMode,
    discoveryCategoryGenerationState,
    discoveryHandoffSummary,
    startGuidedDiscoverySession,
    regenerateDiscoveryCategory,
    cancelDiscoveryGeneration,
    toggleDiscoverySelection,
    createDiscoveryCustomVariant,
  };
}
