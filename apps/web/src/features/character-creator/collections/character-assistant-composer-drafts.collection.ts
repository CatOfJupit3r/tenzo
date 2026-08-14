import type { JSONContent } from '@tiptap/core';
import { z } from 'zod';

import { applicationDatabase } from '@~/db/database';
import { PersistentCollection } from '@~/db/persistent-collection';

export const CHARACTER_ASSISTANT_COMPOSER_DRAFT_SCHEMA = z.object({
  characterId: z.string().trim().min(1),
  text: z.string(),
  templateIds: z.array(z.string()).max(4),
  scopeLabel: z.string(),
  document: z.custom<JSONContent>().nullable().optional().default(null),
});

export type iCharacterAssistantComposerDraft = z.infer<typeof CHARACTER_ASSISTANT_COMPOSER_DRAFT_SCHEMA>;

export function createCharacterAssistantComposerDraft(characterId: string): iCharacterAssistantComposerDraft {
  return {
    characterId,
    text: '',
    templateIds: [],
    scopeLabel: 'Whole character',
    document: null,
  };
}

export const CHARACTER_ASSISTANT_COMPOSER_DRAFTS_STORAGE_KEY = 'tenzo:character-creator:assistant-composer-drafts:v1';

export const characterAssistantComposerDraftsCollection = new PersistentCollection({
  table: applicationDatabase.characterAssistantComposerDrafts,
  getKey: (draft) => draft.characterId,
  schema: CHARACTER_ASSISTANT_COMPOSER_DRAFT_SCHEMA,
});

export async function ensureCharacterAssistantComposerDraft(characterId: string) {
  await characterAssistantComposerDraftsCollection.preload();
  const existingDraft = characterAssistantComposerDraftsCollection.get(characterId);
  if (existingDraft) {
    return CHARACTER_ASSISTANT_COMPOSER_DRAFT_SCHEMA.parse(existingDraft);
  }

  const draft = createCharacterAssistantComposerDraft(characterId);
  const transaction = characterAssistantComposerDraftsCollection.insert(draft);
  await transaction.isPersisted.promise;
  return draft;
}

export async function saveCharacterAssistantComposerDraft(draft: iCharacterAssistantComposerDraft) {
  await characterAssistantComposerDraftsCollection.preload();
  const parsedDraft = CHARACTER_ASSISTANT_COMPOSER_DRAFT_SCHEMA.parse(draft);
  const transaction = characterAssistantComposerDraftsCollection.has(parsedDraft.characterId)
    ? characterAssistantComposerDraftsCollection.update(parsedDraft.characterId, (storedDraft) => {
        storedDraft.text = parsedDraft.text;
        storedDraft.templateIds = parsedDraft.templateIds;
        storedDraft.scopeLabel = parsedDraft.scopeLabel;
        storedDraft.document = parsedDraft.document;
      })
    : characterAssistantComposerDraftsCollection.insert(parsedDraft);
  await transaction.isPersisted.promise;
}

export async function clearCharacterAssistantComposerDraft(characterId: string) {
  await saveCharacterAssistantComposerDraft(createCharacterAssistantComposerDraft(characterId));
}
