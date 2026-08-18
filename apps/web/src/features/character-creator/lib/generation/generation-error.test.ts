import { describe, expect, it } from 'vitest';

import { serializeError } from '@~/lib/logging/log-sanitizer';
import type { iLogger } from '@~/lib/logging/logging-contracts';

import { describeGenerationError, getGenerationErrorHint, logGenerationError } from './generation-error';

function createCapturingLogger() {
  const logs: Array<{
    level: 'error';
    message: string;
    error: ReturnType<typeof serializeError>;
    context?: Record<string, unknown>;
  }> = [];
  const logger: iLogger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: (message, error, context) => {
      logs.push({ level: 'error', message, error: serializeError(error), context });
    },
    fatal: () => undefined,
    child: () => logger,
  };
  return { logger, logs };
}

describe('generation errors', () => {
  it('preserves actionable nested provider details', () => {
    const error = Object.assign(new Error('Provider rejected the request.'), {
      rawEvent: {
        error: {
          code: 400,
          metadata: { error_type: 'invalid_prompt', provider_code: 'tool_call_parse_failed' },
        },
      },
    });

    expect(describeGenerationError(error)).toBe(
      'Provider rejected the request. | code: 400 | error_type: invalid_prompt | provider_code: tool_call_parse_failed',
    );
  });

  it('redacts credentials from displayed and logged errors', () => {
    const error = new Error('Authorization: Bearer secret-token apiKey=very-secret');
    const { logger, logs } = createCapturingLogger();

    expect(describeGenerationError(error)).toBe('Authorization: Bearer [redacted] apiKey=[redacted]');
    logGenerationError('Generation', error, logger);

    expect(logs).toEqual([
      expect.objectContaining({
        level: 'error',
        message: 'Generation failed',
        error: {
          name: 'Error',
          message: 'Authorization: Bearer [redacted] apiKey=[redacted]',
          stack: expect.any(String),
        },
        context: { operation: 'Generation' },
      }),
    ]);
    expect(JSON.stringify(logs)).not.toContain('secret-token');
    expect(JSON.stringify(logs)).not.toContain('very-secret');
  });

  it('adds actionable guidance for masked provider failures', () => {
    expect(getGenerationErrorHint({ message: 'Provider returned error', code: 500 })).toBe(
      'The selected provider failed or masked its upstream error; retry or choose another routing provider.',
    );
  });
});
