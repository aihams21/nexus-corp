// IPO / Going Public — the prestige loop. Reset the company, keep Executive
// Shares, and every share is +10% permanent on all future income and all
// future arcade rewards.

import { netWorth } from './ledger.js';

export const IPO_MIN_WORTH = 1e6;
export const IPO_SHARE_STEP = 1.6;
export const IPO_SHARE_PERCENT = 0.1;

/** Shares awarded for liquidating a company worth `worth`. */
export function sharesFor(worth) {
  const w = Number.isFinite(worth) && worth > 0 ? worth : 0;
  return Math.max(0, Math.floor(Math.sqrt(w / IPO_MIN_WORTH) * IPO_SHARE_STEP));
}

/** Permanent global multiplier from the share count. */
export function sharesMult(shares) {
  const n = Math.max(0, Math.floor(Number(shares) || 0));
  return 1 + n * IPO_SHARE_PERCENT;
}

/** Net worth needed for one more share than you currently hold. */
export function nextShareWorth(shares) {
  const have = Math.max(0, Math.floor(Number(shares) || 0));
  const target = have + 1;
  const need = Math.ceil(Math.pow(target / IPO_SHARE_STEP, 2) * IPO_MIN_WORTH);
  return Math.max(IPO_MIN_WORTH, need);
}

/**
 * Everything the IPO panel needs, without mutating anything.
 * @returns {{worth:number, ok:boolean, reason:string, gain:number, shares:number, mult:number, nextAt:number}}
 */
export function ipoPreview(state) {
  const worth = netWorth(state);
  const shares = Math.max(0, Math.floor(Number(state && state.shares) || 0));
  const gain = sharesFor(worth);
  const ok = worth >= IPO_MIN_WORTH && gain > 0;
  let reason = 'ready';
  if (worth < IPO_MIN_WORTH) reason = 'worth';
  else if (gain <= 0) reason = 'gain';
  return {
    worth,
    ok,
    reason,
    gain,
    shares,
    mult: sharesMult(shares + (ok ? gain : 0)),
    nextAt: nextShareWorth(shares + (ok ? gain : 0)),
  };
}

/**
 * Liquidate: mint shares, then wipe everything that is not permanent.
 * @returns {{ok:boolean, reason:string, gain:number, shares:number}}
 */
export function doIpo(state) {
  const pv = ipoPreview(state);
  if (!pv.ok) return { ok: false, reason: pv.reason, gain: 0, shares: Math.floor(Number(state.shares) || 0) };

  const gained = pv.gain;
  const totalShares = Math.floor(Number(state.shares) || 0) + gained;

  state.shares = totalShares;
  state.prestigeCount = (Number(state.prestigeCount) || 0) + 1;

  state.cash = 0;
  state.clickTotal = 0;
  state.deptLevels = {};
  state.gearLevels = {};
  state.hired = {};
  state.combo = 0;
  state.comboUntil = 0;
  state.overclockUntil = 0;

  return { ok: true, reason: 'listed', gain: gained, shares: totalShares };
}
