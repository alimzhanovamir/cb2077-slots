export type Random = {
  /** Uniform random integer in `[0, maxExclusive)`. */
  nextInt(maxExclusive: number): number;
};

const UINT32_RANGE = 0x1_0000_0000;

/** Cryptographically strong RNG, available in Node.js and browsers. */
export const cryptoRandom: Random = {
  nextInt(maxExclusive) {
    // Rejection sampling avoids modulo bias.
    const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
    const buffer = new Uint32Array(1);

    for (;;) {
      const [value = 0] = crypto.getRandomValues(buffer);

      if (value < limit) {
        return value % maxExclusive;
      }
    }
  },
};

/** Deterministic RNG (mulberry32) for tests. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;

  return {
    nextInt(maxExclusive) {
      state = (state + 0x6d2b79f5) >>> 0;

      let mixed = state;

      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

      const unit = ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;

      return Math.floor(unit * maxExclusive);
    },
  };
}

/** Random id like `s-3f9a0c…` (16 random bytes, hex). */
export function randomId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let hex = "";

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return `${prefix}-${hex}`;
}
