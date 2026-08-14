import { gunzipSync, gzipSync, unzipSync, zipSync } from 'fflate';

import { ARCHIVE_FORMAT_MIME_TYPES, ARCHIVE_FORMATS } from './export-settings';
import type { ArchiveFormat } from './export-settings';

export interface iArchiveFileEntry {
  path: string;
  data: Uint8Array;
}

const TAR_BLOCK_SIZE = 512;
const TAR_NAME_LENGTH = 100;

function writeTarString(block: Uint8Array, offset: number, length: number, value: string) {
  const encoded = new TextEncoder().encode(value);
  block.set(encoded.subarray(0, length), offset);
}

function writeTarOctal(block: Uint8Array, offset: number, length: number, value: number) {
  writeTarString(block, offset, length, `${value.toString(8).padStart(length - 1, '0')}\0`);
}

function createTarHeader(path: string, size: number): Uint8Array {
  if (new TextEncoder().encode(path).length > TAR_NAME_LENGTH) {
    throw new Error(`Archive entry path is too long: ${path}`);
  }

  const header = new Uint8Array(TAR_BLOCK_SIZE);
  writeTarString(header, 0, TAR_NAME_LENGTH, path);
  writeTarOctal(header, 100, 8, 0o644);
  writeTarOctal(header, 108, 8, 0);
  writeTarOctal(header, 116, 8, 0);
  writeTarOctal(header, 124, 12, size);
  writeTarOctal(header, 136, 12, Math.floor(Date.now() / 1000));
  writeTarString(header, 156, 1, '0');
  writeTarString(header, 257, 6, 'ustar\0');
  writeTarString(header, 263, 2, '00');

  // Checksum is computed with the checksum field treated as spaces.
  header.fill(0x20, 148, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeTarString(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);

  return header;
}

function createTarBytes(files: iArchiveFileEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];

  files.forEach((file) => {
    chunks.push(createTarHeader(file.path, file.data.length));
    chunks.push(file.data);

    const remainder = file.data.length % TAR_BLOCK_SIZE;
    if (remainder !== 0) {
      chunks.push(new Uint8Array(TAR_BLOCK_SIZE - remainder));
    }
  });

  chunks.push(new Uint8Array(TAR_BLOCK_SIZE * 2));

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const tarBytes = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    tarBytes.set(chunk, offset);
    offset += chunk.length;
  });

  return tarBytes;
}

function readTarOctal(bytes: Uint8Array, offset: number, length: number): number {
  const text = new TextDecoder().decode(bytes.subarray(offset, offset + length)).replace(/[\0 ]+$/, '');
  return text === '' ? 0 : Number.parseInt(text, 8);
}

function readTarString(bytes: Uint8Array, offset: number, length: number): string {
  const raw = bytes.subarray(offset, offset + length);
  const nullIndex = raw.indexOf(0);
  return new TextDecoder().decode(nullIndex === -1 ? raw : raw.subarray(0, nullIndex));
}

function readTarBytes(tarBytes: Uint8Array): iArchiveFileEntry[] {
  const entries: iArchiveFileEntry[] = [];
  let offset = 0;

  while (offset + TAR_BLOCK_SIZE <= tarBytes.length) {
    const path = readTarString(tarBytes, offset, TAR_NAME_LENGTH);

    if (path === '') {
      break;
    }

    const size = readTarOctal(tarBytes, offset + 124, 12);
    const typeFlag = readTarString(tarBytes, offset + 156, 1);
    const dataStart = offset + TAR_BLOCK_SIZE;

    if (typeFlag === '' || typeFlag === '0') {
      entries.push({ path, data: tarBytes.slice(dataStart, dataStart + size) });
    }

    offset = dataStart + Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE;
  }

  return entries;
}

export function createArchiveBytes(files: iArchiveFileEntry[], format: ArchiveFormat): Uint8Array {
  if (format === ARCHIVE_FORMATS.tar_gz) {
    return gzipSync(createTarBytes(files));
  }

  const zipInput: Record<string, Uint8Array> = {};
  files.forEach((file) => {
    zipInput[file.path] = file.data;
  });

  return zipSync(zipInput);
}

export function createArchiveBlob(files: iArchiveFileEntry[], format: ArchiveFormat): Blob {
  const archiveBytes = createArchiveBytes(files, format);
  return new Blob([archiveBytes.slice()], { type: ARCHIVE_FORMAT_MIME_TYPES[format] });
}

const ZIP_MAGIC = [0x50, 0x4b];
const GZIP_MAGIC = [0x1f, 0x8b];

function matchesMagic(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((byte, index) => bytes[index] === byte);
}

export function detectArchiveFormat(bytes: Uint8Array): ArchiveFormat | null {
  if (matchesMagic(bytes, ZIP_MAGIC)) {
    return ARCHIVE_FORMATS.zip;
  }

  if (matchesMagic(bytes, GZIP_MAGIC)) {
    return ARCHIVE_FORMATS.tar_gz;
  }

  return null;
}

export function readArchiveBytes(bytes: Uint8Array): iArchiveFileEntry[] {
  const format = detectArchiveFormat(bytes);

  if (format === ARCHIVE_FORMATS.zip) {
    const unzipped = unzipSync(bytes);
    return Object.entries(unzipped)
      .filter(([path]) => !path.endsWith('/'))
      .map(([path, data]) => ({ path, data }));
  }

  if (format === ARCHIVE_FORMATS.tar_gz) {
    return readTarBytes(gunzipSync(bytes));
  }

  throw new Error('Unsupported archive. Use a ZIP or tar.gz file.');
}
