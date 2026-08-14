import Dexie from 'dexie';
import type { EntityTable } from 'dexie';

import type { iCharacterAssistantComposerDraft } from '../features/character-creator/collections/character-assistant-composer-drafts.collection';
import type { iCharacterAssistantSession } from '../features/character-creator/lib/assistant/character-assistant-session';
import type { iCharacterLibraryItem } from '../features/character-creator/lib/cards/character-library';
import type { iStoredExampleCharacter } from '../features/character-creator/lib/cards/example-characters';
import type { iStoredFieldTemplate } from '../features/character-creator/lib/cards/field-templates';
import type { UiPreference } from './collections/ui-preferences.collection';

export const APPLICATION_DATABASE_NAME = 'tenzo-character-creator';

export interface iMigrationState {
  id: string;
  completedAt: string;
}

export class ApplicationDatabase extends Dexie {
  characterLibrary!: EntityTable<iCharacterLibraryItem, 'id'>;

  exampleCharacters!: EntityTable<iStoredExampleCharacter, 'id'>;

  fieldTemplates!: EntityTable<iStoredFieldTemplate, 'id'>;

  characterAssistantSessions!: EntityTable<iCharacterAssistantSession, 'id'>;

  characterAssistantComposerDrafts!: EntityTable<iCharacterAssistantComposerDraft, 'characterId'>;

  uiPreferences!: EntityTable<UiPreference, 'id'>;

  migrationState!: EntityTable<iMigrationState, 'id'>;

  constructor() {
    super(APPLICATION_DATABASE_NAME);

    // Application migrations operate on records inside these stable stores. Keeping
    // the physical schema stable lets the app inspect and confirm destructive work
    // before IndexedDB opens an upgrade transaction.
    this.version(1).stores({
      characterLibrary: 'id',
      exampleCharacters: 'id',
      fieldTemplates: 'id',
      characterAssistantSessions: 'id',
      characterAssistantComposerDrafts: 'characterId',
      uiPreferences: 'id',
      migrationState: 'id',
    });
  }
}

export const applicationDatabase = new ApplicationDatabase();
