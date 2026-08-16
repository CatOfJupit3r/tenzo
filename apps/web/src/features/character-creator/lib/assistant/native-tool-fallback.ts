import { EventType } from '@tanstack/ai';
import type { StreamChunk } from '@tanstack/ai';

import { describeGenerationError } from '../generation/generation-error';

const NATIVE_TOOL_CAPABILITY_ERROR =
  /tool[-_ ]call[-_ ]parser|enable[-_ ]auto[-_ ]tool[-_ ]choice|does not support feature:\s*function-calling|no endpoints?.*support.*tools?/i;
const unsupportedNativeToolRoutes = new Set<string>();

export function createNativeToolRouteKey(endpoint: string, model: string, provider?: string) {
  const normalizedProvider = provider?.trim().toLowerCase();
  const routePrefix = `${endpoint.trim().toLowerCase()}|${model.trim().toLowerCase()}`;
  if (!normalizedProvider) return `${routePrefix}|automatic`;
  return `${routePrefix}|${normalizedProvider}`;
}

export function isNativeToolRouteUnsupported(routeKey: string) {
  return unsupportedNativeToolRoutes.has(routeKey);
}

export function markNativeToolRouteUnsupported(routeKey: string) {
  unsupportedNativeToolRoutes.add(routeKey);
}

export function isNativeToolCapabilityError(chunk: StreamChunk) {
  return chunk.type === EventType.RUN_ERROR && NATIVE_TOOL_CAPABILITY_ERROR.test(describeGenerationError(chunk));
}

function isCommittedAssistantOutput(chunk: StreamChunk) {
  return (
    chunk.type === EventType.TEXT_MESSAGE_START ||
    chunk.type === EventType.TEXT_MESSAGE_CONTENT ||
    chunk.type === EventType.TOOL_CALL_START ||
    chunk.type === EventType.TOOL_CALL_ARGS ||
    chunk.type === EventType.TOOL_CALL_END
  );
}

export async function* fallbackFromUnsupportedNativeTools(
  nativeStream: AsyncIterable<StreamChunk>,
  createFallbackStream: () => AsyncIterable<StreamChunk>,
): AsyncGenerator<StreamChunk> {
  const bufferedChunks: StreamChunk[] = [];
  let hasCommittedOutput = false;

  for await (const chunk of nativeStream) {
    if (!hasCommittedOutput && isNativeToolCapabilityError(chunk)) {
      yield* createFallbackStream();
      return;
    }
    if (!hasCommittedOutput && isCommittedAssistantOutput(chunk)) {
      hasCommittedOutput = true;
      yield* bufferedChunks;
      bufferedChunks.length = 0;
    }
    if (hasCommittedOutput) {
      yield chunk;
    } else {
      bufferedChunks.push(chunk);
    }
  }

  yield* bufferedChunks;
}
