import { z } from 'zod';

export const OUTPUT_FORMAT_SCHEMA = z.enum(['xml', 'json', 'none']);
export const OUTPUT_FORMATS = OUTPUT_FORMAT_SCHEMA.enum;
export type OutputFormat = z.infer<typeof OUTPUT_FORMAT_SCHEMA>;

export const REQUEST_MODE_SCHEMA = z.enum(['proxy', 'browser']);
export const REQUEST_MODES = REQUEST_MODE_SCHEMA.enum;
export type RequestMode = z.infer<typeof REQUEST_MODE_SCHEMA>;

export const DEFAULT_CONTEXT_SIZE = 8_192;

export const TEMPERATURE_RANGE = { min: 0, max: 2 } as const;
export const TOP_P_RANGE = { min: 0, max: 1 } as const;
export const FREQUENCY_PENALTY_RANGE = { min: -2, max: 2 } as const;
export const PRESENCE_PENALTY_RANGE = { min: -2, max: 2 } as const;

export interface iCharacterGenerationConnectionSettings {
  endpoint: string;
  model: string;
  apiKeyCiphertext: string;
  contextSize: number;
  maxTokens: number;
  outputFormat: OutputFormat;
  requestMode: RequestMode;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface iCharacterGenerationPromptSettings {
  generalCharacterIdea: string;
  fieldInstructions: Record<string, string>;
  fieldShouldUseGeneralCharacterIdea: Record<string, boolean>;
}

export interface iCharacterGenerationSettings
  extends iCharacterGenerationConnectionSettings, iCharacterGenerationPromptSettings {}

export const DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS: iCharacterGenerationConnectionSettings = {
  endpoint: 'https://api.openai.com',
  model: 'gpt-4.1-mini',
  apiKeyCiphertext: '',
  contextSize: DEFAULT_CONTEXT_SIZE,
  maxTokens: 600,
  outputFormat: OUTPUT_FORMATS.xml,
  requestMode: REQUEST_MODES.proxy,
  temperature: 1,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

export const DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS: iCharacterGenerationPromptSettings = {
  generalCharacterIdea: '',
  fieldInstructions: {},
  fieldShouldUseGeneralCharacterIdea: {},
};

export const DEFAULT_CHARACTER_GENERATION_SETTINGS: iCharacterGenerationSettings = {
  ...DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS,
  ...DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS,
};

function readString(value: unknown, fallbackValue: string) {
  return typeof value === 'string' ? value : fallbackValue;
}

function readPositiveInteger(value: unknown, fallbackValue: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallbackValue;
}

function readFloatInRange(value: unknown, range: { min: number; max: number }, fallbackValue: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallbackValue;
  }

  return Math.min(range.max, Math.max(range.min, value));
}

function readFieldInstructions(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS.fieldInstructions;
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string',
    ),
  );
}

function readFieldShouldUseGeneralCharacterIdea(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS.fieldShouldUseGeneralCharacterIdea;
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, boolean] => typeof entry[0] === 'string' && typeof entry[1] === 'boolean',
    ),
  );
}

export function sanitizeCharacterGenerationConnectionSettings(value: unknown): iCharacterGenerationConnectionSettings {
  const candidate = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    endpoint: readString(candidate.endpoint, DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.endpoint),
    model: readString(candidate.model, DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.model),
    apiKeyCiphertext: readString(
      candidate.apiKeyCiphertext,
      DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.apiKeyCiphertext,
    ),
    contextSize: readPositiveInteger(
      candidate.contextSize,
      DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.contextSize,
    ),
    maxTokens: readPositiveInteger(candidate.maxTokens, DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.maxTokens),
    outputFormat: OUTPUT_FORMAT_SCHEMA.safeParse(candidate.outputFormat).success
      ? (candidate.outputFormat as OutputFormat)
      : DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.outputFormat,
    requestMode: REQUEST_MODE_SCHEMA.safeParse(candidate.requestMode).success
      ? (candidate.requestMode as RequestMode)
      : DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.requestMode,
    temperature: readFloatInRange(
      candidate.temperature,
      TEMPERATURE_RANGE,
      DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.temperature,
    ),
    topP: readFloatInRange(candidate.topP, TOP_P_RANGE, DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.topP),
    frequencyPenalty: readFloatInRange(
      candidate.frequencyPenalty,
      FREQUENCY_PENALTY_RANGE,
      DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.frequencyPenalty,
    ),
    presencePenalty: readFloatInRange(
      candidate.presencePenalty,
      PRESENCE_PENALTY_RANGE,
      DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.presencePenalty,
    ),
  };
}

export function sanitizeCharacterGenerationPromptSettings(value: unknown): iCharacterGenerationPromptSettings {
  const candidate = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    generalCharacterIdea: readString(
      candidate.generalCharacterIdea,
      DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS.generalCharacterIdea,
    ),
    fieldInstructions: readFieldInstructions(candidate.fieldInstructions),
    fieldShouldUseGeneralCharacterIdea: readFieldShouldUseGeneralCharacterIdea(
      candidate.fieldShouldUseGeneralCharacterIdea,
    ),
  };
}

export function sanitizeCharacterGenerationSettings(value: unknown): iCharacterGenerationSettings {
  return {
    ...sanitizeCharacterGenerationConnectionSettings(value),
    ...sanitizeCharacterGenerationPromptSettings(value),
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
