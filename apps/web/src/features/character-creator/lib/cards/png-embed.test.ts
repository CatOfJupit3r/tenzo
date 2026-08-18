import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  decodePngTextChunk,
  embedCharacterCardInPng,
  encodePngChunks,
  encodePngTextChunk,
  extractPngChunks,
  readCharacterCardFromPng,
} from './png-embed';

function readSamplePng(): Uint8Array {
  return new Uint8Array(readFileSync(resolve(process.cwd(), 'public/favicon/favicon-96x96.png')));
}

describe('png-embed', () => {
  it('embeds and reads character metadata from a PNG', () => {
    const jsonText = JSON.stringify({ spec: 'chara_card_v2', data: { name: 'Archivist' } });
    const pngBytes = readSamplePng();

    const embeddedPng = embedCharacterCardInPng(pngBytes, jsonText);

    expect(readCharacterCardFromPng(embeddedPng)).toBe(jsonText);
  });

  it('replaces stale chara and ccv3 chunks before writing a fresh chara chunk', () => {
    const initialPng = embedCharacterCardInPng(readSamplePng(), JSON.stringify({ version: 'old' }));
    const chunks = extractPngChunks(initialPng);
    chunks.splice(-1, 0, encodePngTextChunk('ccv3', btoa(JSON.stringify({ version: 'v3-stale' }))));

    const rewrittenPng = embedCharacterCardInPng(encodePngChunks(chunks), JSON.stringify({ version: 'new' }));
    const rewrittenTextChunks = extractPngChunks(rewrittenPng)
      .filter((chunk) => chunk.name === 'tEXt')
      .map((chunk) => decodePngTextChunk(chunk.data));

    expect(rewrittenTextChunks.filter((chunk) => chunk.keyword.toLowerCase() === 'chara')).toHaveLength(1);
    expect(rewrittenTextChunks.filter((chunk) => chunk.keyword.toLowerCase() === 'ccv3')).toHaveLength(0);
    expect(readCharacterCardFromPng(rewrittenPng)).toBe(JSON.stringify({ version: 'new' }));
  });
});
