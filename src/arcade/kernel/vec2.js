// Plain-object 2D vectors. Every function returns a new object unless the
// name says otherwise, so game code never has to think about aliasing.

export const vec = (x = 0, y = 0) => ({ x, y });

export const clone = (a) => ({ x: a.x, y: a.y });

/** In-place write. Returns the same object. */
export const set = (a, x, y) => {
  a.x = x;
  a.y = y;
  return a;
};

export const copy = (dst, src) => set(dst, src.x, src.y);

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s });

/** a + b * s — the workhorse for drag-and-step motion. */
export const addScaled = (a, b, s) => ({ x: a.x + b.x * s, y: a.y + b.y * s });

export const neg = (a) => ({ x: -a.x, y: -a.y });

export const dot = (a, b) => a.x * b.x + a.y * b.y;

/** 2D cross product magnitude (z component). */
export const cross = (a, b) => a.x * b.y - a.y * b.x;

export const len2 = (a) => a.x * a.x + a.y * a.y;
export const len = (a) => Math.sqrt(a.x * a.x + a.y * a.y);

export const dist2 = (a, b) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
export const dist = (a, b) => Math.sqrt(dist2(a, b));

/** Unit vector, or `{x:0,y:0}` when the input has no length. */
export const norm = (a) => {
  const l = len(a);
  if (l < 1e-9) return { x: 0, y: 0 };
  return { x: a.x / l, y: a.y / l };
};

/** Clamp the magnitude in place, returning the same object. */
export const limit = (a, max) => {
  const l = len(a);
  if (l > max && l > 1e-9) {
    const k = max / l;
    a.x *= k;
    a.y *= k;
  }
  return a;
};

export const fromAngle = (rad, mag = 1) => ({ x: Math.cos(rad) * mag, y: Math.sin(rad) * mag });

export const angleOf = (a) => Math.atan2(a.y, a.x);

export const rotate = (a, rad) => {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};

/** Mirror a velocity about a unit normal: v - 2(v·n)n. */
export const reflect = (v, n) => {
  const d = 2 * dot(v, n);
  return { x: v.x - d * n.x, y: v.y - d * n.y };
};

/** Push a velocity along `n` at a given speed, keeping tangential motion. */
export const project = (v, n, speed) => {
  const along = dot(v, n);
  const perp = { x: v.x - n.x * along, y: v.y - n.y * along };
  return { x: perp.x + n.x * speed, y: perp.y + n.y * speed };
};

export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Shortest signed angular difference from a to b, in (-PI, PI]. */
export const angleTo = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
};
