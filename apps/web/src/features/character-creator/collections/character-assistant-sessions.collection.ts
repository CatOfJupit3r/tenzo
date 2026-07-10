import { createCollection, localStorageCollectionOptions } from '@tanstack/react-db';

import { localStorageApi } from '@~/db/storage';

import { GUIDED_STEP_IDS, getNextGuidedStepId } from '../constants/guided-flow';
import type { iCharacterConcept, iCharacterAssistantContextAttachment } from '../lib/character-assistant-contracts';
import {
  CHARACTER_ASSISTANT_SESSION_SCHEMA,
  CHARACTER_ASSISTANT_SESSION_MODES,
  createCharacterAssistantSession,
} from '../lib/character-assistant-session';
import type { iCharacterAssistantSession } from '../lib/character-assistant-session';
import { migrateCharacterAssistantSessionStorage } from '../lib/character-assistant-session-storage';
import { deleteGuidedReferenceAssetBlobs } from '../lib/image-store';

export const CHARACTER_ASSISTANT_SESSIONS_COLLECTION_STORAGE_KEY = 'tenzo:character-creator:assistant-sessions:v2';
const LEGACY_CHARACTER_AGENT_SESSION_STORAGE_KEYS = [
  'tenzo:character-creator:assistant-sessions:v1',
  'tenzo:character-creator:agent-sessions:v2',
  'tenzo:character-creator:agent-sessions:v1',
];

migrateCharacterAssistantSessionStorage({
  storage: localStorageApi,
  legacyStorageKeys: LEGACY_CHARACTER_AGENT_SESSION_STORAGE_KEYS,
  storageKey: CHARACTER_ASSISTANT_SESSIONS_COLLECTION_STORAGE_KEY,
});

export const characterAssistantSessionsCollection = createCollection(
  localStorageCollectionOptions({
    storageKey: CHARACTER_ASSISTANT_SESSIONS_COLLECTION_STORAGE_KEY,
    storage: localStorageApi,
    getKey: (item) => item.id,
    schema: CHARACTER_ASSISTANT_SESSION_SCHEMA,
  }),
);

export async function ensureCharacterAssistantSession(characterId: string) {
  await characterAssistantSessionsCollection.preload();
  const existingSession = characterAssistantSessionsCollection.get(characterId);
  if (existingSession) {
    return CHARACTER_ASSISTANT_SESSION_SCHEMA.parse(existingSession);
  }

  const session = createCharacterAssistantSession(characterId);
  const transaction = characterAssistantSessionsCollection.insert(session);
  await transaction.isPersisted.promise;
  return CHARACTER_ASSISTANT_SESSION_SCHEMA.parse(characterAssistantSessionsCollection.get(session.id) ?? session);
}

export async function updateCharacterAssistantSession(
  sessionId: string,
  recipe: (draft: iCharacterAssistantSession) => unknown,
) {
  if (!characterAssistantSessionsCollection.has(sessionId)) {
    throw new Error(`Character assistant session "${sessionId}" is unavailable.`);
  }

  const transaction = characterAssistantSessionsCollection.update(sessionId, (draft) => {
    recipe(draft as iCharacterAssistantSession);
    draft.updatedAt = new Date().toISOString();
  });
  await transaction.isPersisted.promise;

  const persistedSession = characterAssistantSessionsCollection.get(sessionId);
  if (!persistedSession) {
    throw new Error(`Character assistant session "${sessionId}" was not persisted.`);
  }

  return CHARACTER_ASSISTANT_SESSION_SCHEMA.parse(persistedSession);
}

export async function startGuidedSession(characterId: string) {
  const session = await ensureCharacterAssistantSession(characterId);
  await deleteGuidedReferenceAssetBlobs(characterId);
  return updateCharacterAssistantSession(session.id, (draft) => {
    draft.messages = [];
    draft.proposals = [];
    draft.mode = CHARACTER_ASSISTANT_SESSION_MODES.guided;
    draft.guided = {
      currentStep: GUIDED_STEP_IDS.concept,
      completedSteps: [],
      concept: null,
      attachments: [],
    };
  });
}

export async function advanceGuidedStep(characterId: string) {
  const session = await ensureCharacterAssistantSession(characterId);
  return updateCharacterAssistantSession(session.id, (draft) => {
    if (!draft.guided) {
      return;
    }

    if (!draft.guided.completedSteps.includes(draft.guided.currentStep)) {
      draft.guided.completedSteps.push(draft.guided.currentStep);
    }

    const nextStep = getNextGuidedStepId(draft.guided.currentStep);
    if (!nextStep) {
      draft.mode = CHARACTER_ASSISTANT_SESSION_MODES.chat;
      return;
    }

    draft.guided.currentStep = nextStep;
  });
}

export async function exitGuidedSession(characterId: string) {
  const session = await ensureCharacterAssistantSession(characterId);
  return updateCharacterAssistantSession(session.id, (draft) => {
    draft.mode = CHARACTER_ASSISTANT_SESSION_MODES.chat;
  });
}

export async function recordGuidedConcept(characterId: string, concept: iCharacterConcept) {
  const session = await ensureCharacterAssistantSession(characterId);
  return updateCharacterAssistantSession(session.id, (draft) => {
    if (draft.guided) {
      draft.guided.concept = structuredClone(concept);
    }
  });
}

export async function appendGuidedAttachment(characterId: string, attachment: iCharacterAssistantContextAttachment) {
  const session = await ensureCharacterAssistantSession(characterId);
  return updateCharacterAssistantSession(session.id, (draft) => {
    if (draft.guided) {
      draft.guided.attachments = [
        ...draft.guided.attachments.filter((currentAttachment) => currentAttachment.id !== attachment.id),
        structuredClone(attachment),
      ].slice(-4);
    }
  });
}

export async function removeGuidedAttachment(characterId: string, attachmentId: string) {
  const session = await ensureCharacterAssistantSession(characterId);
  return updateCharacterAssistantSession(session.id, (draft) => {
    if (draft.guided) {
      draft.guided.attachments = draft.guided.attachments.filter((attachment) => attachment.id !== attachmentId);
    }
  });
}
