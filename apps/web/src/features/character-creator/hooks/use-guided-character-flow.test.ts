import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GUIDED_STEP_IDS, GUIDED_STEP_SEQUENCE, getNextGuidedStepId } from '../constants/guided-flow';
import type { GuidedStepId } from '../constants/guided-step-id';
import { CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES } from '../lib/character-assistant-contracts';
import type {
  iCharacterAssistantDiscoveryDirectionCard,
  iCharacterAssistantDiscoveryDirectionCategory,
} from '../lib/character-assistant-contracts';
import {
  buildDeterministicDiscoveryHandoffSummary,
  createCustomizedDirectionCard,
  replaceGeneratedDiscoveryCardsByCategory,
  toggleDirectionCardSelection,
} from '../lib/character-assistant-discovery-state';
import {
  createDiscoveryHandoffSummaryDefault,
  createCharacterAssistantSession,
  CHARACTER_ASSISTANT_SESSION_MODES,
} from '../lib/character-assistant-session';
import { GENERATION_PROVIDERS } from '../lib/generation-config';
import {
  DISCOVERY_CATEGORY_TIMEOUT_MS,
  DISCOVERY_LONG_RUNNING_THRESHOLD_MS,
  useGuidedCharacterFlow,
} from './use-guided-character-flow';

type iMockSession = ReturnType<typeof createCharacterAssistantSession>;

const mockSessions = new Map<string, iMockSession>();
const mockGenerationErrors = new Set<iCharacterAssistantDiscoveryDirectionCategory>();
const mockGenerationModels: string[] = [];
const mockHangingGenerationCategories = new Set<iCharacterAssistantDiscoveryDirectionCategory>();
const mockDiscoveredCardsByCategory = new Map<
  iCharacterAssistantDiscoveryDirectionCategory,
  iCharacterAssistantDiscoveryDirectionCard[]
>();

function resetMockSessions() {
  mockSessions.clear();
}

function getMockSession(characterId: string) {
  return mockSessions.get(characterId) ?? null;
}

function ensureGuidedState(session: iMockSession) {
  if (!session.guided) {
    throw new Error(`Character session ${session.id} is not in guided mode.`);
  }

  return session.guided;
}

function createGeneratedCardsForCategory(category: iCharacterAssistantDiscoveryDirectionCategory, index: number) {
  return {
    id: `${category}-${index}`,
    category,
    title: `${category} direction ${index}`,
    description: `${category} variation ${index}`,
    sourceCardId: null,
    isUserAuthored: false,
  };
}

function assertDirectionCard(card: iCharacterAssistantDiscoveryDirectionCard | undefined, description: string) {
  if (!card) {
    throw new Error(`Expected ${description} direction card`);
  }

  return card;
}

function createDiscoverySession(characterId: string): iMockSession {
  const baseSession = createCharacterAssistantSession(characterId);
  return {
    ...baseSession,
    mode: CHARACTER_ASSISTANT_SESSION_MODES.guided,
    guided: {
      currentStep: GUIDED_STEP_IDS.concept,
      completedSteps: [],
      concept: null,
      attachments: [],
      discovery: {
        originalPremise: '',
        cards: [],
        selectedCardIds: [],
        isReadyForHandoff: false,
      },
      discoveryHandoffSummary: createDiscoveryHandoffSummaryDefault(),
    },
  } satisfies iMockSession;
}

vi.mock('@tanstack/react-db', () => ({
  useLiveQuery: vi.fn(() => ({ data: [...mockSessions.values()] })),
}));

vi.mock('../collections/character-assistant-sessions.collection', () => ({
  characterAssistantSessionsCollection: {
    get: (characterId: string) => mockSessions.get(characterId),
  },
  startGuidedSession: vi.fn(async (characterId: string) => {
    const nextSession = mockSessions.get(characterId) ?? createDiscoverySession(characterId);
    mockSessions.set(characterId, {
      ...nextSession,
      mode: CHARACTER_ASSISTANT_SESSION_MODES.guided,
      guided: {
        currentStep: GUIDED_STEP_IDS.concept,
        completedSteps: [],
        concept: null,
        attachments: [],
        discovery: {
          originalPremise: '',
          cards: [],
          selectedCardIds: [],
          isReadyForHandoff: false,
        },
        discoveryHandoffSummary: createDiscoveryHandoffSummaryDefault(),
      },
    });
    return getMockSession(characterId);
  }),
  exitGuidedSession: vi.fn(async (characterId: string) => {
    const currentSession = mockSessions.get(characterId);
    if (!currentSession) {
      return null;
    }

    mockSessions.set(characterId, {
      ...currentSession,
      mode: CHARACTER_ASSISTANT_SESSION_MODES.chat,
    });
    return getMockSession(characterId);
  }),
  startGuidedDiscovery: vi.fn(async (characterId: string, originalPremise: string) => {
    const currentSession = mockSessions.get(characterId);
    if (!currentSession?.guided) {
      return null;
    }

    mockSessions.set(characterId, {
      ...currentSession,
      guided: {
        ...currentSession.guided,
        discovery: {
          originalPremise,
          cards: [],
          selectedCardIds: [],
          isReadyForHandoff: false,
        },
      },
    });
    return getMockSession(characterId);
  }),
  replaceGeneratedGuidedDiscoveryCardsByCategory: vi.fn(
    async (characterId: string, category: iCharacterAssistantDiscoveryDirectionCategory, generatedCards) => {
      const currentSession = mockSessions.get(characterId);
      if (!currentSession?.guided) {
        return null;
      }

      const guidedState = ensureGuidedState(currentSession);
      mockSessions.set(characterId, {
        ...currentSession,
        guided: {
          ...guidedState,
          discovery: replaceGeneratedDiscoveryCardsByCategory(guidedState.discovery, category, generatedCards),
        },
      });
      return getMockSession(characterId);
    },
  ),
  toggleGuidedDiscoveryCardSelection: vi.fn(async (characterId: string, cardId: string) => {
    const currentSession = mockSessions.get(characterId);
    if (!currentSession?.guided) {
      return null;
    }

    const guidedState = ensureGuidedState(currentSession);
    mockSessions.set(characterId, {
      ...currentSession,
      guided: {
        ...guidedState,
        discovery: toggleDirectionCardSelection(guidedState.discovery, cardId),
      },
    });
    return getMockSession(characterId);
  }),
  addCustomizedGuidedDiscoveryCard: vi.fn(
    async (
      characterId: string,
      sourceCardId: string,
      customCard: { id: string; title: string; description: string },
    ) => {
      const currentSession = mockSessions.get(characterId);
      if (!currentSession?.guided) {
        return null;
      }

      const guidedState = ensureGuidedState(currentSession);
      mockSessions.set(characterId, {
        ...currentSession,
        guided: {
          ...guidedState,
          discovery: createCustomizedDirectionCard(guidedState.discovery, sourceCardId, customCard),
        },
      });
      return getMockSession(characterId);
    },
  ),
  finishGuidedDiscovery: vi.fn(async (characterId: string) => {
    const currentSession = mockSessions.get(characterId);
    if (!currentSession?.guided) {
      return null;
    }

    const guidedState = ensureGuidedState(currentSession);
    mockSessions.set(characterId, {
      ...currentSession,
      guided: {
        ...guidedState,
        discoveryHandoffSummary: buildDeterministicDiscoveryHandoffSummary(guidedState.discovery),
      },
    });
    return getMockSession(characterId);
  }),
  advanceGuidedStep: vi.fn(async (characterId: string) => {
    const currentSession = mockSessions.get(characterId);
    if (!currentSession?.guided) {
      return null;
    }

    const guidedState = ensureGuidedState(currentSession);
    const nextStep = getNextGuidedStepId(guidedState.currentStep);
    mockSessions.set(characterId, {
      ...currentSession,
      mode: nextStep ? currentSession.mode : CHARACTER_ASSISTANT_SESSION_MODES.chat,
      guided: {
        ...guidedState,
        completedSteps: [...guidedState.completedSteps, guidedState.currentStep].filter(
          (step, index, steps) => index === steps.indexOf(step),
        ),
        currentStep: nextStep ?? guidedState.currentStep,
      },
    });
    return getMockSession(characterId);
  }),
  selectGuidedStep: vi.fn(async (characterId: string, stepId: GuidedStepId) => {
    const currentSession = mockSessions.get(characterId);
    if (!currentSession?.guided) {
      return null;
    }

    mockSessions.set(characterId, {
      ...currentSession,
      mode: CHARACTER_ASSISTANT_SESSION_MODES.guided,
      guided: {
        ...currentSession.guided,
        currentStep: stepId,
      },
    });
    return getMockSession(characterId);
  }),
  removeGuidedAttachment: vi.fn(async () => null),
}));

vi.mock('../lib/character-assistant-discovery-client', () => ({
  generateCharacterAssistantDiscoveryDirections: vi.fn(
    async ({
      category,
      model,
      signal,
    }: {
      category: iCharacterAssistantDiscoveryDirectionCategory;
      model: string;
      signal: AbortSignal;
    }) => {
      mockGenerationModels.push(model);
      if (mockHangingGenerationCategories.has(category)) {
        await new Promise((_, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      }
      if (mockGenerationErrors.has(category)) {
        throw new Error(`Generation for ${category} failed.`);
      }

      const categoryCards = mockDiscoveredCardsByCategory.get(category) ?? [
        createGeneratedCardsForCategory(category, 1),
        createGeneratedCardsForCategory(category, 2),
        createGeneratedCardsForCategory(category, 3),
      ];

      return categoryCards;
    },
  ),
}));

vi.mock('@~/utils/uuid', () => ({
  generateUuid: vi.fn(() => 'custom-variant-1'),
}));

function renderGuidedFlow(
  characterId: string,
  options: { hasUnresolvedProposals?: boolean; updateGeneralCharacterIdea?: (value: string) => unknown } = {},
) {
  return renderHook(() =>
    useGuidedCharacterFlow({
      characterId,
      apiKey: 'key',
      provider: GENERATION_PROVIDERS.koboldcpp,
      endpoint: 'https://api.example.com',
      model: 'model',
      visionModel: 'vision-model',
      maxTokens: 1024,
      temperature: 0.8,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      topK: 0,
      minP: 0,
      updateGeneralCharacterIdea: options.updateGeneralCharacterIdea ?? vi.fn(),
      workspace: {
        hasCompletedCurrentGuidedStepRun: false,
        hasUnresolvedProposals: options.hasUnresolvedProposals ?? false,
      },
    }),
  );
}

beforeEach(() => {
  resetMockSessions();
  mockGenerationErrors.clear();
  mockGenerationModels.length = 0;
  mockHangingGenerationCategories.clear();
  mockDiscoveredCardsByCategory.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('use-guided-character-flow discovery orchestration', () => {
  it('starts direct guided flow without a discovery premise', async () => {
    const characterId = 'character-direct';
    const { result, rerender } = renderGuidedFlow(characterId);
    await act(async () => {
      await result.current.openGuidedSession();
    });
    rerender();

    const session = getMockSession(characterId);
    expect(session?.guided?.discovery.originalPremise).toBe('');
    expect(result.current.isGuidedDiscoveryMode).toBe(false);
  });

  it('keeps a completed current step available to continue after runtime state is lost', async () => {
    const characterId = 'character-resumed-step';
    const { result, rerender } = renderGuidedFlow(characterId);
    await act(async () => {
      await result.current.openGuidedSession();
    });

    const session = getMockSession(characterId);
    if (!session?.guided) {
      throw new Error('Expected a guided session.');
    }
    session.guided.completedSteps.push(session.guided.currentStep);
    rerender();

    expect(result.current.canContinue).toBe(true);
  });

  it('switches directly between prompt scaffolds without clearing the guided session', async () => {
    const characterId = 'character-step-navigation';
    const { result, rerender } = renderGuidedFlow(characterId);
    await act(async () => {
      await result.current.openGuidedSession();
    });

    const session = getMockSession(characterId);
    if (!session?.guided) {
      throw new Error('Expected a guided session.');
    }
    session.guided.completedSteps.push(GUIDED_STEP_IDS.appearance);

    await act(async () => {
      await result.current.navigateToStep(GUIDED_STEP_IDS.scenario);
    });
    rerender();

    expect(getMockSession(characterId)?.guided?.currentStep).toBe(GUIDED_STEP_IDS.scenario);
    expect(getMockSession(characterId)?.guided?.completedSteps).toEqual([GUIDED_STEP_IDS.appearance]);
    expect(result.current.currentStepDefinition?.id).toBe(GUIDED_STEP_IDS.scenario);
  });

  it('allows selection and handoff summary before continuing concept step', async () => {
    const characterId = 'character-selection';
    const premise = 'A detective and an oracle track a forgotten city.';
    const { result, rerender } = renderGuidedFlow(characterId);

    await act(async () => {
      await result.current.startGuidedDiscoverySession(premise);
    });
    rerender();

    const readySession = getMockSession(characterId);
    expect(readySession?.guided?.discovery.cards.length).toBe(12);
    expect(mockGenerationModels).toEqual(['model', 'model', 'model', 'model']);
    expect(result.current.canContinue).toBe(false);

    const conceptCard = assertDirectionCard(
      readySession?.guided?.discovery.cards.find(
        (card) => card.category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
      ),
      'character concept',
    );
    await act(async () => {
      await result.current.toggleDiscoverySelection(conceptCard.id);
    });
    rerender();

    expect(result.current.canContinue).toBe(true);
    expect(getMockSession(characterId)?.guided?.discovery.selectedCardIds).toEqual([conceptCard.id]);

    const didContinue = await act(async () => result.current.continueToNextStep());
    expect(didContinue).toBe(true);
    rerender();

    const afterContinueSession = getMockSession(characterId);
    const afterContinueSummary = afterContinueSession?.guided?.discoveryHandoffSummary;
    if (!afterContinueSummary) {
      throw new Error('Expected discovery handoff summary after continue.');
    }
    expect(afterContinueSession?.mode).toBe(CHARACTER_ASSISTANT_SESSION_MODES.guided);
    expect(afterContinueSession?.guided?.currentStep).toBe(GUIDED_STEP_IDS.concept);
    expect(afterContinueSession?.guided?.completedSteps).not.toContain(GUIDED_STEP_IDS.concept);
    expect(result.current.isGuidedDiscoveryMode).toBe(false);
    expect(afterContinueSummary[CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept']]).toHaveLength(
      1,
    );
    expect(afterContinueSummary[CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario]).toEqual([]);
  });

  it('starts discovery for an explicitly targeted newly created character', async () => {
    const activeCharacterId = 'previous-character';
    const targetCharacterId = 'new-character';
    const premise = 'A lost prince hires the thief who stole his crown.';
    const { result } = renderGuidedFlow(activeCharacterId);

    await act(async () => {
      await result.current.startGuidedDiscoverySession(premise, targetCharacterId);
    });

    expect(getMockSession(activeCharacterId)).toBeNull();
    expect(getMockSession(targetCharacterId)?.guided?.discovery.originalPremise).toBe(premise);
    expect(getMockSession(targetCharacterId)?.guided?.discovery.cards).toHaveLength(12);
  });

  it('rejects an all-category discovery failure while preserving the premise for retry', async () => {
    const characterId = 'character-all-categories-failed';
    const premise = 'A lighthouse keeper bargains with the storm that erased her town.';
    const { result, rerender } = renderGuidedFlow(characterId);

    Object.values(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES).forEach((category) => {
      mockGenerationErrors.add(category);
    });

    let errorMessage = '';
    await act(async () => {
      try {
        await result.current.startGuidedDiscoverySession(premise);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : '';
      }
    });
    rerender();

    expect(errorMessage).toContain('Guided discovery could not start.');
    expect(getMockSession(characterId)?.guided?.discovery.originalPremise).toBe(premise);
    expect(getMockSession(characterId)?.guided?.discovery.cards).toHaveLength(0);
    Object.values(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES).forEach((category) => {
      expect(result.current.discoveryCategoryGenerationState[category].errorMessage).toBe(
        `Generation for ${category} failed.`,
      );
    });
  });

  it('isolates category regeneration failures to the requested discovery category', async () => {
    const characterId = 'character-scoped-regeneration';
    const premise = 'A courier and a tyrant bargain over a stolen relic.';
    const { result, rerender } = renderGuidedFlow(characterId);

    await act(async () => {
      await result.current.startGuidedDiscoverySession(premise);
    });
    rerender();

    const sessionBeforeFailure = getMockSession(characterId);
    expect(
      sessionBeforeFailure?.guided?.discovery.cards.filter(
        (card) => card.category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
      ).length,
    ).toBe(3);
    const toneCardIdsBefore = sessionBeforeFailure?.guided?.discovery.cards
      .filter((card) => card.category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone)
      .map((card) => card.id);

    mockGenerationErrors.add(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone);
    mockDiscoveredCardsByCategory.set(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone, []);

    let hasFailure = false;
    await act(async () => {
      try {
        await result.current.regenerateDiscoveryCategory(CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone);
      } catch (error) {
        hasFailure = true;
        expect((error as Error).message).toBe('Generation for tone failed.');
      }
    });
    expect(hasFailure).toBe(true);
    rerender();

    const sessionAfterFailure = getMockSession(characterId);
    const toneCardIdsAfter = sessionAfterFailure?.guided?.discovery.cards
      .filter((card) => card.category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone)
      .map((card) => card.id);
    const scenarioCardCount = sessionAfterFailure?.guided?.discovery.cards.filter(
      (card) => card.category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
    ).length;

    expect(toneCardIdsAfter).toEqual(toneCardIdsBefore);
    expect(scenarioCardCount).toBe(3);
    expect(
      result.current.discoveryCategoryGenerationState[CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone]
        .errorMessage,
    ).toBe('Generation for tone failed.');
    expect(
      result.current.discoveryCategoryGenerationState[CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario]
        .errorMessage,
    ).toBeNull();
  });

  it('times out one category, preserves successful categories, and allows retry', async () => {
    vi.useFakeTimers();
    const characterId = 'character-category-timeout';
    const premise = 'A singer bargains with the echo that stole her memories.';
    const timedOutCategory = CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone;
    mockHangingGenerationCategories.add(timedOutCategory);
    const { result, rerender } = renderGuidedFlow(characterId);

    let startPromise: Promise<unknown> = Promise.resolve();
    act(() => {
      startPromise = result.current.startGuidedDiscoverySession(premise);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DISCOVERY_LONG_RUNNING_THRESHOLD_MS);
    });
    expect(result.current.discoveryCategoryGenerationState[timedOutCategory]).toMatchObject({
      isRunning: true,
      isLongRunning: true,
      elapsedSeconds: DISCOVERY_LONG_RUNNING_THRESHOLD_MS / 1000,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DISCOVERY_CATEGORY_TIMEOUT_MS - DISCOVERY_LONG_RUNNING_THRESHOLD_MS);
      await expect(startPromise).resolves.toBeUndefined();
    });
    rerender();

    const successfulCards = getMockSession(characterId)?.guided?.discovery.cards ?? [];
    expect(successfulCards).toHaveLength(9);
    expect(successfulCards.some((card) => card.category === timedOutCategory)).toBe(false);
    expect(result.current.discoveryCategoryGenerationState[timedOutCategory]).toMatchObject({
      isRunning: false,
      errorMessage: 'Generation timed out. Retry this category.',
    });

    mockHangingGenerationCategories.delete(timedOutCategory);
    await act(async () => {
      await result.current.regenerateDiscoveryCategory(timedOutCategory);
    });
    rerender();

    expect(
      getMockSession(characterId)?.guided?.discovery.cards.filter((card) => card.category === timedOutCategory),
    ).toHaveLength(3);
    expect(result.current.discoveryCategoryGenerationState[timedOutCategory].errorMessage).toBeNull();
  });

  it('keeps a replacement category request active when the previous request aborts', async () => {
    const characterId = 'character-overlapping-category-request';
    const category = CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone;
    const { result, rerender } = renderGuidedFlow(characterId);

    await act(async () => {
      await result.current.startGuidedDiscoverySession('A diplomat negotiates with her own forgotten future.');
    });
    rerender();
    mockHangingGenerationCategories.add(category);

    let firstRequest: Promise<unknown> = Promise.resolve();
    let replacementRequest: Promise<unknown> = Promise.resolve();
    act(() => {
      firstRequest = result.current.regenerateDiscoveryCategory(category);
      replacementRequest = result.current.regenerateDiscoveryCategory(category);
    });
    await act(async () => {
      await firstRequest;
    });

    expect(result.current.discoveryCategoryGenerationState[category]).toMatchObject({
      isRunning: true,
      errorMessage: null,
    });

    act(() => {
      result.current.cancelDiscoveryGeneration(category);
    });
    await act(async () => {
      await replacementRequest;
    });

    expect(result.current.discoveryCategoryGenerationState[category]).toMatchObject({
      isRunning: false,
      errorMessage: null,
    });
  });

  it('blocks Review completion until unresolved proposals settle', async () => {
    const characterId = 'character-review-gate';
    const session = createDiscoverySession(characterId);
    const guidedState = ensureGuidedState(session);
    guidedState.currentStep = GUIDED_STEP_IDS.review;
    guidedState.completedSteps = [...GUIDED_STEP_SEQUENCE];
    mockSessions.set(characterId, session);

    const { result } = renderGuidedFlow(characterId, { hasUnresolvedProposals: true });
    expect(result.current.canContinue).toBe(false);
    await expect(result.current.continueToNextStep()).resolves.toBe(false);
    expect(getMockSession(characterId)?.mode).toBe(CHARACTER_ASSISTANT_SESSION_MODES.guided);

    const settledFlow = renderGuidedFlow(characterId, { hasUnresolvedProposals: false });
    expect(settledFlow.result.current.canContinue).toBe(true);
    await act(async () => {
      await settledFlow.result.current.continueToNextStep();
    });
    settledFlow.rerender();

    expect(getMockSession(characterId)?.mode).toBe(CHARACTER_ASSISTANT_SESSION_MODES.chat);
    expect(settledFlow.result.current.isGuidedComplete).toBe(true);
  });

  it('applies the recorded concept to the general character idea', () => {
    const characterId = 'character-use-idea';
    const session = createDiscoverySession(characterId);
    const guidedState = ensureGuidedState(session);
    guidedState.concept = {
      premise: 'A patient cartographer who maps impossible promises.',
      archetype: 'Patient cartographer',
      keyTraits: [],
      flaws: [],
      nameCandidates: [],
      suggestedTags: [],
    };
    mockSessions.set(characterId, session);
    let generalCharacterIdea = '';
    const { result } = renderGuidedFlow(characterId, {
      updateGeneralCharacterIdea: (value) => {
        generalCharacterIdea = value;
      },
    });

    act(() => {
      result.current.applyConceptToCard();
    });

    expect(generalCharacterIdea).toBe('A patient cartographer who maps impossible promises.');
  });

  it('creates a custom selectable variant for a generated direction', async () => {
    const characterId = 'character-customization';
    const premise = 'An archivist finds a myth that predicts collapse.';
    const sourceCategory = CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['relationship-dynamic'];
    const { result, rerender } = renderGuidedFlow(characterId);

    await act(async () => {
      await result.current.startGuidedDiscoverySession(premise);
    });
    rerender();

    const sessionBeforeCustom = getMockSession(characterId);
    const sourceCard = assertDirectionCard(
      sessionBeforeCustom?.guided?.discovery.cards.find((card) => card.category === sourceCategory),
      'source',
    );
    expect(sourceCard.isUserAuthored).toBe(false);

    await act(async () => {
      await result.current.createDiscoveryCustomVariant(
        sourceCard.id,
        'Custom relationship hook',
        'Turn the relationship into a careful rivalry.',
      );
    });
    rerender();

    const sessionAfterCustom = getMockSession(characterId);
    const customCard = sessionAfterCustom?.guided?.discovery.cards.find((card) => card.id === 'custom-variant-1');
    expect(customCard).toMatchObject({
      id: 'custom-variant-1',
      sourceCardId: sourceCard.id,
      category: sourceCategory,
      title: 'Custom relationship hook',
      isUserAuthored: true,
    });
  });

  it('persists deterministic handoff summary when continuing', async () => {
    const characterId = 'character-handoff';
    const premise = 'A cartographer maps contradictions with a machine.';
    const { result, rerender } = renderGuidedFlow(characterId);

    await act(async () => {
      await result.current.startGuidedDiscoverySession(premise);
    });
    rerender();

    const sessionAtStart = getMockSession(characterId);
    const scenarioCard = assertDirectionCard(
      sessionAtStart?.guided?.discovery.cards.find(
        (card) => card.category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
      ),
      'scenario',
    );
    const toneCard = assertDirectionCard(
      sessionAtStart?.guided?.discovery.cards.find(
        (card) => card.category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
      ),
      'tone',
    );

    await act(async () => {
      await result.current.toggleDiscoverySelection(scenarioCard.id);
      await result.current.toggleDiscoverySelection(toneCard.id);
    });
    rerender();

    await act(async () => {
      await result.current.continueToNextStep();
    });
    rerender();

    const session = getMockSession(characterId);
    expect(session?.guided?.discoveryHandoffSummary).toEqual(
      expect.objectContaining({
        [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept']]: [],
        [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['relationship-dynamic']]: [],
        [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario]: [
          expect.objectContaining({ id: scenarioCard?.id, title: scenarioCard?.title }),
        ],
        [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone]: [
          expect.objectContaining({ id: toneCard?.id, title: toneCard?.title }),
        ],
      }),
    );
  });
});
