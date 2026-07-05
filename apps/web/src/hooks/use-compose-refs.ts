import { composeRefs } from 'radix-ui/internal';
import { useCallback } from 'react';
import type { RefCallback } from 'react';

import type { PossibleRef } from '@~/lib/compose-refs';

/**
 * A custom hook that composes multiple refs
 * Accepts callback refs and RefObject(s)
 */
export function useComposedRefs<T>(...refs: PossibleRef<T>[]): RefCallback<T> {
  // biome-ignore lint/correctness/useExhaustiveDependencies: we want to memoize by all values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(composeRefs(...refs), refs);
}
