/**
 * Minimal synchronous event bus. One instance is shared by the whole app;
 * modules publish domain events instead of importing each other's internals.
 */

const listeners = new Map();

export function on(topic, fn) {
  let set = listeners.get(topic);
  if (!set) listeners.set(topic, (set = new Set()));
  set.add(fn);
  return () => off(topic, fn);
}

export function off(topic, fn) {
  const set = listeners.get(topic);
  if (set) {
    set.delete(fn);
    if (!set.size) listeners.delete(topic);
  }
}

export function emit(topic, payload) {
  const set = listeners.get(topic);
  if (!set) return;
  // Copy so a handler may unsubscribe during dispatch.
  for (const fn of Array.from(set)) {
    try {
      fn(payload);
    } catch (err) {
      console.error(`[bus] handler for "${topic}" threw`, err);
    }
  }
}

export function clearAll() {
  listeners.clear();
}

/** Canonical topics, so typos surface as unused constants instead of silence. */
export const TOPIC = {
  CASH: 'cash',
  GAUGE: 'gauge',
  DEPT: 'dept',
  GEAR: 'gear',
  EXEC: 'exec',
  IPO: 'ipo',
  COMBO: 'combo',
  OVERCLOCK: 'overclock',
  SCORE: 'score',
  CABINET: 'cabinet',
  TOAST: 'toast',
  LANG: 'lang',
  SAVE: 'save',
};