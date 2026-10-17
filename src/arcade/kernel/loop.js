// Per-game lifecycle: the listener bag, the timer bag, and the thin wrapper
// that gives a game a frame callback without ever owning a requestAnimationFrame.
//
// The single rAF in the whole app lives in the machine (../machine.js) and calls
// into here. That is what guarantees switching games or leaving the cabinet
// cancels every callback and every listener.

import { MAX_DT, FAST_SPEED, SUB_STEPS, createLoop, needsSubStep, stepClamped, integrate } from '../../core/engine.js';

export { MAX_DT, FAST_SPEED, SUB_STEPS, createLoop, needsSubStep, stepClamped, integrate };

/** Every DOM listener a game registers goes through a bag so teardown is total. */
export class ListenerBag {
  constructor() {
    this.entries = [];
  }

  add(target, type, fn, options) {
    if (!target || typeof target.addEventListener !== 'function' || typeof fn !== 'function') return fn;
    target.addEventListener(type, fn, options);
    this.entries.push({ target, type, fn, options });
    return fn;
  }

  /** Convenience for the window keyboard maps games use constantly. */
  onKey(fn, options) {
    return this.add(window, 'keydown', fn, options);
  }

  onKeyUp(fn, options) {
    return this.add(window, 'keyup', fn, options);
  }

  onResize(fn) {
    return this.add(window, 'resize', fn);
  }

  remove(target, type, fn, options) {
    const i = this.entries.findIndex((e) => e.target === target && e.type === type && e.fn === fn && e.options === options);
    if (i < 0) return false;
    const [entry] = this.entries.splice(i, 1);
    try {
      entry.target.removeEventListener(entry.type, entry.fn, entry.options);
    } catch (_) {
      /* a detached node is fine to skip */
    }
    return true;
  }

  get size() {
    return this.entries.length;
  }

  clear() {
    const entries = this.entries;
    this.entries = [];
    for (const e of entries) {
      try {
        e.target.removeEventListener(e.type, e.fn, e.options);
      } catch (_) {
        /* ignore */
      }
    }
    return entries.length;
  }
}

/** setTimeout / setInterval / rAF handles that a game forgets to clear. */
export class Timers {
  constructor() {
    this.timeouts = [];
    this.intervals = [];
    this.frames = [];
  }

  after(ms, fn) {
    const id = window.setTimeout(() => {
      const i = this.timeouts.indexOf(id);
      if (i >= 0) this.timeouts.splice(i, 1);
      fn();
    }, Math.max(0, ms));
    this.timeouts.push(id);
    return id;
  }

  every(ms, fn) {
    const period = Math.max(1, ms);
    const id = window.setInterval(fn, period);
    this.intervals.push(id);
    return id;
  }

  frame(fn) {
    const id = window.requestAnimationFrame(fn);
    this.frames.push(id);
    return id;
  }

  clearTimeoutSafe(id) {
    const i = this.timeouts.indexOf(id);
    if (i >= 0) this.timeouts.splice(i, 1);
    window.clearTimeout(id);
  }

  get size() {
    return this.timeouts.length + this.intervals.length + this.frames.length;
  }

  clear() {
    for (const id of this.timeouts) window.clearTimeout(id);
    for (const id of this.intervals) window.clearInterval(id);
    for (const id of this.frames) window.cancelAnimationFrame(id);
    const n = this.size;
    this.timeouts.length = 0;
    this.intervals.length = 0;
    this.frames.length = 0;
    return n;
  }
}
