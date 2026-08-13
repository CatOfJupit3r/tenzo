import { describe, expect, it } from 'vitest';

import {
  advanceGuidedStep,
  characterAssistantSessionsCollection,
  removeCharacterAssistantSession,
  finishGuidedDiscovery,
  restartGuidedDiscovery,
  replaceGeneratedGuidedDiscoveryCardsByCategory,
  startGuidedDiscovery,
  startGuidedSession,
  updateCharacterAssistantSession,
} from '../collections/character-assistant-sessions.collection';
import { GUIDED_STEP_IDS, getNextGuidedStepId } from '../constants/guided-flow';
import {
  CHARACTER_ASSISTANT_ATTACHMENT_KINDS,
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES,
} from './character-assistant-contracts';
import type { iCharacterAssistantDiscoveryDirectionCard } from './character-assistant-contracts';
import {
  createCustomizedDirectionCard,
  replaceGeneratedDiscoveryCardsByCategory,
  buildDeterministicDiscoveryHandoffSummary,
  removeStaleDirectionCardSelections,
  sanitizeCharacterAssistantDiscoveryState,
  toggleDirectionCardSelection,
} from './character-assistant-discovery-state';
import {
  CHARACTER_ASSISTANT_SESSION_SCHEMA,
  createCharacterAssistantSession,
  createDiscoveryHandoffSummaryDefault,
  sanitizeCharacterAssistantSession,
} from './character-assistant-session';
import { migrateCharacterAssistantSessionStorage } from './character-assistant-session-storage';

function createMemoryStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('character assistant sessions', () => {
  it('uses one deterministic session identity per character', () => {
    expect(createCharacterAssistantSession('character-1').id).toBe('character-1');
    expect(createCharacterAssistantSession('character-1').id).toBe('character-1');
  });

  it('removes only the targeted provisional character session', async () => {
    const provisionalCharacterId = 'provisional-character-session';
    const existingCharacterId = 'existing-character-session';
    await startGuidedSession(provisionalCharacterId);
    await startGuidedSession(existingCharacterId);

    await removeCharacterAssistantSession(provisionalCharacterId);

    expect(characterAssistantSessionsCollection.get(provisionalCharacterId)).toBeUndefined();
    expect(characterAssistantSessionsCollection.get(existingCharacterId)).toBeDefined();

    await removeCharacterAssistantSession(existingCharacterId);
  });

  it('sanitizes legacy agent sessions into conversation and proposal state', () => {
    const recoveredSession = sanitizeCharacterAssistantSession({
      id: 'legacy-random-id',
      characterId: 'character-1',
      draftCard: { legacy: true },
      toolEvents: [{ legacy: true }],
      messages: [{ id: 'message-1', role: 'user', content: 'Keep me', createdAt: '2026-07-10T01:00:00.000Z' }],
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T02:00:00.000Z',
    });

    expect(recoveredSession).toMatchObject({
      id: 'character-1',
      characterId: 'character-1',
      proposals: [],
    });
    expect(recoveredSession?.messages).toHaveLength(1);
    expect(CHARACTER_ASSISTANT_SESSION_SCHEMA.safeParse(recoveredSession).success).toBe(true);
    expect(recoveredSession).not.toHaveProperty('draftCard');
    expect(recoveredSession).not.toHaveProperty('toolEvents');
    expect(recoveredSession?.mode).toBe('chat');
    expect(recoveredSession?.guided).toBeNull();
  });

  it('drops a malformed guided block without dropping the session', () => {
    const recoveredSession = sanitizeCharacterAssistantSession({
      characterId: 'character-1',
      messages: [],
      proposals: [],
      mode: 'guided',
      guided: { currentStep: 'not-a-step', attachments: 'invalid' },
    });

    expect(recoveredSession?.mode).toBe('chat');
    expect(recoveredSession?.guided).toBeNull();
  });

  it('walks the guided sequence and ends after review', () => {
    expect(getNextGuidedStepId(GUIDED_STEP_IDS.concept)).toBe(GUIDED_STEP_IDS.appearance);
    expect(getNextGuidedStepId(GUIDED_STEP_IDS.review)).toBeNull();
  });

  it('round-trips guided concepts and evidence attachments', () => {
    const session = sanitizeCharacterAssistantSession({
      ...createCharacterAssistantSession('character-1'),
      mode: 'guided',
      guided: {
        currentStep: GUIDED_STEP_IDS.appearance,
        completedSteps: [GUIDED_STEP_IDS.concept],
        concept: {
          premise: 'A reluctant lunar archivist.',
          archetype: 'Reluctant scholar',
          keyTraits: ['curious'],
          flaws: ['guarded'],
          nameCandidates: ['Mira'],
          suggestedTags: ['scholar'],
        },
        attachments: [
          {
            id: 'image-1',
            kind: CHARACTER_ASSISTANT_ATTACHMENT_KINDS.imageAnalysis,
            title: 'Reference',
            content: 'Subject: A person',
            warnings: [],
            confidence: 0.8,
          },
        ],
      },
    });

    expect(session?.guided?.concept?.premise).toContain('archivist');
    expect(session?.guided?.attachments).toHaveLength(1);
  });

  it('retains guided-step ownership for persisted conversation results', () => {
    const session = sanitizeCharacterAssistantSession({
      ...createCharacterAssistantSession('character-1'),
      messages: [
        {
          id: 'message-1',
          role: 'assistant',
          content: 'Appearance is ready.',
          createdAt: '2026-08-13T10:00:00.000Z',
          guidedStepId: GUIDED_STEP_IDS.appearance,
        },
      ],
      proposals: [
        {
          id: 'proposal-1',
          characterId: 'character-1',
          baseRevision: 'revision-1',
          patches: [],
          status: 'review',
          guidedStepId: GUIDED_STEP_IDS.appearance,
          errorMessage: null,
          createdAt: '2026-08-13T10:00:00.000Z',
          updatedAt: '2026-08-13T10:00:00.000Z',
        },
      ],
    });

    expect(session?.messages[0]?.guidedStepId).toBe(GUIDED_STEP_IDS.appearance);
    expect(session?.proposals[0]?.guidedStepId).toBe(GUIDED_STEP_IDS.appearance);
  });

  it('advances all guided steps and returns to chat after review', async () => {
    const characterId = 'guided-session-test';
    await startGuidedSession(characterId);

    for (let index = 0; index < 7; index += 1) {
      await advanceGuidedStep(characterId);
    }

    const session = characterAssistantSessionsCollection.get(characterId);
    expect(session?.mode).toBe('chat');
    expect(session?.guided?.completedSteps).toEqual([
      GUIDED_STEP_IDS.concept,
      GUIDED_STEP_IDS.appearance,
      GUIDED_STEP_IDS.personality,
      GUIDED_STEP_IDS.scenario,
      GUIDED_STEP_IDS.voice,
      GUIDED_STEP_IDS.metadata,
      GUIDED_STEP_IDS.review,
    ]);
    characterAssistantSessionsCollection.delete(characterId);
  });

  it('migrates the latest session across both agent storage versions', () => {
    const firstLegacyStorageKey = 'agent:v1';
    const secondLegacyStorageKey = 'agent:v2';
    const storageKey = 'assistant:v1';
    const olderSession = createCharacterAssistantSession('character-1');
    const newerSession = {
      ...olderSession,
      updatedAt: '2026-07-10T02:00:00.000Z',
      messages: [{ id: 'message-1', role: 'user', content: 'Keep me', createdAt: '2026-07-10T01:00:00.000Z' }],
    };
    const storage = createMemoryStorage({
      [firstLegacyStorageKey]: JSON.stringify({
        's:older': { versionKey: 'older', data: { ...olderSession, updatedAt: '2026-07-10T00:00:00.000Z' } },
      }),
      [secondLegacyStorageKey]: JSON.stringify({
        's:newer': { versionKey: 'newer', data: newerSession },
      }),
    });

    migrateCharacterAssistantSessionStorage({
      storage,
      legacyStorageKeys: [secondLegacyStorageKey, firstLegacyStorageKey],
      storageKey,
    });

    const storedValue = JSON.parse(storage.getItem(storageKey) ?? '{}') as Record<
      string,
      { data: { id: string; messages: unknown[] } }
    >;
    expect(Object.keys(storedValue)).toEqual(['s:character-1']);
    expect(storedValue['s:character-1']?.data.messages).toHaveLength(1);
    expect(storage.getItem(firstLegacyStorageKey)).toBeNull();
    expect(storage.getItem(secondLegacyStorageKey)).toBeNull();
  });

  it('keeps legacy storage when recovered collection persistence fails', () => {
    const legacyStorageKey = 'agent:v2';
    const storageKey = 'assistant:v1';
    const legacyValue = JSON.stringify({
      's:legacy': { versionKey: 'legacy', data: createCharacterAssistantSession('character-1') },
    });
    const baseStorage = createMemoryStorage({ [legacyStorageKey]: legacyValue });
    const storage = {
      ...baseStorage,
      setItem: () => {
        throw new Error('Quota exceeded');
      },
    };

    migrateCharacterAssistantSessionStorage({ storage, legacyStorageKeys: [legacyStorageKey], storageKey });

    expect(storage.getItem(legacyStorageKey)).toBe(legacyValue);
    expect(storage.getItem(storageKey)).toBeNull();
  });

  it('replaces only one category with up to three generated direction cards', () => {
    const discoveryState = sanitizeCharacterAssistantDiscoveryState({
      originalPremise: 'A rival and a reluctant ally begin a shared operation.',
      cards: [
        {
          id: 'concept-source',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
          title: 'Original concept',
          description: 'Source concept text.',
          sourceCardId: 'concept-source',
          isUserAuthored: true,
        },
        {
          id: 'concept-generated-old',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
          title: 'Old concept direction',
          description: 'Generated concept direction.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'scenario-source',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
          title: 'Scenario direction',
          description: 'Keep this scenario card.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'tone-source',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
          title: 'Tone direction',
          description: 'Keep this tone card.',
          sourceCardId: null,
          isUserAuthored: false,
        },
      ],
      selectedCardIds: ['concept-generated-old', 'scenario-source', 'missing-selection'],
      isReadyForHandoff: false,
    });

    const updatedDiscoveryState = replaceGeneratedDiscoveryCardsByCategory(
      discoveryState,
      CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
      [
        {
          id: 'concept-generated-new-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
          title: 'Concept direction 1',
          description: 'Generated concept direction 1.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'concept-generated-new-2',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
          title: 'Concept direction 2',
          description: 'Generated concept direction 2.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'concept-generated-new-3',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
          title: 'Concept direction 3',
          description: 'Generated concept direction 3.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'concept-generated-new-4',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
          title: 'Concept direction 4',
          description: 'Generated concept direction 4.',
          sourceCardId: null,
          isUserAuthored: false,
        },
      ],
    );

    const conceptCards = updatedDiscoveryState.cards.filter(
      (card) => card.category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
    );

    expect(conceptCards).toHaveLength(4);
    expect(conceptCards.map((card) => card.id)).toEqual([
      'concept-source',
      'concept-generated-new-1',
      'concept-generated-new-2',
      'concept-generated-new-3',
    ]);
    expect(updatedDiscoveryState.selectedCardIds).toEqual(['scenario-source']);
    expect(updatedDiscoveryState.isReadyForHandoff).toBe(true);
  });

  it('toggles multiple direction selections and keeps readiness derived from selections', () => {
    const discoveryState = sanitizeCharacterAssistantDiscoveryState({
      originalPremise: 'A quiet village wakes.',
      cards: [
        {
          id: 'scenario-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
          title: 'Scenario 1',
          description: 'A hidden courtyard.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'tone-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
          title: 'Tone 1',
          description: 'Measured and observant.',
          sourceCardId: null,
          isUserAuthored: false,
        },
      ],
      selectedCardIds: ['scenario-1'],
      isReadyForHandoff: true,
    });

    const afterAdd = toggleDirectionCardSelection(discoveryState, 'tone-1');
    const afterRemove = toggleDirectionCardSelection(afterAdd, 'scenario-1');

    expect(afterAdd.selectedCardIds).toEqual(['scenario-1', 'tone-1']);
    expect(afterAdd.isReadyForHandoff).toBe(true);
    expect(afterRemove.selectedCardIds).toEqual(['tone-1']);
    expect(afterRemove.isReadyForHandoff).toBe(true);
  });

  it('creates a user-authored customized direction card while preserving source', () => {
    const discoveryState = sanitizeCharacterAssistantDiscoveryState({
      originalPremise: 'An exhausted negotiator needs a secret.',
      cards: [
        {
          id: 'scenario-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
          title: 'Scenario 1',
          description: 'A diplomatic summit.',
          sourceCardId: null,
          isUserAuthored: false,
        },
      ],
      selectedCardIds: ['scenario-1'],
      isReadyForHandoff: true,
    });

    const customState = createCustomizedDirectionCard(discoveryState, 'scenario-1', {
      id: 'scenario-custom',
      title: 'Custom scenario',
      description: 'A customs office standoff.',
    });

    expect(customState.cards).toHaveLength(2);
    expect(customState.cards.find((card) => card.id === 'scenario-custom')).toMatchObject({
      id: 'scenario-custom',
      category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
      sourceCardId: 'scenario-1',
      isUserAuthored: true,
    });
    expect(customState.cards.find((card) => card.id === 'scenario-1')).toBeDefined();
    expect(customState.selectedCardIds).toEqual(['scenario-custom']);
    expect(customState.isReadyForHandoff).toBe(true);
  });

  it('removes stale selections from discovery state', () => {
    const discoveryState = sanitizeCharacterAssistantDiscoveryState({
      originalPremise: 'A quiet village wakes.',
      cards: [
        {
          id: 'tone-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
          title: 'Tone 1',
          description: 'Measured and observant.',
          sourceCardId: null,
          isUserAuthored: false,
        },
      ],
      selectedCardIds: ['tone-1', 'missing-selection'],
      isReadyForHandoff: true,
    });

    expect(removeStaleDirectionCardSelections(discoveryState).selectedCardIds).toEqual(['tone-1']);
  });

  it('builds deterministic handoff summary grouped by category', () => {
    const discoveryState = sanitizeCharacterAssistantDiscoveryState({
      originalPremise: 'A quiet village wakes.',
      cards: [
        {
          id: 'tone-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
          title: 'Tone 1',
          description: 'Measured and observant.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'concept-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
          title: 'Concept 1',
          description: 'A rival mentor.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'scenario-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
          title: 'Scenario 1',
          description: 'A city on lockdown.',
          sourceCardId: null,
          isUserAuthored: false,
        },
      ],
      selectedCardIds: ['scenario-1', 'concept-1', 'tone-1'],
      isReadyForHandoff: false,
    });
    const handoffSummary = buildDeterministicDiscoveryHandoffSummary(discoveryState);

    expect(handoffSummary).toMatchObject({
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept']]: [
        {
          id: 'concept-1',
          title: 'Concept 1',
        },
      ],
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone]: [{ id: 'tone-1', title: 'Tone 1' }],
      [CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario]: [{ id: 'scenario-1', title: 'Scenario 1' }],
    });
    expect(handoffSummary[CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['relationship-dynamic']]).toEqual([]);
    expect(handoffSummary[CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept']][0].description).toBe(
      'A rival mentor.',
    );
  });

  it('sanitizes guided sessions without discovery payload into defaults', () => {
    const recoveredSession = sanitizeCharacterAssistantSession({
      ...createCharacterAssistantSession('character-1'),
      mode: 'guided',
      guided: {
        currentStep: GUIDED_STEP_IDS.concept,
        completedSteps: [],
        concept: null,
        attachments: [],
      },
    });

    expect(recoveredSession?.guided?.discovery).toEqual({
      originalPremise: '',
      cards: [],
      selectedCardIds: [],
      isReadyForHandoff: false,
    });
    expect(recoveredSession?.mode).toBe('guided');
  });

  it('removes stale guided discovery selections and derives handoff readiness in session sanitization', () => {
    const recoveredSession = sanitizeCharacterAssistantSession({
      ...createCharacterAssistantSession('character-1'),
      mode: 'guided',
      guided: {
        currentStep: GUIDED_STEP_IDS.appearance,
        completedSteps: [GUIDED_STEP_IDS.concept],
        concept: null,
        attachments: [],
        discovery: {
          originalPremise: 'A quiet village wakes.',
          cards: [
            {
              id: 'tone-1',
              category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
              title: 'Tone 1',
              description: 'Measured and observant.',
              sourceCardId: null,
              isUserAuthored: false,
            },
          ],
          selectedCardIds: ['tone-1', 'missing-selection'],
          isReadyForHandoff: false,
        },
      },
    });

    expect(recoveredSession?.guided?.discovery?.selectedCardIds).toEqual(['tone-1']);
    expect(recoveredSession?.guided?.discovery?.isReadyForHandoff).toBe(true);
  });

  it('sanitizes discovery state by deduping selections and deriving readiness', () => {
    const sanitizedDiscoveryState = sanitizeCharacterAssistantDiscoveryState({
      originalPremise: 'A quiet village wakes.',
      cards: [
        {
          id: 'tone-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
          title: 'Tone 1',
          description: 'Measured and observant.',
          sourceCardId: null,
          isUserAuthored: false,
        },
      ] satisfies readonly iCharacterAssistantDiscoveryDirectionCard[],
      selectedCardIds: ['tone-1', 'tone-1', 'missing-selection'],
      isReadyForHandoff: false,
    });

    expect(sanitizedDiscoveryState.selectedCardIds).toEqual(['tone-1']);
    expect(sanitizedDiscoveryState.isReadyForHandoff).toBe(true);
  });

  it('starts guided discovery with a validated premise', async () => {
    const characterId = 'guided-discovery-start';
    await startGuidedSession(characterId);
    await startGuidedDiscovery(characterId, 'A rival and a reluctant ally find common cause in a city of secrets.');

    const session = characterAssistantSessionsCollection.get(characterId);
    expect(session?.guided?.discovery?.originalPremise).toBe(
      'A rival and a reluctant ally find common cause in a city of secrets.',
    );
    expect(session?.guided?.discovery?.cards).toEqual([]);
    expect(session?.guided?.discovery?.selectedCardIds).toEqual([]);
    expect(session?.guided?.discovery?.isReadyForHandoff).toBe(false);

    await expect(startGuidedDiscovery(characterId, '')).rejects.toThrowError();
    characterAssistantSessionsCollection.delete(characterId);
  });

  it('replaces generated cards in one discovery category atomically', async () => {
    const characterId = 'guided-discovery-replace';
    await startGuidedSession(characterId);
    await updateCharacterAssistantSession(characterId, (draft) => {
      if (!draft.guided) {
        return;
      }

      draft.guided.discovery = {
        originalPremise: 'A city remembers everything the city forgets.',
        cards: [
          {
            id: 'concept-source',
            category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
            title: 'Concept source',
            description: 'A base concept card kept by hand.',
            sourceCardId: 'source-card',
            isUserAuthored: true,
          },
          {
            id: 'concept-generated-old',
            category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
            title: 'Old generated concept',
            description: 'The old generated concept idea.',
            sourceCardId: null,
            isUserAuthored: false,
          },
          {
            id: 'tone-selected',
            category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
            title: 'Warm and ironic',
            description: 'A warm, ironic voice.',
            sourceCardId: null,
            isUserAuthored: false,
          },
        ],
        selectedCardIds: ['concept-generated-old', 'tone-selected'],
        isReadyForHandoff: true,
      };
      draft.guided.discoveryHandoffSummary = buildDeterministicDiscoveryHandoffSummary(draft.guided.discovery);
    });

    const updated = await replaceGeneratedGuidedDiscoveryCardsByCategory(
      characterId,
      CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
      [
        {
          id: 'concept-generated-new-1',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
          title: 'A concept with consequence.',
          description: 'A character builds identity from debt.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'concept-generated-new-2',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
          title: 'A concept with conflict.',
          description: 'A character rejects their own memory.',
          sourceCardId: null,
          isUserAuthored: false,
        },
        {
          id: 'concept-generated-new-3',
          category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'],
          title: 'A concept with choice.',
          description: 'A character balances mercy and profit.',
          sourceCardId: null,
          isUserAuthored: false,
        },
      ],
    );
    const updatedDiscovery = updated?.guided?.discovery;

    expect(
      updatedDiscovery?.cards
        .filter((card) => card.category === CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES['character-concept'])
        .map((card) => card.id),
    ).toEqual(['concept-source', 'concept-generated-new-1', 'concept-generated-new-2', 'concept-generated-new-3']);
    expect(updatedDiscovery?.selectedCardIds).toEqual(['tone-selected']);
  });

  it('finishes discovery with deterministic handoff summary and preserves premise on restart', async () => {
    const characterId = 'guided-discovery-finish-restart';
    await startGuidedSession(characterId);
    await updateCharacterAssistantSession(characterId, (draft) => {
      if (!draft.guided) {
        return;
      }

      draft.guided.discovery = {
        originalPremise: 'A courier bargains with a demon for passage.',
        cards: [
          {
            id: 'tone-1',
            category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
            title: 'Bitter but funny',
            description: 'A dry wit keeps the fear honest.',
            sourceCardId: null,
            isUserAuthored: false,
          },
          {
            id: 'scenario-1',
            category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
            title: 'Neon checkpoint',
            description: 'The handoff starts at a rain-soaked checkpoint.',
            sourceCardId: null,
            isUserAuthored: false,
          },
        ],
        selectedCardIds: ['tone-1', 'scenario-1'],
        isReadyForHandoff: true,
      };
    });

    const finishedSession = await finishGuidedDiscovery(characterId);
    const handoffSummary = finishedSession.guided?.discoveryHandoffSummary;
    expect(handoffSummary?.[CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone]).toEqual([
      {
        id: 'tone-1',
        category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.tone,
        title: 'Bitter but funny',
        description: 'A dry wit keeps the fear honest.',
        sourceCardId: null,
        isUserAuthored: false,
      },
    ]);
    expect(handoffSummary?.[CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario]).toEqual([
      {
        id: 'scenario-1',
        category: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORIES.scenario,
        title: 'Neon checkpoint',
        description: 'The handoff starts at a rain-soaked checkpoint.',
        sourceCardId: null,
        isUserAuthored: false,
      },
    ]);

    const restartedSession = await restartGuidedDiscovery(characterId);
    expect(restartedSession.guided?.discovery?.originalPremise).toBe('A courier bargains with a demon for passage.');
    expect(restartedSession.guided?.discovery?.cards).toEqual([]);
    expect(restartedSession.guided?.discovery?.selectedCardIds).toEqual([]);
    expect(restartedSession.guided?.discovery?.isReadyForHandoff).toBe(false);
    expect(restartedSession.guided?.discoveryHandoffSummary).toEqual(createDiscoveryHandoffSummaryDefault());
    characterAssistantSessionsCollection.delete(characterId);
  });

  it('requires a selection before finishing discovery', async () => {
    const characterId = 'guided-discovery-empty-handoff';
    await startGuidedSession(characterId);
    await startGuidedDiscovery(characterId, 'Two strangers inherit opposite halves of an impossible map.');

    await expect(finishGuidedDiscovery(characterId)).rejects.toThrowError(
      'Select at least one discovery direction before continuing.',
    );

    characterAssistantSessionsCollection.delete(characterId);
  });
});
