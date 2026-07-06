import { describe, expect, it } from 'vitest';

import { SeededRandom } from './seeded-random';

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const first = new SeededRandom(123);
    const second = new SeededRandom(123);

    const firstSequence = [first.next(), first.next(), first.next()];
    const secondSequence = [second.next(), second.next(), second.next()];

    expect(firstSequence).toEqual(secondSequence);
    firstSequence.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  it('produces different sequences for different seeds', () => {
    const first = new SeededRandom(1);
    const second = new SeededRandom(2);

    expect([first.next(), first.next()]).not.toEqual([second.next(), second.next()]);
  });

  it('shuffles into a permutation of the input without mutating it', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const random = new SeededRandom(9);
    const shuffled = random.shuffle(items);

    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it('picks only values present in the source list', () => {
    const random = new SeededRandom(5);
    const options = ['a', 'b', 'c'];

    for (let iteration = 0; iteration < 20; iteration += 1) {
      expect(options).toContain(random.pickFrom(options));
    }

    expect(random.pickFrom<string>([])).toBeUndefined();
  });

  it('generates seeds within the 32-bit range', () => {
    const seed = SeededRandom.generateSeed();

    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(SeededRandom.MODULUS);
  });
});
