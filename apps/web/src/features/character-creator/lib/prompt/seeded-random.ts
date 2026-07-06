export class SeededRandom {
  static readonly MODULUS = 2 ** 32;

  private state: number;

  constructor(seed: number) {
    /* eslint-disable-next-line no-bitwise -- mulberry32 state must be a 32-bit unsigned integer */
    this.state = (Math.floor(Math.abs(seed)) % SeededRandom.MODULUS) >>> 0;
  }

  static generateSeed(): number {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] ?? Math.floor(Math.random() * SeededRandom.MODULUS);
  }

  /**
   * Deterministic PRNG (mulberry32): the same seed always yields the same
   * sequence, so every random choice in the prompt pipeline is reproducible.
   */
  next(): number {
    /* eslint-disable no-bitwise -- mulberry32 is defined in terms of 32-bit integer mixing */
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let mixed = this.state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / SeededRandom.MODULUS;
    /* eslint-enable no-bitwise */
  }

  pickFrom<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) {
      return undefined;
    }

    return items[Math.floor(this.next() * items.length)];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const shuffled = [...items];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.next() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
  }
}
