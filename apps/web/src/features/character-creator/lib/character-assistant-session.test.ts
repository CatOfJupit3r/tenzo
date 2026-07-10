import { describe, expect, it } from 'vitest';

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
