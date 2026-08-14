import type { ChatClientPersistence, ChatPersistedState } from '@tanstack/ai-react';

import {
  ensureCharacterAssistantSession,
  removeCharacterAssistantSession,
  updateCharacterAssistantSession,
} from '../../collections/character-assistant-sessions.collection';

export function createCharacterAssistantMessagePersistence(characterId: string): ChatClientPersistence {
  return {
    async getItem() {
      const session = await ensureCharacterAssistantSession(characterId);
      return { messages: session.messages };
    },
    async setItem(_id: string, state: ChatPersistedState) {
      const session = await ensureCharacterAssistantSession(characterId);
      await updateCharacterAssistantSession(session.id, (draft) => {
        draft.messages = structuredClone(state.messages);
      });
    },
    async removeItem() {
      await removeCharacterAssistantSession(characterId);
      await ensureCharacterAssistantSession(characterId);
    },
  };
}
