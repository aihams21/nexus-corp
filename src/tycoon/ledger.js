// The ledger: department data plus every pure money calculation in the game.
// Nothing here touches the DOM; the store in ./store.js drives it.

import { clamp } from '../core/math.js';
import { costAt, GROWTH } from '../core/money.js';
import { gearClickMult } from './gear.js';

export const CLICK_BASE = 1;
export const COMBO_WINDOW_MS = 1400;
export const COMBO_MAX = 25;
export const COMBO_STEP = 0.2;
export const ARCADE_RATE = 0.5;
export const OVERCLOCK_MS = 5 * 60 * 1000;
export const MILESTONES = [10, 25, 50, 100, 200];

/**
 * Ten passive departments. `base` seeds the cost curve, `per` is the $/sec
 * contribution of one level before milestones.
 */
export const DEPTS = [
  { id: 'garage',    base: 15,    per: 0.6,   ic: '⌂', gate: 0,       name: { ar: 'فرسان المرآب',      en: 'Garage Freelancer' },          desc: { ar: 'شخص واحد يشتغل من غرفته ويبيع شغله.', en: 'One operator, one room, selling craft.' } },
  { id: 'agency',    base: 120,   per: 3.2,   ic: '⌸', gate: 900,     name: { ar: 'وكالة ويب مستقلة', en: 'Indie Web Agency' },            desc: { ar: 'فريق صغير يبني مواقع لعميلين.', en: 'A small crew building sites.' } },
  { id: 'mobile',    base: 900,   per: 17,    ic: '▤', gate: 7000,    name: { ar: 'استوديو تطبيقات',  en: 'Mobile App Studio' },           desc: { ar: 'تطبيقات جوال تُحمّل آلاف المرات.', en: 'Apps that download by the thousands.' } },
  { id: 'saas',      base: 6800,  per: 96,    ic: '☁', gate: 52000,   name: { ar: 'منصة سحابية',      en: 'SaaS Cloud Platform' },         desc: { ar: 'اشتراكات تتكرر كل شهر بلا انقطاع.', en: 'Subscriptions that keep billing.' } },
  { id: 'cyber',     base: 52000, per: 540,   ic: '⛨', gate: 380000,  name: { ar: 'قسم الأمن السيبراني', en: 'Cybersecurity Division' },    desc: { ar: 'تحمي شبكات العملاء مقابل عقد.', en: 'Protecting client networks, by contract.' } },
  { id: 'ailab',     base: 390000, per: 3100, ic: '⚗', gate: 2.6e6,   name: { ar: 'مختبر أبحاث ذكي',  en: 'AI Research Lab' },              desc: { ar: 'نماذج تتعلم من كل ما يمر بها.', en: 'Models that learn from everything.' } },
  { id: 'quantum',   base: 2.9e6, per: 18000, ic: '◈', gate: 1.8e7,   name: { ar: 'منأة الحوسبة الكمية', en: 'Quantum Computing Facility' }, desc: { ar: 'حسابات لا تعبأ بالأسواق.', en: 'Computation that does not care about markets.' } },
  { id: 'robotics',  base: 2.2e7, per: 105000, ic: '⛭', gate: 1.1e8,  name: { ar: 'مصنع الروبوتات',   en: 'Autonomous Robotics Plant' },    desc: { ar: 'آلات تصنع المصنع وصيانتها وحدها.', en: 'Machines that maintain themselves.' } },
  { id: 'orbital',   base: 1.6e8, per: 620000, ic: '◉', gate: 6.5e8,  name: { ar: 'شبكة أقمار صناعية', en: 'Orbital Satellite Network' },  desc: { ar: 'نطاق يحيط بالكرة الأرضية.', en: 'Coverage that wraps the planet.' } },
  { id: 'singularity', base: 1.2e9, per: 3.6e6, ic: '✳', gate: 4.2e9, name: { ar: 'التفرد العصبي العالمي', en: 'Global Neural Singularity' }, desc: { ar: 'الشركة نفسها أصبحت مستقلة.', en: 'The company runs itself.' } },
];

export const DEPT_IDS = DEPTS.map((d) => d.id);

export function deptById(id) {
  return DEPTS.find((d) => d.id === id) || null;
}

export function deptLevel(state, id) {
  const map = state && state.deptLevels ? state.deptLevels : {};
  const n = Number(map[id]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** How many milestone tiers a given level has crossed. */
export function milestoneTiers(level) {
  const lv = Math.max(0, Math.floor(level));
  let tiers = 0;
  for (const m of MILESTONES) if (lv >= m) tiers += 1;
  return tiers;
}

/** 2× at each of 10 / 25 / 50 / 100 / 200, compounding. */
export function milestoneMult(level) {
  return Math.pow(2, milestoneTiers(level));
}

/** The next milestone this level has not crossed yet, or null. */
export function nextMilestone(level) {
  const lv = Math.max(0, Math.floor(level));
  for (const m of MILESTONES) if (lv < m) return m;
  return null;
}

/** Progress in [0,1] toward the next milestone. */
export function milestoneProgress(level) {
  const lv = Math.max(0, Math.floor(level));
  const target = nextMilestone(lv);
  if (target === null) return 1;
  let prev = 0;
  for (const m of MILESTONES) {
    if (m > lv) {
      return clamp((lv - prev) / (m - prev), 0, 1);
    }
    prev = m;
  }
  return 1;
}

export function deptCost(state, id) {
  const d = deptById(id);
  if (!d) return Infinity;
  return costAt(d.base, deptLevel(state, id), GROWTH);
}

/** $/sec from one department, milestone multiplier applied. */
export function deptOutput(state, id) {
  const d = deptById(id);
  if (!d) return 0;
  const lv = deptLevel(state, id);
  if (lv <= 0) return 0;
  return d.per * lv * milestoneMult(lv);
}

/** Sum of every department's $/sec. */
export function flowRate(state) {
  let sum = 0;
  for (const d of DEPTS) sum += deptOutput(state, d.id);
  return sum;
}

/** Cash-equivalent value of one department level, for net worth. */
export function deptWorth(state, id) {
  const d = deptById(id);
  if (!d) return 0;
  return d.base * deptLevel(state, id);
}

/** Total net worth: liquid cash plus the embedded value of the org chart. */
export function netWorth(state) {
  let sum = Number(state && state.cash) || 0;
  for (const d of DEPTS) sum += deptWorth(state, d.id);
  return sum;
}

/** Raw passive income before any multiplier. */
export function baseFlow(state) {
  return flowRate(state);
}

/** Overclock tier from the highest milestone reached anywhere: 2× … 5×. */
export function overclockFactor(state) {
  let tiers = 0;
  for (const d of DEPTS) {
    const t = milestoneTiers(deptLevel(state, d.id));
    if (t > tiers) tiers = t;
  }
  return clamp(2 + Math.max(0, tiers - 1), 2, 5);
}

/** Remaining overclock in ms, 0 when inactive. */
export function overclockLeft(state, t) {
  const now = Number.isFinite(t) ? t : Date.now();
  const until = Number(state && state.overclockUntil) || 0;
  return Math.max(0, until - now);
}

export function overclockActive(state, t) {
  return overclockLeft(state, t) > 0;
}

/** Global production multiplier: gear click power is the only flat mult, then
 *  IPO shares (+10% each) and the temporary overclock window. */
export function prodMult(state, t) {
  const shares = Number(state && state.shares) || 0;
  const oc = overclockActive(state, t) ? overclockFactor(state) : 1;
  return (1 + shares * 0.1) * oc;
}

/** Passive income actually banked per second right now. */
export function incomePerSec(state, t) {
  return baseFlow(state) * prodMult(state, t);
}

/** Click power: base × the whole gear rack × IPO shares. Combo is separate. */
export function hitValue(state) {
  const shares = Number(state && state.shares) || 0;
  return CLICK_BASE * gearClickMult(state) * (1 + shares * 0.1);
}

/** Current combo multiplier, decaying to 1 when the window lapses. */
export function comboMult(state, t) {
  const now = Number.isFinite(t) ? t : Date.now();
  const until = Number(state && state.comboUntil) || 0;
  if (now >= until) return 1;
  return 1 + Math.min(COMBO_MAX - 1, Math.floor((Number(state && state.combo) || 0) * COMBO_STEP));
}

export function comboCount(state) {
  return Math.max(0, Math.floor(Number(state && state.combo) || 0));
}

/**
 * Register one manual hit. Advances the combo, returns the gain.
 * @returns {{gain:number, combo:number, mult:number}}
 */
export function doHit(state, t) {
  const now = Number.isFinite(t) ? t : Date.now();
  state.combo = comboCount(state) + 1;
  if (state.combo > COMBO_MAX) state.combo = COMBO_MAX;
  state.comboUntil = now + COMBO_WINDOW_MS;
  const mult = comboMult(state, now);
  const gain = hitValue(state) * mult;
  state.cash = (Number(state.cash) || 0) + gain;
  state.clickTotal = (Number(state.clickTotal) || 0) + 1;
  return { gain, combo: state.combo, mult };
}

/** Clear the combo when its window expires. */
export function decayCombo(state, t) {
  const now = Number.isFinite(t) ? t : Date.now();
  if ((Number(state && state.combo) || 0) > 0 && now >= (Number(state.comboUntil) || 0)) {
    state.combo = 0;
    state.comboUntil = 0;
    return true;
  }
  return false;
}

/** A department is available once the org can afford its first level. */
export function deptUnlocked(state, id) {
  const d = deptById(id);
  if (!d) return false;
  if (deptLevel(state, id) > 0) return true;
  return (Number(state && state.cash) || 0) >= d.base;
}

/**
 * Buy one level of a department.
 * @returns {{ok:boolean, reason:string, cost:number, level:number}}
 */
export function buyDept(state, id) {
  const d = deptById(id);
  if (!d) return { ok: false, reason: 'unknown', cost: 0, level: 0 };
  const level = deptLevel(state, id);
  const cost = deptCost(state, id);
  const cash = Number(state.cash) || 0;
  if (cash + 1e-9 < cost) return { ok: false, reason: 'funds', cost, level };
  state.cash = cash - cost;
  state.deptLevels[id] = level + 1;
  return { ok: true, reason: 'bought', cost, level: level + 1 };
}

/**
 * Buy the cheapest affordable department repeatedly, up to `maxBuys`.
 * This is what an executive autobuyer runs.
 * @returns {{bought:number, spent:number, lastMilestone:string|null}}
 */
export function autoBuy(state, maxBuys = 1) {
  let bought = 0;
  let spent = 0;
  let lastMilestone = null;
  const limit = Math.max(0, Math.min(200, Math.floor(maxBuys) || 0));
  for (let i = 0; i < limit; i += 1) {
    let bestId = null;
    let bestCost = Infinity;
    for (const d of DEPTS) {
      const c = deptCost(state, d.id);
      if (c < bestCost) {
        bestCost = c;
        bestId = d.id;
      }
    }
    if (bestId === null) break;
    const before = deptLevel(state, bestId);
    const res = buyDept(state, bestId);
    if (!res.ok) break;
    bought += 1;
    spent += res.cost;
    const ms = nextMilestone(before);
    if (ms !== null && res.level === ms) lastMilestone = `${bestId}:${ms}`;
  }
  return { bought, spent, lastMilestone };
}

/** Convert an arcade score into cash using the current production multiplier. */
export function scoreToCash(score, state, t) {
  const s = Math.max(0, Math.floor(Number(score) || 0));
  return s * ARCADE_RATE * prodMult(state, t);
}

/** Grant overclock. Extends the existing window; never shortens it. */
export function grantOverclock(state, ms = OVERCLOCK_MS, t) {
  const now = Number.isFinite(t) ? t : Date.now();
  const dur = Number.isFinite(ms) && ms > 0 ? ms : OVERCLOCK_MS;
  const left = overclockLeft(state, now);
  state.overclockUntil = now + Math.max(left, dur);
  return overclockLeft(state, now);
}
