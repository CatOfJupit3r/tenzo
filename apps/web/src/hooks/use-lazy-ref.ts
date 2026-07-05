import { useRef } from 'react';
import type { RefObject } from 'react';

export function useLazyRef<T>(fn: () => T) {
  const ref = useRef<T | null>(null);

  ref.current ??= fn();

  return ref as RefObject<T>;
}
