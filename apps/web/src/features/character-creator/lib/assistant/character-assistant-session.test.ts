import { describe, expect, it } from 'vitest';

import { sanitizeCharacterAssistantSession } from './character-assistant-session';

describe('character assistant session storage', () => {
  it('hydrates supported UI messages and drops malformed persisted entries', () => {
    const session = sanitizeCharacterAssistantSession({
      id: 'session-1',
      characterId: 'character-1',
      messages: [
        {
          id: 'message-1',
          role: 'user',
          parts: [{ type: 'text', content: 'Keep the voice warm.' }],
          createdAt: '2026-08-18T20:00:00.000Z',
        },
        { id: 'missing-parts', role: 'assistant' },
      ],
      proposals: [{ malformed: true }],
      createdAt: '',
      updatedAt: null,
    });

    expect(session?.messages).toHaveLength(1);
    expect(session?.messages[0]?.createdAt).toEqual(new Date('2026-08-18T20:00:00.000Z'));
    expect(session?.proposals).toEqual([]);
    expect(session?.createdAt).toMatch(/^20\d\d-/);
    expect(session?.updatedAt).toMatch(/^20\d\d-/);
  });
});
