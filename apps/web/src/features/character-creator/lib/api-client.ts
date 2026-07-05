import type { iGenerationMessage } from './prompt-builder';

export interface iChatCompletionsRequest {
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  messages: iGenerationMessage[];
}

interface iChatCompletionsRequestPayload {
  model: string;
  messages: iGenerationMessage[];
  max_tokens: number;
  stream: boolean;
}

function normalizeProviderTextPart(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeProviderTextPart(entry)).join('');
  }

  if (value && typeof value === 'object') {
    const textValue = Reflect.get(value, 'text');
    if (typeof textValue === 'string') {
      return textValue;
    }

    const contentValue = Reflect.get(value, 'content');
    if (contentValue !== undefined) {
      return normalizeProviderTextPart(contentValue);
    }
  }

  return '';
}

function extractProviderMessageContent(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const choices = Reflect.get(payload, 'choices');
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const firstChoice = choices[0];
    const delta = Reflect.get(firstChoice, 'delta');
    if (delta && typeof delta === 'object') {
      return normalizeProviderTextPart(Reflect.get(delta, 'content'));
    }

    const message = Reflect.get(firstChoice, 'message');
    if (message && typeof message === 'object') {
      return normalizeProviderTextPart(Reflect.get(message, 'content'));
    }
  }

  return normalizeProviderTextPart(Reflect.get(payload, 'response'));
}

function consumeSseEventChunk(eventChunk: string) {
  const dataLines = eventChunk
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  if (dataLines.length === 0) {
    return { isDone: false, content: '' };
  }

  const payloadText = dataLines.join('\n');
  if (payloadText === '[DONE]') {
    return { isDone: true, content: '' };
  }

  try {
    const payload = JSON.parse(payloadText) as unknown;
    return { isDone: false, content: extractProviderMessageContent(payload) };
  } catch {
    return { isDone: false, content: '' };
  }
}

export function normalizeChatCompletionsEndpoint(endpoint: string) {
  const trimmedEndpoint = endpoint.trim().replace(/\/$/, '');

  if (trimmedEndpoint.endsWith('/chat/completions')) {
    return trimmedEndpoint;
  }

  if (trimmedEndpoint.endsWith('/v1')) {
    return `${trimmedEndpoint}/chat/completions`;
  }

  return `${trimmedEndpoint}/v1/chat/completions`;
}

export function buildChatCompletionsPayload({
  model,
  maxTokens,
  messages,
}: iChatCompletionsRequest): iChatCompletionsRequestPayload {
  return {
    model: model.trim(),
    messages,
    max_tokens: Math.max(1, Math.floor(maxTokens)),
    stream: true,
  };
}

export function buildChatCompletionsHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  } satisfies HeadersInit;
}

export async function executeBrowserChatCompletionsRequest(request: iChatCompletionsRequest, signal?: AbortSignal) {
  return fetch(normalizeChatCompletionsEndpoint(request.endpoint), {
    method: 'POST',
    headers: buildChatCompletionsHeaders(request.apiKey),
    body: JSON.stringify(buildChatCompletionsPayload(request)),
    signal,
  });
}

export async function buildProviderErrorMessage(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as unknown;
      if (payload && typeof payload === 'object') {
        const errorValue = Reflect.get(payload, 'error');
        if (typeof errorValue === 'string') {
          return errorValue;
        }

        if (errorValue && typeof errorValue === 'object') {
          const messageValue = Reflect.get(errorValue, 'message');
          if (typeof messageValue === 'string') {
            return messageValue;
          }
        }

        const messageValue = Reflect.get(payload, 'message');
        if (typeof messageValue === 'string') {
          return messageValue;
        }
      }
    }

    const text = await response.text();
    if (text.trim()) {
      return text.trim();
    }
  } catch {
    return `${response.status} ${response.statusText}`.trim();
  }

  return `${response.status} ${response.statusText}`.trim();
}

export interface iReadChatCompletionsResponseOptions {
  response: Response;
  onContent: (content: string) => void;
  signal?: AbortSignal;
}

export async function readChatCompletionsResponse({
  response,
  onContent,
  signal,
}: iReadChatCompletionsResponseOptions) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as unknown;
    const content = extractProviderMessageContent(payload);
    if (content) {
      onContent(content);
    }
    return content;
  }

  if (!response.body) {
    const text = await response.text();
    if (text) {
      onContent(text);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    if (signal?.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new DOMException('Request aborted', 'AbortError');
    }

    const { done: isDone, value } = await reader.read();
    if (isDone) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    if (contentType.includes('text/event-stream')) {
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const eventChunk of events) {
        const eventResult = consumeSseEventChunk(eventChunk);
        if (eventResult.content) {
          fullContent += eventResult.content;
          onContent(eventResult.content);
        }

        if (eventResult.isDone) {
          return fullContent;
        }
      }

      continue;
    }

    const textChunk = buffer;
    buffer = '';
    if (textChunk) {
      fullContent += textChunk;
      onContent(textChunk);
    }
  }

  const remainingChunk = buffer + decoder.decode();
  if (remainingChunk.trim()) {
    if (contentType.includes('text/event-stream')) {
      const eventResult = consumeSseEventChunk(remainingChunk);
      if (eventResult.content) {
        fullContent += eventResult.content;
        onContent(eventResult.content);
      }
    } else {
      fullContent += remainingChunk;
      onContent(remainingChunk);
    }
  }

  return fullContent;
}
