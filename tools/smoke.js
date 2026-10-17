import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const HTTP_PORT = 8731;
const CDP_PORT = 9333;
const ORIGIN = `http://127.0.0.1:${HTTP_PORT}`;

const procs = [];
function cleanup(code) {
  for (const p of procs) { try { p.kill('SIGKILL'); } catch (_) {} }
  process.exit(code);
}

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json().catch(() => true);
    } catch (_) {}
    await sleep(250);
  }
  throw new Error('timeout waiting for ' + url);
}

const http = spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore' });
procs.push(http);

const chrome = spawn('/usr/bin/chromium', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--autoplay-policy=no-user-gesture-required',
  '--window-size=900,900',
  `--remote-debugging-port=${CDP_PORT}`,
  '--user-data-dir=/tmp/nexus-smoke-profile',
  'about:blank',
], { stdio: 'ignore' });
procs.push(chrome);

await waitFor(`http://127.0.0.1:${CDP_PORT}/json/version`);
const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) { console.error('no page target'); cleanup(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push('exception: ' + (m.params.exceptionDetails?.exception?.description
      || m.params.exceptionDetails?.text));
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
    consoleErrors.push('log: ' + m.params.entry.text + ' @ ' + (m.params.entry.url || ''));
  }
};
function send(method, params = {}) {
  const id = ++msgId;
  return new Promise((res) => { pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
}

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url: `${ORIGIN}/tools/smoke.html` });

let report = null;
for (let i = 0; i < 160; i++) {
  const r = await send('Runtime.evaluate', {
    expression: 'window.__SMOKE_DONE__ ? JSON.stringify(window.__SMOKE__) : ""',
    returnByValue: true,
  });
  const v = r.result?.result?.value;
  if (v) { report = JSON.parse(v); break; }
  await sleep(500);
}
if (!report) {
  console.error('harness did not finish in time');
  console.error('page errors:', consoleErrors.slice(0, 20));
  cleanup(1);
}

console.log(`games registered: ${report.gameCount}`);
console.log(`harness errors  : ${report.errors.length}`);
for (const e of report.errors.slice(0, 20)) console.log('   ! ' + e);
console.log('');
let pass = 0;
for (const r of report.results) {
  if (r.ok) pass++;
  const flag = r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`${flag} ${r.id.padEnd(30)} frames=${String(r.frames).padStart(3)} colors=${r.distinctColors} clean=${r.teardownClean ? 'y' : 'n'} score=${JSON.stringify((report.finishes.find((f) => f.id === r.id) || {}).score ?? '-')}`);
  if (r.error) console.log('        error: ' + r.error.split('\n')[0]);
}
console.log('');
console.log(`RESULT: ${pass}/${report.results.length} games OK`);
const pageErrors = consoleErrors.filter((e) => !e.includes('favicon'));
if (pageErrors.length) {
  console.log(`page-level errors (${pageErrors.length}):`);
  for (const e of pageErrors.slice(0, 15)) console.log('   ! ' + e);
}
cleanup(pass === report.results.length && report.errors.length === 0 ? 0 : 1);