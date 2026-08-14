import type { UIMessage } from '@tanstack/ai-react';
import { z } from 'zod';

import type { CharacterCard } from '../card-schema';
import { ASSISTANT_FINAL_RESPONSE_SCHEMA } from './assistant-final-response';

export const NEXT_PROMPT_SUGGESTION_KIND_SCHEMA = z.enum(['discover', 'fill-field', 'refine', 'review', 'image']);
export const NEXT_PROMPT_SUGGESTION_KINDS = NEXT_PROMPT_SUGGESTION_KIND_SCHEMA.enum;

export interface iNextPromptSuggestion {
  id: string;
  label: string;
  prompt: string;
  kind: z.infer<typeof NEXT_PROMPT_SUGGESTION_KIND_SCHEMA>;
}

export const COLD_START_PROMPT_SUGGESTIONS = [
  {
    id: 'discover',
    label: 'Help me discover a character',
    prompt: 'Help me discover a character from scratch. Surprise me with varied directions.',
    kind: NEXT_PROMPT_SUGGESTION_KINDS.discover,
  },
  {
    id: 'premise',
    label: 'I have a premise',
    prompt: 'I have a premise: ',
    kind: NEXT_PROMPT_SUGGESTION_KINDS['fill-field'],
  },
  {
    id: 'image',
    label: 'Start from an image',
    prompt: 'Help me create a character from an image I will attach.',
    kind: NEXT_PROMPT_SUGGESTION_KINDS.image,
  },
] satisfies iNextPromptSuggestion[];

export function deriveNextPromptSuggestions({
  card,
  messages,
}: {
  card: CharacterCard;
  messages: readonly UIMessage[];
}) {
  if (messages.length === 0) return COLD_START_PROMPT_SUGGESTIONS;
  const name = card.data.name.trim() || '{{char}}';
  const candidates: iNextPromptSuggestion[] = [];
  if (!card.data.description.trim())
    candidates.push({
      id: 'description',
      label: 'Define appearance',
      prompt: `Describe ${name}'s appearance, presence, and distinctive details.`,
      kind: NEXT_PROMPT_SUGGESTION_KINDS['fill-field'],
    });
  if (!card.data.personality.trim())
    candidates.push({
      id: 'personality',
      label: 'Define personality',
      prompt: `Define ${name}'s personality, quirks, motivations, and flaws.`,
      kind: NEXT_PROMPT_SUGGESTION_KINDS['fill-field'],
    });
  if (!card.data.scenario.trim())
    candidates.push({
      id: 'scenario',
      label: 'Build the scenario',
      prompt: `Create a compelling scenario and relationship dynamic for ${name}.`,
      kind: NEXT_PROMPT_SUGGESTION_KINDS['fill-field'],
    });
  if (!card.data.first_mes.trim())
    candidates.push({
      id: 'first-message',
      label: 'Draft an opening scene',
      prompt: `Draft an immersive opening scene for ${name}.`,
      kind: NEXT_PROMPT_SUGGESTION_KINDS['fill-field'],
    });
  if (!card.data.mes_example.trim())
    candidates.push({
      id: 'voice',
      label: 'Establish the voice',
      prompt: `Write example dialogue that establishes ${name}'s voice and behavior.`,
      kind: NEXT_PROMPT_SUGGESTION_KINDS['fill-field'],
    });
  if (candidates.length < 2)
    candidates.push({
      id: 'review',
      label: 'Review for contradictions',
      prompt: 'Review the whole card for contradictions, weak spots, and opportunities to improve cohesion.',
      kind: NEXT_PROMPT_SUGGESTION_KINDS.review,
    });
  return candidates.slice(0, 4);
}

export function readModelPromptSuggestions(messages: readonly UIMessage[]) {
  const lastAssistantMessage = messages.findLast((message) => message.role === 'assistant');
  if (!lastAssistantMessage) return [];
  for (const part of lastAssistantMessage.parts.toReversed()) {
    if (part.type !== 'structured-output' || part.status !== 'complete') continue;
    const result = ASSISTANT_FINAL_RESPONSE_SCHEMA.safeParse(part.data);
    if (result.success) return result.data.followUpSuggestions;
  }
  return [];
}

export function mergeNextPromptSuggestions({
  deterministic,
  modelProvided,
  maximum = 4,
}: {
  deterministic: readonly iNextPromptSuggestion[];
  modelProvided: readonly string[];
  maximum?: number;
}) {
  const seenPrompts = new Set<string>();
  return [
    ...modelProvided.map(
      (prompt, index) =>
        ({
          id: `model-${index}-${prompt}`,
          label: prompt,
          prompt,
          kind: NEXT_PROMPT_SUGGESTION_KINDS.refine,
        }) satisfies iNextPromptSuggestion,
    ),
    ...deterministic,
  ]
    .filter((suggestion) => {
      const key = suggestion.prompt.trim().toLocaleLowerCase();
      if (!key || seenPrompts.has(key)) return false;
      seenPrompts.add(key);
      return true;
    })
    .slice(0, Math.max(0, maximum));
}
