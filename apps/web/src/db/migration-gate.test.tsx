import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MigrationGate } from './migration-gate';

const migrationMocks = vi.hoisted(() => ({
  downloadMigrationBackup: vi.fn(async () => undefined),
  getPendingMigrations: vi.fn(),
  initializeApplicationCollections: vi.fn(async () => undefined),
  runMigrations: vi.fn(async () => undefined),
}));

vi.mock('./migrations', () => ({
  downloadMigrationBackup: migrationMocks.downloadMigrationBackup,
  getPendingMigrations: migrationMocks.getPendingMigrations,
  runMigrations: migrationMocks.runMigrations,
}));

vi.mock('./collections/initialize-collections', () => ({
  initializeApplicationCollections: migrationMocks.initializeApplicationCollections,
}));

vi.mock('./database', () => ({
  applicationDatabase: {
    characterLibrary: {
      add: vi.fn(async () => undefined),
      count: vi.fn(async () => 1),
    },
  },
}));

describe('MigrationGate', () => {
  beforeEach(() => {
    migrationMocks.downloadMigrationBackup.mockClear();
    migrationMocks.getPendingMigrations.mockReset();
    migrationMocks.initializeApplicationCollections.mockClear();
    migrationMocks.runMigrations.mockClear();
  });

  it('blocks the product UI and requires a backup before a destructive migration', async () => {
    const destructiveMigration = {
      id: 'delete-obsolete-records',
      isDestructive: true,
      warning: 'Obsolete records will be deleted.',
      run: vi.fn(async () => undefined),
    } as const;
    migrationMocks.getPendingMigrations.mockResolvedValue([destructiveMigration]);
    const user = userEvent.setup();

    render(
      <MigrationGate>
        <div>Character editor</div>
      </MigrationGate>,
    );

    expect(await screen.findByText('Save a backup before continuing')).toBeTruthy();
    expect(screen.queryByText('Character editor')).toBeNull();

    const runButton = screen.getByRole<HTMLButtonElement>('button', { name: 'Run migration' });
    expect(runButton.disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Download data backup' }));
    expect(migrationMocks.downloadMigrationBackup).toHaveBeenCalledOnce();
    expect(runButton.disabled).toBe(false);

    await user.click(runButton);
    await waitFor(() => {
      expect(screen.getByText('Character editor')).toBeTruthy();
    });
    expect(migrationMocks.runMigrations).toHaveBeenCalledWith([destructiveMigration]);
  });
});
