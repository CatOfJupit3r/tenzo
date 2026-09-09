import { describe, expect, it } from 'vitest';

import { MESSAGE_PART_TYPES_CASES, MESSAGE_ROLES } from '@~/features/character-creator/lib/generation/message-enums';

import { sanitizeCharacterAssistantSession } from './character-assistant-session';

describe('character assistant session storage', () => {
  it('hydrates supported UI messages and drops malformed persisted entries', () => {
    const session = sanitizeCharacterAssistantSession({
      id: 'session-1',
      characterId: 'character-1',
      messages: [
        {
          id: 'message-1',
          role: MESSAGE_ROLES.USER,
          parts: [{ type: MESSAGE_PART_TYPES_CASES.TEXT, content: 'Keep the voice warm.' }],
          createdAt: '2026-08-18T20:00:00.000Z',
        },
        { id: 'missing-parts', role: MESSAGE_ROLES.ASSISTANT },
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
