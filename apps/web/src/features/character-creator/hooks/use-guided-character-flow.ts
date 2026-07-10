import { useLiveQuery } from '@tanstack/react-db';
import { useCallback, useMemo, useState } from 'react';

import {
  advanceGuidedStep,
  characterAssistantSessionsCollection,
  exitGuidedSession,
  removeGuidedAttachment,
  startGuidedSession,
} from '../collections/character-assistant-sessions.collection';
import { GUIDED_STEP_DEFINITIONS } from '../constants/guided-flow';
import { analyzeCharacterImage } from '../lib/character-vision-client';
import type { iCharacterImageAnalysis } from '../lib/character-vision-contracts';
import { deleteCharacterAssetBlob } from '../lib/image-store';

interface iUseGuidedCharacterFlowOptions {
  characterId: string;
  apiKey: string;
  endpoint: string;
  model: string;
  maxTokens: number;
  temperature: number;
  updateGeneralCharacterIdea: (value: string) => void;
  workspace: {
    hasCompletedCurrentGuidedStepRun: boolean;
  };
}

export function useGuidedCharacterFlow({
  characterId,
  apiKey,
  endpoint,
  model,
  maxTokens,
  temperature,
  updateGeneralCharacterIdea,
  workspace,
}: iUseGuidedCharacterFlowOptions) {
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageAnalysisError, setImageAnalysisError] = useState<string | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<iCharacterImageAnalysis | null>(null);
  const { data: storedSessions } = useLiveQuery((query) =>
    query.from({ session: characterAssistantSessionsCollection }),
  );
  const session = useMemo(
    () => storedSessions.find((storedSession) => storedSession.id === characterId) ?? null,
    [characterId, storedSessions],
  );
  const guidedState = session?.mode === 'guided' ? session.guided : null;
  const isGuidedComplete = Boolean(session?.mode === 'chat' && session.guided?.completedSteps.includes('review'));
  const currentStepDefinition = guidedState ? GUIDED_STEP_DEFINITIONS[guidedState.currentStep] : null;
  const canContinue = Boolean(
    currentStepDefinition && (currentStepDefinition.isSkippable || workspace.hasCompletedCurrentGuidedStepRun),
  );

  const continueToNextStep = useCallback(async () => {
    if (!canContinue) {
      return false;
    }

    await advanceGuidedStep(characterId);
    setLatestAnalysis(null);
    return true;
  }, [canContinue, characterId]);

  const skipStep = useCallback(async () => {
    if (!currentStepDefinition?.isSkippable) {
      return false;
    }

    await advanceGuidedStep(characterId);
    setLatestAnalysis(null);
    return true;
  }, [characterId, currentStepDefinition?.isSkippable]);

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
          model,
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
    [apiKey, characterId, currentStepDefinition?.isImageStepAllowed, endpoint, maxTokens, model, temperature],
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

  const openGuidedSession = useCallback(async () => {
    await startGuidedSession(characterId);
  }, [characterId]);

  const restartGuidedSession = useCallback(async () => {
    await startGuidedSession(characterId);
    setLatestAnalysis(null);
    setImageAnalysisError(null);
  }, [characterId]);

  const leaveGuidedMode = useCallback(async () => {
    await exitGuidedSession(characterId);
  }, [characterId]);

  return {
    guidedState,
    isGuidedComplete,
    currentStepDefinition,
    canContinue,
    isAnalyzingImage,
    imageAnalysisError,
    latestAnalysis,
    continueToNextStep,
    skipStep,
    analyzeImage,
    applyConceptToCard,
    removeImageAttachment,
    openGuidedSession,
    restartGuidedSession,
    exitGuidedMode: leaveGuidedMode,
  };
}
