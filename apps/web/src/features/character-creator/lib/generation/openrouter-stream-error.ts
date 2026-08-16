import { describeGenerationError } from './generation-error';

const OPENROUTER_ERROR_DETAIL_LIMIT = 1_000;

function enrichOpenRouterEventBlock(block: string) {
  return block
    .split(/\r?\n/)
    .map((line) => {
      if (!line.startsWith('data:')) return line;
      const data = line.slice('data:'.length).trim();
      if (!data || data === '[DONE]') return line;
      try {
        const event = JSON.parse(data) as { error?: { message?: string; metadata?: unknown } };
        if (!event.error?.metadata) return line;
        const message = describeGenerationError(event.error).slice(0, OPENROUTER_ERROR_DETAIL_LIMIT);
        return `data: ${JSON.stringify({ ...event, error: { ...event.error, message } })}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

export function preserveOpenRouterStreamErrorDetails(response: Response) {
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) return response;

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  const transformedBody = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? '';
        blocks.forEach((block) => controller.enqueue(encoder.encode(`${enrichOpenRouterEventBlock(block)}\n\n`)));
      },
      flush(controller) {
        buffer += decoder.decode();
        if (buffer) controller.enqueue(encoder.encode(enrichOpenRouterEventBlock(buffer)));
      },
    }),
  );

  return new Response(transformedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function createOpenRouterErrorPreservingHttpClient() {
  return {
    async request(request: Request) {
      return preserveOpenRouterStreamErrorDetails(await fetch(request));
    },
  };
}
