import { chat, defineChatMiddleware } from '@tanstack/ai';
import type { AnyTextAdapter, ModelMessage, TokenUsage, UIMessage } from '@tanstack/ai';
import type { z } from 'zod';

import { describeGenerationError } from './generation-error';

interface iGenerateValidatedObjectOptions<T> {
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
  return new Proxy(adapter, {
    get(target, property) {
      if (property === 'structuredOutputStream') {
        return undefined;
      }
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== 'function') {
        return value;
      }
      const method = value as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => Reflect.apply(method, target, args);
    },
  });
}

export async function generateValidatedObject<T>({
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
    const output = await chat({
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
}
