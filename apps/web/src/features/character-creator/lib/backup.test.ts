import { describe, expect, it } from 'vitest';

import { readArchiveBytes, createArchiveBytes } from './archive';
import { buildFullBackupFiles, findBackupManifest, parseFullBackup, TENZO_BACKUP_FORMAT } from './backup';
import { createCharacterLibraryItem } from './character-library';
import type { iStoredExampleCharacter } from './example-characters';
import { ARCHIVE_FORMATS } from './export-settings';
import { DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS } from './generation-config';

function createSampleCharacter() {
  const character = createCharacterLibraryItem();
  character.card.data.name = 'Fire Keeper';
  character.portrait = {
    assetId: 'asset-1',
    fileName: 'fire-keeper.png',
    mimeType: 'image/png',
    cropRect: { x: 0, y: 0, width: 100, height: 150 },
    thumbnailDataUrl: null,
  };
  return character;
}

function createSampleExampleCharacter(): iStoredExampleCharacter {
  return {
    id: 'example-1',
    fileName: 'example.json',
    sourceKind: 'json',
    card: createCharacterLibraryItem().card,
    includedFieldKeys: ['name', 'description'],
  };
}

describe('backup', () => {
  it('round-trips a full backup through an archive', () => {
    const character = createSampleCharacter();
    const files = buildFullBackupFiles({
      characters: [character],
      exampleCharacters: [createSampleExampleCharacter()],
      connectionSettings: {
        ...DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS,
        model: 'custom-model',
        apiKeyCiphertext: 'super-secret',
      },
      assets: [{ assetId: 'asset-1', mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3, 4]) }],
    });

    const archiveBytes = createArchiveBytes(files, ARCHIVE_FORMATS.zip);
    const backup = parseFullBackup(readArchiveBytes(archiveBytes));

    expect(backup.manifest.format).toBe(TENZO_BACKUP_FORMAT);
    expect(backup.characters).toHaveLength(1);
    expect(backup.characters[0].card.data.name).toBe('Fire Keeper');
    expect(backup.characters[0].portrait?.assetId).toBe('asset-1');
    expect(backup.exampleCharacters).toHaveLength(1);
    expect(backup.connectionSettings?.model).toBe('custom-model');
    expect(backup.assets).toHaveLength(1);
    expect(backup.assets[0].assetId).toBe('asset-1');
    expect(backup.assets[0].mimeType).toBe('image/png');
    expect(Array.from(backup.assets[0].bytes)).toEqual([1, 2, 3, 4]);
  });

  it('never includes API credentials in the backup', () => {
    const files = buildFullBackupFiles({
      characters: [],
      exampleCharacters: [],
      connectionSettings: {
        ...DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS,
        apiKeyCiphertext: 'super-secret',
      },
      assets: [],
    });

    const settingsEntry = files.find((file) => file.path === 'settings.json');
    expect(settingsEntry).toBeDefined();
    expect(new TextDecoder().decode(settingsEntry?.data)).not.toContain('super-secret');

    const backup = parseFullBackup(files);
    expect(backup.connectionSettings?.apiKeyCiphertext).toBe('');
  });

  it('does not treat a plain card archive as a backup', () => {
    const cardEntry = { path: 'fire-keeper.json', data: new TextEncoder().encode('{}') };
    expect(findBackupManifest([cardEntry])).toBeNull();
    expect(() => parseFullBackup([cardEntry])).toThrow(/not a Tenzo backup/);
  });
});
