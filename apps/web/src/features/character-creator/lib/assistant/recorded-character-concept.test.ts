import type { UIMessage } from '@tanstack/ai-react';
import { describe, expect, it } from 'vitest';

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
    role: 'assistant',
    createdAt: new Date('2026-08-15T00:00:00.000Z'),
    parts: [
      {
        type: 'tool-call',
        id: 'concept-call',
        name: CHARACTER_ASSISTANT_TOOL_NAMES.record_concept,
        arguments: '{}',
        state: 'complete',
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
