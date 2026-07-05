import pngChunkText from 'png-chunk-text';
import encodeChunks from 'png-chunks-encode';
import extractChunks from 'png-chunks-extract';

const CHARACTER_CHUNK_KEYWORDS = new Set(['chara', 'ccv3']);

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
    .filter((chunk) => chunk.name === 'tEXt')
    .map((chunk) => decodePngTextChunk(chunk.data));

  if (textChunks.length === 0) {
    throw new Error('PNG metadata does not contain any text chunks.');
  }

  const preferredChunk =
    textChunks.find((chunk) => chunk.keyword.toLowerCase() === 'ccv3') ??
    textChunks.find((chunk) => chunk.keyword.toLowerCase() === 'chara');

  if (!preferredChunk) {
    throw new Error('PNG metadata does not contain any character data.');
  }

  return decodeUtf8Base64(preferredChunk.text);
}

export function embedCharacterCardInPng(pngBytes: Uint8Array, jsonText: string): Uint8Array {
  const chunks = extractPngChunks(pngBytes).filter((chunk) => {
    if (chunk.name !== 'tEXt') {
      return true;
    }

    const decodedChunk = decodePngTextChunk(chunk.data);
    return !CHARACTER_CHUNK_KEYWORDS.has(decodedChunk.keyword.toLowerCase());
  });

  const iendIndex = chunks.findIndex((chunk) => chunk.name === 'IEND');

  if (iendIndex === -1) {
    throw new Error('Invalid PNG: missing IEND chunk.');
  }

  chunks.splice(iendIndex, 0, encodePngTextChunk('chara', encodeUtf8Base64(jsonText)));

  return encodePngChunks(chunks);
}
