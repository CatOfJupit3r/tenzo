import { describe, expect, it } from 'vitest';

import {
  advanceGuidedStep,
  characterAssistantSessionsCollection,
  startGuidedSession,
} from '../collections/character-assistant-sessions.collection';
import { GUIDED_STEP_IDS, getNextGuidedStepId } from '../constants/guided-flow';
import { CHARACTER_ASSISTANT_ATTACHMENT_KINDS } from './character-assistant-contracts';
import {
  CHARACTER_ASSISTANT_SESSION_SCHEMA,
  createCharacterAssistantSession,
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
});
