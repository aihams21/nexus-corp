/**
 * Small numeric helpers shared by the tycoon and the arcade kernel.
 * Everything here is pure — no globals, no DOM.
 */

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

/** Move `v` toward `target` by at most `step`. */
export function approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return target;
}

/** Frame-rate independent smoothing: `rate` is the fraction closed per second. */
export const easeToward = (v, target, rate, dt) =>
  target + (v - target) * Math.exp(-rate * dt);

export const TAU = Math.PI * 2;

/** Shortest signed angular difference from `a` to `b`, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export const hypot = (x, y) => Math.sqrt(x * x + y * y);
export const dist2 = (ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

/** Linear interpolation between two hex colours, each `#rrggbb`. */
export function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const k = clamp01(t);
  const r = Math.round((pa >> 16) + (((pb >> 16) - (pa >> 16)) * k));
  const g = Math.round(((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * k));
  const bl = Math.round((pa & 255) + (((pb & 255) - (pa & 255)) * k));
  return `rgb(${r},${g},${bl})`;
}

/** Sum of an array in one pass (used by flow rate computation). */
export const total = (arr, fn = (x) => x) => {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += fn(arr[i], i);
  return s;
};

/** Format seconds as `m:ss`, clamped to non-negative. */
export function mmss(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}