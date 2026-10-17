/**
 * Frame driver.
 *
 * Two invariants from the spec are enforced here, once, for every game:
 *
 *   1. `dt = Math.min(raw, 0.033)` — a lag spike or a backgrounded tab can
 *      never hand a body a huge step and teleport it through a wall.
 *   2. Anything whose speed exceeds FAST_SPEED is integrated in SUB_STEPS
 *      smaller steps, each one clamped to the play field, so a fast body is
 *      tested against walls at the intermediate positions too.
 */

import { clamp } from './math.js';

export const MAX_DT = 0.033;
export const FAST_SPEED = 400;
export const SUB_STEPS = 4;

/**
 * Create a frame loop.
 * @param {(dt:number, elapsed:number)=>void} update  runs at fixed-clamped dt
 * @param {(alpha:number)=>void} [draw]               optional render callback
 * @returns {{start:Function, stop:Function, running:()=>boolean, frames:()=>number}}
 */
export function createLoop(update, draw) {
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let frames = 0;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const raw = last ? (now - last) / 1000 : 0;
    last = now;
    const dt = Math.min(raw, MAX_DT);
    elapsed += dt;
    frames++;
    update(dt, elapsed);
    if (draw) draw(clamp(raw / MAX_DT, 0, 1));
  };

  return {
    start() {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    },
    running: () => raf !== 0,
    frames: () => frames,
  };
}

/**
 * Does a body with this velocity need sub-stepping this frame?
 * Threshold is 400 px/s on either axis.
 */
export function needsSubStep(vx, vy) {
  return Math.abs(vx) > FAST_SPEED || Math.abs(vy) > FAST_SPEED;
}

/**
 * Integrate one axis with continuous boundary clamping.
 * @param {number} p  current position
 * @param {number} v  velocity (units per second)
 * @param {number} dt seconds
 * @param {number} lo lower bound (radius)
 * @param {number} hi upper bound (width - radius)
 */
export function stepClamped(p, v, dt, lo, hi) {
  return clamp(p + v * dt, lo, hi);
}

/**
 * Run `fn` once per frame, or `SUB_STEPS` times with `dt/SUB_STEPS` when the
 * body is fast. Each sub-step receives its own clamped dt so the total
 * integrated time still equals the frame dt.
 *
 * @param {number} dt frame delta, already clamped to MAX_DT
 * @param {number} vx velocity x
 * @param {number} vy velocity y
 * @param {(subDt:number)=>void} fn
 */
export function integrate(dt, vx, vy, fn) {
  if (!needsSubStep(vx, vy)) {
    fn(dt);
    return 1;
  }
  const sub = dt / SUB_STEPS;
  for (let i = 0; i < SUB_STEPS; i++) fn(sub);
  return SUB_STEPS;
}