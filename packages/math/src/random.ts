/**
 * The randomness the math needs. The RGS passes its own generator; the math only relies on this
 * shape, so it imports nothing from the RGS.
 */
export type Random = {
  /** Uniform random integer in `[0, maxExclusive)`. */
  nextInt: (maxExclusive: number) => number;
};
