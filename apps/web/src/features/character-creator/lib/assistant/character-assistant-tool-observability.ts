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

function readInputRecord(input: unknown) {
  return input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
}

function readRequestedFieldKeys(toolName: string, input: unknown) {
  const dedicatedFieldKey = DEDICATED_TOOL_FIELD_KEYS[toolName as keyof typeof DEDICATED_TOOL_FIELD_KEYS];
  if (dedicatedFieldKey) return [dedicatedFieldKey];
  if (toolName !== CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields) return [];
  const record = readInputRecord(input);
  if (!Array.isArray(record?.changes)) return [];
  return record.changes.flatMap((change) => {
    const changeRecord = readInputRecord(change);
    return typeof changeRecord?.fieldKey === 'string' ? [changeRecord.fieldKey] : [];
  });
}

function readItemCount(input: unknown) {
  const record = readInputRecord(input);
  if (!record) return undefined;
  for (const key of ['changes', 'tags', 'greetings', 'fields'] as const) {
    if (Array.isArray(record[key])) return record[key].length;
  }
  if (record.characterBook && typeof record.characterBook === 'object') {
    const entries = Reflect.get(record.characterBook, 'entries');
    if (Array.isArray(entries)) return entries.length;
  }
  return undefined;
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
  const inputRecord = readInputRecord(input);
  const errorPosition = error && typeof error === 'object' ? Reflect.get(error, 'position') : undefined;
  const inputLength = error && typeof error === 'object' ? Reflect.get(error, 'inputLength') : undefined;
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
    requestedFieldKeys: readRequestedFieldKeys(toolName, input),
    itemCount: readItemCount(input),
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
