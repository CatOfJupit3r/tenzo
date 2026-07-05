import { useDebouncedCallback } from '@tanstack/react-pacer';
import { useRef, useInsertionEffect, useCallback } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function useStableCallback<T extends (...args: any[]) => any>(
  fn: T,
): (...funcArgs: Parameters<T>) => ReturnType<T> {
  const ref = useRef(fn);

  useInsertionEffect(() => {
    ref.current = fn;
  }, [fn]);

  return useCallback((...args: Parameters<T>): ReturnType<T> => {
    const f = ref.current;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return f(...args);
  }, []);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedStableCallback<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): ReturnType<typeof useDebouncedCallback<T>> {
  const ref = useRef(fn);

  useInsertionEffect(() => {
    ref.current = fn;
  }, [fn]);

  const callback = useCallback((...args: Parameters<T>): ReturnType<T> => {
    const f = ref.current;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return f(...args);
  }, []);

  return useDebouncedCallback(callback, {
    wait: delay,
  });
}
