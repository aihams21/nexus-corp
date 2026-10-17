/* Nexus Corp: Empire & Arcade — OPS DECK build.
 * Boot, shell rendering, tycoon wiring, cabinet host, persistence, bilingual toggle. */

import { clamp, clamp01, mmss } from './core/math.js';
import { cash, points, mult } from './core/money.js';
import { TOPIC, emit } from './core/bus.js';
import { createLoop, MAX_DT } from './core/engine.js';
import sfx from './core/sfx.js';
import {
  t, applyDom, setLang, getLang, toggleLang, isRTL, pick,
} from './core/strings.js';
import {
  AUTOSAVE_MS, startAutosave, loadRaw, exportSave, importSave,
  clearSave, describeSave, computeOfflineEarnings,
  OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY,
} from './core/save.js';
import store, { S } from './tycoon/store.js';
import {
  DEPTS, DEPT_IDS, MILESTONES, OVERCLOCK_MS, COMBO_MAX,
  deptCost, deptLevel, deptOutput, netWorth, baseFlow, incomePerSec,
  hitValue, comboCount, overclockFactor, overclockLeft, overclockActive,
  doHit, buyDept, deptUnlocked, scoreToCash, grantOverclock,
  nextMilestone, milestoneProgress,
} from './tycoon/ledger.js';
import { GEAR, GEAR_IDS, gearLevel, gearCost, gearIsMaxed, buyGear } from './tycoon/gear.js';
import { EXECS, EXEC_IDS, isHired, execVisible, hireExec, hasAutoGear, hasAutoHit, fullyAutonomous } from './tycoon/execs.js';
import { sharesMult, ipoPreview, doIpo } from './tycoon/ipo.js';
import { createMachine, PLANE_W, PLANE_H } from './arcade/machine.js';
import { GAMES, TOTAL_GAMES, cabinetUnlocked, drawPoster, gameById } from './arcade/registry.js';

/* ── element handles ───────────────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const el = {
  splash: $('#splash'),
  bootFill: $('#boot-fill'),
  bootLog: $('#boot-log'),
  shell: $('#shell'),
  gCash: $('#g-cash'), gFlow: $('#g-flow'), gWorth: $('#g-worth'),
  gHit: $('#g-hit'), gShares: $('#g-shares'), gCombo: $('#g-combo'),
  ocChip: $('#oc-chip'), ocLeft: $('#oc-left'),
  btnLang: $('#btn-lang'), btnLangTxt: $('#btn-lang-txt'),
  btnSfx: $('#btn-sfx'), btnMus: $('#btn-mus'),
  nav: $('#deck-nav'), deck: $('#deck'),
  termOut: $('#term-out'), btnTerm: $('#btn-term'), comboFill: $('#combo-fill'),
  deptList: $('#dept-list'), gearGrid: $('#gear-grid'), execGrid: $('#exec-grid'),
  cabGrid: $('#cab-grid'),
  ipoWorth: $('#ipo-worth'), ipoShares: $('#ipo-shares'), ipoMult: $('#ipo-mult'),
  ipoNext: $('#ipo-next'), ipoCount: $('#ipo-count'), btnIpo: $('#btn-ipo'),
  sysSaved: $('#sys-saved'), sysVer: $('#sys-version'), sysRuns: $('#sys-runs'),
  sysPoints: $('#sys-points'), topList: $('#top-list'),
  cabinet: $('#cabinet'), cabTitle: $('#cab-title'), cabExit: $('#cab-exit'),
  screen: $('#screen'), cabOverlay: $('#cab-overlay'), ovKind: $('#ov-kind'),
  ovScore: $('#ov-score'), ovBest: $('#ov-best'), ovCash: $('#ov-cash'),
  ovAgain: $('#ov-again'), ovOut: $('#ov-out'), cabHint: $('#cab-hint'), cabScore: $('#cab-score'),
  veil: $('#veil'), veilHd: $('#veil-hd'), veilBody: $('#veil-body'), veilFoot: $('#veil-foot'),
  pip: $('#pip'),
  sbLeft: $('#sb-left'), sbMid: $('#sb-mid'), sbRight: $('#sb-right'),
  tickDot: $('#tick-dot'),
};

/* ── shell state ───────────────────────────────────────────────────────── */
const shell = {
  view: 'floor',
  booted: false,
  liveGame: null,
  lastRun: null,
  cardCanvases: new Map(),
};

const machine = createMachine({
  canvas: el.screen,
  audio: sfx,
  onScore: (score) => { el.cabScore.textContent = points(score); },
  onFinish: (score, id, reason) => endRun(score, id, reason),
  onExit: () => closeCabinet(),
  onHint: (text) => { el.cabHint.textContent = pick(text) || ''; },
  onFlash: () => { sfx.play('tick', 0.28); },
  onBanner: () => {},
  onStop: () => {},
});

/* ── toasts ────────────────────────────────────────────────────────────── */
function toast(text, tone = 'info') {
  const node = document.createElement('div');
  node.className = 'pip-toast';
  node.dataset.t = tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : tone === 'hot' ? 'hot' : '';
  node.textContent = text;
  el.pip.appendChild(node);
  emit(TOPIC.TOAST, text);
  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 240);
  }, 2400);
}

/* ── modal veil ────────────────────────────────────────────────────────── */
function openVeil({ head, body, value, label, actions }) {
  el.veilHd.textContent = head;
  el.veilBody.textContent = '';
  if (body) {
    const p = document.createElement('p');
    p.textContent = body;
    el.veilBody.appendChild(p);
  }
  if (value != null) {
    const box = document.createElement('div');
    box.className = 'veil-cta';
    const b = document.createElement('b');
    b.textContent = value;
    const s = document.createElement('span');
    s.textContent = label || '';
    box.appendChild(b);
    box.appendChild(s);
    el.veilBody.appendChild(box);
  }
  el.veilFoot.textContent = '';
  const list = actions || [];
  return new Promise((resolve) => {
    for (const act of list) {
      const btn = document.createElement('button');
      btn.className = 'btn' + (act.tone ? ' btn-' + act.tone : '');
      btn.type = 'button';
      btn.textContent = act.label;
      btn.addEventListener('click', () => { closeVeil(); resolve(act.value); });
      el.veilFoot.appendChild(btn);
    }
    el.veil.hidden = false;
  });
}

function closeVeil() {
  el.veil.hidden = true;
  el.veilBody.textContent = '';
  el.veilFoot.textContent = '';
}

/* ── gauges ────────────────────────────────────────────────────────────── */
function paintGauges() {
  const worth = netWorth(S);
  el.gCash.textContent = cash(S.cash);
  el.gFlow.textContent = cash(incomePerSec(S)) + '/s';
  el.gWorth.textContent = cash(worth);
  el.gHit.textContent = cash(hitValue(S));
  el.gShares.textContent = String(S.shares);
  const cc = comboCount(S);
  el.gCombo.textContent = cc > 1 ? `×${cc}` : '—';
  const left = overclockLeft(S);
  el.ocChip.hidden = left <= 0;
  if (left > 0) el.ocLeft.textContent = mmss(left / 1000);
  el.tickDot.style.opacity = String(0.35 + 0.65 * clamp01(1 - (worth % 1e6) / 1e6));
}

/* ── floor view ────────────────────────────────────────────────────────── */
const LINES = {
  idle: ['$ ready.', '> awaiting input…', 'boot: ops deck online'],
  hit: ['$ commit pushed', '> build green', '$ shipped to prod'],
  deal: ['$ deal closed', '> contract signed', '$ milestone billed'],
};

let lineIn = 0;
let lineIx = 0;
function tickTerminal(dt) {
  lineIn += dt;
  if (lineIn < 2.6) return;
  lineIn = 0;
  const pool = pick(LINES.idle);
  el.termOut.textContent = pool[lineIx % pool.length];
  lineIx++;
}

function paintCombo() {
  const cc = comboCount(S);
  el.comboFill.style.width = `${clamp01(cc / COMBO_MAX) * 100}%`;
}

function deptRowHTML(d) {
  const lv = deptLevel(S, d.id);
  const cost = deptCost(S, d.id);
  const out = deptOutput(S, d.id);
  const next = nextMilestone(lv);
  const prog = milestoneProgress(lv);
  const locked = !deptUnlocked(S, d.id);
  const owned = lv > 0;
  // the buy button must exist from level 0 — otherwise the first tier is unreachable
  const canBuy = !locked && S.cash >= cost;
  return `<div class="dept" data-dept="${d.id}">
    <div class="dept-ic">${d.ic}</div>
    <div class="dept-b">
      <span class="dept-n">${pick(d.name)}</span>
      <span class="dept-s">
        <small>${owned ? `LV ${lv}` : locked ? 'LOCKED' : `OPEN · LV ${lv}`}</small>
        <span class="dept-meter"><i style="width:${(prog * 100).toFixed(1)}%"></i></span>
        <small>${next ? `NEXT 2× @ ${next}` : 'MAX TIER'}</small>
      </span>
    </div>
    <div class="dept-out">
      <b>${out > 0 ? cash(out) + '/s' : '—'}</b>
      <button class="btn dept-buy" type="button" data-buy="${d.id}"${canBuy ? '' : ' disabled'}>${cash(cost)}</button>
    </div>
  </div>`;
}

function gearCardHTML(g) {
  const lv = gearLevel(S, g.id);
  const maxed = gearIsMaxed(S, g.id);
  const cost = gearCost(S, g.id);
  const poor = S.cash < cost;
  return `<button class="gear${maxed ? ' is-max' : ''}${poor ? ' is-locked' : ''}" type="button" data-gear="${g.id}">
    <span class="gear-n">${g.ic} ${pick(g.name)}</span>
    <span class="gear-d">${pick(g.desc)}</span>
    <span class="gear-f">
      <span class="gear-lv">LV ${lv}${maxed ? ' MAX' : ''}</span>
      <span class="gear-cost">${maxed ? '—' : cash(cost)}</span>
    </span>
  </button>`;
}

function execCardHTML(x) {
  const on = isHired(S, x.id);
  return `<button class="exec${on ? ' is-on' : ''}${!on && S.cash < x.cost ? ' is-locked' : ''}" type="button" data-exec="${x.id}">
    <span class="exec-n">${x.ic} ${pick(x.name)}</span>
    <span class="exec-d">${pick(x.desc)}</span>
    <span class="exec-f">
      <span class="exec-tag">${on ? t('floor.execOn') : 'VACANT'}</span>
      <span class="exec-cost">${on ? 'ACTIVE' : x.cost ? cash(x.cost) : '—'}</span>
    </span>
  </button>`;
}

function paintFloor() {
  el.deptList.innerHTML = DEPTS.map(deptRowHTML).join('');
  el.gearGrid.innerHTML = GEAR.map(gearCardHTML).join('');
  const worth = netWorth(S);
  el.execGrid.innerHTML = EXECS.filter((x) => execVisible(S, worth)).map(execCardHTML).join('');
}

/* ── arcade view ───────────────────────────────────────────────────────── */
function cardHTML(g, index) {
  const best = S.gameBest[g.id] || 0;
  const locked = !cabinetUnlocked(S, g.id);
  return `<div class="cab-card${locked ? ' is-locked' : ''}" data-game="${g.id}" role="button" tabindex="0">
    <div class="cab-thumb"><canvas data-thumb="${g.id}"></canvas><span class="cab-no">${String(g.no).padStart(2, '0')}</span><span class="cab-best">${best ? 'BEST ' + points(best) : 'NO RUN'}</span></div>
    <div class="cab-meta">
      <span class="cab-n">${pick(g.name)}</span>
      <span class="cab-t">${pick(g.tag)}</span>
      <span class="cab-d">${pick(g.desc)}</span>
    </div>
  </div>`;
}

function paintArcade() {
  el.cabGrid.innerHTML = GAMES.map(cardHTML).join('');
  shell.cardCanvases.clear();
  for (const g of GAMES) {
    const cv = el.cabGrid.querySelector(`canvas[data-thumb="${g.id}"]`);
    if (!cv) continue;
    const box = cv.getBoundingClientRect();
    const w = Math.max(80, Math.round(box.width)) || 150;
    const h = Math.max(60, Math.round(box.height)) || 74;
    cv.width = w;
    cv.height = h;
    const g2 = cv.getContext('2d');
    drawPoster(g2, g.id, w, h);
    shell.cardCanvases.set(g.id, cv);
  }
}

/* ── ipo view ──────────────────────────────────────────────────────────── */
function paintIpo() {
  const pv = ipoPreview(S);
  el.ipoWorth.textContent = cash(pv.worth);
  el.ipoShares.textContent = `+${pv.gain}`;
  el.ipoMult.textContent = mult(pv.mult);
  el.ipoNext.textContent = pv.nextAt ? cash(pv.nextAt) : '—';
  el.ipoCount.textContent = String(S.prestigeCount);
  el.btnIpo.disabled = !pv.ok;
}

/* ── sys view ──────────────────────────────────────────────────────────── */
function paintSys() {
  const d = describeSave(S);
  el.sysSaved.textContent = d.fresh ? t('sys.never') : new Date(d.savedAt).toLocaleString();
  el.sysVer.textContent = String(d.version);
  el.sysRuns.textContent = points(d.runs);
  el.sysPoints.textContent = points(d.points);
  const rows = GAMES.map((g) => ({ g, best: S.gameBest[g.id] || 0, runs: S.gamesPlayed[g.id] || 0 }))
    .filter((r) => r.best > 0)
    .sort((a, b) => b.best - a.best)
    .slice(0, 8);
  if (!rows.length) {
    el.topList.innerHTML = `<li class="empty">${t('sys.noScores')}</li>`;
  } else {
    el.topList.innerHTML = rows.map((r) =>
      `<li><span>${String(r.g.no).padStart(2, '0')} · ${pick(r.g.name)} <small>${r.runs}R</small></span><b>${points(r.best)}</b></li>`).join('');
  }
}

/* ── status bar ────────────────────────────────────────────────────────── */
function paintStatus() {
  const parts = [];
  parts.push(t('sb.dept', { n: DEPT_IDS.filter((id) => deptLevel(S, id) > 0).length }));
  parts.push(t('sb.gear', { n: GEAR_IDS.filter((id) => gearLevel(S, id) > 0).length }));
  parts.push(t('sb.exec', { n: EXEC_IDS.filter((id) => isHired(S, id)).length }));
  if (hasAutoGear(S) && hasAutoHit(S)) parts.push(t('sb.autonomous'));
  el.sbLeft.textContent = parts.join(' · ');
  const rate = incomePerSec(S);
  el.sbMid.textContent = `${cash(rate)}/s ${overclockActive(S) ? '· ' + t('oc.tag') + ' ×' + overclockFactor(S) : ''}`;
  el.sbRight.textContent = t('sb.frame', { ms: (MAX_DT * 1000).toFixed(0), plane: `${PLANE_W}×${PLANE_H}` });
}

/* ── view switching ────────────────────────────────────────────────────── */
function showView(name) {
  shell.view = name;
  for (const tab of el.nav.querySelectorAll('.tab')) {
    tab.classList.toggle('is-on', tab.dataset.view === name);
  }
  for (const view of el.deck.querySelectorAll('.view')) {
    view.classList.toggle('is-on', view.id === 'view-' + name);
  }
  if (name === 'floor') paintFloor();
  else if (name === 'arcade') paintArcade();
  else if (name === 'ipo') paintIpo();
  else if (name === 'sys') paintSys();
}

/* ── cabinet lifecycle ─────────────────────────────────────────────────── */
function openCabinet(id) {
  const g = gameById(id);
  if (!g) return;
  if (!cabinetUnlocked(S, id)) {
    sfx.play('error', 0.6);
    toast(t('toast.locked'), 'bad');
    return;
  }
  shell.liveGame = id;
  el.cabTitle.textContent = `${String(g.no).padStart(2, '0')} · ${pick(g.name)}`;
  el.cabOverlay.hidden = true;
  el.cabScore.textContent = '0';
  el.cabHint.textContent = pick(g.hint);
  el.cabinet.hidden = false;
  sfx.unlock();
  machine.mount(id, g.create);
}

function closeCabinet() {
  machine.unmount();
  shell.liveGame = null;
  el.cabinet.hidden = true;
  el.cabOverlay.hidden = true;
}

function endRun(score, id, reason) {
  const g = gameById(id);
  const s = Math.max(0, Math.floor(score) || 0);
  S.totalScoreAllTime += s;
  S.gamesPlayed[id] = (S.gamesPlayed[id] || 0) + 1;
  const prev = S.gameBest[id] || 0;
  if (s > prev) S.gameBest[id] = s;
  const payout = scoreToCash(s, S);
  S.cash += payout;
  grantOverclock(S, OVERCLOCK_MS);
  store.markDirty();
  sfx.play('cash', 0.7);
  emit(TOPIC.CASH, S.cash);
  el.ovScore.textContent = points(s);
  el.ovBest.textContent = points(Math.max(prev, s));
  el.ovCash.textContent = cash(payout);
  el.ovKind.textContent = t('ov.title') + ' · ' + (reason ? reason.toUpperCase() : 'DONE');
  el.cabOverlay.hidden = false;
  shell.lastRun = { id, score: s, payout, name: g ? pick(g.name) : id };
  paintStatus();
  emit(TOPIC.SCORE, { id, score: s });
}

/* ── actions ───────────────────────────────────────────────────────────── */
function pressTerminal() {
  const before = S.cash;
  const res = doHit(S);
  S.cash = res.gain != null ? before + res.gain : before;
  store.markDirty();
  sfx.play(res.combo >= 8 ? 'power' : 'cash', 0.5);
  el.btnTerm.classList.add('is-hit');
  setTimeout(() => el.btnTerm.classList.remove('is-hit'), 170);
  paintCombo();
  emit(TOPIC.COMBO, res.combo);
}

function buyDeptById(id) {
  const r = buyDept(S, id);
  if (r.ok) {
    sfx.play('buy', 0.6);
    store.markDirty();
    const d = DEPTS.find((x) => x.id === id);
    toast(t('toast.bought', { name: pick(d.name), level: r.level }), 'good');
    if (MILESTONES.includes(r.level)) toast(t('toast.milestone', { level: r.level }), 'hot');
    emit(TOPIC.DEPT, id);
  } else if (r.reason === 'funds') {
    sfx.play('error', 0.5);
    toast(t('toast.need'), 'bad');
  }
  paintFloor();
}

function buyGearById(id) {
  const r = buyGear(S, id);
  if (r.ok) {
    sfx.play('buy', 0.6);
    store.markDirty();
    const g = GEAR.find((x) => x.id === id);
    toast(t('toast.bought', { name: pick(g.name), level: r.level }), 'good');
    if (gearIsMaxed(S, id)) toast(t('toast.maxed'), 'hot');
    emit(TOPIC.GEAR, id);
  } else if (r.reason === 'funds') {
    sfx.play('error', 0.5);
    toast(t('toast.need'), 'bad');
  }
  paintFloor();
}

function hireById(id) {
  const r = hireExec(S, id);
  if (r.ok) {
    sfx.play('level', 0.7);
    store.markDirty();
    const x = EXECS.find((e) => e.id === id);
    toast(t('toast.hired', { name: pick(x.name) }), 'good');
    if (fullyAutonomous(S)) toast(t('toast.autonomous'), 'hot');
    emit(TOPIC.EXEC, id);
  } else if (r.reason === 'funds') {
    sfx.play('error', 0.5);
    toast(t('toast.need'), 'bad');
  }
  paintFloor();
}

async function runIpo() {
  const pv = ipoPreview(S);
  if (!pv.ok) {
    sfx.play('error', 0.5);
    toast(t('toast.ipoLocked'), 'bad');
    return;
  }
  const ok = await openVeil({
    head: t('modal.ipoTitle'),
    body: t('modal.ipoBody'),
    value: `+${pv.gain} ${t('ipo.shares')}`,
    actions: [
      { label: t('modal.cancel'), value: false },
      { label: t('modal.ipoOk'), value: true, tone: 'go' },
    ],
  });
  if (!ok) return;
  const r = doIpo(S);
  if (r.ok) {
    sfx.arp([523, 659, 784, 1047, 1319]);
    store.markDirty();
    toast(t('toast.ipo', { n: r.shares }), 'hot');
    emit(TOPIC.IPO, r.shares);
  }
  paintIpo();
  paintGauges();
}

async function exportSaveFile() {
  const text = exportSave(S);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nexus-ops-deck-save.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  toast(t('toast.exported'), 'good');
}

async function importSaveFlow() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  const file = await new Promise((res) => {
    input.addEventListener('change', () => res(input.files && input.files[0] ? input.files[0] : null), { once: true });
    input.click();
  });
  if (!file) return;
  try {
    const text = await file.text();
    const next = importSave(text);
    store.hydrate(next);
    store.markDirty();
    store.save();
    sfx.play('cash', 0.7);
    toast(t('toast.imported'), 'good');
    renderAll();
    showView(shell.view);
  } catch (err) {
    sfx.play('error', 0.7);
    toast(`${t('toast.importFail')} (${String(err.message || err)})`, 'bad');
  }
}

async function wipeSave() {
  const ok = await openVeil({
    head: t('modal.wipeTitle'),
    body: t('modal.wipeBody'),
    actions: [
      { label: t('modal.cancel'), value: false },
      { label: t('modal.wipeOk'), value: true, tone: 'warn' },
    ],
  });
  if (!ok) return;
  clearSave();
  store.reset();
  sfx.play('explode', 0.5);
  toast(t('toast.wiped'), 'bad');
  renderAll();
  showView(shell.view);
}

/* ── welcome back ──────────────────────────────────────────────────────── */
async function welcomeBack() {
  const loaded = loadRaw();
  if (loaded.state) store.hydrate(loaded.state);
  else store.hydrate(null);

  const savedAt = loaded.savedAt;
  const elapsed = savedAt > 0 ? Math.max(0, (Date.now() - savedAt) / 1000) : 0;
  const rate = baseFlow(S) * sharesMult(S.shares);
  const rep = computeOfflineEarnings(rate, elapsed, OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY);

  if (S.seenWelcome || rep.earned <= 0 || !savedAt) {
    S.seenWelcome = true;
    return;
  }

  const mms = Math.floor(rep.usedSeconds / 60);
  const sss = Math.floor(rep.usedSeconds % 60);
  await openVeil({
    head: t('modal.welcome'),
    body: t('modal.welcomeBody', { time: `${mms}m ${sss}s` }),
    value: cash(rep.earned),
    actions: [{ label: t('modal.claim'), value: true, tone: 'go' }],
  });
  S.seenWelcome = true;
  store.applyOffline(rep.usedSeconds, rate, Date.now());
  store.markDirty();
  if (rep.wasCapped) toast(t('toast.capped'), 'hot');
}

/* ── i18n wiring ───────────────────────────────────────────────────────── */
function applyStrings() {
  applyDom(document);
  el.btnLangTxt.textContent = getLang() === 'ar' ? 'EN' : 'ع';
  el.btnLang.setAttribute('aria-label', getLang() === 'ar' ? 'Switch to English' : 'التبديل إلى العربية');
  el.btnTerm.querySelector('.bk-l1').textContent = t('floor.run');
  el.btnTerm.querySelector('.bk-l2').textContent = t('floor.runSub');
  el.btnIpo.querySelector('.bk-l1').textContent = t('ipo.btn');
  el.btnIpo.querySelector('.bk-l2').textContent = t('ipo.btnSub');
  el.ovAgain.textContent = t('ov.again');
  el.ovOut.textContent = t('ov.out');
  for (const tab of el.nav.querySelectorAll('.tab')) {
    const span = tab.querySelector('span');
    if (span) span.textContent = t('nav.' + tab.dataset.view);
  }
  for (const g of GAMES) {
    const card = el.cabGrid.querySelector(`[data-game="${g.id}"]`);
    if (!card) continue;
    card.querySelector('.cab-n').textContent = pick(g.name);
    card.querySelector('.cab-t').textContent = pick(g.tag);
    card.querySelector('.cab-d').textContent = pick(g.desc);
  }
  for (const row of el.deptList.querySelectorAll('.dept')) {
    const id = row.dataset.dept;
    const d = DEPTS.find((x) => x.id === id);
    if (d) row.querySelector('.dept-n').textContent = pick(d.name);
  }
  for (const card of el.gearGrid.querySelectorAll('.gear')) {
    const g = GEAR.find((x) => x.id === card.dataset.gear);
    if (!g) continue;
    card.querySelector('.gear-n').textContent = `${g.ic} ${pick(g.name)}`;
    card.querySelector('.gear-d').textContent = pick(g.desc);
  }
  for (const card of el.execGrid.querySelectorAll('.exec')) {
    const x = EXECS.find((e) => e.id === card.dataset.exec);
    if (!x) continue;
    card.querySelector('.exec-n').textContent = `${x.ic} ${pick(x.name)}`;
    card.querySelector('.exec-d').textContent = pick(x.desc);
  }
  for (const li of el.topList.querySelectorAll('li')) {
    const span = li.querySelector('span');
    if (span) {
      const m = /^(\d{2})\s*·\s*(.+?)(\s\d+R)?$/.exec(span.textContent.trim());
      if (m) {
        const g = GAMES.find((x) => x.no === Number(m[1]));
        if (g) span.textContent = `${String(g.no).padStart(2, '0')} · ${pick(g.name)}${m[3] ? ' ' + m[3] : ''}`;
      }
    }
  }
  el.docBodyText = $('.doc');
  if (el.docBodyText) el.docBodyText.textContent = t('sys.docBody');
  if (shell.liveGame) {
    const g = gameById(shell.liveGame);
    if (g) el.cabHint.textContent = pick(g.hint);
  }
  el.termOut.textContent = pick(LINES.idle)[0];
}

/* ── render everything visible ─────────────────────────────────────────── */
function renderAll() {
  paintGauges();
  paintCombo();
  paintStatus();
  if (shell.view === 'floor') paintFloor();
  else if (shell.view === 'arcade') paintArcade();
  else if (shell.view === 'ipo') paintIpo();
  else paintSys();
}

/* ── event wiring ──────────────────────────────────────────────────────── */
function wire() {
  el.nav.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) { sfx.play('select', 0.4); showView(tab.dataset.view); }
  });

  el.btnTerm.addEventListener('pointerdown', (e) => { e.preventDefault(); pressTerminal(); });
  el.btnTerm.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pressTerminal(); }
  });

  el.deptList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-buy]');
    if (btn) buyDeptById(btn.dataset.buy);
  });
  el.gearGrid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-gear]');
    if (card) buyGearById(card.dataset.gear);
  });
  el.execGrid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-exec]');
    if (card) hireById(card.dataset.exec);
  });

  el.cabGrid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-game]');
    if (card) openCabinet(card.dataset.game);
  });
  el.cabGrid.addEventListener('keydown', (e) => {
    const card = e.target.closest('[data-game]');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openCabinet(card.dataset.game); }
  });

  el.cabExit.addEventListener('click', () => { sfx.play('select', 0.5); closeCabinet(); });
  el.ovOut.addEventListener('click', () => { sfx.play('select', 0.5); closeCabinet(); });
  el.ovAgain.addEventListener('click', () => {
    const id = shell.liveGame;
    const g = gameById(id);
    if (!g) return;
    sfx.play('click', 0.5);
    el.cabOverlay.hidden = true;
    el.cabScore.textContent = '0';
    const againId = shell.liveGame;
    machine.unmount();
    el.cabScore.textContent = '0';
    machine.mount(againId, g.create);
  });

  el.btnIpo.addEventListener('click', () => runIpo());
  $('#btn-export').addEventListener('click', () => exportSaveFile());
  $('#btn-import').addEventListener('click', () => importSaveFlow());
  $('#btn-wipe').addEventListener('click', () => wipeSave());

  el.btnLang.addEventListener('click', () => {
    sfx.play('select', 0.5);
    toggleLang();
    S.lang = getLang();
    store.markDirty();
    applyStrings();
    renderAll();
    emit(TOPIC.LANG, getLang());
  });

  el.btnSfx.addEventListener('click', () => {
    S.sfxOn = !S.sfxOn;
    sfx.setEnabled(S.sfxOn);
    if (S.sfxOn) sfx.play('click', 0.5);
    store.markDirty();
    paintOps();
  });

  el.btnMus.addEventListener('click', () => {
    S.musOn = !S.musOn;
    store.markDirty();
    paintOps();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.cabinet.hidden) { e.preventDefault(); closeCabinet(); }
    if (e.key === 'Escape' && !el.veil.hidden) closeVeil();
  });

  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (shell.view === 'arcade') paintArcade();
      machine.refit();
    }, 140);
  });

  window.addEventListener('pointerdown', () => sfx.unlock(), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) store.save();
  });
  window.addEventListener('pagehide', () => store.save());
}

function paintOps() {
  el.btnSfx.dataset.on = S.sfxOn ? '1' : '';
  el.btnSfx.setAttribute('aria-pressed', S.sfxOn ? 'true' : 'false');
  el.btnMus.dataset.on = S.musOn ? '1' : '';
  el.btnMus.setAttribute('aria-pressed', S.musOn ? 'true' : 'false');
}

/* ── boot ──────────────────────────────────────────────────────────────── */
const BOOT_STEPS = [
  ['core', 0.18], ['save', 0.34], ['ledger', 0.5], ['gear', 0.62],
  ['execs', 0.72], ['ipo', 0.8], ['kernel', 0.88], ['cabinet', 0.96],
];

async function boot() {
  const log = (line) => {
    const li = document.createElement('div');
    li.textContent = `> ${line}`;
    el.bootLog.appendChild(li);
    while (el.bootLog.childElementCount > 4) el.bootLog.firstElementChild.remove();
  };
  const progress = (p) => { el.bootFill.style.width = `${clamp01(p) * 100}%`; };

  try {
    setLang(getLang() || 'ar');
    log(t('boot.log.core'));
    progress(BOOT_STEPS[0][1]);
    await new Promise((r) => setTimeout(r, 40));

    log(t('boot.log.save'));
    progress(BOOT_STEPS[1][1]);
    await new Promise((r) => setTimeout(r, 40));

    log(t('boot.log.ledger'));
    progress(BOOT_STEPS[2][1]);

    log(t('boot.log.games'));
    for (let i = 0; i < GAMES.length; i++) {
      const g = GAMES[i];
      if (typeof g.create !== 'function') throw new Error(`registry: ${g.id} has no create()`);
      progress(0.2 + (i / GAMES.length) * 0.72);
      await new Promise((r) => setTimeout(r, 12));
    }
    log(`${TOTAL_GAMES} cabinets online`);

    progress(1);
    setLang(S.lang || getLang() || 'ar');
    sfx.setEnabled(S.sfxOn !== false);
    paintOps();
    wire();
    applyStrings();
    renderAll();
    showView('floor');

    store.subscribe(() => {
      paintGauges();
      paintCombo();
      paintStatus();
      if (shell.view === 'floor') paintFloor();
      if (shell.view === 'ipo') paintIpo();
      if (shell.view === 'sys') paintSys();
    });

    const saver = startAutosave(AUTOSAVE_MS, () => S, () => {
      emit(TOPIC.SAVE, Date.now());
      paintStatus();
    });

    log(t('boot.log.ready'));
    el.shell.hidden = false;

    await welcomeBack();
    renderAll();
    showView(shell.view);

    el.splash.classList.add('out');
    setTimeout(() => { el.splash.style.display = 'none'; }, 520);
    shell.booted = true;

    let acc = 0;
    const loop = createLoop((dt) => {
      store.tick(dt);
      acc += dt;
      if (acc >= 0.25) {
        acc = 0;
        paintGauges();
        paintCombo();
        if (shell.view === 'sys') paintSys();
      }
      tickTerminal(dt);
    });
    loop.start();
    void saver;
  } catch (err) {
    console.error('[opsdeck] boot failed', err);
    log(t('boot.log.fail'));
  }
}

window.__opsdeck = {
  state: S,
  machine,
  launch: (id) => { openCabinet(id); return machine.mounted; },
  activeId: () => (machine.mounted ? shell.liveGame : null),
  endNow: (score) => { if (machine.mounted) { machine.setScore(Number(score) || 0); machine.finish('quit'); } },
  view: (name) => showView(name),
  ready: () => shell.booted,
};

boot();