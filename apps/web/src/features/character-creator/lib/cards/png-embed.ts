import { em } from 'enumwaii';
import pngChunkText from 'png-chunk-text';
import encodeChunks from 'png-chunks-encode';
import extractChunks from 'png-chunks-extract';

const CHARACTER_CHUNK_KEYWORD_ENUM = em({
  CHARA: 'chara',
  CCV3: 'ccv3',
});
const CHARACTER_CHUNK_KEYWORDS = CHARACTER_CHUNK_KEYWORD_ENUM.enum;
const PNG_CHUNK_TYPE_ENUM = em({
  T_EXT: 'tEXt',
  IEND: 'IEND',
});
const PNG_CHUNK_TYPES = PNG_CHUNK_TYPE_ENUM.enum;

export interface iPngChunk {
  name: string;
  data: Uint8Array;
}

export interface iDecodedPngTextChunk {
  keyword: string;
  text: string;
}

export const extractPngChunks = extractChunks as (pngBytes: Uint8Array) => iPngChunk[];
export const encodePngChunks = encodeChunks as (chunks: iPngChunk[]) => Uint8Array;
export const decodePngTextChunk = pngChunkText.decode as (chunkData: Uint8Array) => iDecodedPngTextChunk;
export const encodePngTextChunk = pngChunkText.encode as (keyword: string, text: string) => iPngChunk;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (const [index, char] of Array.from(binary).entries()) {
    bytes[index] = char.charCodeAt(0);
  }

  return bytes;
}

function encodeUtf8Base64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

function decodeUtf8Base64(base64Text: string): string {
  return new TextDecoder().decode(base64ToBytes(base64Text));
}

export function readCharacterCardFromPng(pngBytes: Uint8Array): string {
  const textChunks = extractPngChunks(pngBytes)
    .filter((chunk) => chunk.name === PNG_CHUNK_TYPES.T_EXT)
    .map((chunk) => decodePngTextChunk(chunk.data));

  if (textChunks.length === 0) {
    throw new Error('PNG metadata does not contain any text chunks.');
  }

  const preferredChunk =
    textChunks.find((chunk) => chunk.keyword.toLowerCase() === CHARACTER_CHUNK_KEYWORDS.CCV3) ??
    textChunks.find((chunk) => chunk.keyword.toLowerCase() === CHARACTER_CHUNK_KEYWORDS.CHARA);

  if (!preferredChunk) {
    throw new Error('PNG metadata does not contain any character data.');
  }

  return decodeUtf8Base64(preferredChunk.text);
}

export function embedCharacterCardInPng(pngBytes: Uint8Array, jsonText: string): Uint8Array {
  const chunks = extractPngChunks(pngBytes).filter((chunk) => {
    if (chunk.name !== PNG_CHUNK_TYPES.T_EXT) {
      return true;
    }

    const decodedChunk = decodePngTextChunk(chunk.data);
    return !CHARACTER_CHUNK_KEYWORD_ENUM.is(decodedChunk.keyword.toLowerCase());
  });

  const iendIndex = chunks.findIndex((chunk) => chunk.name === PNG_CHUNK_TYPES.IEND);

  if (iendIndex === -1) {
    throw new Error('Invalid PNG: missing IEND chunk.');
  }

  chunks.splice(iendIndex, 0, encodePngTextChunk(CHARACTER_CHUNK_KEYWORDS.CHARA, encodeUtf8Base64(jsonText)));

  return encodePngChunks(chunks);
}
