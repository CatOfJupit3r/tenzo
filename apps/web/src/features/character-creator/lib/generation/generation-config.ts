import { em } from 'enumwaii';
import { z } from 'zod';

import type { FieldWritingStrategy } from '../orchestration/field-writing-strategy';
import { FIELD_WRITING_STRATEGIES, FIELD_WRITING_STRATEGY_SCHEMA } from '../orchestration/field-writing-strategy';
import type { CharacterEditFieldKey } from '../proposals/character-edit-proposal';
import { CHARACTER_EDIT_FIELD_KEYS, CHARACTER_EDIT_FIELD_KEY_SCHEMA } from '../proposals/character-edit-proposal';
import type { AgentGenerationBudget } from '../provider/agent-generation-budget';
import { AGENT_GENERATION_BUDGETS, AGENT_GENERATION_BUDGET_SCHEMA } from '../provider/agent-generation-budget';

export const OUTPUT_FORMAT_ENUM = em({
  XML: 'xml',
  JSON: 'json',
  NONE: 'none',
});
export const OUTPUT_FORMATS = OUTPUT_FORMAT_ENUM.enum;
export const OUTPUT_FORMAT_SCHEMA = z.enum(OUTPUT_FORMATS);

export type OutputFormat = z.infer<typeof OUTPUT_FORMAT_SCHEMA>;

export const REQUEST_MODE_ENUM = em({
  PROXY: 'proxy',
  BROWSER: 'browser',
});
export const REQUEST_MODES = REQUEST_MODE_ENUM.enum;
export const REQUEST_MODE_SCHEMA = z.enum(REQUEST_MODES);

export type RequestMode = z.infer<typeof REQUEST_MODE_SCHEMA>;

export const GENERATION_PROVIDER_ENUM = em({
  KOBOLDCPP: 'koboldcpp',
  OPENROUTER: 'openrouter',
});
export const GENERATION_PROVIDERS = GENERATION_PROVIDER_ENUM.enum;
export const GENERATION_PROVIDER_SCHEMA = z.enum(GENERATION_PROVIDERS);

export type GenerationProvider = z.infer<typeof GENERATION_PROVIDER_SCHEMA>;

export const CHARACTER_ASSISTANT_FIELD_EDITING_SCHEMA = z.record(CHARACTER_EDIT_FIELD_KEY_SCHEMA, z.boolean());
export type CharacterAssistantFieldEditing = z.infer<typeof CHARACTER_ASSISTANT_FIELD_EDITING_SCHEMA>;

export const DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING = {
  [CHARACTER_EDIT_FIELD_KEYS.NAME]: true,
  [CHARACTER_EDIT_FIELD_KEYS.DESCRIPTION]: true,
  [CHARACTER_EDIT_FIELD_KEYS.PERSONALITY]: true,
  [CHARACTER_EDIT_FIELD_KEYS.SCENARIO]: true,
  [CHARACTER_EDIT_FIELD_KEYS.FIRST_MES]: true,
  [CHARACTER_EDIT_FIELD_KEYS.MES_EXAMPLE]: true,
  [CHARACTER_EDIT_FIELD_KEYS.CREATOR_NOTES]: false,
  [CHARACTER_EDIT_FIELD_KEYS.SYSTEM_PROMPT]: false,
  [CHARACTER_EDIT_FIELD_KEYS.POST_HISTORY_INSTRUCTIONS]: false,
  [CHARACTER_EDIT_FIELD_KEYS.CREATOR]: false,
  [CHARACTER_EDIT_FIELD_KEYS.CHARACTER_VERSION]: false,
  [CHARACTER_EDIT_FIELD_KEYS.TAGS]: false,
  [CHARACTER_EDIT_FIELD_KEYS.ALTERNATE_GREETINGS]: true,
  [CHARACTER_EDIT_FIELD_KEYS.CUSTOM_FIELDS]: false,
  [CHARACTER_EDIT_FIELD_KEYS.CHARACTER_BOOK]: false,
} satisfies Record<CharacterEditFieldKey, boolean>;

export const GENERATION_PROVIDER_DEFAULTS = GENERATION_PROVIDER_ENUM.derive<{ endpoint: string; model: string }>()(
  [
    GENERATION_PROVIDERS.KOBOLDCPP,
    {
      endpoint: 'http://localhost:5001',
      model: 'local-model',
    },
  ],
  [
    GENERATION_PROVIDERS.OPENROUTER,
    {
      endpoint: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4.1-mini',
    },
  ],
);

export const DEFAULT_CONTEXT_SIZE = 32_768;
export const DEFAULT_MAX_TOKENS = 2_048;
export const RECOMMENDED_MINIMUM_CONTEXT_SIZE = 32_768;
export const RECOMMENDED_MINIMUM_MAX_TOKENS = 1_024;

export const TEMPERATURE_RANGE = { min: 0, max: 2 } as const;
export const TOP_P_RANGE = { min: 0, max: 1 } as const;
export const FREQUENCY_PENALTY_RANGE = { min: -2, max: 2 } as const;
export const PRESENCE_PENALTY_RANGE = { min: -2, max: 2 } as const;
export const TOP_K_RANGE = { min: 0, max: 200 } as const;
export const MIN_P_RANGE = { min: 0, max: 1 } as const;

export interface iCharacterGenerationConnectionSettings {
  globalCharacterInstruction: string;
  provider: GenerationProvider;
  endpoint: string;
  model: string;
  openRouterProvider: string;
  visionModel: string;
  apiKeyCiphertext: string;
  contextSize: number;
  maxTokens: number;
  outputFormat: OutputFormat;
  requestMode: RequestMode;
  agentGenerationBudget: AgentGenerationBudget;
  fieldWritingStrategy: FieldWritingStrategy;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  topK: number;
  minP: number;
  fieldShouldAllowAssistantEditing: CharacterAssistantFieldEditing;
}

export const CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA = z.object({
  generalCharacterIdea: z.string(),
  fieldInstructions: z.record(z.string(), z.string()),
  fieldShouldUseGeneralCharacterIdea: z.record(z.string(), z.boolean()),
  fieldTemplateIds: z.record(z.string(), z.string()).default({}),
  shouldUseDefaultFieldTemplates: z.boolean().default(true),
});

export type iCharacterGenerationPromptSettings = z.infer<typeof CHARACTER_GENERATION_PROMPT_SETTINGS_SCHEMA>;

export interface iCharacterGenerationSettings
  extends iCharacterGenerationConnectionSettings, iCharacterGenerationPromptSettings {}

export const DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS: iCharacterGenerationConnectionSettings = {
  globalCharacterInstruction: '',
  provider: GENERATION_PROVIDERS.KOBOLDCPP,
  ...GENERATION_PROVIDER_DEFAULTS.get(GENERATION_PROVIDERS.KOBOLDCPP),
  visionModel: '',
  openRouterProvider: '',
  apiKeyCiphertext: '',
  contextSize: DEFAULT_CONTEXT_SIZE,
  maxTokens: DEFAULT_MAX_TOKENS,
  outputFormat: OUTPUT_FORMATS.XML,
  requestMode: REQUEST_MODES.PROXY,
  agentGenerationBudget: AGENT_GENERATION_BUDGETS.BALANCED,
  fieldWritingStrategy: FIELD_WRITING_STRATEGIES.SEPARATE_FIELDS,
  temperature: 1,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  topK: 0,
  minP: 0,
  fieldShouldAllowAssistantEditing: DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
};

export const DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS: iCharacterGenerationPromptSettings = {
  generalCharacterIdea: '',
  fieldInstructions: {},
  fieldShouldUseGeneralCharacterIdea: {},
  fieldTemplateIds: {},
  shouldUseDefaultFieldTemplates: true,
};

export const DEFAULT_CHARACTER_GENERATION_SETTINGS: iCharacterGenerationSettings = {
  ...DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS,
  ...DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS,
};

const STORED_STRING_RECORD_SCHEMA = z
  .record(z.string(), z.string().optional().catch(undefined))
  .transform((entries) =>
    Object.fromEntries(Object.entries(entries).filter((entry): entry is [string, string] => entry[1] !== undefined)),
  )
  .catch({});

const STORED_BOOLEAN_RECORD_SCHEMA = z
  .record(z.string(), z.boolean().optional().catch(undefined))
  .transform((entries) =>
    Object.fromEntries(Object.entries(entries).filter((entry): entry is [string, boolean] => entry[1] !== undefined)),
  )
  .catch({});

const STORED_ASSISTANT_FIELD_EDITING_SCHEMA = z
  .partialRecord(CHARACTER_EDIT_FIELD_KEY_SCHEMA, z.boolean().optional().catch(undefined))
  .transform((entries) =>
    Object.fromEntries(Object.entries(entries).filter((entry): entry is [string, boolean] => entry[1] !== undefined)),
  )
  .catch({});

const createClampedNumberSchema = (range: { min: number; max: number }, shouldRound = false) =>
  z
    .number()
    .finite()
    .transform((value) => (shouldRound ? Math.round(value) : value))
    .transform((value) => Math.min(range.max, Math.max(range.min, value)))
    .optional();

const STORED_CHARACTER_GENERATION_CONNECTION_SETTINGS_SCHEMA = z
  .object({
    globalCharacterInstruction: z.string().optional().catch(undefined),
    provider: GENERATION_PROVIDER_SCHEMA.optional().catch(undefined),
    endpoint: z.string().optional().catch(undefined),
    model: z.string().optional().catch(undefined),
    openRouterProvider: z.string().optional().catch(undefined),
    visionModel: z.string().optional().catch(undefined),
    apiKeyCiphertext: z.string().optional().catch(undefined),
    contextSize: z.number().finite().positive().transform(Math.floor).optional().catch(undefined),
    maxTokens: z.number().finite().positive().transform(Math.floor).optional().catch(undefined),
    outputFormat: OUTPUT_FORMAT_SCHEMA.optional().catch(undefined),
    requestMode: REQUEST_MODE_SCHEMA.optional().catch(undefined),
    agentGenerationBudget: AGENT_GENERATION_BUDGET_SCHEMA.optional().catch(undefined),
    fieldWritingStrategy: FIELD_WRITING_STRATEGY_SCHEMA.optional().catch(undefined),
    temperature: createClampedNumberSchema(TEMPERATURE_RANGE),
    topP: createClampedNumberSchema(TOP_P_RANGE),
    frequencyPenalty: createClampedNumberSchema(FREQUENCY_PENALTY_RANGE),
    presencePenalty: createClampedNumberSchema(PRESENCE_PENALTY_RANGE),
    topK: createClampedNumberSchema(TOP_K_RANGE, true),
    minP: createClampedNumberSchema(MIN_P_RANGE),
    fieldShouldAllowAssistantEditing: STORED_ASSISTANT_FIELD_EDITING_SCHEMA.optional().catch(undefined),
  })
  .catch({});

export const CHARACTER_GENERATION_PROMPT_SETTINGS_STORAGE_SCHEMA = z
  .object({
    generalCharacterIdea: z.string().optional().catch(undefined),
    fieldInstructions: STORED_STRING_RECORD_SCHEMA.optional().catch(undefined),
    fieldShouldUseGeneralCharacterIdea: STORED_BOOLEAN_RECORD_SCHEMA.optional().catch(undefined),
    fieldTemplateIds: STORED_STRING_RECORD_SCHEMA.optional().catch(undefined),
    shouldUseDefaultFieldTemplates: z.boolean().optional().catch(undefined),
  })
  .catch({})
  .transform((candidate) => ({
    generalCharacterIdea:
      candidate.generalCharacterIdea ?? DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS.generalCharacterIdea,
    fieldInstructions: candidate.fieldInstructions ?? {},
    fieldShouldUseGeneralCharacterIdea: candidate.fieldShouldUseGeneralCharacterIdea ?? {},
    fieldTemplateIds: candidate.fieldTemplateIds ?? {},
    shouldUseDefaultFieldTemplates:
      candidate.shouldUseDefaultFieldTemplates ??
      DEFAULT_CHARACTER_GENERATION_PROMPT_SETTINGS.shouldUseDefaultFieldTemplates,
  }));

export function sanitizeCharacterGenerationConnectionSettings(value: unknown): iCharacterGenerationConnectionSettings {
  const candidate = STORED_CHARACTER_GENERATION_CONNECTION_SETTINGS_SCHEMA.parse(value);

  return {
    globalCharacterInstruction:
      candidate.globalCharacterInstruction ??
      DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.globalCharacterInstruction,
    provider: candidate.provider ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.provider,
    endpoint: candidate.endpoint ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.endpoint,
    model: candidate.model ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.model,
    openRouterProvider:
      candidate.openRouterProvider ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.openRouterProvider,
    visionModel: candidate.visionModel ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.visionModel,
    apiKeyCiphertext: candidate.apiKeyCiphertext ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.apiKeyCiphertext,
    contextSize: candidate.contextSize ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.contextSize,
    maxTokens: candidate.maxTokens ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.maxTokens,
    outputFormat: candidate.outputFormat ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.outputFormat,
    requestMode: candidate.requestMode ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.requestMode,
    agentGenerationBudget:
      candidate.agentGenerationBudget ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.agentGenerationBudget,
    fieldWritingStrategy:
      candidate.fieldWritingStrategy ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.fieldWritingStrategy,
    temperature: candidate.temperature ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.temperature,
    topP: candidate.topP ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.topP,
    frequencyPenalty: candidate.frequencyPenalty ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.frequencyPenalty,
    presencePenalty: candidate.presencePenalty ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.presencePenalty,
    topK: candidate.topK ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.topK,
    minP: candidate.minP ?? DEFAULT_CHARACTER_GENERATION_CONNECTION_SETTINGS.minP,
    fieldShouldAllowAssistantEditing: {
      ...DEFAULT_CHARACTER_ASSISTANT_FIELD_EDITING,
      ...candidate.fieldShouldAllowAssistantEditing,
    },
  };
}

export function sanitizeCharacterGenerationPromptSettings(value: unknown): iCharacterGenerationPromptSettings {
  return CHARACTER_GENERATION_PROMPT_SETTINGS_STORAGE_SCHEMA.parse(value);
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
