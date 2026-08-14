import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { z } from 'zod';

import { createEmptyCharacterLibraryItem } from '../features/character-creator/lib/cards/character-library';
import { initializeApplicationCollections } from './collections/initialize-collections';
import { applicationDatabase } from './database';
import { downloadMigrationBackup, getPendingMigrations, runMigrations } from './migrations';
import type { ApplicationMigration } from './migrations';

const MIGRATION_GATE_STATUS_SCHEMA = z.enum(['checking', 'confirmation-required', 'running', 'ready', 'error']);
const MIGRATION_GATE_STATUSES = MIGRATION_GATE_STATUS_SCHEMA.enum;
type MigrationGateStatus = z.infer<typeof MIGRATION_GATE_STATUS_SCHEMA>;

interface iMigrationGateProps {
  children: ReactNode;
}

let initializationPromise: Promise<readonly ApplicationMigration[]> | null = null;

async function inspectMigrations() {
  initializationPromise ??= getPendingMigrations();
  return initializationPromise;
}

async function finishInitialization(pendingMigrations: readonly ApplicationMigration[]) {
  await runMigrations(pendingMigrations);

  if ((await applicationDatabase.characterLibrary.count()) === 0) {
    await applicationDatabase.characterLibrary.add(createEmptyCharacterLibraryItem());
  }

  await initializeApplicationCollections();
}

function MigrationShell({ children }: iMigrationGateProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-background px-6 text-foreground">
      <section className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-xl">{children}</section>
    </main>
  );
}

export function MigrationGate({ children }: iMigrationGateProps) {
  const [status, setStatus] = useState<MigrationGateStatus>(MIGRATION_GATE_STATUSES.checking);
  const [pendingMigrations, setPendingMigrations] = useState<readonly ApplicationMigration[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasDownloadedBackup, setHasDownloadedBackup] = useState(false);
  const hasStartedRef = useRef(false);

  const destructiveMigrations = useMemo(
    () => pendingMigrations.filter((migration) => migration.isDestructive),
    [pendingMigrations],
  );

  const initialize = useCallback(async () => {
    try {
      const migrations = await inspectMigrations();
      setPendingMigrations(migrations);

      if (migrations.some((migration) => migration.isDestructive)) {
        setStatus(MIGRATION_GATE_STATUSES['confirmation-required']);
        return;
      }

      setStatus(MIGRATION_GATE_STATUSES.running);
      await finishInitialization(migrations);
      setStatus(MIGRATION_GATE_STATUSES.ready);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The local database could not be prepared.');
      setStatus(MIGRATION_GATE_STATUSES.error);
    }
  }, []);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    void initialize();
  }, [initialize]);

  const handleDownloadBackup = useCallback(async () => {
    try {
      await downloadMigrationBackup();
      setHasDownloadedBackup(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The backup could not be downloaded.');
      setStatus(MIGRATION_GATE_STATUSES.error);
    }
  }, []);

  const handleRunDestructiveMigrations = useCallback(async () => {
    if (!hasDownloadedBackup) {
      return;
    }

    try {
      setStatus(MIGRATION_GATE_STATUSES.running);
      await finishInitialization(pendingMigrations);
      setStatus(MIGRATION_GATE_STATUSES.ready);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The local database migration failed.');
      setStatus(MIGRATION_GATE_STATUSES.error);
    }
  }, [hasDownloadedBackup, pendingMigrations]);

  if (status === MIGRATION_GATE_STATUSES.ready) {
    return <>{children}</>;
  }

  if (status === MIGRATION_GATE_STATUSES['confirmation-required']) {
    return (
      <MigrationShell>
        <p className="text-sm font-medium text-destructive">Data migration requires confirmation</p>
        <h1 className="mt-2 text-2xl font-semibold">Save a backup before continuing</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The pending migration removes or replaces stored data. The character editor stays locked until you save a
          backup and approve the migration.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          {destructiveMigrations.map((migration) => (
            <li key={migration.id}>{migration.warning}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            onClick={handleDownloadBackup}
            type="button"
          >
            Download data backup
          </button>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasDownloadedBackup}
            onClick={handleRunDestructiveMigrations}
            type="button"
          >
            Run migration
          </button>
        </div>
        {!hasDownloadedBackup && (
          <p className="mt-3 text-xs text-muted-foreground">
            Running the migration unlocks after the backup downloads.
          </p>
        )}
      </MigrationShell>
    );
  }

  if (status === MIGRATION_GATE_STATUSES.error) {
    return (
      <MigrationShell>
        <p className="text-sm font-medium text-destructive">Local database unavailable</p>
        <h1 className="mt-2 text-2xl font-semibold">Your data was not changed</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{errorMessage}</p>
        <button
          className="mt-6 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          onClick={() => window.location.reload()}
          type="button"
        >
          Retry
        </button>
      </MigrationShell>
    );
  }

  const loadingMessage =
    status === MIGRATION_GATE_STATUSES.running
      ? 'Finishing database migrations before opening the editor.'
      : 'Checking the local database before opening the editor.';

  return (
    <MigrationShell>
      <p className="text-sm font-medium text-muted-foreground">Preparing local data</p>
      <h1 className="mt-2 text-2xl font-semibold">Please keep this tab open</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{loadingMessage}</p>
    </MigrationShell>
  );
}
