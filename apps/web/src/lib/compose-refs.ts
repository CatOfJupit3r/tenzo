export type PossibleRef<T> = React.Ref<T> | undefined;

/**
 * Set a given ref to a given value
 * This utility takes care of different types of refs: callback refs and RefObject(s)
 */
export function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === 'function') {
    return ref(value);
  }

  if (ref !== null && ref !== undefined) {
    ref.current = value;
  }

  return undefined;
}

/**
 * A utility to compose multiple refs together
 * Accepts callback refs and RefObject(s)
 */
export function composeRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T> {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup === 'function') {
        hasCleanup = true;
      }
      return cleanup;
    });

    if (!hasCleanup) return undefined;

    // React <19 will log an error to the console if a callback ref returns a
    // value. We don't use ref cleanups internally so this will only happen if a
    // user's ref callback returns a value, which we only expect if they are
    // using the cleanup functionality added in React 19.
    return () => {
      for (let i = 0; i < cleanups.length; i += 1) {
        const cleanup = cleanups[i];
        if (typeof cleanup === 'function') {
          cleanup();
        } else {
          setRef(refs[i], null);
        }
      }
    };
  };
}
