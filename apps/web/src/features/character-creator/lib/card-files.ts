import { createArchiveBlob, readArchiveBytes } from './archive';
import type { iArchiveFileEntry } from './archive';
import { buildFullBackupFiles, findBackupManifest, parseFullBackup } from './backup';
import type { iBackupPortraitAsset, iTenzoBackup } from './backup';
import {
  extractTenzoCardMetadata,
  getCharacterCardFileStem,
  normalizeImportedCharacterCard,
  serializeCharacterCard,
} from './card-format';
import type { iCharacterCardExportOptions, iTenzoCardMetadata } from './card-format';
import type { CharacterCard } from './card-schema';
import type { iCharacterLibraryItem } from './character-library';
import type { iStoredExampleCharacter } from './example-characters';
import { ARCHIVE_FORMAT_FILE_EXTENSIONS } from './export-settings';
import type { ArchiveFormat, ExportDetailLevel } from './export-settings';
import type { iCharacterGenerationConnectionSettings } from './generation-config';
import { downloadBlob, readBlobAsUint8Array, readFileAsText } from './image-utils';
import { embedCharacterCardInPng, readCharacterCardFromPng } from './png-embed';
import { renderPortraitBlobWithCrop } from './portrait-focal-point';
import type { iPortraitCropRect } from './portrait-focal-point';

export interface iImportedCharacterCardFile {
  card: CharacterCard;
  tenzoMetadata: iTenzoCardMetadata;
  portraitBlob: Blob | null;
  fileName: string;
  sourceKind: 'json' | 'png';
}

function isJsonFile(file: File): boolean {
  return file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
}

function isPngFile(file: File): boolean {
  return file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
}

const ARCHIVE_FILE_NAME_PATTERN = /\.(zip|tar\.gz|tgz)$/;
const ARCHIVE_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/gzip',
  'application/x-gzip',
];

export function isArchiveFile(file: File): boolean {
  return ARCHIVE_MIME_TYPES.includes(file.type) || ARCHIVE_FILE_NAME_PATTERN.test(file.name.toLowerCase());
}

function importCharacterCardJsonText(jsonText: string, fileName: string): iImportedCharacterCardFile {
  const rawCard: unknown = JSON.parse(jsonText);

  return {
    card: normalizeImportedCharacterCard(rawCard),
    tenzoMetadata: extractTenzoCardMetadata(rawCard),
    portraitBlob: null,
    fileName,
    sourceKind: 'json',
  };
}

function importCharacterCardPngBytes(
  pngBytes: Uint8Array,
  portraitBlob: Blob,
  fileName: string,
): iImportedCharacterCardFile {
  const jsonText = readCharacterCardFromPng(pngBytes);
  const rawCard: unknown = JSON.parse(jsonText);

  return {
    card: normalizeImportedCharacterCard(rawCard),
    tenzoMetadata: extractTenzoCardMetadata(rawCard),
    portraitBlob,
    fileName,
    sourceKind: 'png',
  };
}

export async function importCharacterCardFile(file: File): Promise<iImportedCharacterCardFile> {
  if (isJsonFile(file)) {
    const jsonText = await readFileAsText(file);
    return importCharacterCardJsonText(jsonText, file.name);
  }

  if (isPngFile(file)) {
    const pngBytes = await readBlobAsUint8Array(file);
    return importCharacterCardPngBytes(pngBytes, file, file.name);
  }

  throw new Error('Unsupported import file. Use a JSON or PNG character card.');
}

export async function exportCharacterCardJson(card: CharacterCard, options: iCharacterCardExportOptions) {
  const jsonText = serializeCharacterCard(card, options);
  const jsonBlob = new Blob([jsonText], { type: 'application/json' });
  downloadBlob(jsonBlob, `${getCharacterCardFileStem(card)}.json`);
}

async function buildCharacterCardPngBytes(
  card: CharacterCard,
  portraitBlob: Blob,
  cropRect: iPortraitCropRect | null,
  options: iCharacterCardExportOptions,
): Promise<Uint8Array> {
  const basePngBlob = await renderPortraitBlobWithCrop(portraitBlob, cropRect);
  const pngBytes = await readBlobAsUint8Array(basePngBlob);
  const characterJson = serializeCharacterCard(card, options);
  return embedCharacterCardInPng(pngBytes, characterJson);
}

export async function exportCharacterCardPng(
  card: CharacterCard,
  portraitBlob: Blob,
  cropRect: iPortraitCropRect | null,
  options: iCharacterCardExportOptions,
) {
  const embeddedPngBytes = await buildCharacterCardPngBytes(card, portraitBlob, cropRect, options);
  const embeddedPngBlob = new Blob([embeddedPngBytes.slice()], { type: 'image/png' });

  downloadBlob(embeddedPngBlob, `${getCharacterCardFileStem(card)}.png`);
}

export interface iBulkExportCharacter {
  item: iCharacterLibraryItem;
  portraitBlob: Blob | null;
}

function createUniqueArchivePath(usedPaths: Set<string>, stem: string, extension: string): string {
  let candidate = `${stem}${extension}`;
  let suffix = 2;

  while (usedPaths.has(candidate)) {
    candidate = `${stem}-${suffix}${extension}`;
    suffix += 1;
  }

  usedPaths.add(candidate);
  return candidate;
}

export async function buildCharactersArchiveFiles(
  characters: iBulkExportCharacter[],
  detailLevel: ExportDetailLevel,
): Promise<iArchiveFileEntry[]> {
  const usedPaths = new Set<string>();
  const files: iArchiveFileEntry[] = [];

  for (const { item, portraitBlob } of characters) {
    const exportOptions: iCharacterCardExportOptions = {
      detailLevel,
      promptSettings: item.promptSettings,
      portraitCropRect: item.portrait?.cropRect ?? null,
    };
    const stem = getCharacterCardFileStem(item.card);

    if (portraitBlob) {
      const pngBytes = await buildCharacterCardPngBytes(
        item.card,
        portraitBlob,
        item.portrait?.cropRect ?? null,
        exportOptions,
      );
      files.push({ path: createUniqueArchivePath(usedPaths, stem, '.png'), data: pngBytes });
    } else {
      const jsonText = serializeCharacterCard(item.card, exportOptions);
      files.push({ path: createUniqueArchivePath(usedPaths, stem, '.json'), data: new TextEncoder().encode(jsonText) });
    }
  }

  return files;
}

export async function exportCharactersArchive(
  characters: iBulkExportCharacter[],
  detailLevel: ExportDetailLevel,
  format: ArchiveFormat,
) {
  const files = await buildCharactersArchiveFiles(characters, detailLevel);
  const archiveBlob = createArchiveBlob(files, format);
  const dateStamp = new Date().toISOString().slice(0, 10);

  downloadBlob(archiveBlob, `tenzo-characters-${dateStamp}${ARCHIVE_FORMAT_FILE_EXTENSIONS[format]}`);
}

export async function exportFullBackupArchive(
  {
    characters,
    exampleCharacters,
    connectionSettings,
    assets,
  }: {
    characters: iCharacterLibraryItem[];
    exampleCharacters: iStoredExampleCharacter[];
    connectionSettings: iCharacterGenerationConnectionSettings;
    assets: iBackupPortraitAsset[];
  },
  format: ArchiveFormat,
) {
  const files = buildFullBackupFiles({ characters, exampleCharacters, connectionSettings, assets });
  const archiveBlob = createArchiveBlob(files, format);
  const dateStamp = new Date().toISOString().slice(0, 10);

  downloadBlob(archiveBlob, `tenzo-backup-${dateStamp}${ARCHIVE_FORMAT_FILE_EXTENSIONS[format]}`);
}

export type iImportedArchive =
  | { kind: 'backup'; backup: iTenzoBackup }
  | { kind: 'cards'; cards: iImportedCharacterCardFile[]; failedPaths: string[] };

function getArchiveEntryBaseName(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] ?? path;
}

export async function importArchiveFile(file: File): Promise<iImportedArchive> {
  const archiveBytes = await readBlobAsUint8Array(file);
  const entries = readArchiveBytes(archiveBytes);

  if (findBackupManifest(entries)) {
    return { kind: 'backup', backup: parseFullBackup(entries) };
  }

  const cards: iImportedCharacterCardFile[] = [];
  const failedPaths: string[] = [];

  for (const entry of entries) {
    const lowerPath = entry.path.toLowerCase();

    try {
      if (lowerPath.endsWith('.json')) {
        cards.push(
          importCharacterCardJsonText(new TextDecoder().decode(entry.data), getArchiveEntryBaseName(entry.path)),
        );
      } else if (lowerPath.endsWith('.png')) {
        const portraitBlob = new Blob([entry.data.slice()], { type: 'image/png' });
        cards.push(importCharacterCardPngBytes(entry.data, portraitBlob, getArchiveEntryBaseName(entry.path)));
      }
    } catch {
      failedPaths.push(entry.path);
    }
  }

  if (cards.length === 0) {
    throw new Error('The archive does not contain a Tenzo backup or any importable character cards.');
  }

  return { kind: 'cards', cards, failedPaths };
}
