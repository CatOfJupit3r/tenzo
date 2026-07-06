export interface iSeededRandom {
  /** Returns the next pseudo-random float in [0, 1). */
  next: () => number;
  pickFrom: <T>(items: readonly T[]) => T | undefined;
  shuffle: <T>(items: readonly T[]) => T[];
}

export const GENERATION_SEED_MODULUS = 2 ** 32;

export function createGenerationSeed(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] ?? Math.floor(Math.random() * GENERATION_SEED_MODULUS);
}

/**
 * Deterministic PRNG (mulberry32): the same seed always yields the same
 * sequence, so every random choice in the prompt pipeline is reproducible.
 */
export function createSeededRandom(seed: number): iSeededRandom {
  /* eslint-disable no-bitwise -- mulberry32 is defined in terms of 32-bit integer mixing */
  let state = (Math.floor(Math.abs(seed)) % GENERATION_SEED_MODULUS) >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / GENERATION_SEED_MODULUS;
  };
  /* eslint-enable no-bitwise */

  const pickFrom = <T>(items: readonly T[]): T | undefined => {
    if (items.length === 0) {
      return undefined;
    }

    return items[Math.floor(next() * items.length)];
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(next() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
  };

  return { next, pickFrom, shuffle };
}
