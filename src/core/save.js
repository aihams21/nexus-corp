// Persistence layer: versioned localStorage save, offline accrual math,
// JSON export/import, and the 5-second autosave driver.

export const SAVE_KEY = 'nexus_corp_opsdeck_v2';
export const SAVE_VERSION = 2;

export const AUTOSAVE_MS = 5000;
export const OFFLINE_CAP_SECONDS = 8 * 3600;
export const OFFLINE_EFFICIENCY = 0.5;

/**
 * Offline passive income. A capped, half-efficiency window so leaving the
 * tab overnight is good but never a runaway faucet.
 * @returns {{earned:number, usedSeconds:number, wasCapped:boolean, realSeconds:number}}
 */
export function computeOfflineEarnings(rate, elapsedSeconds, cap = OFFLINE_CAP_SECONDS, efficiency = OFFLINE_EFFICIENCY) {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 0;
  let real = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : 0;
  const used = Math.min(real, cap);
  const earned = safeRate * used * efficiency;
  return {
    earned,
    usedSeconds: used,
    wasCapped: real > cap,
    realSeconds: real,
  };
}

function now() {
  return Date.now();
}

function storage() {
  try {
    return window.localStorage;
  } catch (_) {
    return null;
  }
}

/** Serialize a state snapshot with the envelope fields the loader needs. */
export function pack(state) {
  return {
    v: SAVE_VERSION,
    at: now(),
    data: state,
  };
}

/** Write a snapshot. Returns false when storage is unavailable or throws. */
export function saveRaw(state) {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(pack(state)));
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Read the envelope. Never throws: a missing or corrupt slot reports `fresh`.
 * @returns {{state:object|null, savedAt:number, version:number, fresh:boolean}}
 */
export function loadRaw() {
  const store = storage();
  if (!store) return { state: null, savedAt: 0, version: 0, fresh: true };
  let text = null;
  try {
    text = store.getItem(SAVE_KEY);
  } catch (_) {
    return { state: null, savedAt: 0, version: 0, fresh: true };
  }
  if (!text) return { state: null, savedAt: 0, version: 0, fresh: true };
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    return { state: null, savedAt: 0, version: 0, fresh: true };
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.data !== 'object' || parsed.data === null) {
    return { state: null, savedAt: 0, version: 0, fresh: true };
  }
  return {
    state: parsed.data,
    savedAt: Number(parsed.at) || 0,
    version: Number(parsed.v) || 0,
    fresh: false,
  };
}

/** Seconds between the stored timestamp and now, never negative. */
export function elapsedSince(savedAt) {
  if (!Number.isFinite(savedAt) || savedAt <= 0) return 0;
  return Math.max(0, (now() - savedAt) / 1000);
}

/** Player-facing save string. Wrapped in a marker so imports are obvious. */
export function exportSave(state) {
  return JSON.stringify({ nexus: 'opsdeck', v: SAVE_VERSION, at: now(), data: state });
}

/** Parse a save string. Throws Error with a readable message when invalid. */
export function importSave(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('EMPTY');
  }
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    throw new Error('PARSE');
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('SHAPE');
  const body = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
  if (body === null || Array.isArray(body)) throw new Error('SHAPE');
  if (typeof body.cash !== 'number' || !Number.isFinite(body.cash)) throw new Error('SHAPE');
  return body;
}

/** Remove the save slot entirely. */
export function clearSave() {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(SAVE_KEY);
    return true;
  } catch (_) {
    return false;
  }
}

/** Whether a save slot currently exists (without parsing it). */
export function hasSave() {
  const store = storage();
  if (!store) return false;
  try {
    return !!store.getItem(SAVE_KEY);
  } catch (_) {
    return false;
  }
}

/**
 * Run a save every `ms`. Returns a handle with `stop()`; calling stop more
 * than once is safe and never leaves the interval armed.
 */
export function startAutosave(ms, getState, onSaved) {
  const period = Number.isFinite(ms) && ms >= 500 ? ms : AUTOSAVE_MS;
  let timer = null;
  let stopped = false;

  const fire = () => {
    const state = typeof getState === 'function' ? getState() : null;
    if (!state) return false;
    const ok = saveRaw(state);
    if (ok && typeof onSaved === 'function') onSaved(state);
    return ok;
  };

  timer = window.setInterval(fire, period);

  return {
    period,
    fire,
    get running() { return !stopped; },
    stop() {
      if (stopped) return;
      stopped = true;
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    },
  };
}

/** System-panel snapshot: when it was written, which version, what it holds. */
export function describeSave(state) {
  const loaded = loadRaw();
  return {
    savedAt: loaded.savedAt,
    version: loaded.version || SAVE_VERSION,
    fresh: loaded.fresh,
    runs: Number(state && state.gamesPlayed) || 0,
    points: Number(state && state.totalScoreAllTime) || 0,
  };
}
