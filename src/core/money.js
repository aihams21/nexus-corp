/**
 * Money: the growth curve and the display formatter.
 * The formatter tier table is fixed by spec — K, M, B, T, Qa, Qi, Sx, Sp.
 */

const TIERS = [
  { v: 1e3, s: 'K' },
  { v: 1e6, s: 'M' },
  { v: 1e9, s: 'B' },
  { v: 1e12, s: 'T' },
  { v: 1e15, s: 'Qa' },
  { v: 1e18, s: 'Qi' },
  { v: 1e21, s: 'Sx' },
  { v: 1e24, s: 'Sp' },
];

/** Growth factor per purchased level of every levelable thing. */
export const GROWTH = 1.15;

/** `Cost(n) = BaseCost * 1.15^n` — n is the level already owned. */
export function costAt(base, level, growth = GROWTH) {
  return base * Math.pow(growth, level);
}

/**
 * Compact currency display: `$1.25K`, `$4.50M`, `$8.90B`, `$1.20T`, `$5.00Qa`.
 * Values below 1000 keep two decimals unless they are whole.
 */
export function cash(v) {
  const n = Number.isFinite(v) ? v : 0;
  const neg = n < 0;
  const a = Math.abs(n);
  if (a < 1000) {
    const body = a < 10 && a % 1 !== 0 ? a.toFixed(2) : a < 100 ? a.toFixed(a % 1 ? 1 : 0) : Math.floor(a).toString();
    return `${neg ? '-$' : '$'}${body}`;
  }
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i];
    if (a >= t.v) {
      const scaled = a / t.v;
      const body = scaled < 10 ? scaled.toFixed(2) : scaled < 100 ? scaled.toFixed(1) : Math.floor(scaled).toString();
      return `${neg ? '-$' : '$'}${body}${t.s}`;
    }
  }
  return `${neg ? '-$' : '$'}${a.toExponential(2)}`;
}

/** Integer points with thousands separators. */
export const points = (v) => Math.max(0, Math.floor(Number.isFinite(v) ? v : 0)).toLocaleString('en-US');

/** `+2.4s` style signed multiplier. */
export function mult(m) {
  return `x${Number.isFinite(m) ? m.toFixed(2) : '1.00'}`;
}

/** Whole seconds remaining, never negative. */
export const secsLeft = (ms) => Math.max(0, Math.ceil((Number(ms) || 0) / 1000));