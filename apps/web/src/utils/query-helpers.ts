import { intersection, isEqual } from 'lodash-es';

const destructureQueryKey = (key: unknown): [string[], Record<string, unknown>] => {
  if (Array.isArray(key)) {
    const [keys = [], params = {}] = key;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return [keys, params];
  }
  return [[], {}];
};

export function isSimilar<T, U>(arr1: T | T[], arr2: U[]): boolean {
  const [keys1] = destructureQueryKey(arr1);
  const [keys2] = destructureQueryKey(arr2);

  return intersection(keys1, keys2).length > 0;
}

export function isExactMatch<T, U>(arr1: T | T[], arr2: U[], includeArgs = false): boolean {
  const [keys1, args1] = destructureQueryKey(arr1);
  const [keys2, args2] = destructureQueryKey(arr2);

  if (includeArgs && !isEqual(args1, args2)) return false;
  return isEqual(keys1, keys2);
}
