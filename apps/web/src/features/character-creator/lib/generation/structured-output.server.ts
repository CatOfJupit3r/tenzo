import { chat, defineChatMiddleware } from '@tanstack/ai';
import type { AnyTextAdapter, ModelMessage, TokenUsage, UIMessage } from '@tanstack/ai';
import type { z } from 'zod';

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

function collectGenerationErrorDetails(error: unknown, details: string[], visited: Set<unknown>) {
  if (error === null || error === undefined || visited.has(error)) {
    return;
  }
  visited.add(error);

  if (typeof error === 'string') {
    details.push(error);
    return;
  }
  if (typeof error !== 'object') {
    return;
  }

  collectGenerationErrorDetails(Reflect.get(error, 'rawValue'), details, visited);
  collectGenerationErrorDetails(Reflect.get(error, 'error'), details, visited);
  for (const key of ['message', 'code', 'responseBody'] as const) {
    const value = Reflect.get(error, key);
    if (typeof value === 'string' && value.trim()) {
      details.push(value);
    }
  }
  collectGenerationErrorDetails(Reflect.get(error, 'cause'), details, visited);
  const nestedErrors = Reflect.get(error, 'errors');
  if (Array.isArray(nestedErrors)) {
    nestedErrors.forEach((nestedError) => collectGenerationErrorDetails(nestedError, details, visited));
  }
  collectGenerationErrorDetails(Reflect.get(error, 'rawEvent'), details, visited);
}

function describeGenerationError(error: unknown) {
  const details: string[] = [];
  collectGenerationErrorDetails(error, details, new Set());
  const compactMessage = [...new Set(details)].join(' ').replace(/\s+/g, ' ').trim() || 'Unknown provider error.';
  return compactMessage.length > 300 ? `${compactMessage.slice(0, 297)}...` : compactMessage;
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
