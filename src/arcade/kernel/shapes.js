// Axis-aligned rectangles and circles as plain objects, plus the boundary
// clamping helpers every game shares.

export const rect = (x, y, w, h) => ({ x, y, w, h });
export const circle = (x, y, r) => ({ x, y, r });

export const rectCenter = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
export const circleCenter = (c) => ({ x: c.x, y: c.y });

export const left = (r) => r.x;
export const right = (r) => r.x + r.w;
export const top = (r) => r.y;
export const bottom = (r) => r.y + r.h;

/** Inclusive point-in-rect. Edges count as inside. */
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function pointInCircle(px, py, c) {
  const dx = px - c.x;
  const dy = py - c.y;
  return dx * dx + dy * dy <= c.r * c.r;
}

/** True when `inner` sits entirely inside `outer`. */
export function rectContains(outer, inner) {
  return inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.w <= outer.x + outer.w
    && inner.y + inner.h <= outer.y + outer.h;
}

export function grow(r, by) {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

export function shrink(r, by) {
  const w = Math.max(0, r.w - by * 2);
  const h = Math.max(0, r.h - by * 2);
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}

/** Keep a circle fully inside a 0..w / 0..h play field. In place. */
export function clampCircle(c, w, h) {
  c.x = Math.max(c.r, Math.min(w - c.r, c.x));
  c.y = Math.max(c.r, Math.min(h - c.r, c.y));
  return c;
}

/** Keep a rect fully inside a 0..w / 0..h play field. In place. */
export function clampRect(r, w, h) {
  r.x = Math.max(0, Math.min(w - r.w, r.x));
  r.y = Math.max(0, Math.min(h - r.h, r.y));
  return r;
}

/** Wrap a point into the field (for screen-wrapping shooters). */
export function wrapPoint(p, w, h) {
  if (p.x < 0) p.x += w;
  else if (p.x >= w) p.x -= w;
  if (p.y < 0) p.y += h;
  else if (p.y >= h) p.y -= h;
  return p;
}

/** Even grid of cells covering a w x h field. */
export function grid(cols, rows, cw, ch) {
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) {
      row.push(rect(c * cw, r * ch, cw, ch));
    }
    cells.push(row);
  }
  return cells;
}
