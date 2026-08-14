import { EventType } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai';

const UNSUPPORTED_TOOL_USE_PATTERN =
  /no endpoints found that support tool use|does not support (tool|function)|tool(?:_| )calls? (?:are|is) not supported|unsupported (?:tool|function)/i;

function collectErrorText(error: unknown, messages: string[], visited: Set<unknown>) {
  if (error === null || error === undefined || visited.has(error)) {
    return;
  }
  visited.add(error);

  if (typeof error === 'string') {
    messages.push(error);
    return;
  }
  if (typeof error !== 'object') {
    return;
  }

  for (const key of ['message', 'code', 'responseBody'] as const) {
    const value = Reflect.get(error, key);
    if (typeof value === 'string') {
      messages.push(value);
    }
  }
  collectErrorText(Reflect.get(error, 'cause'), messages, visited);
  const nestedErrors = Reflect.get(error, 'errors');
  if (Array.isArray(nestedErrors)) {
    nestedErrors.forEach((nestedError) => collectErrorText(nestedError, messages, visited));
  }
  collectErrorText(Reflect.get(error, 'rawEvent'), messages, visited);
}

export function isUnsupportedToolUseError(error: unknown) {
  const messages: string[] = [];
  collectErrorText(error, messages, new Set());
  return UNSUPPORTED_TOOL_USE_PATTERN.test(messages.join(' '));
}

export async function* fallbackFromUnsupportedToolUse(
  nativeStream: AsyncIterable<StreamChunk>,
  createStructuredStream: () => AsyncIterable<StreamChunk>,
): AsyncGenerator<StreamChunk> {
  const pendingRunEvents: StreamChunk[] = [];
  let hasEmittedContent = false;

  try {
    for await (const chunk of nativeStream) {
      if (chunk.type === EventType.RUN_ERROR && !hasEmittedContent && isUnsupportedToolUseError(chunk)) {
        yield* createStructuredStream();
        return;
      }

      if (!hasEmittedContent && chunk.type === EventType.RUN_STARTED) {
        pendingRunEvents.push(chunk);
        continue;
      }

      if (!hasEmittedContent) {
        hasEmittedContent = true;
        yield* pendingRunEvents;
      }
      yield chunk;
    }
  } catch (error) {
    if (!hasEmittedContent && isUnsupportedToolUseError(error)) {
      yield* createStructuredStream();
      return;
    }
    throw error;
  }
}
