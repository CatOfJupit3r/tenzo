import { EventType } from '@tanstack/ai';
import type { ModelMessage, StreamChunk, UIMessage } from '@tanstack/ai';
import { z } from 'zod';

import { generateUuid } from '@~/utils/uuid';

import type { CharacterCard } from '../cards/card-schema';
import { generateValidatedObject } from '../generation/structured-output.server';
import { createCharacterModelOptions, createCharacterTextAdapter } from '../generation/tanstack-ai-text-generation';
import { ASSISTANT_FINAL_RESPONSE_SCHEMA } from './assistant-final-response';
import { CHARACTER_ASSISTANT_TOOL_NAMES, CHARACTER_CONCEPT_SCHEMA } from './character-assistant-contracts';
import type {
  CharacterAssistantFocus,
  iCharacterAssistantContextAttachment,
  iCharacterAssistantDiscoveryContext,
  iCharacterAssistantStreamRequest,
  iCharacterConcept,
  iChatTemplateRef,
} from './character-assistant-contracts';
import { buildAssistantSystemPrompt } from './character-assistant-runtime.server';
import {
  createCharacterAssistantActionHandlers,
  PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA,
  PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA,
  PROPOSE_CHARACTER_FIELDS_INPUT_SCHEMA,
  PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA,
  PROPOSE_TAGS_INPUT_SCHEMA,
  SUGGEST_DIRECTIONS_INPUT_SCHEMA,
} from './character-assistant-tools';
import type { iCharacterAssistantProposalStore } from './character-assistant-tools';

export const MAX_STRUCTURED_ROUNDS = 4;
const MAX_TOOL_CALLS_PER_RUN = 12;
const MAX_PARALLEL_TOOL_CALLS_PER_TURN = 4;

const STRUCTURED_ACTION_SCHEMA = z.discriminatedUnion('action', [
  z.object({ action: z.literal(CHARACTER_ASSISTANT_TOOL_NAMES.record_concept), input: CHARACTER_CONCEPT_SCHEMA }),
  z.object({
    action: z.literal(CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields),
    input: PROPOSE_CHARACTER_FIELDS_INPUT_SCHEMA,
  }),
  z.object({ action: z.literal(CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags), input: PROPOSE_TAGS_INPUT_SCHEMA }),
  z.object({
    action: z.literal(CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings),
    input: PROPOSE_ALTERNATE_GREETINGS_INPUT_SCHEMA,
  }),
  z.object({
    action: z.literal(CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields),
    input: PROPOSE_CUSTOM_FIELDS_INPUT_SCHEMA,
  }),
  z.object({
    action: z.literal(CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book),
    input: PROPOSE_CHARACTER_BOOK_INPUT_SCHEMA,
  }),
  z.object({
    action: z.literal(CHARACTER_ASSISTANT_TOOL_NAMES.suggest_character_directions),
    input: SUGGEST_DIRECTIONS_INPUT_SCHEMA,
  }),
]);

const STRUCTURED_ROUND_SCHEMA = z.object({
  assistantMessage: z.string(),
  actions: z.array(STRUCTURED_ACTION_SCHEMA).max(MAX_PARALLEL_TOOL_CALLS_PER_TURN),
  isDone: z.boolean(),
  followUpSuggestions: z.array(z.string().trim().min(1)).max(3).default([]),
});

interface iStructuredAssistantOptions {
  card: CharacterCard;
  focus: CharacterAssistantFocus;
  contextAttachments: iCharacterAssistantContextAttachment[];
  apiKey: string;
  generationSettings: Pick<
    iCharacterAssistantStreamRequest,
    | 'endpoint'
    | 'model'
    | 'maxTokens'
    | 'temperature'
    | 'topP'
    | 'frequencyPenalty'
    | 'presencePenalty'
    | 'topK'
    | 'minP'
  >;
  shouldSendDisabledSamplers?: boolean;
  generalCharacterIdea?: string;
  concept?: iCharacterConcept | null;
  discoveryContext?: iCharacterAssistantDiscoveryContext;
  templates?: iChatTemplateRef[];
  store: iCharacterAssistantProposalStore;
  messages: Array<ModelMessage | UIMessage>;
  abortSignal?: AbortSignal;
}

async function executeAction(
  handlers: ReturnType<typeof createCharacterAssistantActionHandlers>,
  action: z.infer<typeof STRUCTURED_ACTION_SCHEMA>,
  toolCallId: string,
) {
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.record_concept) return handlers.recordConcept(action.input);
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_fields)
    return handlers.proposeCharacterFields(action.input, toolCallId);
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.propose_tags)
    return handlers.proposeTags(action.input, toolCallId);
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.propose_alternate_greetings)
    return handlers.proposeAlternateGreetings(action.input, toolCallId);
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.propose_custom_fields)
    return handlers.proposeCustomFields(action.input, toolCallId);
  if (action.action === CHARACTER_ASSISTANT_TOOL_NAMES.propose_character_book)
    return handlers.proposeCharacterBook(action.input, toolCallId);
  return handlers.suggestDirections(action.input);
}

export async function* generateStructuredCharacterAssistantStream(
  options: iStructuredAssistantOptions,
): AsyncGenerator<StreamChunk> {
  const threadId = generateUuid();
  const runId = generateUuid();
  const messageId = generateUuid();
  const handlers = createCharacterAssistantActionHandlers({ focus: options.focus, store: options.store });
  const messages: Array<ModelMessage | UIMessage> = [...options.messages];
  const system = [
    buildAssistantSystemPrompt({
      card: options.card,
      focus: options.focus,
      contextAttachments: options.contextAttachments,
      generalCharacterIdea: options.generalCharacterIdea,
      concept: options.concept,
      discoveryContext: options.discoveryContext,
      templates: options.templates,
      mode: 'structured-output',
    }),
    'Work in bounded rounds. Return conversational prose plus zero or more typed actions. A prose-only round with isDone false is valid and must be followed by another round. Set isDone true only when the request is meaningfully addressed.',
  ].join('\n\n');
  let toolCallCount = 0;
  let finalMessage = '';
  let followUpSuggestions: string[] = [];

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
      schema: STRUCTURED_ROUND_SCHEMA,
      schemaDescription:
        'One conversational assistant round with typed character actions, completion state, and up to three follow-up suggestions.',
      system,
      messages,
      modelOptions: createCharacterModelOptions(options.generationSettings.endpoint, {
        ...options.generationSettings,
        shouldSendDisabledSamplers: options.shouldSendDisabledSamplers ?? false,
      }),
      abortSignal: options.abortSignal,
    });
    if (round.assistantMessage.trim()) {
      const delta = `${finalMessage ? '\n\n' : ''}${round.assistantMessage.trim()}`;
      finalMessage += delta;
      yield { type: EventType.TEXT_MESSAGE_CONTENT, messageId, delta };
    }
    followUpSuggestions = round.followUpSuggestions;
    if (toolCallCount + round.actions.length > MAX_TOOL_CALLS_PER_RUN)
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
      yield { type: EventType.TOOL_CALL_ARGS, toolCallId, delta: JSON.stringify(action.input) };
      try {
        const output = await executeAction(handlers, action, toolCallId);
        const result = JSON.stringify(output);
        yield {
          type: EventType.TOOL_CALL_END,
          toolCallId,
          toolCallName: action.action,
          toolName: action.action,
          input: action.input,
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
        yield {
          type: EventType.TOOL_CALL_END,
          toolCallId,
          toolCallName: action.action,
          toolName: action.action,
          input: action.input,
          result,
          state: 'output-error',
        };
        actionSummaries.push(`${action.action}: ${result}`);
      }
    }
    if (round.isDone) break;
    messages.push({ role: 'assistant', content: round.assistantMessage || 'I am continuing the character work.' });
    messages.push({
      role: 'user',
      content:
        actionSummaries.length > 0
          ? `Continue from these executed actions:\n${actionSummaries.join('\n')}`
          : 'Continue with the next useful round. You have not completed the request yet; make concrete progress or explain what is needed.',
    });
  }
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
  yield { type: EventType.RUN_FINISHED, threadId, runId, finishReason: 'stop' };
}
