// Executives. Each one is revealed at a net-worth milestone, hired once with a
// permanent fee, and from then on autonomously buys its own department.

import { DEPTS } from './ledger.js';

/**
 * `at`  — net worth required before the exec even shows up
 * `cost` — one-off hiring fee (0 = granted free)
 * `grants` — permanent automation handed over on hire
 */
export const EXECS = [
  { id: 'ops-garage',    at: 2.5e3,  cost: 1.2e3,  grants: { dept: 'garage' },    ic: '⌂', name: { ar: 'قائد العمليات', en: 'Ops Lead' },             desc: { ar: 'يشتري Levels of the Garage floor بلا إذنك.', en: 'Buys Garage levels without asking.' } },
  { id: 'ops-agency',    at: 1.2e4,  cost: 6e3,    grants: { dept: 'agency' },    ic: '⌸', name: { ar: 'مدير الوكالة', en: 'Agency Director' },    desc: { ar: 'يدير جدول مشاريع الويب كاملاً.', en: 'Runs the whole web project board.' } },
  { id: 'ops-mobile',    at: 7e4,    cost: 3.5e4,  grants: { dept: 'mobile' },    ic: '▤', name: { ar: 'منتج التطبيقات', en: 'App Producer' },      desc: { ar: 'يرفع الإصدار قبل أن تفكر فيه.', en: 'Ships before you think of it.' } },
  { id: 'ops-saas',      at: 4e5,    cost: 2e5,    grants: { dept: 'saas' },      ic: '☁', name: { ar: 'رئيس الإيرادات', en: 'Revenue Chief' },     desc: { ar: 'يرفع الاشتراكات ويخفض churn.', en: 'Lifts subscriptions, cuts churn.' } },
  { id: 'ops-cyber',     at: 2.4e6,  cost: 1.2e6,  grants: { dept: 'cyber' },     ic: '⛨', name: { ar: 'مدير الأمن', en: 'Security Director' },       desc: { ar: 'يوسّع تغطية العقود المحمية.', en: 'Expands contracted coverage.' } },
  { id: 'ops-ailab',     at: 1.5e7,  cost: 7.5e6,  grants: { dept: 'ailab' },     ic: '⚗', name: { ar: 'مدير المختبر', en: 'Lab Director' },       desc: { ar: 'يوسّع التدريب تلقائياً.', en: 'Scales training on its own.' } },
  { id: 'ops-quantum',   at: 9e7,    cost: 4.5e7,  grants: { dept: 'quantum' },   ic: '◈', name: { ar: 'مدير الكم', en: 'Quantum Lead' },          desc: { ar: 'يحجز أوقات المعالجة بلا تدخّل.', en: 'Books compute time without you.' } },
  { id: 'ops-robotics',  at: 5e8,    cost: 2.5e8,  grants: { dept: 'robotics' },  ic: '⛭', name: { ar: 'مصمم المصنع', en: 'Plant Architect' },      desc: { ar: 'يبني خطوط الإنتاج الجديدة.', en: 'Builds the new production lines.' } },
  { id: 'ops-orbital',   at: 3e9,    cost: 1.5e9,  grants: { dept: 'orbital' },   ic: '◉', name: { ar: 'مدير المدار', en: 'Orbital Director' },     desc: { ar: 'يحافظ على المدار بنفسه.', en: 'Keeps the constellation flying.' } },
  { id: 'ops-autopilot', at: 1.6e10, cost: 0,      grants: { gear: true, hit: true }, ic: '✳', name: { ar: 'الطيار الآلي', en: 'Autopilot' },   desc: { ar: 'يشتري التجهيزات ويكتب الكود نيابة عنك.', en: 'Buys the gear and types for you.' } },
];

export const EXEC_IDS = EXECS.map((e) => e.id);

export function execById(id) {
  return EXECS.find((e) => e.id === id) || null;
}

export function isHired(state, id) {
  const map = state && state.hired ? state.hired : {};
  return map[id] === true;
}

/** Revealed once the org's net worth passes the milestone. */
export function execVisible(state, worth) {
  const w = Number.isFinite(worth) ? worth : 0;
  return EXECS.filter((e) => w >= e.at);
}

/**
 * Hire one exec. Idempotent: hiring twice is rejected, never charged twice.
 * @returns {{ok:boolean, reason:string, grants:object}}
 */
export function hireExec(state, id) {
  const e = execById(id);
  if (!e) return { ok: false, reason: 'unknown', grants: {} };
  if (isHired(state, id)) return { ok: false, reason: 'hired', grants: e.grants };
  const cash = Number(state.cash) || 0;
  if (e.cost > 0 && cash + 1e-9 < e.cost) return { ok: false, reason: 'funds', grants: e.grants };
  if (e.cost > 0) state.cash = cash - e.cost;
  if (!state.hired) state.hired = {};
  state.hired[id] = true;
  return { ok: true, reason: 'hired', grants: e.grants };
}

/** Departments with an autobuyer currently installed. */
export function autoDepartments(state) {
  const out = [];
  for (const e of EXECS) {
    if (!isHired(state, e.id)) continue;
    if (e.grants && e.grants.dept) out.push(e.grants.dept);
  }
  return out;
}

export function hasAutoGear(state) {
  return EXECS.some((e) => isHired(state, e.id) && e.grants && e.grants.gear === true);
}

export function hasAutoHit(state) {
  return EXECS.some((e) => isHired(state, e.id) && e.grants && e.grants.hit === true);
}

/** True once nothing is left for the CEO to do by hand. */
export function fullyAutonomous(state) {
  return autoDepartments(state).length >= DEPTS.length && hasAutoGear(state);
}
