import { z } from 'zod';

import { loggerFactory } from '@~/lib/logging/logger';
import type { iLogger } from '@~/lib/logging/logging-contracts';

const ERROR_DETAIL_KEYS = [
  'message',
  'code',
  'status',
  'statusCode',
  'error_type',
  'provider_code',
  'provider_name',
  'raw',
  'responseBody',
] as const;

const ERROR_CHILD_KEYS = ['rawValue', 'error', 'metadata', 'cause', 'rawEvent', 'response'] as const;
const MAX_ERROR_MESSAGE_LENGTH = 1_200;
const GENERATION_LOGGER = loggerFactory.getLogger('character-creator.generation');

const GENERATION_ERROR_OBJECT_SCHEMA = z
  .object({
    message: z.union([z.string(), z.number()]).optional(),
    code: z.union([z.string(), z.number()]).optional(),
    status: z.union([z.string(), z.number()]).optional(),
    statusCode: z.union([z.string(), z.number()]).optional(),
    error_type: z.union([z.string(), z.number()]).optional(),
    provider_code: z.union([z.string(), z.number()]).optional(),
    provider_name: z.union([z.string(), z.number()]).optional(),
    raw: z.union([z.string(), z.number()]).optional(),
    responseBody: z.union([z.string(), z.number()]).optional(),
    rawValue: z.unknown().optional(),
    error: z.unknown().optional(),
    metadata: z.unknown().optional(),
    cause: z.unknown().optional(),
    rawEvent: z.unknown().optional(),
    response: z.unknown().optional(),
    errors: z.array(z.unknown()).optional(),
  })
  .passthrough();
type iGenerationErrorObject = z.infer<typeof GENERATION_ERROR_OBJECT_SCHEMA>;

function redactSensitiveValues(value: string) {
  return value
    .replace(/(["']?authorization["']?\s*[:=]\s*["']?)Bearer\s+[A-Za-z0-9._~+/=-]+/gi, '$1Bearer [redacted]')
    .replace(/(["']?api[_-]?key["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, '$1[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]');
}

function appendErrorDetail(details: string[], key: (typeof ERROR_DETAIL_KEYS)[number], value: unknown) {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim().length === 0) return;
  const sanitizedValue = redactSensitiveValues(String(value).replace(/\s+/g, ' ').trim());
  if (key === 'message' || key === 'raw' || key === 'responseBody') {
    details.push(sanitizedValue);
    return;
  }
  details.push(`${key}: ${sanitizedValue}`);
}

function collectGenerationErrorDetails(error: unknown, details: string[], visited: Set<object>) {
  if (error === null || error === undefined) return;

  if (typeof error === 'string') {
    details.push(redactSensitiveValues(error));
    return;
  }
  if (typeof error !== 'object') return;
  if (visited.has(error)) return;
  visited.add(error);

  const parsed = GENERATION_ERROR_OBJECT_SCHEMA.safeParse(error);
  if (!parsed.success) return;
  const errorObject: iGenerationErrorObject = parsed.data;

  for (const key of ERROR_DETAIL_KEYS) {
    appendErrorDetail(details, key, errorObject[key]);
  }
  for (const key of ERROR_CHILD_KEYS) {
    collectGenerationErrorDetails(errorObject[key], details, visited);
  }
  if (errorObject.errors) {
    errorObject.errors.forEach((nestedError) => collectGenerationErrorDetails(nestedError, details, visited));
  }
}

export function describeGenerationError(error: unknown, fallbackMessage = 'Unknown provider error.') {
  const details: string[] = [];
  collectGenerationErrorDetails(error, details, new Set<object>());
  const message = [...new Set(details)].join(' | ').trim() || fallbackMessage;
  return message.length > MAX_ERROR_MESSAGE_LENGTH ? `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH - 3)}...` : message;
}

export function getGenerationErrorHint(error: unknown) {
  const description = describeGenerationError(error).toLowerCase();
  if (/error_type:\s*(authentication|permission_denied)|code:\s*(401|403)\b/.test(description)) {
    return 'Check the API key and its OpenRouter permissions.';
  }
  if (/error_type:\s*payment_required|code:\s*402\b/.test(description)) {
    return 'The OpenRouter account or API key has insufficient credit.';
  }
  if (/error_type:\s*rate_limit_exceeded|code:\s*429\b/.test(description)) {
    return 'The selected route is rate-limited; wait briefly or choose another routing provider.';
  }
  if (/error_type:\s*(provider_overloaded|provider_unavailable|server|timeout)|code:\s*5\d\d\b/.test(description)) {
    return 'The selected provider failed or masked its upstream error; retry or choose another routing provider.';
  }
  if (/error_type:\s*(invalid_request|invalid_prompt)|code:\s*400\b/.test(description)) {
    return 'The provider rejected the tool request shape; choose another tool-capable route or model.';
  }
  return null;
}

export function logGenerationError(context: string, error: unknown, logger: iLogger = GENERATION_LOGGER) {
  logger.error('Generation failed', error, {
    operation: context,
  });
}
