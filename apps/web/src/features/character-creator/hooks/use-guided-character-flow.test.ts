import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GUIDED_STEP_IDS, getNextGuidedStepId } from '../constants/guided-flow';
import type { GuidedStepId } from '../constants/guided-flow';
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
import { useGuidedCharacterFlow } from './use-guided-character-flow';

type iMockSession = ReturnType<typeof createCharacterAssistantSession>;

const mockSessions = new Map<string, iMockSession>();
const mockGenerationErrors = new Set<iCharacterAssistantDiscoveryDirectionCategory>();
const mockGenerationModels: string[] = [];
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

function createDiscoverySession(characterId: string) {
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
    const nextStep = getNextGuidedStepId(guidedState.currentStep) ?? GUIDED_STEP_IDS.appearance;
    mockSessions.set(characterId, {
      ...currentSession,
      guided: {
        ...guidedState,
        completedSteps: [...guidedState.completedSteps, guidedState.currentStep].filter(
          (step, index, steps) => index === steps.indexOf(step),
        ),
        currentStep: nextStep,
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
    async ({ category, model }: { category: iCharacterAssistantDiscoveryDirectionCategory; model: string }) => {
      mockGenerationModels.push(model);
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

function renderGuidedFlow(characterId: string) {
  return renderHook(() =>
    useGuidedCharacterFlow({
      characterId,
      apiKey: 'key',
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
      updateGeneralCharacterIdea: vi.fn(),
      workspace: {
        hasCompletedCurrentGuidedStepRun: false,
      },
    }),
  );
}

beforeEach(() => {
  resetMockSessions();
  mockGenerationErrors.clear();
  mockGenerationModels.length = 0;
  mockDiscoveredCardsByCategory.clear();
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
