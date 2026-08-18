import { z } from 'zod';

import { loggerFactory } from '@~/lib/logging/logger';
import type { iLogger } from '@~/lib/logging/logging-contracts';

import { CHARACTER_EDIT_FIELD_KEYS } from '../proposals/character-edit-proposal';
import { CHARACTER_ASSISTANT_TOOL_NAMES } from './character-assistant-contracts';
import type { CharacterAssistantToolName } from './character-assistant-contracts';

export const CHARACTER_ASSISTANT_TOOL_OUTCOME_SCHEMA = z.enum(['completed', 'no-op', 'failed']);
export const CHARACTER_ASSISTANT_TOOL_OUTCOMES = CHARACTER_ASSISTANT_TOOL_OUTCOME_SCHEMA.enum;
export type CharacterAssistantToolOutcome = z.infer<typeof CHARACTER_ASSISTANT_TOOL_OUTCOME_SCHEMA>;
const CHARACTER_ASSISTANT_TOOL_LOGGER = loggerFactory.getLogger('character-assistant.tool');

interface iCharacterAssistantToolLog {
  model?: string;
  mode: 'structured-output' | 'tool-call';
  outcome: CharacterAssistantToolOutcome;
  runId?: string;
  toolCallId: string;
  toolName: string;
  durationMs?: number;
  input?: unknown;
  error?: unknown;
}

const DEDICATED_TOOL_FIELD_KEYS = {
  [CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags]: CHARACTER_EDIT_FIELD_KEYS.tags,
  [CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings]: CHARACTER_EDIT_FIELD_KEYS.alternate_greetings,
  [CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields]: CHARACTER_EDIT_FIELD_KEYS.custom_fields,
  [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book]: CHARACTER_EDIT_FIELD_KEYS.character_book,
} satisfies Partial<Record<CharacterAssistantToolName, string>>;

const TOOL_INPUT_SCHEMA = z
  .object({
    changes: z.array(z.object({ fieldKey: z.string() }).passthrough()).optional(),
    tags: z.array(z.unknown()).optional(),
    greetings: z.array(z.unknown()).optional(),
    fields: z.array(z.unknown()).optional(),
    characterBook: z
      .object({
        entries: z.array(z.unknown()).optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();
type iCharacterAssistantToolInput = z.infer<typeof TOOL_INPUT_SCHEMA>;

const TOOL_ERROR_METADATA_SCHEMA = z
  .object({
    position: z.number().finite().optional(),
    inputLength: z.number().finite().optional(),
  })
  .passthrough();

function readRequestedFieldKeys(toolName: string, input: iCharacterAssistantToolInput | null) {
  const dedicatedFieldKey = Object.entries(DEDICATED_TOOL_FIELD_KEYS).find(([key]) => key === toolName)?.[1];
  if (dedicatedFieldKey) return [dedicatedFieldKey];
  if (toolName !== CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields) return [];
  return input?.changes?.map((change) => change.fieldKey) ?? [];
}

function readItemCount(input: iCharacterAssistantToolInput | null) {
  for (const values of [input?.changes, input?.tags, input?.greetings, input?.fields]) {
    if (values) return values.length;
  }
  return input?.characterBook?.entries?.length;
}

function classifyToolError(error: unknown) {
  if (!(error instanceof Error)) return 'unknown';
  if (error.name === 'JsonRepairError' || error instanceof SyntaxError) return 'json-parse';
  if (error.name === 'ZodError') return 'input-validation';
  if (error.message.includes('strict template')) return 'strict-template';
  if (error.message.includes('focused on') || error.message.includes('does not allow')) return 'focus-restriction';
  if (error.message.includes('editable changes')) return 'no-editable-changes';
  return 'execution';
}

export function logCharacterAssistantTool(
  { model, mode, outcome, runId, toolCallId, toolName, durationMs, input, error }: iCharacterAssistantToolLog,
  logger: iLogger = CHARACTER_ASSISTANT_TOOL_LOGGER,
) {
  const parsedInput = TOOL_INPUT_SCHEMA.safeParse(input);
  const inputRecord = parsedInput.success ? parsedInput.data : null;
  const parsedError = TOOL_ERROR_METADATA_SCHEMA.safeParse(error);
  const errorPosition = parsedError.success ? parsedError.data.position : undefined;
  const inputLength = parsedError.success ? parsedError.data.inputLength : undefined;
  const details = {
    event: 'character-assistant-tool',
    mode,
    model,
    outcome,
    runId,
    toolCallId,
    toolName,
    durationMs,
    inputKeys: inputRecord ? Object.keys(inputRecord).sort() : [],
    requestedFieldKeys: readRequestedFieldKeys(toolName, inputRecord),
    itemCount: readItemCount(inputRecord),
    ...(error === undefined
      ? {}
      : {
          errorCategory: classifyToolError(error),
          ...(typeof errorPosition === 'number' ? { errorPosition } : {}),
          ...(typeof inputLength === 'number' ? { inputLength } : {}),
        }),
  };

  if (outcome === CHARACTER_ASSISTANT_TOOL_OUTCOMES.failed) {
    logger.error('Tool execution', error, details);
  } else {
    logger.info('Tool execution', details);
  }
}
