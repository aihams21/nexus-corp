// Collision kernel. Exact predicates, no tolerances, plus penetration
// resolution so a ball can never end a frame inside a paddle or a brick.
//
// Contract: every function here is pure and unit tested. `resolveCircleAABB`
// returns a unit normal (pointing away from the box) and the penetration depth,
// which the caller applies to the position BEFORE reflecting velocity.

/** Axis-aligned box vs axis-aligned box. Edges that merely touch do not overlap. */
export function intersectAABB(a, b) {
  return a.x < b.x + b.w
    && a.x + a.w > b.x
    && a.y < b.y + b.h
    && a.y + a.h > b.y;
}

/** Circle vs circle using squared distance — no sqrt in the predicate. */
export function intersectCircle(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = a.r + b.r;
  return dx * dx + dy * dy < rr * rr;
}

/**
 * Closest point on an AABB to a point. Returns the point itself when the query
 * is inside the box, which is what makes the inside-out case resolve cleanly.
 */
export function closestPointOnAABB(px, py, box) {
  return {
    x: Math.max(box.x, Math.min(box.x + box.w, px)),
    y: Math.max(box.y, Math.min(box.y + box.h, py)),
  };
}

/** Circle vs AABB, including the circle fully inside the box. */
export function intersectCircleAABB(c, box) {
  const p = closestPointOnAABB(c.x, c.y, box);
  const dx = c.x - p.x;
  const dy = c.y - p.y;
  if (c.x >= box.x && c.x <= box.x + box.w && c.y >= box.y && c.y <= box.y + box.h) return true;
  return dx * dx + dy * dy < c.r * c.r;
}

/**
 * Separation test for the circle/AABB pair. Same predicate as
 * intersectCircleAABB, named for how games actually use it.
 */
export function circleHitsBox(c, box) {
  return intersectCircleAABB(c, box);
}

/**
 * Penetration resolution for a circle against an AABB.
 *
 * @returns {{hit:boolean, nx:number, ny:number, depth:number, px:number, py:number}}
 *   `nx,ny` is a unit normal pointing from the box toward the circle; `depth` is
 *   how far the circle must move along it to be exactly touching.
 *   `px,py` is the closest point on the box (useful for scoring the impact).
 *   A miss reports `hit:false` with a zero normal and zero depth.
 */
export function resolveCircleAABB(c, box) {
  const p = closestPointOnAABB(c.x, c.y, box);
  const px = p.x;
  const py = p.y;
  const dx = c.x - px;
  const dy = c.y - py;
  const d2 = dx * dx + dy * dy;

  if (d2 > c.r * c.r) {
    return { hit: false, nx: 0, ny: 0, depth: 0, px, py };
  }

  const inside = c.x > box.x && c.x < box.x + box.w && c.y > box.y && c.y < box.y + box.h;
  if (inside) {
    // Escape through the nearest face: the smallest of the four gaps wins.
    const leftGap = c.x - box.x;
    const rightGap = box.x + box.w - c.x;
    const topGap = c.y - box.y;
    const bottomGap = box.y + box.h - c.y;
    const m = Math.min(leftGap, rightGap, topGap, bottomGap);
    if (m === leftGap) return { hit: true, nx: -1, ny: 0, depth: c.r + leftGap, px: box.x, py: c.y };
    if (m === rightGap) return { hit: true, nx: 1, ny: 0, depth: c.r + rightGap, px: box.x + box.w, py: c.y };
    if (m === topGap) return { hit: true, nx: 0, ny: -1, depth: c.r + topGap, px: c.x, py: box.y };
    return { hit: true, nx: 0, ny: 1, depth: c.r + bottomGap, px: c.x, py: box.y + box.h };
  }

  const d = Math.sqrt(d2);
  if (d < 1e-9) return { hit: true, nx: 0, ny: -1, depth: c.r, px, py };
  return { hit: true, nx: dx / d, ny: dy / d, depth: c.r - d, px, py };
}

/**
 * Full bounce: eject the circle from the box, then reflect its velocity.
 * @returns {{hit:boolean, nx:number, ny:number, depth:number, vx:number, vy:number}}
 *   The velocity is returned rather than written, so the caller stays in charge
 *   of the object and tests can assert on a pure return value.
 */
export function bounceCircleAABB(c, box, v, restitution = 1) {
  const res = resolveCircleAABB(c, box);
  if (!res.hit) return { hit: false, nx: 0, ny: 0, depth: 0, vx: v.x, vy: v.y };
  const e = Math.max(0, Math.min(1, restitution));
  const d = 2 * (v.x * res.nx + v.y * res.ny);
  return {
    hit: true,
    nx: res.nx,
    ny: res.ny,
    depth: res.depth,
    vx: (v.x - d * res.nx) * e,
    vy: (v.y - d * res.ny) * e,
  };
}

/**
 * Swept circle against an AABB. Used by fast projectiles so they cannot skip
 * a thin wall between frames. Returns the impact point or null.
 */
export function sweepCircleAABB(x0, y0, x1, y1, radius, box) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / Math.max(1, radius)));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (intersectCircleAABB({ x, y, r: radius }, box)) return { x, y, t };
  }
  return null;
}

/**
 * Uniform grid for broad-phase. Bins objects by their center cell plus any
 * cells an oversized object spans, so a wide brick still registers.
 */
export function makeSpatialHash(cols, rows, w, h) {
  const cellW = w / cols;
  const cellH = h / rows;
  return {
    cols,
    rows,
    cellW,
    cellH,
    clear() {
      for (const k of Object.keys(this.cells || {})) delete this.cells[k];
    },
    cells: {},
    /** Range of column indices an object at (x,y) with radius r spans. */
    colRange(x, r) {
      const a = Math.floor((x - r) / cellW);
      const b = Math.floor((x + r) / cellW);
      return [Math.max(0, Math.min(cols - 1, a)), Math.max(0, Math.min(cols - 1, b))];
    },
    rowRange(y, r) {
      const a = Math.floor((y - r) / cellH);
      const b = Math.floor((y + r) / cellH);
      return [Math.max(0, Math.min(rows - 1, a)), Math.max(0, Math.min(rows - 1, b))];
    },
    insert(obj, x, y, r) {
      const [c0, c1] = this.colRange(x, r);
      const [r0, r1] = this.rowRange(y, r);
      for (let c = c0; c <= c1; c += 1) {
        for (let rr = r0; rr <= r1; rr += 1) {
          const key = c + ':' + rr;
          if (!this.cells[key]) this.cells[key] = [];
          this.cells[key].push(obj);
        }
      }
    },
    /** Every object whose bins overlap the query circle, without duplicates. */
    query(x, y, r) {
      const out = [];
      const seen = new Set();
      const [c0, c1] = this.colRange(x, r);
      const [r0, r1] = this.rowRange(y, r);
      for (let c = c0; c <= c1; c += 1) {
        for (let rr = r0; rr <= r1; rr += 1) {
          const bucket = this.cells[c + ':' + rr];
          if (!bucket) continue;
          for (const o of bucket) {
            if (seen.has(o)) continue;
            seen.add(o);
            out.push(o);
          }
        }
      }
      return out;
    },
  };
}
