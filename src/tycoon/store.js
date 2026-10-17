// The live company: one mutable state object, a normalization pass for loaded
// saves, the passive-income tick, and the executive autobuyers.

import { emit, TOPIC } from '../core/bus.js';
import { computeOfflineEarnings, OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY } from '../core/save.js';
import { DEFAULT_LANG } from '../core/strings.js';
import {
  buyDept, comboCount, decayCombo, deptCost, doHit, incomePerSec, netWorth, overclockLeft,
} from './ledger.js';
import { autoDepartments, hasAutoGear, hasAutoHit } from './execs.js';
import { buyGear, GEAR, gearCost, gearIsMaxed } from './gear.js';

const AUTO_DEPT_MS = 260;
const AUTO_GEAR_MS = 640;
const AUTO_HIT_MS = 220;

export function defaultState() {
  return {
    cash: 0,
    clickTotal: 0,
    deptLevels: {},
    gearLevels: {},
    hired: {},
    shares: 0,
    prestigeCount: 0,
    overclockUntil: 0,
    combo: 0,
    comboUntil: 0,
    totalScoreAllTime: 0,
    gameBest: {},
    gamesPlayed: {},
    lastTick: Date.now(),
    lang: DEFAULT_LANG,
    sfxOn: true,
    musOn: false,
    seenWelcome: false,
    createdAt: Date.now(),
  };
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function levelMap(v) {
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of Object.keys(v)) {
      const n = num(v[k], 0);
      if (n > 0) out[k] = Math.floor(n);
    }
  }
  return out;
}

function bestMap(v) {
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of Object.keys(v)) {
      const n = num(v[k], 0);
      if (n > 0) out[k] = Math.floor(n);
    }
  }
  return out;
}

function hiredMap(v) {
  const out = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of Object.keys(v)) if (v[k] === true) out[k] = true;
  }
  return out;
}

/**
 * Fold an untrusted save payload into a valid state. Missing fields take the
 * default, impossible values are clamped, and nothing here can throw.
 */
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  return {
    cash: Math.max(0, num(raw.cash, 0)),
    clickTotal: Math.max(0, num(raw.clickTotal, 0)),
    deptLevels: levelMap(raw.deptLevels),
    gearLevels: levelMap(raw.gearLevels),
    hired: hiredMap(raw.hired),
    shares: Math.max(0, Math.floor(num(raw.shares, 0))),
    prestigeCount: Math.max(0, Math.floor(num(raw.prestigeCount, 0))),
    overclockUntil: Math.max(0, num(raw.overclockUntil, 0)),
    combo: Math.max(0, Math.floor(num(raw.combo, 0))),
    comboUntil: Math.max(0, num(raw.comboUntil, 0)),
    totalScoreAllTime: Math.max(0, Math.floor(num(raw.totalScoreAllTime, 0))),
    gameBest: bestMap(raw.gameBest),
    gamesPlayed: levelMap(raw.gamesPlayed),
    lastTick: Math.max(0, num(raw.lastTick, Date.now())),
    lang: raw.lang === 'en' || raw.lang === 'ar' ? raw.lang : DEFAULT_LANG,
    sfxOn: raw.sfxOn !== false,
    musOn: raw.musOn === true,
    seenWelcome: raw.seenWelcome === true,
    createdAt: Math.max(0, num(raw.createdAt, Date.now())),
  };
}

/** Detached copy suitable for saving. */
export function snapshot(state) {
  return JSON.parse(JSON.stringify({
    cash: state.cash,
    clickTotal: state.clickTotal,
    deptLevels: state.deptLevels,
    gearLevels: state.gearLevels,
    hired: state.hired,
    shares: state.shares,
    prestigeCount: state.prestigeCount,
    overclockUntil: state.overclockUntil,
    combo: state.combo,
    comboUntil: state.comboUntil,
    totalScoreAllTime: state.totalScoreAllTime,
    gameBest: state.gameBest,
    gamesPlayed: state.gamesPlayed,
    lastTick: state.lastTick,
    lang: state.lang,
    sfxOn: state.sfxOn,
    musOn: state.musOn,
    seenWelcome: state.seenWelcome,
    createdAt: state.createdAt,
  }));
}

export function createStore() {
  const state = normalize(null);
  const subs = new Set();
  let deptClock = 0;
  let gearClock = 0;
  let hitClock = 0;
  let dirty = false;

  function notify(reason) {
    for (const fn of Array.from(subs)) {
      try {
        fn(state, reason);
      } catch (err) {
        // A broken view must never stop the game clock.
        console.error('[store] subscriber threw', err);
      }
    }
  }

  return {
    state,

    subscribe(fn) {
      if (typeof fn !== 'function') return () => {};
      subs.add(fn);
      return () => subs.delete(fn);
    },

    /** Replace the whole state from an untrusted payload. */
    hydrate(raw) {
      const next = normalize(raw);
      Object.keys(state).forEach((k) => { delete state[k]; });
      Object.assign(state, next);
      deptClock = 0;
      gearClock = 0;
      hitClock = 0;
      dirty = false;
      notify('hydrate');
      return state;
    },

    /** Wipe back to a brand-new company. */
    reset() {
      return this.hydrate(null);
    },

    markDirty() {
      dirty = true;
    },

    get dirty() {
      return dirty;
    },

    /** Register a manual hit and broadcast it. */
    hit(t) {
      const res = doHit(state, t);
      dirty = true;
      emit(TOPIC.CASH, res);
      emit(TOPIC.COMBO, { combo: res.combo, mult: res.mult });
      notify('hit');
      return res;
    },

    /** Spend cash on a department. Broadcasts the outcome. */
    buy(id) {
      const res = buyDept(state, id);
      dirty = true;
      if (res.ok) emit(TOPIC.DEPT, { id, ...res });
      notify('dept');
      return res;
    },

    /**
     * Advance the company clock: passive income, combo decay, autobuyers.
     * @param {number} dt  seconds, already clamped by the loop
     * @param {number} t   epoch ms
     */
    tick(dt, t) {
      const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
      if (step <= 0) return;

      const rate = incomePerSec(state, t);
      if (rate > 0) {
        state.cash += rate * step;
        dirty = true;
      }

      if (decayCombo(state, t)) {
        emit(TOPIC.COMBO, { combo: comboCount(state), mult: 1 });
        dirty = true;
      }

      deptClock += step;
      if (deptClock >= AUTO_DEPT_MS) {
        deptClock = 0;
        const owned = autoDepartments(state);
        if (owned.length) {
          for (const id of owned) {
            const cost = deptCost(state, id);
            if (Number(state.cash) >= cost) {
              buyDept(state, id);
              dirty = true;
            }
          }
        }
      }

      gearClock += step;
      if (gearClock >= AUTO_GEAR_MS) {
        gearClock = 0;
        if (hasAutoGear(state)) {
          let bestId = null;
          let bestCost = Infinity;
          for (const g of GEAR) {
            if (gearIsMaxed(state, g.id)) continue;
            const c = gearCost(state, g.id);
            if (c < bestCost) {
              bestCost = c;
              bestId = g.id;
            }
          }
          if (bestId !== null && Number(state.cash) >= bestCost) {
            buyGear(state, bestId);
            dirty = true;
          }
        }
      }

      hitClock += step;
      if (hitClock >= AUTO_HIT_MS) {
        hitClock = 0;
        if (hasAutoHit(state)) {
          doHit(state, t);
          dirty = true;
        }
      }

      state.lastTick = t;
    },

    /** Snapshot for the autosave writer. */
    save() {
      dirty = false;
      return snapshot(state);
    },

    /**
     * Bank what the company earned while the tab was closed. Capped at 8h and
     * credited at 50% efficiency, exactly like the welcome-back contract.
     * @returns {{earned:number, usedSeconds:number, wasCapped:boolean, realSeconds:number, rate:number}}
     */
    applyOffline(elapsedSeconds, rate, t) {
      const now = Number.isFinite(t) ? t : Date.now();
      const perSec = Number.isFinite(rate) ? rate : incomePerSec(state, now);
      const report = computeOfflineEarnings(perSec, elapsedSeconds, OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY);
      if (report.earned > 0) {
        state.cash += report.earned;
        dirty = true;
      }
      state.lastTick = now;
      emit(TOPIC.CASH, { gain: report.earned, source: 'offline' });
      notify('offline');
      return { ...report, rate: perSec };
    },

    /** Derived numbers the HUD shows. */
    read() {
      const now = Date.now();
      return {
        cash: state.cash,
        worth: netWorth(state),
        income: incomePerSec(state, now),
        combo: comboCount(state),
        overclockLeft: overclockLeft(state, now),
        dirty,
      };
    },
  };
}

export const store = createStore();
export const S = store.state;
export default store;
