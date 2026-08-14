import type { UIMessage } from '@tanstack/ai-react';
import { describe, expect, it } from 'vitest';

import { createEmptyCharacterCard } from '../../constants/card-defaults';
import {
  deriveNextPromptSuggestions,
  mergeNextPromptSuggestions,
  readModelPromptSuggestions,
} from './next-prompt-suggestions';

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
      messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', content: 'Hello' }] }],
    });
    expect(suggestions[0]?.id).toBe('review');
  });

  it('reads, merges, deduplicates, and caps model suggestions', () => {
    const messages: UIMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'structured-output',
            status: 'complete',
            raw: '{}',
            data: { assistantMessage: 'Done', followUpSuggestions: ['Add tension', 'Draft a greeting'] },
          },
        ],
      },
    ];
    const merged = mergeNextPromptSuggestions({
      deterministic: [{ id: 'same', label: 'Add tension', prompt: 'Add tension', kind: 'refine' }],
      modelProvided: readModelPromptSuggestions(messages),
      maximum: 2,
    });
    expect(merged.map(({ prompt }) => prompt)).toEqual(['Add tension', 'Draft a greeting']);
  });
});
