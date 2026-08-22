import { AsyncQueuer, AsyncRetryer } from '@tanstack/pacer';

export const AGENT_CALL_MAXIMUM_ATTEMPTS = 3;
export const AGENT_CALL_RETRY_BASE_WAIT_MS = 500;
export const AGENT_CALL_RETRY_MAXIMUM_WAIT_MS = 10_000;
export const AGENT_CALL_MAXIMUM_CONCURRENCY = 2;

interface iPacedCallResult<T> {
  value: T;
  retryCount: number;
}

interface iPacedCallTask {
  abortSignal?: AbortSignal;
  operation: (abortSignal: AbortSignal) => Promise<unknown>;
  resolve: (result: iPacedCallResult<unknown>) => unknown;
  reject: (error: unknown) => unknown;
}

export interface iAgentCallPacer {
  execute: <T>(
    operation: (abortSignal: AbortSignal) => Promise<T>,
    abortSignal?: AbortSignal,
  ) => Promise<iPacedCallResult<T>>;
}

function readErrorProperty(error: unknown, property: string): unknown {
  if (!error || typeof error !== 'object' || !(property in error)) return undefined;
  return (error as Record<string, unknown>)[property];
}

function getErrorStatus(error: unknown): number | null {
  const status = readErrorProperty(error, 'status') ?? readErrorProperty(error, 'statusCode');
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
}

function getErrorCode(error: unknown): string {
  const code = readErrorProperty(error, 'code');
  return typeof code === 'string' ? code.toUpperCase() : '';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
}

export function isTransientAgentCallError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  const status = getErrorStatus(error);
  if (status === 408 || status === 409 || status === 425 || status === 429 || (status !== null && status >= 500)) {
    return true;
  }
  const code = getErrorCode(error);
  if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'].includes(code)) return true;
  const message = getErrorMessage(error);
  return /\b(408|409|425|429|5\d\d)\b|rate.?limit|temporar|timed?\s*out|network|fetch failed/.test(message);
}

function getRetryAfterMs(error: unknown): number | null {
  const retryAfterMs = readErrorProperty(error, 'retryAfterMs');
  if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs)) {
    return Math.min(AGENT_CALL_RETRY_MAXIMUM_WAIT_MS, Math.max(0, retryAfterMs));
  }
  const retryAfterSeconds = readErrorProperty(error, 'retryAfter');
  if (typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds)) {
    return Math.min(AGENT_CALL_RETRY_MAXIMUM_WAIT_MS, Math.max(0, retryAfterSeconds * 1_000));
  }
  const response = readErrorProperty(error, 'response');
  const headers = readErrorProperty(response, 'headers');
  if (!(headers instanceof Headers)) return null;
  const header = headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.min(AGENT_CALL_RETRY_MAXIMUM_WAIT_MS, Math.max(0, seconds * 1_000));
  }
  const dateMs = Date.parse(header);
  return Number.isFinite(dateMs) ? Math.min(AGENT_CALL_RETRY_MAXIMUM_WAIT_MS, Math.max(0, dateMs - Date.now())) : null;
}

async function runWithRetry<T>(
  operation: (abortSignal: AbortSignal) => Promise<T>,
  abortSignal?: AbortSignal,
): Promise<iPacedCallResult<T>> {
  let retryCount = 0;
  type RetryResult = { isSuccessful: true; value: T } | { isSuccessful: false; error: unknown };
  const retryer = new AsyncRetryer<() => Promise<RetryResult>>(
    async (): Promise<RetryResult> => {
      abortSignal?.throwIfAborted();
      const retrySignal: AbortSignal | null = retryer.getAbortSignal();
      if (!retrySignal) throw new Error('Agent retry signal is unavailable.');
      try {
        return { isSuccessful: true as const, value: await operation(retrySignal) };
      } catch (error) {
        if (abortSignal?.aborted || retrySignal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (isTransientAgentCallError(error)) throw error;
        return { isSuccessful: false as const, error };
      }
    },
    {
      maxAttempts: AGENT_CALL_MAXIMUM_ATTEMPTS,
      backoff: 'exponential',
      baseWait: (currentRetryer) =>
        getRetryAfterMs(currentRetryer.store.state.lastError) ?? AGENT_CALL_RETRY_BASE_WAIT_MS,
      jitter: 0.25,
      throwOnError: 'last',
      onRetry: () => {
        retryCount += 1;
      },
    },
  );
  const abort = () => retryer.abort();
  if (abortSignal?.aborted) abort();
  else abortSignal?.addEventListener('abort', abort, { once: true });
  try {
    const result = await retryer.execute();
    abortSignal?.throwIfAborted();
    if (!result) throw new Error('Agent call ended without a result.');
    if (!result.isSuccessful) throw result.error;
    return { value: result.value, retryCount };
  } finally {
    abortSignal?.removeEventListener('abort', abort);
  }
}

export function createAgentCallPacer(): iAgentCallPacer {
  const queue = new AsyncQueuer<iPacedCallTask>(
    async (task) => {
      try {
        task.resolve(await runWithRetry(task.operation, task.abortSignal));
      } catch (error) {
        task.reject(error);
      }
    },
    { concurrency: AGENT_CALL_MAXIMUM_CONCURRENCY, started: true },
  );

  return {
    execute: async <T>(operation: (abortSignal: AbortSignal) => Promise<T>, abortSignal?: AbortSignal) =>
      new Promise<iPacedCallResult<T>>((resolve, reject) => {
        const isAdded = queue.addItem({
          operation,
          abortSignal,
          resolve: resolve as (result: iPacedCallResult<unknown>) => unknown,
          reject,
        });
        if (!isAdded) reject(new Error('Agent call queue is full.'));
      }),
  };
}
