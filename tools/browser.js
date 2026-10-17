#!/usr/bin/env node
/* Headless browser verification for the Ops Deck build.
 * Serves the project, drives real Chromium over CDP, then runs:
 *   A) boot + console-error gate
 *   B) a smoke pass that launches, feeds input to, renders and cleanly unmounts
 *      every one of the 20 cabinets
 *   C) an end-to-end pass over the tycoon shell (clicks, purchases, prestige,
 *      save/load, bilingual toggle, mobile viewport)
 * Usage: node tools/browser.js [--head] [--keep] [--only=smoke|e2e] */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '..'));
const HEAD = !process.argv.includes('--head');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || 'all';
const HTTP_PORT = 8781;
const CDP_PORT = 9381;
const PROFILE = '/tmp/opsdeck-verify-profile';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent((req.url || '/').split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = normalize(join(ROOT, rel));
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(HTTP_PORT, '127.0.0.1', () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('CDP endpoint never came up: ' + url);
}

/* ── minimal CDP client ───────────────────────────────────────────────── */
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map(); }
  static async attach(port) {
    const version = await fetchJson(`http://127.0.0.1:${port}/json/version`);
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws failed')); });
    const client = new CDP(ws);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && client.pending.has(msg.id)) {
        const { resolve, reject } = client.pending.get(msg.id);
        client.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        const list = client.handlers.get(msg.method);
        if (list) for (const fn of list) fn(msg.params);
      }
    };
    return client;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(method + ' timeout')); } }, 60000);
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
}

class Page {
  constructor(cdp, sessionId, errors) {
    this.cdp = cdp;
    this.sid = sessionId;
    this.errors = errors;
  }
  send(method, params) { return this.cdp.send(method, params, this.sid); }
  async eval(fn, ...args) {
    const expr = `(${fn.toString()})(${args.map((a) => JSON.stringify(a === undefined ? null : a)).join(',')})`;
    const res = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || 'eval threw');
    return res.result.value;
  }
}

/* ── checks ───────────────────────────────────────────────────────────── */
const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond, extra: cond ? '' : String(extra ?? '') });
  const tag = cond ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${tag}  ${name}${cond ? '' : '  → ' + extra}`);
}

/* ── in-page smoke driver (runs inside the browser) ───────────────────── */
const SMOKE_SRC = `
async function runSmoke() {
  const root = window.__opsdeck;
  const out = [];
  const ids = [];
  for (let i = 1; i <= 20; i++) ids.push('g' + String(i).padStart(2, '0'));
  for (const id of ids) {
    const rec = { id, launched: false, frames: 0, colors: 0, clean: false, error: '' };
    try {
      const canvas = document.getElementById('screen');
      const g2 = canvas.getContext('2d');
      rec.launched = root.launch(id) === true;
      if (!rec.launched) { rec.error = 'launch refused'; out.push(rec); continue; }

      const rect = canvas.getBoundingClientRect();
      const send = (type, extra) => {
        const ev = new PointerEvent(type, Object.assign({
          bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
          clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
        }, extra || {}));
        canvas.dispatchEvent(ev);
        window.dispatchEvent(ev);
        document.dispatchEvent(ev);
      };
      const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyB', 'KeyX', 'Enter', 'ShiftLeft', 'ControlLeft', 'KeyK', 'KeyC', 'KeyZ'];
      const TYPED = 'asynckerneldockerdeploy';
      let t = 0;
      const start = performance.now();
      while (performance.now() - start < 1500) {
        t += 1 / 60;
        send(t % 2 < 1 ? 'pointermove' : 'pointerdown', { buttons: t % 2 < 1 ? 0 : 1 });
        if (t % 4 < 1) send('pointerup', { buttons: 0 });
        const code = KEYS[(t * 7 | 0) % KEYS.length];
        window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
        if ((t * 3 | 0) % 2 === 0) {
          const ch = TYPED[(t * 5 | 0) % TYPED.length];
          window.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
        }
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: (t % 2 ? 1 : -1) * 40, bubbles: true }));
        await new Promise((r) => requestAnimationFrame(r));
        rec.frames += 1;
      }
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));

      // colour census proves the game actually drew something
      const data = g2.getImageData(0, 0, canvas.width, canvas.height).data;
      const seen = new Set();
      for (let i = 0; i < data.length; i += 4 * 37) {
        seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        if (seen.size > 40) break;
      }
      rec.colors = seen.size;

      // clean lifecycle: unmount via the exit affordance, then assert nothing runs
      document.getElementById('cab-exit').click();
      await new Promise((r) => setTimeout(r, 140));
      rec.clean = root.activeId() === null && document.getElementById('cabinet').hidden === true;
    } catch (err) {
      rec.error = String(err && err.message || err);
    }
    out.push(rec);
  }
  return out;
}
`;

/* ── in-page input probe (guards the listener lifecycle) ───────────────── */
// A game animating on its own proves nothing. These send one real key and one
// real pointer press and require the machine's own Input to report them, both
// on the FIRST cabinet and after the cabinet has been closed and reopened.
const INPUT_PROBE_SRC = `
async function inputProbe(id) {
  const root = window.__opsdeck;
  const m = root.machine;
  const canvas = document.getElementById('screen');
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const out = { id, bag: 0, keySeen: false, keyHeld: false, ptrSeen: false, px: -1, py: -1 };
  await frame();
  out.bag = m.bag.size;

  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true }));
  await frame();
  out.keySeen = m.input.wasPressed('ArrowLeft') === true || m.input.isDown('ArrowLeft') === true;
  out.keyHeld = m.input.isDown('ArrowLeft') === true;
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true }));
  await frame();

  const r = canvas.getBoundingClientRect();
  const cx = r.left + r.width * 0.7, cy = r.top + r.height * 0.4;
  canvas.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse',
    clientX: cx, clientY: cy, buttons: 1,
  }));
  await frame();
  out.ptrSeen = m.input.pointerDown === true || m.input.clicked === true;
  out.px = Math.round(m.input.px); out.py = Math.round(m.input.py);
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse', clientX: cx, clientY: cy, buttons: 0 }));
  await frame();
  out.released = m.input.pointerDown === false;
  return out;
}
`;

/* ── main ─────────────────────────────────────────────────────────────── */
let server;
let chrome;
let code = 0;
try {
  server = await serve();
  await rm(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }).catch(() => {});
  const bin = ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find((p) => existsSync(p));
  if (!bin) throw new Error('no chromium binary found');
  chrome = spawn(bin, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE}`,
    '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--window-size=1280,900', '--force-device-scale-factor=1', '--mute-audio',
    ...(HEAD ? [] : ['--headless=new']),
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr.on('data', () => {});

  const cdp = await CDP.attach(CDP_PORT);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  const errors = [];
  const page = new Page(cdp, sessionId, errors);
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') errors.push('console.error: ' + (p.args || []).map((a) => a.value ?? a.description ?? '?').join(' '));
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    errors.push('exception: ' + (d.exception?.description || d.text || '?'));
  });
  cdp.on('Log.entryAdded', (p) => {
    if (p.entry && p.entry.level === 'error') errors.push('log: ' + p.entry.text);
  });

  await page.send('Runtime.enable');
  await page.send('Log.enable');
  await page.send('Page.enable');
  await page.send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/index.html` });

  console.log('\n[1/3] boot');
  let ready = false;
  for (let i = 0; i < 120; i++) {
    await sleep(250);
    ready = await page.eval(() => !!(window.__opsdeck && window.__opsdeck.ready())).catch(() => false);
    if (ready) break;
  }
  check('boot completes', ready);
  if (!ready) {
    check('boot errors surfaced', false, errors.slice(0, 3).join(' | ') || 'never became ready');
    throw new Error('boot did not finish');
  }
  const shellVisible = await page.eval(() => {
    const s = document.getElementById('shell');
    return !!s && s.hidden === false;
  });
  check('shell revealed', shellVisible);
  // the splash fades out (opacity) before it is display:none — poll until it is really gone
  let splashGone = false;
  for (let i = 0; i < 24; i++) {
    splashGone = await page.eval(() => {
      const s = document.getElementById('splash');
      if (!s) return true;
      if (s.style.display === 'none') return true;
      if (s.hidden) return true;
      const cs = getComputedStyle(s);
      if (Number(cs.opacity) === 0 || cs.display === 'none' || cs.visibility === 'hidden') return true;
      return s.getBoundingClientRect().width === 0;
    }).catch(() => false);
    if (splashGone) break;
    await sleep(200);
  }
  check('splash dismissed', splashGone);
  check('no blocking modal at boot', await page.eval(() => document.getElementById('veil').hidden === true));
  // measured here, before the smoke phase funds the company
  const cash0 = await page.eval(() => window.__opsdeck.state.cash);
  check('fresh company starts at zero', cash0 === 0, String(cash0));
  check('no console errors during boot', errors.length === 0, errors.slice(0, 3).join(' | '));

  if (ONLY === 'all' || ONLY === 'smoke') {
    console.log('\n[2/3] cabinet smoke — all 20 games');
    // every cabinet past g01 sits behind the $10K unlock gate, so fund the company first
    await page.eval(() => { window.__opsdeck.state.cash = 5e6; window.__opsdeck.view('arcade'); });
    await sleep(200);
    await page.eval((src) => { (0, eval)(src); }, SMOKE_SRC);
    const rows = await page.eval((ids) => window.runSmoke(), Array.from({ length: 20 }, (_, i) => 'g' + String(i + 1).padStart(2, '0')));
    for (const r of rows) {
      check(`g ${r.id} launch+render+teardown`, r.launched && r.colors > 1 && r.clean, r.error || `frames=${r.frames} colors=${r.colors} clean=${r.clean}`);
    }
    check('all 20 cabinets ran', rows.length === 20 && rows.every((r) => r.launched), `${rows.length} rows`);

    // real-input guard: the first cabinet, then a close/reopen cycle
    await page.eval((src) => { (0, eval)(src); }, INPUT_PROBE_SRC);
    const probe = await page.eval(async () => {
      const root = window.__opsdeck;
      root.launch('g07');
      await new Promise((r) => setTimeout(r, 300));
      const one = await window.inputProbe('g07');
      document.getElementById('cab-exit').click();
      await new Promise((r) => setTimeout(r, 260));
      const closed = root.activeId() === null;
      root.launch('g08');
      await new Promise((r) => setTimeout(r, 300));
      const two = await window.inputProbe('g08');
      document.getElementById('cab-exit').click();
      await new Promise((r) => setTimeout(r, 200));
      return { one, two, closed };
    });
    check('input live on the first cabinet', probe.one.keySeen && probe.one.ptrSeen, JSON.stringify(probe.one));
    check('pointer position tracks the mouse', probe.one.px > 200 && probe.one.py > 80, `${probe.one.px},${probe.one.py}`);
    check('cabinet exits cleanly', probe.closed);
    check('input rebinds after a cabinet closes', probe.two.keySeen && probe.two.ptrSeen, JSON.stringify(probe.two));
    check('listener bag is repopulated on mount', probe.one.bag > 5 && probe.two.bag > 5, `${probe.one.bag} / ${probe.two.bag}`);
  }

  if (ONLY === 'all' || ONLY === 'e2e') {
    console.log('\n[3/3] end-to-end shell');
    const gained = await page.eval(async () => {
      const btn = document.getElementById('btn-term');
      for (let i = 0; i < 25; i++) {
        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
        await new Promise((r) => setTimeout(r, 8));
      }
      return { cash: window.__opsdeck.state.cash, clicks: window.__opsdeck.state.clickTotal, combo: window.__opsdeck.state.combo };
    });
    check('terminal clicks credit cash', gained.cash > 0 && gained.clicks === 25, JSON.stringify(gained));
    check('combo builds up', gained.combo > 1, String(gained.combo));

    const cards = await page.eval(() => {
      window.__opsdeck.view('arcade');
      return document.querySelectorAll('[data-game]').length;
    });
    check('20 arcade cards render', cards === 20, String(cards));
    const thumbs = await page.eval(() => {
      const list = [...document.querySelectorAll('.cab-thumb canvas')];
      return list.filter((c) => c.width > 0 && c.height > 0).length;
    });
    check('every card has a poster canvas', thumbs === 20, String(thumbs));

    const unlocked = await page.eval(() => {
      const s = window.__opsdeck.state;
      s.cash = 5e6;
      return true;
    });
    check('cash injection for purchase test', unlocked);

    const dept = await page.eval(async () => {
      // buy buttons are rendered disabled while broke — re-enter the view so they repaint as affordable
      window.__opsdeck.view('arcade');
      window.__opsdeck.view('floor');
      await new Promise((r) => setTimeout(r, 120));
      const row = document.querySelector('[data-dept="garage"]');
      const before = window.__opsdeck.state.deptLevels.garage || 0;
      const btn = row ? row.querySelector('[data-buy]') : null;
      const wasDisabled = btn ? btn.disabled : null;
      if (btn) btn.click();
      await new Promise((r) => setTimeout(r, 120));
      return { before, after: window.__opsdeck.state.deptLevels.garage || 0, wasDisabled, found: !!btn };
    });
    check('department purchase raises its level', dept.after === dept.before + 1, JSON.stringify(dept));
    const cashAfterDept = await page.eval(() => window.__opsdeck.state.cash);
    check('department purchase spends cash', cashAfterDept < 5e6, String(cashAfterDept));

    const flow = await page.eval(async () => {
      const a = window.__opsdeck.state.cash;
      await new Promise((r) => setTimeout(r, 900));
      return { a, b: window.__opsdeck.state.cash };
    });
    check('passive income accrues', flow.b > flow.a, JSON.stringify(flow));

    const run = await page.eval(async () => {
      const root = window.__opsdeck;
      const before = window.__opsdeck.state.cash;
      root.launch('g07');
      await new Promise((r) => setTimeout(r, 700));
      const active = root.activeId();
      root.endNow(1200);
      await new Promise((r) => setTimeout(r, 500));
      return {
        active,
        before,
        after: window.__opsdeck.state.cash,
        played: window.__opsdeck.state.gamesPlayed.g07,
        best: window.__opsdeck.state.gameBest.g07,
        oc: window.__opsdeck.state.overclockUntil - Date.now(),
        overlay: !document.getElementById('cab-overlay').hidden,
        cashCell: document.getElementById('ov-cash').textContent,
      };
    });
    check('game mounts and becomes active', run.active === 'g07', String(run.active));
    check('score converts to cash', run.after > run.before, JSON.stringify({ before: run.before, after: run.after }));
    check('gamesPlayed incremented', run.played === 1, String(run.played));
    check('best score recorded', run.best === 1200, String(run.best));
    check('overclock granted ~5 min', run.oc > 4.5 * 60 * 1000 && run.oc <= 5 * 60 * 1000 + 2000, String(run.oc));
    check('game-over overlay shows payout', run.overlay && /^\$/.test(run.cashCell), `${run.overlay} ${run.cashCell}`);

    const retry = await page.eval(async () => {
      document.getElementById('ov-again').click();
      await new Promise((r) => setTimeout(r, 400));
      const active = window.__opsdeck.activeId();
      document.getElementById('cab-exit').click();
      await new Promise((r) => setTimeout(r, 200));
      return { active, closed: window.__opsdeck.activeId() === null };
    });
    check('replay relaunches the cabinet', retry.active === 'g07', String(retry.active));
    check('exit tears the cabinet down', retry.closed);

    const ipo = await page.eval(async () => {
      const s = window.__opsdeck.state;
      s.cash = 2e6;
      window.__opsdeck.view('ipo');
      const enabled = !document.getElementById('btn-ipo').disabled;
      document.getElementById('btn-ipo').click();
      await new Promise((r) => setTimeout(r, 260));
      const btns = [...document.querySelectorAll('#veil-foot .btn')];
      const go = btns[btns.length - 1];
      const label = go ? go.textContent : '';
      if (go) go.click();
      await new Promise((r) => setTimeout(r, 260));
      return { enabled, label, shares: s.shares, cash: s.cash, prestige: s.prestigeCount, veiled: !document.getElementById('veil').hidden };
    });
    check('IPO unlocks past $1M', ipo.enabled);
    check('IPO mints executive shares', ipo.shares > 0 && ipo.prestige === 1 && ipo.cash === 0, JSON.stringify(ipo));
    check('IPO modal closes after confirming', ipo.veiled === false);

    const saved = await page.eval(async () => {
      const key = 'nexus_corp_opsdeck_v2';
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return { present: !!raw, version: parsed ? parsed.v : 0, cash: parsed && parsed.data ? parsed.data.cash : -1 };
    });
    check('save persisted to localStorage', saved.present && saved.version === 2, JSON.stringify(saved));

    const round = await page.eval(async () => {
      const mod = await import('./src/core/save.js');
      const state = window.__opsdeck.state;
      const text = mod.exportSave(state);
      const back = mod.importSave(text);
      return { ok: back.cash === state.cash && back.shares === state.shares, key: mod.SAVE_KEY };
    });
    check('export → import round trip', round.ok && round.key === 'nexus_corp_opsdeck_v2', JSON.stringify(round));

    const lang = await page.eval(async () => {
      const before = document.documentElement.dir;
      document.getElementById('btn-lang').click();
      await new Promise((r) => setTimeout(r, 160));
      const mid = document.documentElement.dir;
      const midLabel = document.getElementById('btn-lang-txt').textContent;
      const i18n = await import('./src/core/strings.js');
      const sample = i18n.t('floor.run');
      document.getElementById('btn-lang').click();
      await new Promise((r) => setTimeout(r, 160));
      return { before, mid, midLabel, sample, back: document.documentElement.dir };
    });
    check('language toggle flips direction', lang.before === 'rtl' && lang.mid === 'ltr' && lang.back === 'rtl', JSON.stringify(lang));
    check('English strings are English', /^[A-Za-z ]+$/.test(lang.sample), lang.sample);
    check('toggle button shows target language', lang.midLabel === 'ع', lang.midLabel);

    await page.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 760, deviceScaleFactor: 2, mobile: true });
    await page.eval(() => window.__opsdeck.view('floor'));
    await sleep(400);
    const mob = await page.eval(() => {
      const doc = document.documentElement;
      const term = document.getElementById('btn-term').getBoundingClientRect();
      const screen = document.getElementById('screen').getBoundingClientRect();
      const tabs = [...document.querySelectorAll('#deck-nav .tab')].every((t) => t.getBoundingClientRect().width > 0);
      const gauges = document.getElementById('gauges');
      return {
        overflow: doc.scrollWidth - doc.clientWidth,
        termW: Math.round(term.width), termH: Math.round(term.height),
        cabW: Math.round(screen.width), cabH: Math.round(screen.height),
        tabs, gaugesScroll: gauges.scrollWidth >= gauges.clientWidth,
      };
    });
    check('mobile: no horizontal page overflow', mob.overflow <= 1, String(mob.overflow));
    check('mobile: terminal key usable', mob.termW > 200 && mob.termH > 40, JSON.stringify(mob));
    check('mobile: nav tabs visible', mob.tabs);
    // the cabinet is the primary screen on a phone: make sure it still fits
    const mobCab = await page.eval(async () => {
      window.__opsdeck.view('arcade');
      window.__opsdeck.state.cash = 5e6;   // the IPO reset zeroed the balance, so re-fund for the gate
      window.__opsdeck.view('arcade');
      await new Promise((r) => setTimeout(r, 120));
      document.querySelector('[data-game="g02"]').click();
      await new Promise((r) => setTimeout(r, 420));
      const cab = document.getElementById('cabinet');
      const rect = cab.getBoundingClientRect();
      const scr = document.getElementById('screen').getBoundingClientRect();
      const open = !cab.hidden && window.__opsdeck.activeId() === 'g02';
      const fits = scr.width > 100 && scr.height > 100 && scr.width <= window.innerWidth + 1 && scr.height <= window.innerHeight + 1;
      const out = { open, w: Math.round(rect.width), scrW: Math.round(scr.width), scrH: Math.round(scr.height), fits };
      document.getElementById('cab-exit').click();
      await new Promise((r) => setTimeout(r, 200));
      out.closed = window.__opsdeck.activeId() === null && document.getElementById('cabinet').hidden;
      return out;
    });
    check('mobile: cabinet opens and fits the viewport', mobCab.open && mobCab.fits, JSON.stringify(mobCab));
    check('mobile: cabinet tears down again', mobCab.closed, JSON.stringify(mobCab));
    await page.send('Emulation.clearDeviceMetricsOverride');
    await sleep(250);

    check('zero console errors across the whole run', errors.length === 0, errors.slice(0, 4).join(' | '));
  }
} catch (err) {
  console.error('\n\x1b[31mharness error:\x1b[0m', err.message);
  code = 1;
} finally {
  if (chrome) chrome.kill('SIGKILL');
  if (server) server.close();
  if (!process.argv.includes('--keep')) await rm(PROFILE, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 }).catch(() => {});
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) { console.log('failing: ' + failed.map((f) => f.name).join(', ')); code = 1; }
}
process.exit(code);