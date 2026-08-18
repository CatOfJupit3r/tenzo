import { chat, defineChatMiddleware } from '@tanstack/ai';
import type { AnyTextAdapter, ChatMiddleware, ModelMessage, TokenUsage, UIMessage } from '@tanstack/ai';
import type { z } from 'zod';

import { describeGenerationError } from './generation-error';

export interface iGenerateValidatedObjectOptions<T> {
  adapter: AnyTextAdapter;
  schema: z.ZodType<T>;
  schemaDescription: string;
  system: string;
  prompt?: string;
  messages?: Array<ModelMessage | UIMessage>;
  modelOptions?: Record<string, unknown>;
  abortSignal?: AbortSignal;
  onUsage?: (usage: TokenUsage) => void;
}

export type iGenerateValidatedObject = <T>(options: iGenerateValidatedObjectOptions<T>) => Promise<T>;

export interface iStructuredOutputChatOptions {
  adapter: AnyTextAdapter;
  messages: Array<ModelMessage | UIMessage>;
  systemPrompts: string[];
  outputSchema: z.ZodType;
  modelOptions?: Record<string, unknown>;
  abortController: AbortController;
  middleware?: ChatMiddleware[];
  stream: false;
}

export type iStructuredOutputChat = (options: iStructuredOutputChatOptions) => Promise<unknown>;

function buildMessages(prompt?: string, messages?: Array<ModelMessage | UIMessage>): Array<ModelMessage | UIMessage> {
  if (messages) {
    return messages;
  }

  if (prompt) {
    return [{ role: 'user', content: prompt }];
  }

  throw new Error('Structured generation requires a prompt or messages.');
}

function createNonStreamingStructuredOutputAdapter(adapter: AnyTextAdapter): AnyTextAdapter {
  return {
    ...adapter,
    chatStream: (options) => adapter.chatStream(options),
    structuredOutput: async (options) => adapter.structuredOutput(options),
    structuredOutputStream: undefined,
    ...(adapter.supportsCombinedToolsAndSchema
      ? { supportsCombinedToolsAndSchema: adapter.supportsCombinedToolsAndSchema.bind(adapter) }
      : {}),
  };
}

export function createValidatedObjectGenerator(
  chatDependency: iStructuredOutputChat = async (options) => chat(options),
): iGenerateValidatedObject {
  return async function generateValidatedObject<T>({
    adapter,
    schema,
    schemaDescription,
    system,
    prompt,
    messages,
    modelOptions,
    abortSignal,
    onUsage,
  }: iGenerateValidatedObjectOptions<T>): Promise<T> {
    const abortController = new AbortController();
    if (abortSignal?.aborted) {
      abortController.abort(abortSignal.reason);
    } else {
      abortSignal?.addEventListener('abort', () => abortController.abort(abortSignal.reason), { once: true });
    }

    const inputMessages = buildMessages(prompt, messages);
    const middleware = onUsage
      ? [
          defineChatMiddleware({
            name: 'validated-object-usage',
            onUsage: (_context, usage) => onUsage(usage),
          }),
        ]
      : undefined;

    try {
      const output = await chatDependency({
        adapter: createNonStreamingStructuredOutputAdapter(adapter),
        messages: inputMessages,
        systemPrompts: [system],
        outputSchema: schema.describe(schemaDescription),
        modelOptions,
        abortController,
        middleware,
        stream: false,
      });
      return schema.parse(output);
    } catch (error) {
      if (abortController.signal.aborted) throw error;
      throw new Error(describeGenerationError(error), { cause: error });
    }
  };
}

export const generateValidatedObject = createValidatedObjectGenerator();
