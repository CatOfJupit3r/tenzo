import { EventType } from '@tanstack/ai';
import type { ModelMessage, StreamChunk, TokenUsage, UIMessage } from '@tanstack/ai';
import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import type { CharacterCard } from '../cards/card-schema';
import type { CharacterAssistantFieldEditing } from '../generation/generation-config';
import { parseRepairedJson } from '../generation/json-repair';
import { generateValidatedObject } from '../generation/structured-output.server';
import {
  createCharacterStructuredModelOptions,
  createCharacterTextAdapter,
} from '../generation/tanstack-ai-text-generation';
import type { iPromptExampleCharacter } from '../prompt/generation-contracts';
import { ASSISTANT_FINAL_RESPONSE_SCHEMA } from './assistant-final-response';
import { CHARACTER_ASSISTANT_TOOL_NAMES, CHARACTER_CONCEPT_SCHEMA } from './character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  CharacterAssistantToolName,
  iCharacterAssistantContextAttachment,
  iCharacterAssistantDiscoveryContext,
  iCharacterAssistantStreamRequest,
  iChatTemplateRef,
} from './character-assistant-contracts';
import { buildAssistantSystemPrompt } from './character-assistant-runtime.server';
import {
  aggregateTokenUsage,
  MAX_ASSISTANT_PARALLEL_TOOL_CALLS_PER_TURN,
  MAX_ASSISTANT_TOOL_CALLS_PER_RUN,
} from './character-assistant-safety';
import { CHARACTER_ASSISTANT_TOOL_OUTCOMES, logCharacterAssistantTool } from './character-assistant-tool-observability';
import {
  createCharacterAssistantActionHandlers,
  createProposeCharacterFieldsInputSchema,
  getAllowedCharacterAssistantToolNames,
  getAllowedCharacterAssistantTextFieldKeys,
  PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA,
  PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA,
  PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA,
  PROPOSE_TAGS_INPUT_SCHEMA,
  SUGGEST_DIRECTIONS_INPUT_SCHEMA,
} from './character-assistant-tools';
import type { iCharacterAssistantProposalStore } from './character-assistant-tools';

export const MAX_STRUCTURED_ROUNDS = 4;
const MAX_STRUCTURED_SCHEMA_ATTEMPTS = 2;
const MAX_STRUCTURED_HISTORY_MESSAGES = 12;
const MAX_STRUCTURED_HISTORY_MESSAGE_CHARACTERS = 4_000;

interface iStructuredAction {
  action: CharacterAssistantToolName;
  input?: unknown;
  inputJson?: string;
}

function createStructuredActionSchema(
  actionNames: [CharacterAssistantToolName, ...CharacterAssistantToolName[]],
  characterFieldsInputSchema: ReturnType<typeof createProposeCharacterFieldsInputSchema>,
) {
  const inputSchemas = {
    [CHARACTER_ASSISTANT_TOOL_NAMES.record_concept]: CHARACTER_CONCEPT_SCHEMA,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields]: characterFieldsInputSchema,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags]: PROPOSE_TAGS_INPUT_SCHEMA,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings]: PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields]: PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA,
    [CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book]: PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA,
    [CHARACTER_ASSISTANT_TOOL_NAMES.suggest_character_directions]: SUGGEST_DIRECTIONS_INPUT_SCHEMA,
  } satisfies Record<
    Exclude<CharacterAssistantToolName, typeof CHARACTER_ASSISTANT_TOOL_NAMES.read_character>,
    z.ZodType | null
  >;
  const actionSchemas = actionNames.flatMap((actionName) => {
    const inputSchema = inputSchemas[actionName as keyof typeof inputSchemas];
    return inputSchema ? [z.object({ action: z.literal(actionName), input: inputSchema })] : [];
  });
  const [firstActionSchema, secondActionSchema, ...remainingActionSchemas] = actionSchemas;
  if (!firstActionSchema || !secondActionSchema) {
    throw new Error('Structured assistant requires at least two available actions.');
  }
  return z.discriminatedUnion('action', [firstActionSchema, secondActionSchema, ...remainingActionSchemas]);
}

function isRetryableStructuredSchemaError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /structured-output-(?:validation-failed|parse-failed|missing-result)/i.test(error.message);
}

function createStructuredRoundSchema(
  actionNames: [CharacterAssistantToolName, ...CharacterAssistantToolName[]],
  characterFieldsInputSchema: ReturnType<typeof createProposeCharacterFieldsInputSchema>,
) {
  return z.object({
    assistantMessage: z.string().default(''),
    actions: z
      .array(createStructuredActionSchema(actionNames, characterFieldsInputSchema))
      .max(MAX_ASSISTANT_PARALLEL_TOOL_CALLS_PER_TURN)
      .default([]),
    isDone: z.boolean().default(false),
    followUpSuggestions: z.array(z.string().trim().min(1)).max(3).default([]),
  });
}

function buildStructuredActionCatalog(
  actionNames: ReadonlySet<CharacterAssistantToolName>,
  fieldShouldAllowAssistantEditing?: Readonly<CharacterAssistantFieldEditing>,
  focus?: CharacterAssistantFocus,
) {
  const enabledTextFieldKeys = getAllowedCharacterAssistantTextFieldKeys(fieldShouldAllowAssistantEditing, focus);
  return [
    'Action catalog for input:',
    actionNames.has(CHARACTER_ASSISTANT_TOOL_NAMES.suggest_character_directions)
      ? '- suggest_character_directions: {"premise":"optional inspiration"}. Use this when the user asks to discover or explore character directions.'
      : '',
    actionNames.has(CHARACTER_ASSISTANT_TOOL_NAMES.record_concept)
      ? '- record_concept: {"premise":"...","archetype":"...","keyTraits":[],"flaws":[],"nameCandidates":[],"suggestedTags":[]}.'
      : '',
    actionNames.has(CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields)
      ? `- propose_character_fields: {"changes":[{"fieldKey":"${enabledTextFieldKeys.join('|')}","value":"..."}],"summary":"..."}.`
      : '',
    actionNames.has(CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags)
      ? '- propose_tags: {"tags":["..."],"summary":"..."}.'
      : '',
    actionNames.has(CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings)
      ? '- propose_alternate_greetings: {"greetings":["..."],"summary":"..."}.'
      : '',
    actionNames.has(CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields)
      ? '- propose_custom_fields: {"fields":[{"label":"...","value":"..."}],"summary":"..."}.'
      : '',
    actionNames.has(CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book)
      ? '- propose_character_book: {"characterBook":null,"summary":"..."}.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseActionInputJson(action: iStructuredAction) {
  const parsed = action.input ?? parseRepairedJson(action.inputJson ?? '{}');
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return parsed;
  }
  if ('input' in parsed) {
    return parsed.input;
  }
  if ('action' in parsed && parsed.action === action.action) {
    const { action: _action, ...input } = parsed;
    return input;
  }
  return parsed;
}

function compactStructuredHistoryMessage(message: ModelMessage | UIMessage): ModelMessage | null {
  if (message.role === 'tool' || message.role === 'system') return null;
  let content = '';
  if ('parts' in message) {
    content = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.content)
      .join('\n');
  } else if (typeof message.content === 'string') {
    content = message.content;
  } else if (message.content) {
    content = message.content
      .filter((part) => part.type === 'text')
      .map((part) => part.content)
      .join('\n');
  }
  const compactContent = content.trim().slice(-MAX_STRUCTURED_HISTORY_MESSAGE_CHARACTERS);
  return compactContent ? { role: message.role, content: compactContent } : null;
}

function compactStructuredHistory(messages: Array<ModelMessage | UIMessage>) {
  return messages
    .flatMap((message) => {
      const compactMessage = compactStructuredHistoryMessage(message);
      return compactMessage ? [compactMessage] : [];
    })
    .slice(-MAX_STRUCTURED_HISTORY_MESSAGES);
}

interface iStructuredAssistantOptions {
  card: CharacterCard;
  focus: CharacterAssistantFocus;
  contextAttachments: iCharacterAssistantContextAttachment[];
  apiKey: string;
  generationSettings: Pick<
    iCharacterAssistantStreamRequest,
    | 'endpoint'
    | 'model'
    | 'openRouterProvider'
    | 'maxTokens'
    | 'temperature'
    | 'topP'
    | 'frequencyPenalty'
    | 'presencePenalty'
    | 'topK'
    | 'minP'
  >;
  shouldSendDisabledSamplers?: boolean;
  globalCharacterInstruction?: string;
  generalCharacterIdea?: string;
  discoveryContext?: iCharacterAssistantDiscoveryContext;
  templates?: iChatTemplateRef[];
  exampleCharacters?: iPromptExampleCharacter[];
  maxExampleContextCharacters?: number;
  fieldShouldAllowAssistantEditing?: Readonly<CharacterAssistantFieldEditing>;
  store: iCharacterAssistantProposalStore;
  messages: Array<ModelMessage | UIMessage>;
  abortSignal?: AbortSignal;
}

function createActionExecution(
  handlers: ReturnType<typeof createCharacterAssistantActionHandlers>,
  action: iStructuredAction,
  characterFieldsInputSchema: ReturnType<typeof createProposeCharacterFieldsInputSchema>,
) {
  const rawInput = parseActionInputJson(action);
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.record_concept) {
    const input = CHARACTER_CONCEPT_SCHEMA.parse(rawInput);
    return { input, execute: () => handlers.recordConcept(input) };
  }
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields) {
    if (!characterFieldsInputSchema) throw new Error('Editing standard character fields is disabled.');
    const input = characterFieldsInputSchema.parse(rawInput);
    return { input, execute: (toolCallId: string) => handlers.proposeCharacterFields(input, toolCallId) };
  }
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags) {
    const input = PROPOSE_TAGS_INPUT_SCHEMA.parse(rawInput);
    return { input, execute: (toolCallId: string) => handlers.proposeTags(input, toolCallId) };
  }
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings) {
    const input = PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA.parse(rawInput);
    return { input, execute: (toolCallId: string) => handlers.proposeAlternateGreetings(input, toolCallId) };
  }
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields) {
    const input = PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA.parse(rawInput);
    return { input, execute: (toolCallId: string) => handlers.proposeCustomFields(input, toolCallId) };
  }
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book) {
    const input = PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA.parse(rawInput);
    return { input, execute: (toolCallId: string) => handlers.proposeCharacterBook(input, toolCallId) };
  }
  const input = SUGGEST_DIRECTIONS_INPUT_SCHEMA.parse(rawInput);
  return { input, execute: async () => handlers.suggestDirections(input) };
}

export async function* generateStructuredCharacterAssistantStream(
  options: iStructuredAssistantOptions,
): AsyncGenerator<StreamChunk> {
  const threadId = generateUuid();
  const runId = generateUuid();
  const messageId = generateUuid();
  const handlers = createCharacterAssistantActionHandlers({
    focus: options.focus,
    store: options.store,
    templates: options.templates,
  });
  const actionNames = getAllowedCharacterAssistantToolNames(
    options.fieldShouldAllowAssistantEditing,
    options.focus,
  ).filter((toolName) => toolName !== CHARACTER_ASSISTANT_TOOL_NAMES.read_character) as [
    CharacterAssistantToolName,
    ...CharacterAssistantToolName[],
  ];
  const actionNameSet = new Set(actionNames);
  const characterFieldsInputSchema = createProposeCharacterFieldsInputSchema(
    options.fieldShouldAllowAssistantEditing,
    options.focus,
  );
  const structuredRoundSchema = createStructuredRoundSchema(actionNames, characterFieldsInputSchema);
  const messages: Array<ModelMessage | UIMessage> = compactStructuredHistory(options.messages);
  const system = [
    buildAssistantSystemPrompt({
      card: options.card,
      focus: options.focus,
      contextAttachments: options.contextAttachments,
      globalCharacterInstruction: options.globalCharacterInstruction,
      generalCharacterIdea: options.generalCharacterIdea,
      discoveryContext: options.discoveryContext,
      templates: options.templates,
      exampleCharacters: options.exampleCharacters,
      maxExampleContextCharacters: options.maxExampleContextCharacters,
      mode: 'structured-output',
    }),
    'Work in bounded rounds. Prefer completing the request in one round: group multiple field changes into one propose_character_fields action and include all independent actions together. Use another round only when an executed action result is required. Return conversational prose plus zero or more typed actions. When the user requests card creation or edits, at least one matching action is required; never put proposed values only in prose. Put action arguments directly in the typed input object. A prose-only round with isDone false is valid and must be followed by another round. Set isDone true only when the request is meaningfully addressed.',
    buildStructuredActionCatalog(actionNameSet, options.fieldShouldAllowAssistantEditing, options.focus),
  ].join('\n\n');
  let toolCallCount = 0;
  let finalMessage = '';
  let followUpSuggestions: string[] = [];
  const failedActionMessages = new Map<CharacterAssistantToolName, string>();
  let usage: TokenUsage | undefined;
  const trackUsage = (roundUsage: TokenUsage) => {
    usage = aggregateTokenUsage(usage, roundUsage);
  };

  yield { type: EventType.RUN_STARTED, threadId, runId };
  yield { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' };
  for (let roundIndex = 0; roundIndex < MAX_STRUCTURED_ROUNDS; roundIndex += 1) {
    if (options.abortSignal?.aborted) throw options.abortSignal.reason ?? new DOMException('Aborted', 'AbortError');
    let round: z.infer<typeof structuredRoundSchema> | undefined;
    for (let schemaAttempt = 1; schemaAttempt <= MAX_STRUCTURED_SCHEMA_ATTEMPTS; schemaAttempt += 1) {
      try {
        round = await generateValidatedObject({
          adapter: createCharacterTextAdapter({
            endpoint: options.generationSettings.endpoint,
            apiKey: options.apiKey,
            model: options.generationSettings.model,
          }),
          schema: structuredRoundSchema,
          schemaDescription:
            'One conversational assistant round with typed action inputs, completion state, and up to three follow-up suggestions.',
          system,
          messages:
            schemaAttempt === 1
              ? messages
              : [
                  ...messages,
                  {
                    role: 'user',
                    content:
                      'Return a valid structured round. Every action must use its typed input object and only fields permitted by the schema.',
                  },
                ],
          modelOptions: createCharacterStructuredModelOptions(options.generationSettings.endpoint, {
            ...options.generationSettings,
            shouldSendDisabledSamplers: options.shouldSendDisabledSamplers ?? false,
          }),
          abortSignal: options.abortSignal,
          onUsage: trackUsage,
        });
        break;
      } catch (error) {
        if (schemaAttempt === MAX_STRUCTURED_SCHEMA_ATTEMPTS || !isRetryableStructuredSchemaError(error)) throw error;
        console.warn('[Character Assistant] Retrying invalid structured round', {
          model: options.generationSettings.model,
          round: roundIndex + 1,
          nextAttempt: schemaAttempt + 1,
        });
      }
    }
    // The bounded loop either assigns a validated round or throws its final error.
    if (!round) throw new Error('Structured assistant round did not produce a result.');
    if (round.assistantMessage.trim()) finalMessage = round.assistantMessage.trim();
    followUpSuggestions = round.followUpSuggestions;
    if (toolCallCount + round.actions.length > MAX_ASSISTANT_TOOL_CALLS_PER_RUN)
      throw new Error('The assistant exceeded the maximum tool calls for one run.');
    const actionSummaries: string[] = [];
    for (const action of round.actions) {
      const toolCallId = generateUuid();
      const toolStartedAt = Date.now();
      let diagnosticInput: unknown;
      toolCallCount += 1;
      yield {
        type: EventType.TOOL_CALL_START,
        toolCallId,
        toolCallName: action.action,
        toolName: action.action,
        parentMessageId: messageId,
      };
      try {
        const execution = createActionExecution(handlers, action, characterFieldsInputSchema);
        diagnosticInput = execution.input;
        yield { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(execution.input) };
        const output = await execution.execute(toolCallId);
        failedActionMessages.delete(action.action);
        const isNoOp = output !== null && typeof output === 'object' && Reflect.get(output, 'isNoOp') === true;
        logCharacterAssistantTool({
          mode: 'structured-output',
          model: options.generationSettings.model,
          outcome: isNoOp ? CHARACTER_ASSISTANT_TOOL_OUTCOMES['no-op'] : CHARACTER_ASSISTANT_TOOL_OUTCOMES.completed,
          runId,
          toolCallId,
          toolName: action.action,
          durationMs: Date.now() - toolStartedAt,
          input: execution.input,
        });
        const result = JSON.stringify(output);
        yield {
          type: EventType.TOOL_CALL_END,
          toolCallId,
          toolCallName: action.action,
          toolName: action.action,
          input: execution.input,
          output,
          result,
          state: 'output-available',
        };
        yield {
          type: EventType.TOOL_CALL_RESULT,
          messageId: generateUuid(),
          toolCallId,
          content: result,
          role: 'tool',
          state: 'output-available',
        };
        actionSummaries.push(`${action.action}: ${isNoOp ? 'no changes needed' : 'completed'}`);
      } catch (error) {
        if (diagnosticInput === undefined) {
          try {
            diagnosticInput = parseActionInputJson(action);
          } catch {
            diagnosticInput = undefined;
          }
        }
        logCharacterAssistantTool({
          mode: 'structured-output',
          model: options.generationSettings.model,
          outcome: CHARACTER_ASSISTANT_TOOL_OUTCOMES.failed,
          runId,
          toolCallId,
          toolName: action.action,
          durationMs: Date.now() - toolStartedAt,
          input: diagnosticInput,
          error,
        });
        const result = error instanceof Error ? error.message : 'Action failed.';
        failedActionMessages.set(action.action, result);
        yield {
          type: EventType.TOOL_CALL_END,
          toolCallId,
          toolCallName: action.action,
          toolName: action.action,
          result,
          output: { error: result },
          state: 'output-error',
        };
        actionSummaries.push(`${action.action}: ${result}`);
      }
    }
    if (round.isDone && failedActionMessages.size === 0) break;
    messages.push({ role: 'assistant', content: round.assistantMessage || 'I am continuing the character work.' });
    let continuationInstruction =
      'Continue with the next useful round. You have not completed the request yet; make concrete progress or explain what is needed.';
    if (actionSummaries.length > 0) {
      continuationInstruction = `Continue from these executed actions:\n${actionSummaries.join('\n')}`;
    }
    messages.push({
      role: 'user',
      content: continuationInstruction,
    });
  }
  if (failedActionMessages.size > 0) {
    throw new Error(`The assistant did not produce a valid proposal: ${[...failedActionMessages.values()].join('; ')}`);
  }
  if (finalMessage) yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: finalMessage };
  yield { type: EventType.TEXT_MESSAGE_END, messageId };
  const finalResponse = ASSISTANT_FINAL_RESPONSE_SCHEMA.parse({
    assistantMessage: finalMessage || 'The character work is ready for review.',
    followUpSuggestions,
  });
  const raw = JSON.stringify(finalResponse);
  yield { type: EventType.CUSTOM, name: 'structured-output.start', value: { messageId } };
  yield { type: EventType.TEXT_MESSAGE_START, messageId, role: 'assistant' };
  yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta: raw };
  yield { type: EventType.TEXT_MESSAGE_END, messageId };
  yield { type: EventType.CUSTOM, name: 'structured-output.complete', value: { object: finalResponse, raw } };
  yield { type: EventType.RUN_FINISHED, threadId, runId, finishReason: 'stop', ...(usage ? { usage } : {}) };
}
