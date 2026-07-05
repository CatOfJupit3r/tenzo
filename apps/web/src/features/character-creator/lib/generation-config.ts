import { z } from 'zod';

export const OUTPUT_FORMAT_SCHEMA = z.enum(['xml', 'json', 'none']);
export const OUTPUT_FORMATS = OUTPUT_FORMAT_SCHEMA.enum;
export type OutputFormat = z.infer<typeof OUTPUT_FORMAT_SCHEMA>;

export const REQUEST_MODE_SCHEMA = z.enum(['proxy', 'browser']);
export const REQUEST_MODES = REQUEST_MODE_SCHEMA.enum;
export type RequestMode = z.infer<typeof REQUEST_MODE_SCHEMA>;

export const DEFAULT_CONTEXT_SIZE = 8_192;

export interface iCharacterGenerationSettings {
  endpoint: string;
  model: string;
  apiKeyCiphertext: string;
  contextSize: number;
  maxTokens: number;
  outputFormat: OutputFormat;
  requestMode: RequestMode;
  generalCharacterIdea: string;
  fieldInstructions: Record<string, string>;
  fieldShouldUseGeneralCharacterIdea: Record<string, boolean>;
}

export const DEFAULT_CHARACTER_GENERATION_SETTINGS: iCharacterGenerationSettings = {
  endpoint: 'https://api.openai.com',
  model: 'gpt-4.1-mini',
  apiKeyCiphertext: '',
  contextSize: DEFAULT_CONTEXT_SIZE,
  maxTokens: 600,
  outputFormat: OUTPUT_FORMATS.xml,
  requestMode: REQUEST_MODES.proxy,
  generalCharacterIdea: '',
  fieldInstructions: {},
  fieldShouldUseGeneralCharacterIdea: {},
};

function readString(value: unknown, fallbackValue: string) {
  return typeof value === 'string' ? value : fallbackValue;
}

function readPositiveInteger(value: unknown, fallbackValue: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallbackValue;
}

function readFieldInstructions(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_CHARACTER_GENERATION_SETTINGS.fieldInstructions;
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string',
    ),
  );
}

function readFieldShouldUseGeneralCharacterIdea(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_CHARACTER_GENERATION_SETTINGS.fieldShouldUseGeneralCharacterIdea;
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[0] === 'string' && typeof entry[1] === 'boolean',
    ),
  );
}

export function sanitizeCharacterGenerationSettings(value: unknown): iCharacterGenerationSettings {
  const candidate = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    endpoint: readString(candidate.endpoint, DEFAULT_CHARACTER_GENERATION_SETTINGS.endpoint),
    model: readString(candidate.model, DEFAULT_CHARACTER_GENERATION_SETTINGS.model),
    apiKeyCiphertext: readString(candidate.apiKeyCiphertext, DEFAULT_CHARACTER_GENERATION_SETTINGS.apiKeyCiphertext),
    contextSize: readPositiveInteger(candidate.contextSize, DEFAULT_CHARACTER_GENERATION_SETTINGS.contextSize),
    maxTokens: readPositiveInteger(candidate.maxTokens, DEFAULT_CHARACTER_GENERATION_SETTINGS.maxTokens),
    outputFormat: OUTPUT_FORMAT_SCHEMA.safeParse(candidate.outputFormat).success
      ? (candidate.outputFormat as OutputFormat)
      : DEFAULT_CHARACTER_GENERATION_SETTINGS.outputFormat,
    requestMode: REQUEST_MODE_SCHEMA.safeParse(candidate.requestMode).success
      ? (candidate.requestMode as RequestMode)
      : DEFAULT_CHARACTER_GENERATION_SETTINGS.requestMode,
    generalCharacterIdea: readString(
      candidate.generalCharacterIdea,
      DEFAULT_CHARACTER_GENERATION_SETTINGS.generalCharacterIdea,
    ),
    fieldInstructions: readFieldInstructions(candidate.fieldInstructions),
    fieldShouldUseGeneralCharacterIdea: readFieldShouldUseGeneralCharacterIdea(
      candidate.fieldShouldUseGeneralCharacterIdea,
    ),
  };
}

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
