import { describe, expect, it } from 'vitest';

import { createArchiveBytes, detectArchiveFormat, readArchiveBytes } from './archive';
import type { iArchiveFileEntry } from './archive';
import { ARCHIVE_FORMATS } from './export-settings';

function createSampleFiles(): iArchiveFileEntry[] {
  return [
    { path: 'characters.json', data: new TextEncoder().encode(JSON.stringify([{ id: 'one' }])) },
    { path: 'assets/portrait.png', data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]) },
    { path: 'empty.txt', data: new Uint8Array(0) },
  ];
}

function toComparable(entries: iArchiveFileEntry[]) {
  return [...entries]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => ({ path: entry.path, data: Array.from(entry.data) }));
}

describe('archive', () => {
  it('round-trips files through a zip archive', () => {
    const files = createSampleFiles();
    const archiveBytes = createArchiveBytes(files, ARCHIVE_FORMATS.zip);

    expect(detectArchiveFormat(archiveBytes)).toBe(ARCHIVE_FORMATS.zip);

    const restored = toComparable(readArchiveBytes(archiveBytes));
    expect(restored.map((entry) => entry.path)).toEqual(['assets/portrait.png', 'characters.json', 'empty.txt']);
    expect(restored).toEqual(toComparable(files));
  });

  it('round-trips files through a tar.gz archive', () => {
    const files = createSampleFiles();
    const archiveBytes = createArchiveBytes(files, ARCHIVE_FORMATS.tar_gz);

    expect(detectArchiveFormat(archiveBytes)).toBe(ARCHIVE_FORMATS.tar_gz);

    const restored = toComparable(readArchiveBytes(archiveBytes));
    expect(restored).toEqual(toComparable(files));
  });

  it('rejects bytes that are not a supported archive', () => {
    expect(() => readArchiveBytes(new TextEncoder().encode('{"not":"an archive"}'))).toThrow(/Unsupported archive/);
  });

  it('rejects tar entry paths longer than the ustar name field', () => {
    const longPath = `${'a'.repeat(120)}.json`;
    expect(() => createArchiveBytes([{ path: longPath, data: new Uint8Array(1) }], ARCHIVE_FORMATS.tar_gz)).toThrow(
      /too long/,
    );
  });
});
