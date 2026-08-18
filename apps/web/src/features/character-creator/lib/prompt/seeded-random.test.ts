import { describe, expect, it } from 'vitest';

import { SeededRandom } from './seeded-random';

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const first = new SeededRandom(123);
    const second = new SeededRandom(123);

    const firstSequence = [first.next(), first.next(), first.next()];
    const secondSequence = [second.next(), second.next(), second.next()];

    expect(firstSequence).toEqual(secondSequence);
  });

  it('shuffles into a permutation of the input without mutating it', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const random = new SeededRandom(9);
    const shuffled = random.shuffle(items);

    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it('returns undefined when picking from an empty source list', () => {
    const random = new SeededRandom(5);

    expect(random.pickFrom<string>([])).toBeUndefined();
  });
});
