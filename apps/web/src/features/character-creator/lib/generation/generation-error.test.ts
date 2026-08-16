import { describe, expect, it, vi } from 'vitest';

import { describeGenerationError, getGenerationErrorHint, logGenerationError } from './generation-error';

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
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(describeGenerationError(error)).toBe('Authorization: Bearer [redacted] apiKey=[redacted]');
    logGenerationError('Generation', error);

    expect(consoleError).toHaveBeenCalledWith('[Generation]', 'Authorization: Bearer [redacted] apiKey=[redacted]');
    consoleError.mockRestore();
  });

  it('adds actionable guidance for masked provider failures', () => {
    expect(getGenerationErrorHint({ message: 'Provider returned error', code: 500 })).toBe(
      'The selected provider failed or masked its upstream error; retry or choose another routing provider.',
    );
  });
});
