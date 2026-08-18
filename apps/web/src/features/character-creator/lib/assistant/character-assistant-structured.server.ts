import { EventType } from '@tanstack/ai';
import type { ModelMessage, StreamChunk, TokenUsage, UIMessage } from '@tanstack/ai';
import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import type { CharacterCard } from '../cards/card-schema';
import { CHARACTER_TEXT_FIELD_KEYS } from '../cards/card-schema';
import type { CharacterAssistantFieldEditing } from '../generation/generation-config';
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
import {
  createCharacterAssistantActionHandlers,
  createProposeCharacterFieldsInputSchema,
  getAllowedCharacterAssistantToolNames,
  PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA,
  PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA,
  PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA,
  PROPOSE_TAGS_INPUT_SCHEMA,
  SUGGEST_DIRECTIONS_INPUT_SCHEMA,
} from './character-assistant-tools';
import type { iCharacterAssistantProposalStore } from './character-assistant-tools';

export const MAX_STRUCTURED_ROUNDS = 4;
const MAX_STRUCTURED_HISTORY_MESSAGES = 12;
const MAX_STRUCTURED_HISTORY_MESSAGE_CHARACTERS = 4_000;

interface iStructuredAction {
  action: CharacterAssistantToolName;
  inputJson: string;
}

function createStructuredRoundSchema(actionNames: [CharacterAssistantToolName, ...CharacterAssistantToolName[]]) {
  return z.object({
    assistantMessage: z.string(),
    actions: z
      .array(z.object({ action: z.enum(actionNames), inputJson: z.string() }))
      .max(MAX_ASSISTANT_PARALLEL_TOOL_CALLS_PER_TURN),
    isDone: z.boolean(),
    followUpSuggestions: z.array(z.string().trim().min(1)).max(3).default([]),
  });
}

function buildStructuredActionCatalog(
  actionNames: ReadonlySet<CharacterAssistantToolName>,
  fieldShouldAllowAssistantEditing?: Readonly<CharacterAssistantFieldEditing>,
) {
  const enabledTextFieldKeys = CHARACTER_TEXT_FIELD_KEYS.filter(
    (fieldKey) => fieldShouldAllowAssistantEditing?.[fieldKey] !== false,
  );
  return [
    'Action catalog for inputJson:',
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
  const parsed: unknown = JSON.parse(action.inputJson);
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
  const actionNames = getAllowedCharacterAssistantToolNames(options.fieldShouldAllowAssistantEditing).filter(
    (toolName) => toolName !== CHARACTER_ASSISTANT_TOOL_NAMES.read_character,
  ) as [CharacterAssistantToolName, ...CharacterAssistantToolName[]];
  const actionNameSet = new Set(actionNames);
  const structuredRoundSchema = createStructuredRoundSchema(actionNames);
  const characterFieldsInputSchema = createProposeCharacterFieldsInputSchema(options.fieldShouldAllowAssistantEditing);
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
    'Work in bounded rounds. Prefer completing the request in one round: group multiple field changes into one propose_character_fields action and include all independent actions together. Use another round only when an executed action result is required. Return conversational prose plus zero or more typed actions. When the user requests card creation or edits, at least one matching action is required; never put proposed values only in prose. Encode only the action arguments as one complete JSON object string in inputJson; do not repeat the action name or wrap the arguments. A prose-only round with isDone false is valid and must be followed by another round. Set isDone true only when the request is meaningfully addressed.',
    buildStructuredActionCatalog(actionNameSet, options.fieldShouldAllowAssistantEditing),
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
    const round = await generateValidatedObject({
      adapter: createCharacterTextAdapter({
        endpoint: options.generationSettings.endpoint,
        apiKey: options.apiKey,
        model: options.generationSettings.model,
      }),
      schema: structuredRoundSchema,
      schemaDescription:
        'One conversational assistant round with action names, JSON-encoded action inputs, completion state, and up to three follow-up suggestions.',
      system,
      messages,
      modelOptions: createCharacterStructuredModelOptions(options.generationSettings.endpoint, {
        ...options.generationSettings,
        shouldSendDisabledSamplers: options.shouldSendDisabledSamplers ?? false,
      }),
      abortSignal: options.abortSignal,
      onUsage: trackUsage,
    });
    if (round.assistantMessage.trim()) finalMessage = round.assistantMessage.trim();
    followUpSuggestions = round.followUpSuggestions;
    if (toolCallCount + round.actions.length > MAX_ASSISTANT_TOOL_CALLS_PER_RUN)
      throw new Error('The assistant exceeded the maximum tool calls for one run.');
    const actionSummaries: string[] = [];
    for (const action of round.actions) {
      const toolCallId = generateUuid();
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
        yield { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(execution.input) };
        const output = await execution.execute(toolCallId);
        failedActionMessages.delete(action.action);
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
        actionSummaries.push(`${action.action}: completed`);
      } catch (error) {
        const result = error instanceof Error ? error.message : 'Action failed.';
        failedActionMessages.set(action.action, result);
        yield {
          type: EventType.TOOL_CALL_END,
          toolCallId,
          toolCallName: action.action,
          toolName: action.action,
          result,
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
