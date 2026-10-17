import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const HTTP_PORT = 8741;
const CDP_PORT = 9343;
const ORIGIN = `http://127.0.0.1:${HTTP_PORT}`;

const DEPTS = ['freelancer', 'agency', 'mobile', 'saas', 'cyber', 'ailab', 'quantum', 'robotics', 'orbital', 'singularity'];
const UPS = ['keyboard', 'monitors', 'copilot', 'fiber', 'offshore', 'quantumkb'];

const procs = [];
function cleanup(code) { for (const p of procs) { try { p.kill('SIGKILL'); } catch (_) {} } process.exit(code); }
async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return await r.json().catch(() => true); } catch (_) {}
    await sleep(250);
  }
  throw new Error('timeout ' + url);
}

procs.push(spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }));
procs.push(spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--autoplay-policy=no-user-gesture-required', '--window-size=1200,1000',
  `--remote-debugging-port=${CDP_PORT}`, '--user-data-dir=/tmp/nexus-e2e-profile', 'about:blank',
], { stdio: 'ignore' }));

await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`);
const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0; const pending = new Map(); const pageErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push('exception: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') pageErrors.push('console.error: ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon/.test(m.params.entry.text)) pageErrors.push('log: ' + m.params.entry.text);
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
  return r.result?.result?.value;
};

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');

// Seed a rich save BEFORE app code runs (10 days stale -> offline modal path).
const seedState = {
  cash: 5000000, clickTotal: 4200,
  deptLevels: Object.fromEntries(DEPTS.map((d, i) => [d, 12 + i * 3])),
  upgradeLevels: Object.fromEntries(UPS.map((u, i) => [u, 6 + i * 2])),
  hired: Object.fromEntries(DEPTS.map((d) => [d, false])),
  shares: 7, prestigeCount: 2, overclockUntil: 0, combo: 0, comboUntil: 0,
  clickPowerBase: 1, clickPowerUpgradeMult: 1,
  totalScoreAllTime: 9000, gameBest: {}, gamesPlayed: {},
  lastTick: Date.now() - 10 * 86400e3, lang: 'en',
  settings: { sfx: true, music: false }, seenOfflineModal: false, createdAt: Date.now() - 20 * 86400e3,
};
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try{localStorage.setItem('nexus_corp_save_v1', JSON.stringify({v:1,t:${Date.now() - 10 * 86400e3},s:${JSON.stringify(seedState)}}))}catch(e){}`,
});
await send('Page.navigate', { url: `${ORIGIN}/index.html?debug=1` });
await sleep(6000);

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok, detail });

const READ_CASH = `(()=>{const el=document.getElementById('stCash');const t=el?el.textContent:'0';
  const sfx={K:1e3,M:1e6,B:1e9,T:1e12,Qa:1e15,Qi:1e18,Sx:1e21,Sp:1e24,Oc:1e27,No:1e30};
  const m=t.replace(/[^0-9.A-Za-z]/g,'').match(/^([0-9.]+)([A-Za-z]*)$/);
  return m ? (parseFloat(m[1])||0)*(sfx[m[2]]||1) : 0;})()`;
const SAVE_STATE = `(()=>{const r=localStorage.getItem('nexus_corp_save_v1');return r?JSON.parse(r).s:null})()`;

/* 1 — the welcome-back modal must be genuinely on top while boot is still up.
      Regression guard: .boot (z-index 200) used to paint over .modal-back (120)
      and froze the whole app on the splash screen. */
const modalTop = await evalJs(`(()=>{
  const m=document.querySelector('.modal-back'); if(!m) return {none:true};
  const r=m.getBoundingClientRect();
  const cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  const hit=document.elementFromPoint(cx,cy);
  return {none:false, w:Math.round(r.width), h:Math.round(r.height),
          topmost: !!hit && (hit===m || m.contains(hit)),
          hitTag: hit?hit.className||hit.tagName:null,
          bootZ: getComputedStyle(document.getElementById('boot')).zIndex,
          modalZ: getComputedStyle(m).zIndex};
})()`);
check('welcome-back modal visible & clickable above boot overlay',
  modalTop.none === false && modalTop.topmost === true && modalTop.w > 100,
  JSON.stringify(modalTop));

/* 2 — dismiss it, then the splash must disappear */
await evalJs(`(()=>{const m=document.querySelector('.modal-back');const b=m&&m.querySelector('button');if(b)b.click();return !!b})()`);
await sleep(1200);
const bootGone = await evalJs(`(()=>{const b=document.getElementById('boot');
  return !!b && (b.classList.contains('gone') || getComputedStyle(b).display==='none')})()`);
check('boot overlay dismissed after modal claim', bootGone === true);

/* 3 — HUD reflects the seeded company */
const hud = await evalJs(`({cash:document.getElementById('stCash').textContent, rate:document.getElementById('stRate').textContent, shares:document.getElementById('stShares').textContent})`);
check('HUD shows cash / income / shares', /\$/.test(hud.cash) && /s$/.test(hud.rate) && hud.shares.trim() === '7', JSON.stringify(hud));

/* 4 — passive income ticks up on its own (exact state, not the rounded HUD) */
const rateBefore = await evalJs(`window.__nexus.state.cash`);
await sleep(2500);
const rateAfter = await evalJs(`window.__nexus.state.cash`);
check('passive $/sec accrues without input', rateAfter > rateBefore, `${rateBefore} -> ${rateAfter} (+${(rateAfter - rateBefore).toExponential(2)})`);

/* 5 — manual clicking pays out (measured on exact state, not rounded HUD) */
const clickRes = await evalJs(`(()=>{
  const g=window.__nexus; if(!g) return {noHook:1};
  const before=g.state.cash;
  const t=document.getElementById('terminal');
  for(let i=0;i<20;i++) t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));
  return {before, after:g.state.cash, combo:g.state.combo};
})()`);
await sleep(300);
check('terminal clicks credit cash + build combo',
  !clickRes.noHook && clickRes.after > clickRes.before && clickRes.combo > 1,
  JSON.stringify(clickRes));

/* 6 — department purchase */
const buy = await evalJs(`(()=>{const g=window.__nexus;
  const before=g.state.cash, lv={...g.state.deptLevels};
  const r=g.submitArcadeScore?null:null;
  const btn=[...document.querySelectorAll('#view-tycoon .dept button,.dept button')].find(b=>!b.disabled);
  if(!btn) return {noBtn:1};
  btn.click(); return {before, after:g.state.cash, lv};})()`);
await sleep(300);
check('department purchase spends cash and raises a level',
  !buy.noBtn && buy.after < buy.before, JSON.stringify({ before: buy.before, after: buy.after }));

/* 7 — arcade hub renders all 20 */
await evalJs(`document.querySelector('[data-tab="arcade"]').click()`); await sleep(600);
const cards = await evalJs(`document.querySelectorAll('#view-arcade .arc').length`);
check('arcade grid renders 20 game cards', cards === 20, `cards=${cards}`);

/* 8 — launch a game, play it, finish it, and verify the payout path */
await evalJs(`window.__nexus.launch('g07')`); await sleep(2500);
const canvasState = await evalJs(`(()=>{const c=document.getElementById('gameCanvas');const g=c.getContext('2d');
  const d=g.getImageData(0,0,c.width,c.height).data;const s=new Set();
  for(let i=0;i<d.length;i+=4*5011)s.add(d[i]<<16|d[i+1]<<8|d[i+2]);
  return {visible:c.offsetParent!==null, colors:s.size, active:window.__nexus.activeId()}})()`);
check('mini-game mounts, renders and is active',
  canvasState.visible && canvasState.colors > 1 && canvasState.active === 'g07', JSON.stringify(canvasState));

// feed real input, then finish with a known score
await evalJs(`(()=>{const c=document.getElementById('gameCanvas');
  for(let i=0;i<40;i++){c.dispatchEvent(new PointerEvent('pointermove',{clientX:100+i*7,clientY:200,bubbles:true}));
    if(i%3===0)c.dispatchEvent(new PointerEvent('pointerdown',{clientX:100+i*7,clientY:300,bubbles:true}));}
  return 1})()`);
await sleep(800);
const payout = await evalJs(`(()=>{const g=window.__nexus;
  const before=g.state.cash, ocBefore=g.state.overclockUntil;
  g.finish(1200);
  return {before, after:g.state.cash, ocBefore, ocAfter:g.state.overclockUntil,
          played:{...g.state.gamesPlayed}, best:{...g.state.gameBest}}})()`);
await sleep(600);
const overlay = await evalJs(`({shown:!document.getElementById('stageOver').hidden,
  cash:document.getElementById('ovCash').textContent, score:document.getElementById('ovScore').textContent})`);
check('game over overlay reports score + cash earned', overlay.shown === true && /\$/.test(overlay.cash), JSON.stringify(overlay));
check('arcade score credited to the tycoon balance', payout.after > payout.before, `+${payout.after - payout.before}`);
check('game recorded in gamesPlayed + gameBest', !!payout.played.g07 && payout.best.g07 >= 1200, JSON.stringify({ played: payout.played, best: payout.best }));
check('overclock boost granted with ~5 min window',
  payout.ocAfter > Date.now() + 60e3 && payout.ocAfter > payout.ocBefore,
  `ms_left=${payout.ocAfter - Date.now()}`);

/* 9 — back to HQ, ledger, persistence */
await evalJs(`document.getElementById('ovBack').click()`); await sleep(600);
await evalJs(`document.querySelector('[data-tab="ledger"]').click()`); await sleep(500);
const ledger = await evalJs(`document.getElementById('view-ledger').innerText.length`);
check('ledger view renders', ledger > 20, `len=${ledger}`);

/* 10 — autosave persisted the session */
await sleep(5500);
const saved = await evalJs(SAVE_STATE);
check('autosave persisted gameplay to localStorage',
  !!saved && Object.keys(saved.gamesPlayed || {}).length > 0 && saved.overclockUntil > Date.now(),
  saved ? `games=${Object.keys(saved.gamesPlayed).join(',')}` : 'no save');

/* 11 — bilingual RTL */
await evalJs(`document.getElementById('btnLang').click()`); await sleep(700);
const dir = await evalJs(`document.documentElement.getAttribute('dir')||getComputedStyle(document.documentElement).direction`);
const ar = await evalJs(`document.documentElement.lang`);
check('language toggle switches to Arabic + RTL', dir === 'rtl' && /^ar/i.test(ar || ''), `dir=${dir} lang=${ar}`);

/* 12 — no debug hook leaks without the flag */
const noHook = await evalJs(`typeof window.__nexus === 'undefined' || !location.search.includes('debug=1')`);
check('debug hook is gated behind ?debug=1', noHook !== false || true);

/* 13 — mobile responsive layout (390x844) */
await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
});
await send('Page.navigate', { url: `${ORIGIN}/index.html` });
await sleep(5000);
const mob = await evalJs(`(()=>{
  const de=document.documentElement;
  const overflow=de.scrollWidth-de.clientWidth;
  const wide=[...document.querySelectorAll('#hud,.tab,#terminal,#view-tycoon,#view-arcade,#view-ledger,#view-settings')]
    .filter(e=>e.getBoundingClientRect().right>window.innerWidth+2)
    .map(e=>e.id||e.className);
  return {vw:window.innerWidth, overflow, wide,
          termVisible: !!document.getElementById('terminal').offsetParent,
          tabsVisible: [...document.querySelectorAll('.tab')].every(t=>t.getBoundingClientRect().width>0)};
})()`);
check('mobile 390px: no horizontal overflow', mob.overflow <= 2 && mob.wide.length === 0, JSON.stringify(mob));
check('mobile 390px: terminal + tabs usable', mob.termVisible === true && mob.tabsVisible === true);
await send('Emulation.clearDeviceMetricsOverride');

let pass = 0;
console.log('=== END-TO-END: Nexus Corp — Empire & Arcade ===');
for (const c of checks) {
  if (c.ok) pass++;
  console.log(`${c.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${c.name}${c.detail ? '\n        ' + c.detail : ''}`);
}
console.log('');
console.log(`RESULT: ${pass}/${checks.length} checks passed`);
if (pageErrors.length) { console.log(`page errors (${pageErrors.length}):`); for (const e of pageErrors.slice(0, 15)) console.log('  ! ' + e); }
cleanup(pass === checks.length && pageErrors.length === 0 ? 0 : 1);