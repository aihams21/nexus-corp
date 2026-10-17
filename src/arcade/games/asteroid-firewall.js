// g12 — Asteroid Firewall: 360 degree vector shooter with thrust, rotation and screen wrap.
import { PALETTE } from '../kernel/render.js';
import { clamp, TAU, angleDelta } from '../../core/math.js';
import { wrapPoint } from '../kernel/shapes.js';
import { intersectCircle } from '../kernel/collide.js';

export const meta = {
  id: 'g12',
  no: 12,
  unlockAt: 0,
  accent: PALETTE.cyan,
  name: { ar: 'حاجز الكويكبات', en: 'Asteroid Firewall' },
  tag: { ar: 'دور · ادفع · أطلق', en: 'rotate · thrust · fire' },
  desc: {
    ar: 'اقلب ناقلك، ادفعه بالوقود، وافتح ممرات آمنة عبر حزام الكويكبات المتصدع.',
    en: 'Rotate your interceptor, burn fuel to thrust, and carve a safe lane through the fracturing rock belt.'
  },
  hint: { ar: 'أسهم أو WASD · مسافة للإطلاق', en: 'ARROWS or WASD · SPACE to fire' }
};

export function create(m) {
  const W = m.w;
  const H = m.h;
  const ROCKET_R = 8;
  const BULLET_S = 430;
  const BULLET_R = 2;
  const RUN_TIME = 75;

  let ship = null;
  let rocks = [];
  let bullets = [];
  let parts = [];
  let left = RUN_TIME;
  let spawnIn = 0.6;
  let wave = 1;
  let killed = 0;
  let bestWave = 1;
  let ended = false;
  let fireCd = 0;

  function randPos(margin) {
    return {
      x: m.rng.range(margin, W - margin),
      y: m.rng.range(margin + 22, H - margin)
    };
  }

  function spawnWave() {
    const count = 4 + Math.min(6, Math.floor(wave * 0.8));
    for (let i = 0; i < count; i++) {
      const p = randPos(40);
      const big = m.rng.chance(0.42) || wave < 2;
      const r = big ? m.rng.range(19, 26) : m.rng.range(10, 15);
      const a = m.rng.range(0, TAU);
      const sp = big ? m.rng.range(20, 34) : m.rng.range(34, 56);
      rocks.push({
        x: p.x, y: p.y, r,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        spin: m.rng.range(-1.5, 1.5), rot: m.rng.range(0, TAU),
        hp: big ? 3 : 1, tier: big ? 1 : 0,
        pts: big ? 12 : 5
      });
    }
    wave++;
    if (wave > bestWave) bestWave = wave;
    m.beep('alarm', 0.55);
  }

  function shatter(rock) {
    killed++;
    m.addScore(rock.pts);
    m.beep('break', 0.6);
    m.noise(0.18, 0.5);
    m.flash(PALETTE.amber);
    for (let i = 0; i < 12; i++) {
      const a = m.rng.range(0, TAU);
      const sp = m.rng.range(40, 170);
      parts.push({ x: rock.x, y: rock.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, c: PALETTE.amber });
    }
    if (rock.tier === 1) {
      const bits = 3;
      for (let i = 0; i < bits; i++) {
        const a = m.rng.range(0, TAU);
        const sp = m.rng.range(50, 95);
        rocks.push({
          x: rock.x, y: rock.y, r: m.rng.range(7, 10),
          vx: rock.vx * 0.5 + Math.cos(a) * sp, vy: rock.vy * 0.5 + Math.sin(a) * sp,
          spin: m.rng.range(-2.6, 2.6), rot: rock.rot,
          hp: 1, tier: 0, pts: 5
        });
      }
    }
  }

  function hitRock(rock, byBullet) {
    rock.hp -= byBullet;
    if (rock.hp <= 0) shatter(rock);
    else m.beep('hit', 0.5);
    return true;
  }

  function blowShip() {
    if (ended) return;
    ended = true;
    m.addScore(-60);
    m.beep('explode', 0.85);
    m.noise(0.42, 0.8);
    m.flash(PALETTE.alert);
    for (let i = 0; i < 26; i++) {
      const a = m.rng.range(0, TAU);
      const sp = m.rng.range(50, 230);
      parts.push({ x: ship.x, y: ship.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7, c: PALETTE.alert });
    }
    m.banner('HULL BREACH', 'bad', 1800);
    m.timers.after(1200, () => {
      m.addScore(Math.ceil(left) * 3);
      m.finish('destroyed');
    });
  }

  function finishRun(reason) {
    if (ended) return;
    ended = true;
    m.addScore(Math.ceil(left) * 4);
    m.beep('win', 0.7);
    m.banner(reason === 'time' ? 'SECTOR CLEARED' : 'RUN ENDED', 'good', 1500);
    m.timers.after(900, () => m.finish(reason));
  }

  function shoot() {
    if (fireCd > 0) return;
    fireCd = 0.14;
    const a = ship.a;
    bullets.push({
      x: ship.x + Math.cos(a) * (ROCKET_R + 4),
      y: ship.y + Math.sin(a) * (ROCKET_R + 4),
      vx: Math.cos(a) * BULLET_S + ship.vx,
      vy: Math.sin(a) * BULLET_S + ship.vy,
      life: 0.9
    });
    m.beep('laser', 0.4);
  }

  function stepFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.965;
      p.vy *= 0.965;
      p.life -= dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
  }

  function update(dt) {
    if (ended) { stepFx(dt); return; }

    if (left > 0) {
      left -= dt;
      if (left <= 0) { left = 0; finishRun('time'); return; }
    }

    const turn = (m.input.right ? 1 : 0) - (m.input.left ? 1 : 0);
    ship.a += turn * 3.9 * dt;

    const thrusting = m.input.up;
    if (thrusting) {
      ship.vx += Math.cos(ship.a) * 320 * dt;
      ship.vy += Math.sin(ship.a) * 320 * dt;
      ship.thrust += dt;
      if (m.rng.chance(0.5)) {
        const t = m.rng.range(0, TAU);
        const sp = m.rng.range(30, 90);
        parts.push({
          x: ship.x - Math.cos(ship.a) * 8 + Math.cos(t) * 3,
          y: ship.y - Math.sin(ship.a) * 8 + Math.sin(t) * 3,
          vx: -ship.vx * 0.18 + Math.cos(t) * sp,
          vy: -ship.vy * 0.18 + Math.sin(t) * sp,
          life: 0.26, c: PALETTE.gold
        });
      }
    } else {
      ship.thrust = 0;
    }

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    ship.vx *= 0.994;
    ship.vy *= 0.994;
    wrapPoint(ship, 16);

    fireCd -= dt;
    if (m.input.wasPressed('Space') || m.input.accept || m.input.clicked) shoot();

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      wrapPoint(b, 4);
      let spent = false;
      for (let j = rocks.length - 1; j >= 0; j--) {
        const rk = rocks[j];
        if (intersectCircle({ x: b.x, y: b.y, r: BULLET_R }, { x: rk.x, y: rk.y, r: rk.r })) {
          hitRock(rk, 1);
          rocks.splice(j, 1);
          spent = true;
          break;
        }
      }
      if (spent || b.life <= 0) bullets.splice(i, 1);
    }

    for (let i = rocks.length - 1; i >= 0; i--) {
      const rk = rocks[i];
      rk.x += rk.vx * dt;
      rk.y += rk.vy * dt;
      rk.rot += rk.spin * dt;
      wrapPoint(rk, rk.r);
      if (intersectCircle({ x: rk.x, y: rk.y, r: rk.r }, { x: ship.x, y: ship.y, r: ROCKET_R - 2 })) {
        rocks.splice(i, 1);
        blowShip();
        return;
      }
    }

    if (rocks.length === 0) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = 1.6;
        spawnWave();
      }
    }

    stepFx(dt);
  }

  function drawRock(g, rk) {
    const n = 7;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rk.rot + (i / n) * TAU;
      const rr = rk.r * (0.82 + 0.18 * Math.sin(i * 2.3 + rk.rot * 1.7));
      const px = rk.x + Math.cos(a) * rr;
      const py = rk.y + Math.sin(a) * rr;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fillStyle = rk.tier === 1 ? '#3A3226' : '#2A2419';
    g.fill();
    g.strokeStyle = rk.tier === 1 ? PALETTE.amberDim : PALETTE.line2;
    g.lineWidth = 1.5;
    g.stroke();
    if (rk.tier === 1) {
      g.fillStyle = PALETTE.amber;
      g.fillRect(rk.x - rk.r * 0.24, rk.y - 2, rk.r * 0.48, 4);
      g.fillRect(rk.x - 2, rk.y - rk.r * 0.24, 4, rk.r * 0.48);
    } else {
      g.fillStyle = PALETTE.line2;
      g.fillRect(rk.x - 2.5, rk.y - 2.5, 5, 5);
    }
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(58,51,35,.55)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(W / 2, 0); g.lineTo(W / 2, H);
    g.moveTo(0, H / 2); g.lineTo(W, H / 2);
    g.stroke();

    for (let i = 0; i < rocks.length; i++) drawRock(g, rocks[i]);

    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      g.fillStyle = PALETTE.cyan;
      g.fillRect(b.x - 1.5, b.y - 5, 3, 10);
      g.fillStyle = PALETTE.ink;
      g.fillRect(b.x - 0.5, b.y - 3, 1, 6);
    }

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      g.globalAlpha = Math.max(0, p.life / 0.5);
      g.fillStyle = p.c;
      g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      g.globalAlpha = 1;
    }

    if (!ended && ship) {
      g.save();
      g.translate(ship.x, ship.y);
      g.rotate(ship.a);
      g.fillStyle = PALETTE.phos;
      g.beginPath();
      g.moveTo(ROCKET_R + 4, 0);
      g.lineTo(-ROCKET_R + 2, -ROCKET_R * 0.78);
      g.lineTo(-ROCKET_R - 2, 0);
      g.lineTo(-ROCKET_R + 2, ROCKET_R * 0.78);
      g.closePath();
      g.fill();
      g.strokeStyle = PALETTE.bg0;
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = PALETTE.violet;
      g.beginPath();
      g.arc(-1, 0, 3, 0, TAU);
      g.fill();
      if (ship.thrust > 0) {
        g.fillStyle = PALETTE.gold;
        g.fillRect(-ROCKET_R - 8, -3, 6, 6);
      }
      g.restore();
    }

    g.font = '700 9px "JetBrains Mono", monospace';
    g.textBaseline = 'top';
    g.fillStyle = PALETTE.ink3;
    g.textAlign = 'left';
    g.fillText(`WAVE ${wave}`, 8, 7);
    g.fillStyle = PALETTE.phos;
    g.fillText(`ROCKS ${rocks.length}`, 8, 19);

    g.textAlign = 'right';
    g.fillStyle = PALETTE.ink3;
    g.fillText(`KILLS ${killed}`, W - 8, 7);
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${Math.ceil(left)}s`, W - 8, 19);
    g.textAlign = 'left';
  }

  function reset() {
    ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, thrust: 0 };
    rocks = [];
    bullets = [];
    parts = [];
    left = RUN_TIME;
    wave = 1;
    killed = 0;
    bestWave = 1;
    ended = false;
    fireCd = 0;
    spawnIn = 0.6;
    m.setScore(0);
    spawnWave();
    m.hint({ ar: 'اقلب بدور · ادفع للأمام · أطلق بالقوالب', en: 'Rotate to aim · thrust forward · fire to clear' });
  }

  reset();
  return { update, draw };
}