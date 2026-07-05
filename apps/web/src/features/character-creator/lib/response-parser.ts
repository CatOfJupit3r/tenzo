import { OUTPUT_FORMATS } from './generation-config';
import type { OutputFormat } from './generation-config';

function extractLastCodeBlock(content: string) {
  const codeBlockRegex = /```(?:\w+\n|\n)?([\s\S]*?)```/g;
  let match = codeBlockRegex.exec(content);
  let lastMatch: string | null = null;

  while (match !== null) {
    lastMatch = match[1]?.trim() ?? null;
    match = codeBlockRegex.exec(content);
  }

  return lastMatch;
}

function decodeLooseJsonString(value: string) {
  return value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"');
}

export function coerceParsedResponseToText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => coerceParsedResponseToText(entry))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (value && typeof value === 'object') {
    const responseValue = Reflect.get(value, 'response');
    if (responseValue !== undefined) {
      return coerceParsedResponseToText(responseValue);
    }

    const messageValue = Reflect.get(value, 'message');
    if (messageValue !== undefined) {
      return coerceParsedResponseToText(messageValue);
    }

    const firstValue = Object.values(value)[0];
    return firstValue === undefined ? '' : coerceParsedResponseToText(firstValue);
  }

  if (value == null) {
    return '';
  }

  return String(value).trim();
}

export function parseResponse(content: string, format: OutputFormat): string {
  const codeBlockContent = extractLastCodeBlock(content);
  const cleanedContent = (codeBlockContent ?? content).trim();

  if (!cleanedContent) {
    return '';
  }

  if (format === OUTPUT_FORMATS.none) {
    return cleanedContent;
  }

  if (format === OUTPUT_FORMATS.xml) {
    const closedMatch = /<response>([\s\S]*?)<\/response>/i.exec(cleanedContent);
    if (closedMatch?.[1] !== undefined) {
      return closedMatch[1].trim();
    }

    const openMatch = /<response>([\s\S]*)$/i.exec(cleanedContent);
    if (openMatch?.[1] !== undefined) {
      return openMatch[1].replace(/<\/?[\w:-]*>?$/g, '').trim();
    }

    return cleanedContent;
  }

  try {
    const parsed = JSON.parse(cleanedContent) as unknown;
    return coerceParsedResponseToText(parsed);
  } catch {
    const responseMatch = /"response"\s*:\s*"([\s\S]*)/i.exec(cleanedContent);
    if (responseMatch?.[1] !== undefined) {
      return decodeLooseJsonString(responseMatch[1].replace(/"\s*}\s*$/g, '')).trim();
    }

    return cleanedContent;
  }
}

export function getPrefilled(content: string, format: OutputFormat) {
  const trimmedContent = content.trim();

  switch (format) {
    case OUTPUT_FORMATS.xml:
      return `<response>${trimmedContent}`;
    case OUTPUT_FORMATS.json:
      return `{"response":"${trimmedContent.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}`;
    case OUTPUT_FORMATS.none:
      return trimmedContent;
    default:
      return trimmedContent;
  }
}
