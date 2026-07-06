import { z } from 'zod';

import type { iArchiveFileEntry } from './archive';
import { sanitizeCharacterLibrary } from './character-library';
import type { iCharacterLibraryItem } from './character-library';
import { STORED_EXAMPLE_CHARACTER_SCHEMA } from './example-characters';
import type { iStoredExampleCharacter } from './example-characters';
import { sanitizeCharacterGenerationConnectionSettings } from './generation-config';
import type { iCharacterGenerationConnectionSettings } from './generation-config';

export const TENZO_BACKUP_FORMAT = 'tenzo-backup';
export const TENZO_BACKUP_VERSION = 1;

export const TENZO_BACKUP_MANIFEST_SCHEMA = z.object({
  format: z.literal(TENZO_BACKUP_FORMAT),
  version: z.number(),
  exported_at: z.string(),
});

export type iTenzoBackupManifest = z.infer<typeof TENZO_BACKUP_MANIFEST_SCHEMA>;

const BACKUP_FILE_PATHS = {
  manifest: 'manifest.json',
  characters: 'characters.json',
  exampleCharacters: 'example-characters.json',
  settings: 'settings.json',
  assetsDirectory: 'assets/',
} as const;

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

const ASSET_FILE_EXTENSIONS_BY_MIME_TYPE = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
} satisfies Record<string, string>;

const ASSET_MIME_TYPES_BY_FILE_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
} satisfies Record<string, string>;

function getAssetFileExtension(mimeType: string): string {
  return ASSET_FILE_EXTENSIONS_BY_MIME_TYPE[mimeType as keyof typeof ASSET_FILE_EXTENSIONS_BY_MIME_TYPE] ?? '.bin';
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
    encodeJsonEntry(BACKUP_FILE_PATHS.manifest, manifest),
    encodeJsonEntry(BACKUP_FILE_PATHS.characters, characters),
    encodeJsonEntry(BACKUP_FILE_PATHS.exampleCharacters, exampleCharacters),
    encodeJsonEntry(BACKUP_FILE_PATHS.settings, exportableSettings),
    ...assets.map((asset) => ({
      path: `${BACKUP_FILE_PATHS.assetsDirectory}${asset.assetId}${getAssetFileExtension(asset.mimeType)}`,
      data: asset.bytes,
    })),
  ];
}

export function findBackupManifest(files: iArchiveFileEntry[]): iTenzoBackupManifest | null {
  const manifestEntry = files.find((file) => file.path === BACKUP_FILE_PATHS.manifest);

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
  const fileName = entry.path.slice(BACKUP_FILE_PATHS.assetsDirectory.length);
  const dotIndex = fileName.lastIndexOf('.');
  const assetId = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  const extension = dotIndex === -1 ? '' : fileName.slice(dotIndex);

  if (assetId.trim() === '') {
    return null;
  }

  return {
    assetId,
    mimeType:
      ASSET_MIME_TYPES_BY_FILE_EXTENSION[extension as keyof typeof ASSET_MIME_TYPES_BY_FILE_EXTENSION] ??
      'application/octet-stream',
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

  const charactersEntry = files.find((file) => file.path === BACKUP_FILE_PATHS.characters);
  const exampleCharactersEntry = files.find((file) => file.path === BACKUP_FILE_PATHS.exampleCharacters);
  const settingsEntry = files.find((file) => file.path === BACKUP_FILE_PATHS.settings);

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
      .filter((file) => file.path.startsWith(BACKUP_FILE_PATHS.assetsDirectory))
      .map((entry) => parseAssetEntry(entry))
      .filter((asset): asset is iBackupPortraitAsset => asset !== null),
  };
}
