import type { UIMessage } from '@tanstack/ai-react';
import { describe, expect, it } from 'vitest';

import {
  NEXT_PROMPT_SUGGESTION_KINDS,
  deriveNextPromptSuggestions,
  mergeNextPromptSuggestions,
  readModelPromptSuggestions,
} from '@~/features/character-creator/lib/assistant/next-prompt-suggestions';
import {
  MESSAGE_PART_STATUSES,
  MESSAGE_PART_TYPES_CASES,
  MESSAGE_ROLES,
} from '@~/features/character-creator/lib/generation/message-enums';

import { createEmptyCharacterCard } from '../../constants/card-defaults';

describe('next prompt suggestions', () => {
  it('shows discovery-first choices for an empty conversation', () => {
    const suggestions = deriveNextPromptSuggestions({ card: createEmptyCharacterCard(), messages: [] });
    expect(suggestions.map(({ id }) => id)).toEqual(['discover', 'premise', 'image']);
  });

  it('prioritizes incomplete fields and falls through to review', () => {
    const card = createEmptyCharacterCard();
    card.data.description = 'Defined';
    card.data.personality = 'Defined';
    card.data.scenario = 'Defined';
    card.data.first_mes = 'Defined';
    card.data.mes_example = 'Defined';
    const suggestions = deriveNextPromptSuggestions({
      card,
      messages: [
        { id: 'user-1', role: MESSAGE_ROLES.USER, parts: [{ type: MESSAGE_PART_TYPES_CASES.TEXT, content: 'Hello' }] },
      ],
    });
    expect(suggestions[0]?.id).toBe('review');
  });

  it('reads, merges, deduplicates, and caps model suggestions', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: MESSAGE_ROLES.ASSISTANT,
        parts: [
          {
            type: MESSAGE_PART_TYPES_CASES.STRUCTURED_OUTPUT,
            status: MESSAGE_PART_STATUSES.COMPLETE,
            raw: '{}',
            data: { assistantMessage: 'Done', followUpSuggestions: ['Add tension', 'Draft a greeting'] },
          },
        ],
      },
    ];
    const merged = mergeNextPromptSuggestions({
      deterministic: [
        { id: 'same', label: 'Add tension', prompt: 'Add tension', kind: NEXT_PROMPT_SUGGESTION_KINDS.REFINE },
      ],
      modelProvided: readModelPromptSuggestions(messages),
      maximum: 2,
    });
    expect(merged.map(({ prompt }) => prompt)).toEqual(['Add tension', 'Draft a greeting']);
  });
});
