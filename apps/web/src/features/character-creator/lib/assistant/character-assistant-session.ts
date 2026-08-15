import type { UIMessage } from '@tanstack/ai-react';
import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import { CHARACTER_EDIT_PROPOSAL_SCHEMA } from '../proposals/character-edit-proposal';

const UI_MESSAGE_SCHEMA = z.custom<UIMessage>(
  (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const candidate = value as Partial<UIMessage>;
    return (
      typeof candidate.id === 'string' &&
      (candidate.role === 'system' || candidate.role === 'user' || candidate.role === 'assistant') &&
      Array.isArray(candidate.parts)
    );
  },
  { message: 'Invalid TanStack UI message.' },
);

export const CHARACTER_ASSISTANT_SESSION_SCHEMA = z.object({
  id: z.string(),
  characterId: z.string(),
  messages: z.array(UI_MESSAGE_SCHEMA),
  proposals: z.array(CHARACTER_EDIT_PROPOSAL_SCHEMA),
  lastRecordedConceptToolCallId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type iCharacterAssistantSession = z.infer<typeof CHARACTER_ASSISTANT_SESSION_SCHEMA>;

function readTimestamp(value: unknown, fallbackTimestamp: string) {
  return typeof value === 'string' && value.trim() ? value : fallbackTimestamp;
}

export function sanitizeCharacterAssistantSession(value: unknown): iCharacterAssistantSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const characterId = typeof candidate.characterId === 'string' ? candidate.characterId.trim() : '';
  if (!characterId) {
    return null;
  }

  const fallbackTimestamp = new Date().toISOString();
  const messages = Array.isArray(candidate.messages)
    ? candidate.messages.flatMap((message) => {
        const result = UI_MESSAGE_SCHEMA.safeParse(message);
        return result.success ? [result.data] : [];
      })
    : [];
  const proposals = Array.isArray(candidate.proposals)
    ? candidate.proposals.flatMap((proposal) => {
        const result = CHARACTER_EDIT_PROPOSAL_SCHEMA.safeParse(proposal);
        return result.success ? [result.data] : [];
      })
    : [];

  return CHARACTER_ASSISTANT_SESSION_SCHEMA.parse({
    id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : characterId,
    characterId,
    messages,
    proposals,
    lastRecordedConceptToolCallId:
      typeof candidate.lastRecordedConceptToolCallId === 'string' ? candidate.lastRecordedConceptToolCallId : null,
    createdAt: readTimestamp(candidate.createdAt, fallbackTimestamp),
    updatedAt: readTimestamp(candidate.updatedAt, fallbackTimestamp),
  });
}

export function createCharacterAssistantSession(characterId: string): iCharacterAssistantSession {
  const now = new Date().toISOString();
  return {
    id: generateUuid(),
    characterId,
    messages: [],
    proposals: [],
    lastRecordedConceptToolCallId: null,
    createdAt: now,
    updatedAt: now,
  };
}
