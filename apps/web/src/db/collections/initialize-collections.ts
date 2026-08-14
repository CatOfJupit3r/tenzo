import '../../features/character-creator/collections/character-assistant-composer-drafts.collection';
import '../../features/character-creator/collections/character-assistant-sessions.collection';
import '../../features/character-creator/collections/character-library.collection';
import '../../features/character-creator/collections/example-characters.collection';
import '../../features/character-creator/collections/field-templates.collection';
import { initializePersistentCollections } from '../persistent-collection';
import './ui-preferences.collection';

export async function initializeApplicationCollections() {
  await initializePersistentCollections();
}
