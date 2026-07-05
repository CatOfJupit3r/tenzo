import type z from 'zod';

export function isNil<T>(value: T | Nil): value is Nil {
  return value === null || value === undefined;
}

/**
 * Safe try-catch wrapper for synchronous and asynchronous functions.
 *
 * Use it to avoid try-catch blocks in your code.
 *
 * Inspired by t3dotgg gist: https://gist.github.com/t3dotgg/a486c4ae66d32bf17c09c73609dacc5b
 * @param fn - Function to execute
 * @returns An object containing either the data or the error
 */
export function tryCatch<T, E = Error>(fn: () => T) {
  type Result<TResult, EResult> = { data: TResult; error: null } | { data: null; error: EResult };
  type ReturnType = T extends Promise<infer P> ? Promise<Result<P, E>> : Result<T, E>;

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result
        .then((data: Promise<unknown>) => ({ data, error: null }))
        .catch((e: unknown) => ({ data: null, error: e as E })) as ReturnType;
    }
    return { data: result, error: null } as ReturnType;
  } catch (e: unknown) {
    return { data: null, error: e as E } as ReturnType;
  }
}

export type ZGenerator<T> = T extends (...args: unknown[]) => infer U
  ? U extends z.ZodType
    ? z.infer<U>
    : never
  : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function removeNilFromObject<T extends Record<string, any>>(obj: T): Record<keyof T, NonNil<T[keyof T]>> {
  return Object.fromEntries(Object.entries(obj).filter(([_, value]) => !isNil(value))) as Record<
    keyof T,
    NonNil<T[keyof T]>
  >;
}
