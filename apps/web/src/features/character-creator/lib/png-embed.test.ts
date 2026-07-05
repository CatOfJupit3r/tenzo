import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pngChunkText from 'png-chunk-text';
import encodeChunks from 'png-chunks-encode';
import extractChunks from 'png-chunks-extract';
import { describe, expect, it } from 'vitest';

import { parseCharacterCardJson } from './card-format';
import { embedCharacterCardInPng, readCharacterCardFromPng } from './png-embed';

interface iPngChunk {
  name: string;
  data: Uint8Array;
}

interface iDecodedPngTextChunk {
  keyword: string;
  text: string;
}

const extractPngChunks = extractChunks as (pngBytes: Uint8Array) => iPngChunk[];
const encodePngChunks = encodeChunks as (chunks: iPngChunk[]) => Uint8Array;
const decodePngTextChunk = pngChunkText.decode as (chunkData: Uint8Array) => iDecodedPngTextChunk;
const encodePngTextChunk = pngChunkText.encode as (keyword: string, text: string) => iPngChunk;

function readSamplePng(): Uint8Array {
  return new Uint8Array(readFileSync(resolve(process.cwd(), 'public/favicon/favicon-96x96.png')));
}

function readReferenceCardPng(): Uint8Array {
  return new Uint8Array(readFileSync(resolve(process.cwd(), '../../inspo/characters/main_fire-keeper_spec_v2.png')));
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

  it('imports and re-embeds the reference fire keeper card with a single chara chunk', () => {
    const referencePng = readReferenceCardPng();
    const jsonText = readCharacterCardFromPng(referencePng);
    const card = parseCharacterCardJson(jsonText);
    const rewrittenPng = embedCharacterCardInPng(referencePng, jsonText);
    const rewrittenTextChunks = extractPngChunks(rewrittenPng)
      .filter((chunk) => chunk.name === 'tEXt')
      .map((chunk) => decodePngTextChunk(chunk.data));

    expect(card.data.name.length).toBeGreaterThan(0);
    expect(rewrittenTextChunks.filter((chunk) => chunk.keyword.toLowerCase() === 'chara')).toHaveLength(1);
    expect(rewrittenTextChunks.filter((chunk) => chunk.keyword.toLowerCase() === 'ccv3')).toHaveLength(0);
  });
});
