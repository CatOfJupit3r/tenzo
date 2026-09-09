import { em } from 'enumwaii';
import { z } from 'zod';

import { MEDIA_TYPE_ENUM, MEDIA_TYPES } from '@~/lib/media-type-enums';

import type { iCharacterGenerationConnectionSettings } from '../generation/generation-config';
import { sanitizeCharacterGenerationConnectionSettings } from '../generation/generation-config';
import type { iArchiveFileEntry } from './archive';
import type { iCharacterLibraryItem } from './character-library';
import { sanitizeCharacterLibrary } from './character-library';
import type { iStoredExampleCharacter } from './example-characters';
import { STORED_EXAMPLE_CHARACTER_SCHEMA } from './example-characters';

export const TENZO_BACKUP_FORMAT = 'tenzo-backup';
export const TENZO_BACKUP_VERSION = 1;

export const TENZO_BACKUP_MANIFEST_SCHEMA = z.object({
  format: z.literal(TENZO_BACKUP_FORMAT),
  version: z.number(),
  exported_at: z.string(),
});

export type iTenzoBackupManifest = z.infer<typeof TENZO_BACKUP_MANIFEST_SCHEMA>;

const BACKUP_FILE_PATHS_ENUM = em({
  MANIFEST: 'manifest.json',
  CHARACTERS: 'characters.json',
  EXAMPLE_CHARACTERS: 'example-characters.json',
  SETTINGS: 'settings.json',
  ASSETS_DIRECTORY: 'assets/',
});
const BACKUP_FILE_PATHS = BACKUP_FILE_PATHS_ENUM.enum;

export interface iBackupPortraitAsset {
  assetId: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface iTenzoBackup {
  manifest: iTenzoBackupManifest;
  characters: iCharacterLibraryItem[];
  exampleCharacters: iStoredExampleCharacter[];
  connectionSettings: iCharacterGenerationConnectionSettings | null;
  assets: iBackupPortraitAsset[];
}

const ASSET_FILE_EXTENSION_ENUM = em({ PNG: '.png', JPEG: '.jpg', WEBP: '.webp', GIF: '.gif', BIN: '.bin' });
const ASSET_FILE_EXTENSIONS = ASSET_FILE_EXTENSION_ENUM.enum;
const ASSET_MEDIA_TYPE_ENUM = MEDIA_TYPE_ENUM.pick([
  MEDIA_TYPES.PNG,
  MEDIA_TYPES.JPEG,
  MEDIA_TYPES.WEBP,
  MEDIA_TYPES.GIF,
  MEDIA_TYPES.OCTET_STREAM,
]);
const ASSET_FILE_EXTENSIONS_BY_MIME_TYPE = ASSET_MEDIA_TYPE_ENUM.deriveTo(
  ASSET_FILE_EXTENSION_ENUM,
  [MEDIA_TYPES.PNG, ASSET_FILE_EXTENSIONS.PNG],
  [MEDIA_TYPES.JPEG, ASSET_FILE_EXTENSIONS.JPEG],
  [MEDIA_TYPES.WEBP, ASSET_FILE_EXTENSIONS.WEBP],
  [MEDIA_TYPES.GIF, ASSET_FILE_EXTENSIONS.GIF],
  [MEDIA_TYPES.OCTET_STREAM, ASSET_FILE_EXTENSIONS.BIN],
);
const ASSET_MIME_TYPES_BY_FILE_EXTENSION = ASSET_FILE_EXTENSION_ENUM.deriveTo(
  ASSET_MEDIA_TYPE_ENUM,
  [ASSET_FILE_EXTENSIONS.PNG, MEDIA_TYPES.PNG],
  [ASSET_FILE_EXTENSIONS.JPEG, MEDIA_TYPES.JPEG],
  [ASSET_FILE_EXTENSIONS.WEBP, MEDIA_TYPES.WEBP],
  [ASSET_FILE_EXTENSIONS.GIF, MEDIA_TYPES.GIF],
  [ASSET_FILE_EXTENSIONS.BIN, MEDIA_TYPES.OCTET_STREAM],
);

function getAssetFileExtension(mimeType: string): string {
  return ASSET_MEDIA_TYPE_ENUM.is(mimeType)
    ? ASSET_FILE_EXTENSIONS_BY_MIME_TYPE.get(mimeType)
    : ASSET_FILE_EXTENSIONS.BIN;
}

function encodeJsonEntry(path: string, value: unknown): iArchiveFileEntry {
  return { path, data: new TextEncoder().encode(JSON.stringify(value, null, 2)) };
}

function decodeJsonEntry(entry: iArchiveFileEntry): unknown {
  return JSON.parse(new TextDecoder().decode(entry.data));
}

export function buildFullBackupFiles({
  characters,
  exampleCharacters,
  connectionSettings,
  assets,
}: {
  characters: iCharacterLibraryItem[];
  exampleCharacters: iStoredExampleCharacter[];
  connectionSettings: iCharacterGenerationConnectionSettings;
  assets: iBackupPortraitAsset[];
}): iArchiveFileEntry[] {
  const manifest: iTenzoBackupManifest = {
    format: TENZO_BACKUP_FORMAT,
    version: TENZO_BACKUP_VERSION,
    exported_at: new Date().toISOString(),
  };

  // API credentials never leave the browser profile, even in a full backup.
  const exportableSettings = { ...connectionSettings, apiKeyCiphertext: '' };

  return [
    encodeJsonEntry(BACKUP_FILE_PATHS.MANIFEST, manifest),
    encodeJsonEntry(BACKUP_FILE_PATHS.CHARACTERS, characters),
    encodeJsonEntry(BACKUP_FILE_PATHS.EXAMPLE_CHARACTERS, exampleCharacters),
    encodeJsonEntry(BACKUP_FILE_PATHS.SETTINGS, exportableSettings),
    ...assets.map((asset) => ({
      path: `${BACKUP_FILE_PATHS.ASSETS_DIRECTORY}${asset.assetId}${getAssetFileExtension(asset.mimeType)}`,
      data: asset.bytes,
    })),
  ];
}

export function findBackupManifest(files: iArchiveFileEntry[]): iTenzoBackupManifest | null {
  const manifestEntry = files.find((file) => file.path === BACKUP_FILE_PATHS.MANIFEST);

  if (!manifestEntry) {
    return null;
  }

  try {
    const parsed = TENZO_BACKUP_MANIFEST_SCHEMA.safeParse(decodeJsonEntry(manifestEntry));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function parseAssetEntry(entry: iArchiveFileEntry): iBackupPortraitAsset | null {
  const fileName = entry.path.slice(BACKUP_FILE_PATHS.ASSETS_DIRECTORY.length);
  const dotIndex = fileName.lastIndexOf('.');
  const assetId = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  const extension = dotIndex === -1 ? '' : fileName.slice(dotIndex);

  if (assetId.trim() === '') {
    return null;
  }

  return {
    assetId,
    mimeType: ASSET_FILE_EXTENSION_ENUM.is(extension)
      ? ASSET_MIME_TYPES_BY_FILE_EXTENSION.get(extension)
      : MEDIA_TYPES.OCTET_STREAM,
    bytes: entry.data,
  };
}

export function parseFullBackup(files: iArchiveFileEntry[]): iTenzoBackup {
  const manifest = findBackupManifest(files);

  if (!manifest) {
    throw new Error('The archive is not a Tenzo backup: manifest.json is missing or invalid.');
  }

  if (manifest.version > TENZO_BACKUP_VERSION) {
    throw new Error(`This backup was created by a newer Tenzo version (backup v${manifest.version}).`);
  }

  const charactersEntry = files.find((file) => file.path === BACKUP_FILE_PATHS.CHARACTERS);
  const exampleCharactersEntry = files.find((file) => file.path === BACKUP_FILE_PATHS.EXAMPLE_CHARACTERS);
  const settingsEntry = files.find((file) => file.path === BACKUP_FILE_PATHS.SETTINGS);

  const exampleCharacters: iStoredExampleCharacter[] = [];

  if (exampleCharactersEntry) {
    const rawExamples = decodeJsonEntry(exampleCharactersEntry);

    if (Array.isArray(rawExamples)) {
      rawExamples.forEach((rawExample) => {
        const parsed = STORED_EXAMPLE_CHARACTER_SCHEMA.safeParse(rawExample);

        if (parsed.success) {
          exampleCharacters.push(parsed.data);
        }
      });
    }
  }

  return {
    manifest,
    characters: charactersEntry ? sanitizeCharacterLibrary(decodeJsonEntry(charactersEntry)) : [],
    exampleCharacters,
    connectionSettings: settingsEntry
      ? sanitizeCharacterGenerationConnectionSettings(decodeJsonEntry(settingsEntry))
      : null,
    assets: files
      .filter((file) => file.path.startsWith(BACKUP_FILE_PATHS.ASSETS_DIRECTORY))
      .map((entry) => parseAssetEntry(entry))
      .filter((asset): asset is iBackupPortraitAsset => asset !== null),
  };
}
