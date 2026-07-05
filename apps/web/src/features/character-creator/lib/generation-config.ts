import { z } from 'zod';

export const OUTPUT_FORMAT_SCHEMA = z.enum(['xml', 'json', 'none']);
export const OUTPUT_FORMATS = OUTPUT_FORMAT_SCHEMA.enum;
export type OutputFormat = z.infer<typeof OUTPUT_FORMAT_SCHEMA>;

export const REQUEST_MODE_SCHEMA = z.enum(['proxy', 'browser']);
export const REQUEST_MODES = REQUEST_MODE_SCHEMA.enum;
export type RequestMode = z.infer<typeof REQUEST_MODE_SCHEMA>;

export interface iCharacterGenerationSettings {
  endpoint: string;
  model: string;
  apiKeyCiphertext: string;
  maxTokens: number;
  outputFormat: OutputFormat;
  requestMode: RequestMode;
  fieldInstructions: Record<string, string>;
}

export const DEFAULT_CHARACTER_GENERATION_SETTINGS: iCharacterGenerationSettings = {
  endpoint: 'https://api.openai.com',
  model: 'gpt-4.1-mini',
  apiKeyCiphertext: '',
  maxTokens: 600,
  outputFormat: OUTPUT_FORMATS.xml,
  requestMode: REQUEST_MODES.proxy,
  fieldInstructions: {},
};

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return globalThis.btoa(binary);
}

function decodeBase64(value: string) {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeStoredSecret(secret: string) {
  if (!secret) {
    return '';
  }

  return encodeBase64(secret);
}

export function decodeStoredSecret(ciphertext: string) {
  if (!ciphertext) {
    return '';
  }

  try {
    return decodeBase64(ciphertext);
  } catch {
    return '';
  }
}
