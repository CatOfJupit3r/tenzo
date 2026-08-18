import type { LogContext } from './logging-contracts';

const MAX_DEPTH = 4;
const MAX_KEYS = 30;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 2_000;
const REDACTED_VALUE = '[redacted]';
const SENSITIVE_KEY_PATTERN = /(authorization|api[-_]?key|token|secret|password|prompt|content|requestbody)/i;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SENSITIVE_VALUE_PATTERNS = [
  /(["']?authorization["']?\s*[:=]\s*["']?)(?!Bearer\s)[^"'\s,}]+/gi,
  /(["']?api[-_]?key["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi,
  /(["']?(?:token|secret|password)["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi,
] as const;

function sanitizeString(value: string) {
  const redacted = SENSITIVE_VALUE_PATTERNS.reduce(
    (currentValue, pattern) => currentValue.replace(pattern, `$1${REDACTED_VALUE}`),
    value.replace(BEARER_PATTERN, 'Bearer [redacted]'),
  );
  return redacted.length > MAX_STRING_LENGTH ? `${redacted.slice(0, MAX_STRING_LENGTH - 3)}...` : redacted;
}

function sanitizeValue(value: unknown, depth: number, visited: WeakSet<object>): unknown {
  if (typeof value === 'string') return sanitizeString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (value === undefined) return undefined;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (typeof value !== 'object') return String(value);
  if (visited.has(value)) return '[circular]';
  visited.add(value);
  if (Array.isArray(value))
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1, visited));

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_KEYS)
      .map(([key, item]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED_VALUE : sanitizeValue(item, depth + 1, visited),
      ]),
  );
}

export function sanitizeLogContext(context: LogContext = {}): LogContext {
  return sanitizeValue(context, 0, new WeakSet()) as LogContext;
}

export function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { name: 'Error', message: sanitizeString(String(error)) };
  }
  return {
    name: sanitizeString(error.name),
    message: sanitizeString(error.message),
    ...(error.stack ? { stack: sanitizeString(error.stack) } : {}),
    ...(error.cause === undefined
      ? {}
      : { cause: sanitizeString(error.cause instanceof Error ? error.cause.message : String(error.cause)) }),
  };
}
