/* Pure-node unit suite. Imports only DOM-free modules. */
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.performance = globalThis.performance || { now: () => Date.now() };
import { clamp, clamp01, lerp, approach, easeToward, angleDelta, mmss, mixHex } from '../src/core/math.js';
import { costAt, GROWTH, cash, points, mult, secsLeft } from '../src/core/money.js';
import { makeRng } from '../src/core/rng.js';
import { MAX_DT, FAST_SPEED, SUB_STEPS, createLoop, needsSubStep, stepClamped, integrate } from '../src/core/engine.js';
import {
  computeOfflineEarnings, OFFLINE_CAP_SECONDS, OFFLINE_EFFICIENCY,
  pack, exportSave, importSave, describeSave,
} from '../src/core/save.js';
import {
  DEPTS, MILESTONES, deptCost, deptOutput, flowRate, netWorth, baseFlow,
  overclockFactor, overclockActive, overclockLeft, prodMult, hitValue,
  comboCount, doHit, decayCombo, buyDept, scoreToCash, grantOverclock,
  milestoneMult, nextMilestone, OVERCLOCK_MS,
} from '../src/tycoon/ledger.js';
import { GEAR, gearCost, gearClickMult, gearIsMaxed, buyGear } from '../src/tycoon/gear.js';
import { EXECS, hireExec, isHired, autoDepartments, hasAutoGear, hasAutoHit } from '../src/tycoon/execs.js';
import { IPO_MIN_WORTH, sharesMult, sharesFor, ipoPreview, doIpo } from '../src/tycoon/ipo.js';
import { intersectAABB, intersectCircle, closestPointOnAABB, intersectCircleAABB, resolveCircleAABB } from '../src/arcade/kernel/collide.js';
import { clampCircle, wrapPoint, rect, circle } from '../src/arcade/kernel/shapes.js';

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  failures.push(name + (extra ? ' → ' + extra : ''));
}
function eq(name, a, b) { ok(name, a === b, `got ${a} want ${b}`); }
function near(name, a, b, e = 1e-9) { ok(name, Math.abs(a - b) <= e, `got ${a} want ${b}`); }

/* ── math ─────────────────────────────────────────────────────────────── */
eq('clamp hi', clamp(5, 0, 3), 3);
eq('clamp lo', clamp(-5, 0, 3), 0);
eq('clamp01', clamp01(2), 1);
eq('lerp', lerp(0, 10, 0.25), 2.5);
eq('approach under', approach(0, 10, 3), 3);
eq('approach over', approach(0, 10, 30), 10);
eq('approach away', approach(10, 0, 30), 0);
near('easeToward id', easeToward(5, 5, 10, 0.1), 5);
ok('easeToward moves', easeToward(0, 10, 10, 0.1) > 0 && easeToward(0, 10, 10, 0.1) < 10);
near('angleDelta wrap', angleDelta(0.1, Math.PI * 2 - 0.1), -0.2, 1e-9);
near('angleDelta direct', angleDelta(3, 1), -2, 1e-9);
eq('mmss', mmss(75), '1:15');
eq('mmss neg', mmss(-3), '0:00');
ok('mixHex', typeof mixHex('#000000', '#ffffff', 0.5) === 'string' && mixHex('#000000', '#ffffff', 0.5).startsWith('rgb'));

/* ── money ────────────────────────────────────────────────────────────── */
eq('GROWTH', GROWTH, 1.15);
near('costAt n=0', costAt(100, 0), 100);
near('costAt n=1', costAt(100, 1), 115);
near('costAt n=2', costAt(100, 2), 132.25);
eq('cash zero', cash(0), '$0');
eq('cash small', cash(1.25), '$1.25');
eq('cash k', cash(1250), '$1.25K');
eq('cash m', cash(4.5e6), '$4.50M');
eq('cash b', cash(8.9e9), '$8.90B');
eq('cash t', cash(1.2e12), '$1.20T');
eq('cash qa', cash(5e15), '$5.00Qa');
ok('cash negative', cash(-1250).startsWith('-$'), cash(-1250));
ok('cash huge finite', /^\$\d/.test(cash(9.9e24)), cash(9.9e24));
eq('cash nonfinite', cash(NaN), '$0');
eq('points', points(1234.7), '1,234');
eq('mult', mult(1.25), 'x1.25');
eq('secsLeft', secsLeft(4200), 5);

/* ── rng ──────────────────────────────────────────────────────────────── */
const r1 = makeRng(1234);
const r2 = makeRng(1234);
let same = true;
for (let i = 0; i < 50; i++) if (r1.next() !== r2.next()) same = false;
ok('rng deterministic', same);
const r3 = makeRng(7);
ok('rng in range', Array.from({ length: 200 }, () => r3.next()).every((v) => v >= 0 && v < 1));
const r4 = makeRng(9);
ok('rng int inclusive', Array.from({ length: 100 }, () => r4.int(1, 3)).every((v) => v >= 1 && v <= 3 && Number.isInteger(v)));
eq('rng shuffle keeps set', makeRng(3).shuffle([1, 2, 3, 4, 5]).slice().sort().join(''), '12345');

/* ── engine invariants ────────────────────────────────────────────────── */
eq('MAX_DT', MAX_DT, 0.033);
eq('FAST_SPEED', FAST_SPEED, 400);
eq('SUB_STEPS', SUB_STEPS, 4);
ok('needsSubStep slow', !needsSubStep(100, 100));
ok('needsSubStep exactly 400 false', !needsSubStep(400, 0));
ok('needsSubStep 401 true', needsSubStep(401, 0));
ok('needsSubStep vy', needsSubStep(0, -900));
eq('stepClamped', stepClamped(10, 1000, 0.05, 0, 100), 60);
eq('stepClamped hi', stepClamped(90, 1000, 0.05, 0, 100), 100);
eq('stepClamped lo', stepClamped(10, -1000, 0.05, 0, 100), 0);
let slowSteps = 0;
let fastSteps = 0;
integrate(0.016, 100, 0, () => { slowSteps++; });
integrate(0.016, 900, 0, () => { fastSteps++; });
eq('integrate slow = 1', slowSteps, 1);
eq('integrate fast = 4', fastSteps, 4);
{
  let x = 0;
  const v = 4000;
  for (let i = 0; i < 8; i++) x = stepClamped(x, v, 0.033 / 4, 0, 480);
  ok('substep stays in bounds', x <= 480 && x >= 0, String(x));
}

/* ── loop dt clamp ────────────────────────────────────────────────────── */
{
  let seen = null;
  const loop = createLoop((dt) => { seen = dt; }, null);
  ok('loop not running initially', !loop.running());
  loop.start();
  ok('loop running', loop.running());
  loop.stop();
  ok('loop stopped', !loop.running());
  ok('dt clamped', seen === null || seen <= MAX_DT + 1e-12, String(seen));
}

/* ── collision ────────────────────────────────────────────────────────── */
const A = rect(0, 0, 10, 10);
const B = rect(5, 5, 10, 10);
const FAR = rect(100, 100, 10, 10);
ok('aabb overlap', intersectAABB(A, B));
ok('aabb sep', !intersectAABB(A, FAR));
ok('aabb touching not overlap', !intersectAABB(A, rect(10, 0, 5, 5)));
ok('aabb symmetric', intersectAABB(B, A));
const c1 = circle(0, 0, 5);
const c2 = circle(8, 0, 4);
ok('circle overlap', intersectCircle(c1, c2));
ok('circle sep', !intersectCircle(c1, circle(20, 0, 4)));
ok('circle touching not overlap', !intersectCircle(c1, circle(9, 0, 4)));
near('closestPoint clamp x', closestPointOnAABB(50, 5, A).x, 10);
near('closestPoint clamp y', closestPointOnAABB(5, -8, A).y, 0);
near('closestPoint inside', closestPointOnAABB(5, 5, A).x, 5);
ok('circle vs aabb hit', intersectCircleAABB(circle(12, 5, 4), A));
ok('circle vs aabb miss', !intersectCircleAABB(circle(40, 40, 4), A));
ok('circle centre inside box', intersectCircleAABB(circle(5, 5, 1), A));
{
  const res = resolveCircleAABB(circle(12, 5, 4), A);
  ok('resolve hit', res.hit);
  near('resolve unit normal', Math.hypot(res.nx, res.ny), 1, 1e-9);
  ok('resolve depth', res.depth > 0 && res.depth < 4.01, String(res.depth));
  near('resolve contact on box', res.px, 10, 1e-9);
}
{
  const inside = circle(5, 5, 3);
  const res = resolveCircleAABB(inside, A);
  ok('resolve from inside hits', res.hit);
  near('inside unit normal', Math.hypot(res.nx, res.ny), 1, 1e-9);
  // the contract is: (px,py) is the contact point on a face, the normal points
  // out of the box and `depth` clears the radius. Applying them must eject the
  // circle so it no longer overlaps.
  const moved = { x: inside.x + res.nx * res.depth, y: inside.y + res.ny * res.depth };
  ok('inside ejects clear of box', !intersectCircleAABB(moved, A), `${moved.x},${moved.y}`);
  ok('inside depth clears radius', res.depth > inside.r, String(res.depth));
  const leftBiased = resolveCircleAABB(circle(7, 5, 3), A);
  near('inside nearest face normal', leftBiased.nx, 1, 1e-9);
  const moved2 = { x: 7 + leftBiased.nx * leftBiased.depth, y: 5 };
  ok('nearest-face eject clears box', !intersectCircleAABB(moved2, A), `${moved2.x}`);
}

/* ── shapes ───────────────────────────────────────────────────────────── */
{
  const c = circle(600, 350, 10);
  clampCircle(c, 480, 360);
  ok('clampCircle x hi', c.x === 470, String(c.x));
  ok('clampCircle y hi', c.y === 350, String(c.y));
  const cIn = circle(200, 200, 10);
  clampCircle(cIn, 480, 360);
  ok('clampCircle leaves in-bounds alone', cIn.x === 200 && cIn.y === 200);
  const d = circle(-5, -5, 10);
  clampCircle(d, 480, 360);
  ok('clampCircle lo', d.x === 10 && d.y === 10, `${d.x},${d.y}`);
  const w = { x: 500, y: 400 };
  wrapPoint(w, 480, 360);
  ok('wrapPoint', w.x < 480 && w.y < 360, `${w.x},${w.y}`);
  const wIn = { x: 100, y: 100 };
  wrapPoint(wIn, 480, 360);
  ok('wrapPoint leaves interior alone', wIn.x === 100 && wIn.y === 100);
}

/* ── offline earnings ─────────────────────────────────────────────────── */
{
  const short = computeOfflineEarnings(100, 60);
  near('offline short earned', short.earned, 100 * 60 * OFFLINE_EFFICIENCY);
  ok('offline short not capped', !short.wasCapped);
  const long = computeOfflineEarnings(100, OFFLINE_CAP_SECONDS * 3);
  ok('offline capped', long.wasCapped);
  near('offline capped used', long.usedSeconds, OFFLINE_CAP_SECONDS);
  const never = computeOfflineEarnings(0, 5000);
  near('offline zero rate', never.earned, 0);
  const neg = computeOfflineEarnings(100, -50);
  near('offline negative elapsed', neg.earned, 0);
  const negRate = computeOfflineEarnings(-5, 100);
  near('offline negative rate', negRate.earned, 0);
}

/* ── save pack / export / import ──────────────────────────────────────── */
{
  const state = { cash: 1234.5, shares: 3, deptLevels: { garage: 2 } };
  const packed = pack(state);
  eq('pack version field', typeof packed.at, 'number');
  ok('pack carries data', packed.data.cash === 1234.5);
  const text = exportSave(state);
  const back = importSave(text);
  near('import round trip', back.cash, 1234.5);
  eq('import shares', back.shares, 3);
  eq('import dept', back.deptLevels.garage, 2);
  let threw = null;
  try { importSave('not json'); } catch (e) { threw = e.message; }
  eq('import garbage throws PARSE', threw, 'PARSE');
  threw = null;
  try { importSave(''); } catch (e) { threw = e.message; }
  eq('import empty throws EMPTY', threw, 'EMPTY');
  threw = null;
  try { importSave('{"data":{"cash":"abc"}}'); } catch (e) { threw = e.message; }
  eq('import bad shape throws SHAPE', threw, 'SHAPE');
  const bare = importSave(JSON.stringify(state));
  near('import accepts bare state', bare.cash, 1234.5);
  const d = describeSave(state);
  ok('describeSave', typeof d.savedAt === 'number' && typeof d.points === 'number');
}

/* ── ledger ───────────────────────────────────────────────────────────── */
{
  const S = {
    cash: 0, clickTotal: 0, deptLevels: {}, gearLevels: {}, hired: {},
    shares: 0, prestigeCount: 0, overclockUntil: 0, combo: 0, comboUntil: 0,
  };
  eq('10 departments', DEPTS.length, 10);
  eq('milestones', MILESTONES.join(','), '10,25,50,100,200');
  eq('milestoneMult 0', milestoneMult(0), 1);
  eq('milestoneMult 10', milestoneMult(10), 2);
  eq('milestoneMult 25', milestoneMult(25), 4);
  eq('milestoneMult 200', milestoneMult(200), 32);
  eq('nextMilestone 9', nextMilestone(9), 10);
  eq('nextMilestone 10', nextMilestone(10), 25);
  eq('nextMilestone 200', nextMilestone(200), null);

  const g = DEPTS[0];
  near('deptCost first', deptCost(S, g.id), g.base);
  near('deptOutput 0', deptOutput(S, g.id), 0);
  S.deptLevels[g.id] = 1;
  near('deptOutput 1', deptOutput(S, g.id), g.per);
  S.deptLevels[g.id] = 10;
  near('deptOutput 10 doubled', deptOutput(S, g.id), g.per * 10 * 2);
  near('flowRate', flowRate(S), g.per * 10 * 2);
  near('netWorth includes cash+depts', netWorth(S), S.cash + flowRate(S) * 0 + g.base * 10);

  eq('overclockFactor idle', overclockFactor(S), 2);
  S.deptLevels[DEPTS[3].id] = 25;
  eq('overclockFactor 2 tiers', overclockFactor(S), 3);
  S.deptLevels[DEPTS[9].id] = 200;
  eq('overclockFactor cap 5', overclockFactor(S), 5);

  eq('overclock inactive', overclockActive(S, 1000), false);
  S.overclockUntil = 1000 + OVERCLOCK_MS;
  ok('overclock active', overclockActive(S, 1000));
  near('overclockLeft', overclockLeft(S, 1000), OVERCLOCK_MS);
  near('prodMult with oc', prodMult(S, 1000), 5);
  S.overclockUntil = 0;

  S.shares = 2;
  near('prodMult shares only', prodMult(S, 1000), 1.2);
  near('sharesMult', sharesMult(2), 1.2);

  const h = hitValue(S);
  near('hitValue shares', h, 1 * gearClickMult(S) * 1.2);
  near('hitValue no gear', h, 1.2);
  near('hitValue no shares', hitValue({ ...S, shares: 0 }), gearClickMult(S));

  const r1 = doHit(S, 1000);
  ok('doHit credits', r1.gain > 0);
  eq('doHit combo 1', r1.combo, 1);
  const comboBefore = comboCount(S);
  doHit(S, 1100);
  eq('combo climbs', comboCount(S), comboBefore + 1);
  decayCombo(S, 1000 + 9999);
  eq('combo decays', comboCount(S), 0);

  const cashBefore = S.cash;
  const rb = doHit(S, 1000);
  near('doHit applies gain', S.cash, cashBefore + rb.gain);

  const cost0 = deptCost(S, g.id);
  S.cash = cost0;
  const res = buyDept(S, g.id);
  eq('buyDept ok', res.ok, true);
  eq('buyDept reason', res.reason, 'bought');
  const broke = buyDept(S, g.id);
  eq('buyDept rejects funds', broke.reason, 'funds');
  eq('buyDept unknown', buyDept(S, 'nope').reason, 'unknown');

  const payout = scoreToCash(1000, S, 1000);
  eq('scoreToCash floor*0.5*mult', payout, Math.floor(1000) * 0.5 * prodMult(S, 1000));
  eq('scoreToCash zero', scoreToCash(0, S, 1000), 0);
  eq('scoreToCash negative', scoreToCash(-500, S, 1000), 0);

  grantOverclock(S, OVERCLOCK_MS, 1000);
  near('grant sets window', overclockLeft(S, 1000), OVERCLOCK_MS);
  grantOverclock(S, OVERCLOCK_MS / 2, 1000);
  near('grant extends', overclockLeft(S, 1000), OVERCLOCK_MS);
  eq('baseFlow', baseFlow(S), flowRate(S));
}

/* ── gear ─────────────────────────────────────────────────────────────── */
{
  const S = { cash: 1e12, clickTotal: 0, deptLevels: {}, gearLevels: {}, hired: {}, shares: 0, prestigeCount: 0, overclockUntil: 0, combo: 0, comboUntil: 0 };
  eq('gear count', GEAR.length >= 4, true);
  const g0 = GEAR[0];
  near('gearClickMult empty', gearClickMult(S), 1);
  S.gearLevels[g0.id] = 1;
  near('gearClickMult 1', gearClickMult(S), 1 + g0.per);
  S.gearLevels[g0.id] = 2;
  near('gearClickMult 2', gearClickMult(S), (1 + g0.per * 2));
  near('gearCost level0', gearCost(S, GEAR[1].id), GEAR[1].base);
  S.gearLevels[GEAR[1].id] = 3;
  ok('gearCost grows', gearCost(S, GEAR[1].id) > GEAR[1].base);
  S.gearLevels[GEAR[1].id] = 0;
  const r = buyGear(S, GEAR[1].id);
  eq('buyGear ok', r.ok, true);
  eq('buyGear reason', r.reason, 'bought');
  S.gearLevels[GEAR[1].id] = GEAR[1].max;
  ok('gearIsMaxed', gearIsMaxed(S, GEAR[1].id));
  eq('gearCost when maxed', gearCost(S, GEAR[1].id), Infinity);
  eq('buyGear max', buyGear(S, GEAR[1].id).reason, 'max');
  S.gearLevels[GEAR[1].id] = 0;
  S.cash = 0;
  eq('buyGear funds', buyGear(S, GEAR[1].id).reason, 'funds');
  eq('buyGear unknown', buyGear(S, 'zzz').reason, 'unknown');
}

/* ── execs ────────────────────────────────────────────────────────────── */
{
  const S = { cash: 1e14, clickTotal: 0, deptLevels: {}, gearLevels: {}, hired: {}, shares: 0, prestigeCount: 0, overclockUntil: 0, combo: 0, comboUntil: 0 };
  eq('exec count', EXECS.length, 10);
  eq('isHired false', isHired(S, EXECS[0].id), false);
  eq('hire ok', hireExec(S, EXECS[0].id).ok, true);
  eq('isHired true', isHired(S, EXECS[0].id), true);
  eq('hire twice', hireExec(S, EXECS[0].id).reason, 'hired');
  eq('exec unknown', hireExec(S, 'nope').reason, 'unknown');
  S.cash = 0;
  eq('hire funds', hireExec(S, EXECS[1].id).reason, 'funds');
  S.cash = 1e14;
  const auto = EXECS.find((x) => x.grants && x.grants.dept === 'agency');
  hireExec(S, auto.id);
  ok('autoDepartments grows', autoDepartments(S).length >= 1);
  ok('autoDepartments returns ids', autoDepartments(S).every((x) => typeof x === 'string'));
  eq('hasAutoGear before', hasAutoGear(S), false);
  const pilot = EXECS[EXECS.length - 1];
  hireExec(S, pilot.id);
  eq('hasAutoGear after pilot', hasAutoGear(S), true);
  eq('hasAutoHit after pilot', hasAutoHit(S), true);
}

/* ── ipo ──────────────────────────────────────────────────────────────── */
{
  const S = { cash: 0, clickTotal: 0, deptLevels: {}, gearLevels: {}, hired: {}, shares: 0, prestigeCount: 0, overclockUntil: 0, combo: 0, comboUntil: 0 };
  const pv = ipoPreview(S);
  eq('ipo locked below threshold', pv.ok, false);
  eq('ipo reason worth', pv.reason, 'worth');
  eq('IPO_MIN_WORTH', IPO_MIN_WORTH, 1e6);
  eq('sharesFor 1M', sharesFor(1e6), 1);
  eq('sharesFor 0', sharesFor(0), 0);
  ok('sharesFor grows', sharesFor(1e9) > sharesFor(1e6));
  near('sharesMult 0', sharesMult(0), 1);
  near('sharesMult 10', sharesMult(10), 2);
  S.deptLevels[DEPTS[9].id] = 400;
  const pv2 = ipoPreview(S);
  eq('ipo ready', pv2.ok, true);
  eq('ipo reason ready', pv2.reason, 'ready');
  S.cash = 5e6;
  const before = S.shares;
  const r = doIpo(S);
  eq('doIpo ok', r.ok, true);
  ok('doIpo mints', S.shares > before);
  eq('doIpo resets cash', S.cash, 0);
  eq('doIpo resets depts', Object.keys(S.deptLevels).length, 0);
eq('doIpo resets hired', Object.keys(S.hired).length, 0);
  eq('doIpo counts prestige', S.prestigeCount, 1);
  eq('doIpo keeps shares', S.shares, r.shares);
  const again = doIpo(S);
  eq('doIpo blocked when worthless', again.ok, false);
}

/* ── report ───────────────────────────────────────────────────────────── */
const total = pass + fail;
if (fail) {
  console.log(`\n${fail} failing of ${total}:`);
  for (const f of failures) console.log('  FAIL ' + f);
  process.exit(1);
}
console.log(`\n${pass}/${total} unit checks passed`);