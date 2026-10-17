/**
 * Deterministic PRNG (mulberry32) so procedural content — markets,
 * mine fields, spawn patterns — is reproducible from a seed.
 */

export function makeRng(seed = 1) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    /** Float in [lo, hi). */
    range: (lo, hi) => lo + next() * (hi - lo),
    /** Integer in [lo, hi] inclusive. */
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    /** Random element of a non-empty array. */
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** True with probability p. */
    chance: (p) => next() < p,
    /** Approximately normal via sum of three uniforms. */
    gauss: (mean = 0, dev = 1) => mean + ((next() + next() + next()) / 1.5 - 1) * dev * 2,
    /** Fisher–Yates, returns a new array. */
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}

/** One shared stream for cosmetic, non-reproducible effects. */
export const fx = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);