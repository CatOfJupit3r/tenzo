import type { iCharacterLibraryItem } from '../features/character-creator/lib/cards/character-library';
import { createEmptyCharacterLibraryItem } from '../features/character-creator/lib/cards/character-library';
import type { ApplicationMigration } from './migrations';

export interface iMigrationRepository {
  getPendingMigrations: () => Promise<readonly ApplicationMigration[]>;
  runMigrations: (migrations: readonly ApplicationMigration[]) => Promise<void>;
}

export interface iMigrationBackupPort {
  download: () => Promise<void>;
}

export interface iCharacterLibraryInitializationPort {
  count: () => Promise<number>;
  add: (item: iCharacterLibraryItem) => Promise<unknown>;
}

export interface iCollectionInitializationPort {
  initialize: () => Promise<void>;
}

export interface iMigrationGateService {
  inspectMigrations: () => Promise<readonly ApplicationMigration[]>;
  downloadBackup: () => Promise<void>;
  initialize: (pendingMigrations: readonly ApplicationMigration[]) => Promise<void>;
}

export function createMigrationGateService({
  migrationRepository,
  backup,
  characterLibrary,
  collections,
}: {
  migrationRepository: iMigrationRepository;
  backup: iMigrationBackupPort;
  characterLibrary: iCharacterLibraryInitializationPort;
  collections: iCollectionInitializationPort;
}): iMigrationGateService {
  let inspectionPromise: Promise<readonly ApplicationMigration[]> | null = null;

  return {
    inspectMigrations: async () => {
      inspectionPromise ??= migrationRepository.getPendingMigrations();
      return inspectionPromise;
    },
    downloadBackup: backup.download,
    initialize: async (pendingMigrations) => {
      await migrationRepository.runMigrations(pendingMigrations);

      if ((await characterLibrary.count()) === 0) {
        await characterLibrary.add(createEmptyCharacterLibraryItem());
      }

      await collections.initialize();
    },
  };
}
