import { CHARACTER_ASSISTANT_STREAM_EVENT_SCHEMA } from './character-assistant-contracts';
import type { iCharacterAssistantStreamEvent } from './character-assistant-contracts';

async function readErrorMessage(response: Response) {
  const responseText = await response.text();
  return responseText.trim() || 'Character assistant failed.';
}

function parseServerEventChunk(eventChunk: string) {
  const lines = eventChunk.split('\n');
  let eventType = '';
  const dataLines: string[] = [];

  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      eventType = line.slice('event:'.length).trim();
      return;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  });

  if (!eventType || dataLines.length === 0) {
    return null;
  }

  const parsedEvent = CHARACTER_ASSISTANT_STREAM_EVENT_SCHEMA.parse(JSON.parse(dataLines.join('\n')) as unknown);

  if (parsedEvent.type !== eventType) {
    throw new Error('Character assistant stream event type mismatch.');
  }

  return parsedEvent;
}

export async function consumeCharacterAssistantStream(
  response: Response,
  onEvent: (event: iCharacterAssistantStreamEvent) => unknown,
) {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('Character assistant response stream is unavailable.');
  }

  const textDecoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const readResult = await reader.read();

    if (readResult.done) {
      break;
    }

    buffer = `${buffer}${textDecoder.decode(readResult.value, { stream: true })}`.replaceAll('\r\n', '\n');

    while (true) {
      const delimiterIndex = buffer.indexOf('\n\n');

      if (delimiterIndex === -1) {
        break;
      }

      const eventChunk = buffer.slice(0, delimiterIndex);
      buffer = buffer.slice(delimiterIndex + 2);

      if (!eventChunk.trim()) {
        continue;
      }

      const parsedEvent = parseServerEventChunk(eventChunk);

      if (parsedEvent) {
        await onEvent(parsedEvent);
      }
    }
  }

  const trailingChunk = buffer.trim();

  if (!trailingChunk) {
    return;
  }

  const parsedEvent = parseServerEventChunk(trailingChunk);

  if (parsedEvent) {
    await onEvent(parsedEvent);
  }
}
