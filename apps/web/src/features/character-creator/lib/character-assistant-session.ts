import { z } from 'zod';

import { CHARACTER_ASSISTANT_MESSAGE_SCHEMA } from './character-assistant-contracts';
import { CHARACTER_EDIT_PROPOSAL_SCHEMA } from './character-edit-proposal';

export const CHARACTER_ASSISTANT_SESSION_SCHEMA = z.object({
  id: z.string(),
  characterId: z.string(),
  messages: z.array(CHARACTER_ASSISTANT_MESSAGE_SCHEMA),
  proposals: z.array(CHARACTER_EDIT_PROPOSAL_SCHEMA),
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
        const result = CHARACTER_ASSISTANT_MESSAGE_SCHEMA.safeParse(message);
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
    id: characterId,
    characterId,
    messages,
    proposals,
    createdAt: readTimestamp(candidate.createdAt, fallbackTimestamp),
    updatedAt: readTimestamp(candidate.updatedAt, fallbackTimestamp),
  });
}

export function createCharacterAssistantSession(characterId: string): iCharacterAssistantSession {
  const now = new Date().toISOString();

  return {
    id: characterId,
    characterId,
    messages: [],
    proposals: [],
    createdAt: now,
    updatedAt: now,
  };
}
