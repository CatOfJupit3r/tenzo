import { chat } from '@tanstack/ai';
import type { AnyTextAdapter, ModelMessage } from '@tanstack/ai';
import { z } from 'zod';

interface iGenerateValidatedObjectOptions<T> {
  adapter: AnyTextAdapter;
  schema: z.ZodType<T>;
  schemaDescription: string;
  system: string;
  prompt?: string;
  messages?: ModelMessage[];
  modelOptions?: Record<string, unknown>;
  abortSignal?: AbortSignal;
}

function buildMessages(prompt?: string, messages?: ModelMessage[]): ModelMessage[] {
  if (messages) {
    return messages;
  }

  if (prompt) {
    return [{ role: 'user', content: prompt }];
  }

  throw new Error('Structured generation requires a prompt or messages.');
}

function extractFirstJsonValue(content: string) {
  for (let start = 0; start < content.length; start += 1) {
    if (content[start] !== '{' && content[start] !== '[') {
      continue;
    }

    for (let end = content.length; end > start; end -= 1) {
      try {
        const candidate = content.slice(start, end);
        JSON.parse(candidate);
        return candidate;
      } catch {
        // Continue until the first complete JSON value is isolated.
      }
    }
  }

  throw new Error('The model response did not contain a complete JSON value.');
}

function describeGenerationError(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unknown provider error.';
  }

  const responseBody = Reflect.get(error, 'responseBody');
  const details = typeof responseBody === 'string' && responseBody.trim() ? responseBody : error.message;
  const compactMessage = details.replace(/\s+/g, ' ').trim();
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
}: iGenerateValidatedObjectOptions<T>): Promise<T> {
  const abortController = new AbortController();
  if (abortSignal?.aborted) {
    abortController.abort(abortSignal.reason);
  } else {
    abortSignal?.addEventListener('abort', () => abortController.abort(abortSignal.reason), { once: true });
  }

  const inputMessages = buildMessages(prompt, messages);

  try {
    const output = await chat({
      adapter,
      messages: inputMessages,
      systemPrompts: [system],
      outputSchema: schema.describe(schemaDescription),
      modelOptions,
      abortController,
    });

    return schema.parse(output);
  } catch (structuredOutputError) {
    try {
      const text = await chat({
        adapter,
        messages: inputMessages,
        systemPrompts: [
          `${system}\nReturn only one JSON value matching this JSON Schema: ${JSON.stringify(z.toJSONSchema(schema))}`,
        ],
        modelOptions,
        abortController,
        stream: false,
      });

      return schema.parse(JSON.parse(extractFirstJsonValue(text)) as unknown);
    } catch (fallbackError) {
      throw new AggregateError(
        [structuredOutputError, fallbackError],
        `The model did not return valid structured JSON. Structured response: ${describeGenerationError(structuredOutputError)} JSON fallback: ${describeGenerationError(fallbackError)}`,
      );
    }
  }
}
