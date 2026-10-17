// Click-power upgrades. Each level is a flat multiplicative add on top of the
// base click, and the cost curve is the same 1.15^n used by departments.

import { costAt, GROWTH } from '../core/money.js';

/**
 * `per` is the click multiplier added per level: level 1 of keyboards is
 * 1 + 0.5 = 1.5x. Multipliers multiply together across the whole rack.
 */
export const GEAR = [
  { id: 'keyboard', base: 60, per: 0.5, max: 250, ic: '⌨', name: { ar: 'لوحات مفاتيح أفضل', en: 'Better Keyboards' },   desc: { ar: 'مسافة أقل، ونقر أسرع.', en: 'Less travel, faster strokes.' } },
  { id: 'monitors', base: 700, per: 0.6, max: 250, ic: '▦', name: { ar: 'شاشتان مزدوجتان', en: 'Dual Monitors' },      desc: { ar: 'سياقان مفتوحان في آن واحد.', en: 'Two panes of context at once.' } },
  { id: 'copilot',  base: 9000, per: 0.75, max: 200, ic: '◇', name: { ar: 'مساعد برمجة ذكي', en: 'AI Copilot' },        desc: { ar: 'يكتب السطر الذي كنت ستنساه.', en: 'It writes the line you would skip.' } },
  { id: 'fiber',    base: 1.2e5, per: 1.0, max: 200, ic: '⇅', name: { ar: 'خطوط فايبر', en: 'Fiber Optic Lines' },          desc: { ar: 'زمن استجابة صفر عملياً.', en: 'Response time, practically zero.' } },
  { id: 'nvme',     base: 2.2e6, per: 1.4, max: 150, ic: '▤', name: { ar: 'مصفوفة تخزين NVMe', en: 'NVMe RAID Array' },     desc: { ar: 'كل تنفيذ يصل فوراً.', en: 'Every execution lands instantly.' } },
  { id: 'cluster',  base: 4.5e7, per: 2.0, max: 120, ic: '✳', name: { ar: 'عنقود معالجات', en: 'GPU Cluster' },               desc: { ar: 'ألف نواة في غرفة واحدة.', en: 'A thousand cores in one room.' } },
];

export const GEAR_IDS = GEAR.map((g) => g.id);

export function gearById(id) {
  return GEAR.find((g) => g.id === id) || null;
}

export function gearLevel(state, id) {
  const map = state && state.gearLevels ? state.gearLevels : {};
  const n = Number(map[id]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function gearCost(state, id) {
  const g = gearById(id);
  if (!g) return Infinity;
  const lv = gearLevel(state, id);
  if (lv >= g.max) return Infinity;
  return costAt(g.base, lv, GROWTH);
}

export function gearIsMaxed(state, id) {
  const g = gearById(id);
  if (!g) return true;
  return gearLevel(state, id) >= g.max;
}

/** Combined click multiplier of the whole rack. */
export function gearClickMult(state) {
  let m = 1;
  for (const g of GEAR) m *= 1 + g.per * gearLevel(state, g.id);
  return m;
}

/**
 * Buy one level of a gear item.
 * @returns {{ok:boolean, reason:string, cost:number, level:number, mult:number}}
 */
export function buyGear(state, id) {
  const g = gearById(id);
  if (!g) return { ok: false, reason: 'unknown', cost: 0, level: 0, mult: 1 };
  if (gearIsMaxed(state, id)) {
    return { ok: false, reason: 'max', cost: Infinity, level: gearLevel(state, id), mult: gearClickMult(state) };
  }
  const cost = gearCost(state, id);
  const cash = Number(state.cash) || 0;
  if (cash + 1e-9 < cost) return { ok: false, reason: 'funds', cost, level: gearLevel(state, id), mult: gearClickMult(state) };
  state.cash = cash - cost;
  state.gearLevels[id] = gearLevel(state, id) + 1;
  return { ok: true, reason: 'bought', cost, level: state.gearLevels[id], mult: gearClickMult(state) };
}
