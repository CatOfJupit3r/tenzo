import { createCollection, localStorageCollectionOptions } from '@tanstack/react-db';
import { z } from 'zod';

import { localStorageApi } from '@~/db/storage';

import { GUIDED_STEP_ID_SCHEMA, GUIDED_STEP_IDS, getNextGuidedStepId } from '../constants/guided-flow';
import type { GuidedStepId } from '../constants/guided-flow';
import {
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA,
  CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA,
  CHARACTER_ASSISTANT_DISCOVERY_STATE_DEFAULT,
  CHARACTER_CONCEPT_SCHEMA,
} from '../lib/character-assistant-contracts';
import type {
  iCharacterConcept,
  iCharacterAssistantContextAttachment,
  iCharacterAssistantDiscoveryDirectionCategory,
  iCharacterAssistantDiscoveryDirectionCard,
} from '../lib/character-assistant-contracts';
import {
  buildDeterministicDiscoveryHandoffSummary,
  createCustomizedDirectionCard,
  replaceGeneratedDiscoveryCardsByCategory,
  toggleDirectionCardSelection,
} from '../lib/character-assistant-discovery-state';
import {
  CHARACTER_ASSISTANT_SESSION_SCHEMA,
  CHARACTER_ASSISTANT_SESSION_MODES,
  createCharacterAssistantSession,
  createDiscoveryHandoffSummaryDefault,
} from '../lib/character-assistant-session';
import type { iCharacterAssistantSession } from '../lib/character-assistant-session';
import { migrateCharacterAssistantSessionStorage } from '../lib/character-assistant-session-storage';
import { deleteGuidedReferenceAssetBlobs } from '../lib/image-store';

const CUSTOMIZED_DISCOVERY_CARD_SCHEMA = z.object({
  id: z.string().trim().min(1),
  title: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA.shape.title,
  description: CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CARD_SCHEMA.shape.description,
});
const DISCOVERY_PREMISE_SCHEMA = CHARACTER_CONCEPT_SCHEMA.shape.premise;
const DISCOVERY_CATEGORY_SCHEMA = CHARACTER_ASSISTANT_DISCOVERY_DIRECTION_CATEGORY_SCHEMA;

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
      discovery: CHARACTER_ASSISTANT_DISCOVERY_STATE_DEFAULT,
      discoveryHandoffSummary: createDiscoveryHandoffSummaryDefault(),
    };
  });
}

export async function startGuidedDiscovery(characterId: string, originalPremise: string) {
  const session = await ensureCharacterAssistantSession(characterId);
  const parsedOriginalPremise = DISCOVERY_PREMISE_SCHEMA.parse(originalPremise);

  return updateCharacterAssistantSession(session.id, (draft) => {
    if (!draft.guided) {
      return;
    }

    draft.guided.discovery = {
      originalPremise: parsedOriginalPremise,
      cards: [],
      selectedCardIds: [],
      isReadyForHandoff: false,
    };
    draft.guided.discoveryHandoffSummary = createDiscoveryHandoffSummaryDefault();
  });
}

export async function replaceGeneratedGuidedDiscoveryCardsByCategory(
  characterId: string,
  category: iCharacterAssistantDiscoveryDirectionCategory,
  generatedCards: readonly iCharacterAssistantDiscoveryDirectionCard[],
) {
  const parsedCategory = DISCOVERY_CATEGORY_SCHEMA.parse(category);
  const session = await ensureCharacterAssistantSession(characterId);

  return updateCharacterAssistantSession(session.id, (draft) => {
    if (!draft.guided) {
      return;
    }

    draft.guided.discovery = replaceGeneratedDiscoveryCardsByCategory(
      draft.guided.discovery,
      parsedCategory,
      generatedCards,
    );
  });
}

export async function toggleGuidedDiscoveryCardSelection(characterId: string, cardId: string) {
  const session = await ensureCharacterAssistantSession(characterId);
  const parsedCardId = z.string().trim().min(1).parse(cardId);

  return updateCharacterAssistantSession(session.id, (draft) => {
    if (!draft.guided) {
      return;
    }

    draft.guided.discovery = toggleDirectionCardSelection(draft.guided.discovery, parsedCardId);
  });
}

export async function addCustomizedGuidedDiscoveryCard(
  characterId: string,
  sourceCardId: string,
  customCard: { id: string; title: string; description: string },
) {
  const session = await ensureCharacterAssistantSession(characterId);
  const parsedSourceCardId = z.string().trim().min(1).parse(sourceCardId);
  const parsedCustomCard = CUSTOMIZED_DISCOVERY_CARD_SCHEMA.parse(customCard);

  return updateCharacterAssistantSession(session.id, (draft) => {
    if (!draft.guided) {
      return;
    }

    draft.guided.discovery = createCustomizedDirectionCard(
      draft.guided.discovery,
      parsedSourceCardId,
      parsedCustomCard,
    );
  });
}

export async function finishGuidedDiscovery(characterId: string) {
  const session = await ensureCharacterAssistantSession(characterId);

  return updateCharacterAssistantSession(session.id, (draft) => {
    if (!draft.guided) {
      return;
    }

    if (!draft.guided.discovery.isReadyForHandoff) {
      throw new Error('Select at least one discovery direction before continuing.');
    }

    draft.guided.discoveryHandoffSummary = buildDeterministicDiscoveryHandoffSummary(draft.guided.discovery);
  });
}

export async function restartGuidedDiscovery(characterId: string) {
  const session = await ensureCharacterAssistantSession(characterId);

  return updateCharacterAssistantSession(session.id, (draft) => {
    if (!draft.guided) {
      return;
    }

    const nextDiscovery = {
      originalPremise: draft.guided.discovery.originalPremise,
      cards: [],
      selectedCardIds: [],
      isReadyForHandoff: false,
    };

    draft.guided.discovery = nextDiscovery;
    draft.guided.discoveryHandoffSummary = createDiscoveryHandoffSummaryDefault();
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

export async function selectGuidedStep(characterId: string, stepId: GuidedStepId) {
  const session = await ensureCharacterAssistantSession(characterId);
  const parsedStepId = GUIDED_STEP_ID_SCHEMA.parse(stepId);

  return updateCharacterAssistantSession(session.id, (draft) => {
    if (!draft.guided) {
      return;
    }

    draft.mode = CHARACTER_ASSISTANT_SESSION_MODES.guided;
    draft.guided.currentStep = parsedStepId;
  });
}

export async function recordGuidedStepRunCompletion(characterId: string, stepId: GuidedStepId) {
  const session = await ensureCharacterAssistantSession(characterId);
  return updateCharacterAssistantSession(session.id, (draft) => {
    if (draft.guided?.currentStep !== stepId || draft.guided.completedSteps.includes(stepId)) {
      return;
    }

    draft.guided.completedSteps.push(stepId);
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
