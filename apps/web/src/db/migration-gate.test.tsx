import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MigrationGate } from './migration-gate';
import type { iMigrationGateService } from './migration-gate-service';
import type { ApplicationMigration } from './migrations';

describe('MigrationGate', () => {
  let pendingMigrations: readonly ApplicationMigration[];
  let service: iMigrationGateService;
  let initialize: iMigrationGateService['initialize'];
  let downloadBackup: iMigrationGateService['downloadBackup'];

  beforeEach(() => {
    pendingMigrations = [
      {
        id: 'delete-obsolete-records',
        isDestructive: true,
        warning: 'Obsolete records will be deleted.',
        run: async () => undefined,
      },
    ];
    initialize = vi.fn(async (_pendingMigrations: readonly ApplicationMigration[]) => undefined);
    downloadBackup = vi.fn(async () => undefined);
    service = {
      inspectMigrations: vi.fn(async () => pendingMigrations),
      downloadBackup,
      initialize,
    };
  });

  it('blocks the product UI and requires a backup before a destructive migration', async () => {
    const user = userEvent.setup();

    render(
      <MigrationGate service={service}>
        <div>Character editor</div>
      </MigrationGate>,
    );

    expect(await screen.findByText('Save a backup before continuing')).toBeTruthy();
    expect(screen.queryByText('Character editor')).toBeNull();

    const runButton = screen.getByRole<HTMLButtonElement>('button', { name: 'Run migration' });
    expect(runButton.disabled).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Download data backup' }));
    expect(downloadBackup).toHaveBeenCalledOnce();
    expect(runButton.disabled).toBe(false);

    await user.click(runButton);
    await waitFor(() => {
      expect(screen.getByText('Character editor')).toBeTruthy();
    });
    expect(initialize).toHaveBeenCalledWith(pendingMigrations);
  });
});
