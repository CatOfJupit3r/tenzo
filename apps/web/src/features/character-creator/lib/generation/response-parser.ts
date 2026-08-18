import { z } from 'zod';

import { OUTPUT_FORMATS } from './generation-config';
import type { OutputFormat } from './generation-config';

const PARSED_RESPONSE_VALUE_SCHEMA = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z
    .object({
      response: z.unknown().optional(),
      message: z.unknown().optional(),
    })
    .passthrough(),
]);
const PARSED_RESPONSE_OBJECT_SCHEMA = z
  .object({
    response: z.unknown().optional(),
    message: z.unknown().optional(),
  })
  .passthrough();
type iParsedResponseValue = z.infer<typeof PARSED_RESPONSE_VALUE_SCHEMA>;

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

export function coerceParsedResponseToText(value: iParsedResponseValue): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => coerceParsedResponseToText(parseResponseValue(entry)))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const parsedObject = PARSED_RESPONSE_OBJECT_SCHEMA.safeParse(value);
    if (parsedObject.success && 'response' in parsedObject.data && parsedObject.data.response !== undefined) {
      return coerceParsedResponseToText(parseResponseValue(parsedObject.data.response));
    }

    if (parsedObject.success && 'message' in parsedObject.data && parsedObject.data.message !== undefined) {
      return coerceParsedResponseToText(parseResponseValue(parsedObject.data.message));
    }

    const firstValue = Object.values(value)[0];
    return firstValue === undefined ? '' : coerceParsedResponseToText(parseResponseValue(firstValue));
  }

  if (value == null) {
    return '';
  }

  return String(value).trim();
}

function parseResponseValue(value: unknown): iParsedResponseValue {
  const parsed = PARSED_RESPONSE_VALUE_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : String(value);
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
    return coerceParsedResponseToText(parseResponseValue(JSON.parse(cleanedContent)));
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
