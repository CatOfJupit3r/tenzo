import type { UIMessage } from '@tanstack/ai-react';
import { describe, expect, it } from 'vitest';

import {
  MESSAGE_PART_TYPES_CASES,
  MESSAGE_ROLES,
  TOOL_CALL_STATES,
} from '@~/features/character-creator/lib/generation/message-enums';

import { CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';
import { readNewRecordedCharacterConcept } from './recorded-character-concept';

const concept = {
  premise: 'A disgraced knight guarding a forbidden archive.',
  archetype: 'Reluctant guardian',
  keyTraits: ['Vigilant'],
  flaws: ['Distrustful'],
  nameCandidates: ['Mira'],
  suggestedTags: ['fantasy'],
};

const messages: UIMessage[] = [
  {
    id: 'assistant-message',
    role: MESSAGE_ROLES.ASSISTANT,
    createdAt: new Date('2026-08-15T00:00:00.000Z'),
    parts: [
      {
        type: MESSAGE_PART_TYPES_CASES.TOOL_CALL,
        id: 'concept-call',
        name: CHARACTER_ASSISTANT_TOOL_NAMES.RECORD_CONCEPT,
        arguments: '{}',
        state: TOOL_CALL_STATES.COMPLETE,
        output: { concept },
      },
    ],
  },
];

describe('readNewRecordedCharacterConcept', () => {
  it('returns a newly recorded concept for General Character Idea synchronization', () => {
    expect(readNewRecordedCharacterConcept(messages, null)).toEqual({ concept, toolCallId: 'concept-call' });
  });

  it('does not replay a processed concept over later user edits', () => {
    expect(readNewRecordedCharacterConcept(messages, 'concept-call')).toBeNull();
  });
});
