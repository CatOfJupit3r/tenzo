import { z } from 'zod';

import { GUIDED_STEP_ID_SCHEMA } from '../constants/guided-flow';
import {
  CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA,
  CHARACTER_CONCEPT_SCHEMA,
  CHARACTER_ASSISTANT_MESSAGE_SCHEMA,
} from './character-assistant-contracts';
import { CHARACTER_EDIT_PROPOSAL_SCHEMA } from './character-edit-proposal';

export const CHARACTER_ASSISTANT_SESSION_MODE_SCHEMA = z.enum(['chat', 'guided']);
export const CHARACTER_ASSISTANT_SESSION_MODES = CHARACTER_ASSISTANT_SESSION_MODE_SCHEMA.enum;

export const CHARACTER_ASSISTANT_SESSION_SCHEMA = z.object({
  id: z.string(),
  characterId: z.string(),
  messages: z.array(CHARACTER_ASSISTANT_MESSAGE_SCHEMA),
  proposals: z.array(CHARACTER_EDIT_PROPOSAL_SCHEMA),
  createdAt: z.string(),
  updatedAt: z.string(),
  mode: CHARACTER_ASSISTANT_SESSION_MODE_SCHEMA.default(CHARACTER_ASSISTANT_SESSION_MODES.chat),
  guided: z
    .object({
      currentStep: GUIDED_STEP_ID_SCHEMA,
      completedSteps: z.array(GUIDED_STEP_ID_SCHEMA),
      concept: CHARACTER_CONCEPT_SCHEMA.nullable(),
      attachments: z.array(CHARACTER_ASSISTANT_CONTEXT_ATTACHMENT_SCHEMA).max(4),
    })
    .nullable()
    .default(null),
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
  const modeResult = CHARACTER_ASSISTANT_SESSION_MODE_SCHEMA.safeParse(candidate.mode);
  const guidedResult = CHARACTER_ASSISTANT_SESSION_SCHEMA.shape.guided.safeParse(candidate.guided);

  return CHARACTER_ASSISTANT_SESSION_SCHEMA.parse({
    id: characterId,
    characterId,
    messages,
    proposals,
    createdAt: readTimestamp(candidate.createdAt, fallbackTimestamp),
    updatedAt: readTimestamp(candidate.updatedAt, fallbackTimestamp),
    mode:
      modeResult.success && (modeResult.data !== CHARACTER_ASSISTANT_SESSION_MODES.guided || guidedResult.success)
        ? modeResult.data
        : CHARACTER_ASSISTANT_SESSION_MODES.chat,
    guided: guidedResult.success ? guidedResult.data : null,
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
    mode: CHARACTER_ASSISTANT_SESSION_MODES.chat,
    guided: null,
  };
}
