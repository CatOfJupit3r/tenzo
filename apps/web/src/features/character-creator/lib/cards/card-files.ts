import {
  IMPORTED_ARCHIVE_KINDS_CASES,
  IMPORTED_CARD_SOURCE_KINDS,
} from '@~/features/character-creator/lib/cards/card-file-enums';
import { MEDIA_TYPES } from '@~/lib/media-type-enums';

import type { iCharacterGenerationConnectionSettings } from '../generation/generation-config';
import type { iPortraitCropRect } from '../portrait/portrait-focal-point';
import { renderPortraitBlobWithCrop } from '../portrait/portrait-focal-point';
import type { iArchiveFileEntry } from './archive';
import { createArchiveBlob, readArchiveBytes } from './archive';
import type { iBackupPortraitAsset, iTenzoBackup } from './backup';
import { buildFullBackupFiles, findBackupManifest, parseFullBackup } from './backup';
import type { ImportedCardSourceKind } from './card-file-enums';
import type { iCharacterCardExportOptions, iTenzoCardMetadata } from './card-format';
import {
  extractTenzoCardMetadata,
  getCharacterCardFileStem,
  normalizeImportedCharacterCard,
  serializeCharacterCard,
} from './card-format';
import type { CharacterCard } from './card-schema';
import type { iCharacterLibraryItem } from './character-library';
import type { iStoredExampleCharacter } from './example-characters';
import type { ArchiveFormat, ExportDetailLevel } from './export-settings';
import { ARCHIVE_FORMAT_FILE_EXTENSIONS } from './export-settings';
import { downloadBlob, readBlobAsUint8Array, readFileAsText } from './image-utils';
import { embedCharacterCardInPng, readCharacterCardFromPng } from './png-embed';

export interface iImportedCharacterCardFile {
  card: CharacterCard;
  tenzoMetadata: iTenzoCardMetadata;
  portraitBlob: Blob | null;
  fileName: string;
  sourceKind: ImportedCardSourceKind;
}

function isJsonFile(file: File): boolean {
  return file.type === MEDIA_TYPES.JSON || file.name.toLowerCase().endsWith('.json');
}

function isPngFile(file: File): boolean {
  return file.type === MEDIA_TYPES.PNG || file.name.toLowerCase().endsWith('.png');
}

const ARCHIVE_FILE_NAME_PATTERN = /\.(zip|tar\.gz|tgz)$/;
const ARCHIVE_MIME_TYPES = [MEDIA_TYPES.ZIP, 'application/x-zip-compressed', MEDIA_TYPES.GZIP, 'application/x-gzip'];

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
    sourceKind: IMPORTED_CARD_SOURCE_KINDS.JSON,
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
    sourceKind: IMPORTED_CARD_SOURCE_KINDS.PNG,
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
  const jsonBlob = new Blob([jsonText], { type: MEDIA_TYPES.JSON });
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
  const embeddedPngBlob = new Blob([embeddedPngBytes.slice()], { type: MEDIA_TYPES.PNG });

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

  downloadBlob(archiveBlob, `tenzo-characters-${dateStamp}${ARCHIVE_FORMAT_FILE_EXTENSIONS.get(format)}`);
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

  downloadBlob(archiveBlob, `tenzo-backup-${dateStamp}${ARCHIVE_FORMAT_FILE_EXTENSIONS.get(format)}`);
}

export type iImportedArchive =
  | { kind: typeof IMPORTED_ARCHIVE_KINDS_CASES.BACKUP; backup: iTenzoBackup }
  | { kind: typeof IMPORTED_ARCHIVE_KINDS_CASES.CARDS; cards: iImportedCharacterCardFile[]; failedPaths: string[] };

function getArchiveEntryBaseName(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] ?? path;
}

export async function importArchiveFile(file: File): Promise<iImportedArchive> {
  const archiveBytes = await readBlobAsUint8Array(file);
  const entries = readArchiveBytes(archiveBytes);

  if (findBackupManifest(entries)) {
    return { kind: IMPORTED_ARCHIVE_KINDS_CASES.BACKUP, backup: parseFullBackup(entries) };
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
        const portraitBlob = new Blob([entry.data.slice()], { type: MEDIA_TYPES.PNG });
        cards.push(importCharacterCardPngBytes(entry.data, portraitBlob, getArchiveEntryBaseName(entry.path)));
      }
    } catch {
      failedPaths.push(entry.path);
    }
  }

  if (cards.length === 0) {
    throw new Error('The archive does not contain a Tenzo backup or any importable character cards.');
  }

  return { kind: IMPORTED_ARCHIVE_KINDS_CASES.CARDS, cards, failedPaths };
}
