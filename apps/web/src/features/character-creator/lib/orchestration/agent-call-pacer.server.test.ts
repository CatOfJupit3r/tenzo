import { describe, expect, it, vi } from 'vitest';

import { AGENT_CALL_MAXIMUM_ATTEMPTS, createAgentCallPacer } from './agent-call-pacer.server';

function createHttpError(status: number) {
  return Object.assign(new Error(`Request failed with ${status}.`), { retryAfter: 0, status });
}

describe('agent call pacer', () => {
  it('retries transient rate-limit failures and reports the retry count', async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(createHttpError(429))
      .mockResolvedValue('completed');

    await expect(createAgentCallPacer().execute(operation)).resolves.toEqual({ value: 'completed', retryCount: 1 });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry validation or policy failures', async () => {
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(new Error('Invalid structured output.'));

    await expect(createAgentCallPacer().execute(operation)).rejects.toThrow('Invalid structured output.');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('stops after the bounded maximum attempt count', async () => {
    const operation = vi.fn<() => Promise<string>>().mockRejectedValue(createHttpError(503));

    await expect(createAgentCallPacer().execute(operation)).rejects.toThrow('503');
    expect(operation).toHaveBeenCalledTimes(AGENT_CALL_MAXIMUM_ATTEMPTS);
  });

  it('cancels retries through the caller abort signal', async () => {
    const abortController = new AbortController();
    const operation = vi.fn(async () => {
      abortController.abort();
      throw createHttpError(429);
    });

    await expect(createAgentCallPacer().execute(operation, abortController.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
