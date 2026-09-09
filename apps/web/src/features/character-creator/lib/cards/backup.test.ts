import { describe, expect, it } from 'vitest';

import { IMPORTED_CARD_SOURCE_KINDS } from '@~/features/character-creator/lib/cards/card-file-enums';
import { EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY } from '@~/features/character-creator/lib/cards/example-characters';
import { MEDIA_TYPES } from '@~/lib/media-type-enums';

import { DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS } from '../generation/generation-config';
import { createArchiveBytes, readArchiveBytes } from './archive';
import { buildFullBackupFiles, findBackupManifest, parseFullBackup, TENZO_BACKUP_FORMAT } from './backup';
import { createCharacterLibraryItem } from './character-library';
import type { iStoredExampleCharacter } from './example-characters';
import { ARCHIVE_FORMATS } from './export-settings';

function createSampleCharacter() {
  const character = createCharacterLibraryItem();
  character.card.data.name = 'Fire Keeper';
  character.portrait = {
    assetId: 'asset-1',
    fileName: 'fire-keeper.png',
    mimeType: MEDIA_TYPES.PNG,
    cropRect: { x: 0, y: 0, width: 100, height: 150 },
    thumbnailDataUrl: null,
  };
  return character;
}

function createSampleExampleCharacter(): iStoredExampleCharacter {
  return {
    id: 'example-1',
    fileName: 'example.json',
    sourceKind: IMPORTED_CARD_SOURCE_KINDS.JSON,
    card: createCharacterLibraryItem().card,
    includedFieldKeys: [EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.NAME, EXAMPLE_CHARACTER_CONTEXT_FIELD_KEY.DESCRIPTION],
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
      assets: [{ assetId: 'asset-1', mimeType: MEDIA_TYPES.PNG, bytes: new Uint8Array([1, 2, 3, 4]) }],
    });

    const archiveBytes = createArchiveBytes(files, ARCHIVE_FORMATS.ZIP);
    const backup = parseFullBackup(readArchiveBytes(archiveBytes));

    expect(backup.manifest.format).toBe(TENZO_BACKUP_FORMAT);
    expect(backup.characters).toHaveLength(1);
    expect(backup.characters[0].card.data.name).toBe('Fire Keeper');
    expect(backup.characters[0].portrait?.assetId).toBe('asset-1');
    expect(backup.exampleCharacters).toHaveLength(1);
    expect(backup.connectionSettings?.model).toBe('custom-model');
    expect(backup.assets).toHaveLength(1);
    expect(backup.assets[0].assetId).toBe('asset-1');
    expect(backup.assets[0].mimeType).toBe(MEDIA_TYPES.PNG);
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
