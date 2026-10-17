// G05 · Cyber Runner — endless side-scroller through a burning server aisle.
// Jump the low breaches, duck the ceiling drones, keep sprinting.
import { PALETTE } from '../kernel/render.js';
import { clamp } from '../../core/math.js';

const GROUND = 306;
const RUN_W = 480;
const PLAYER_X = 116;
const BODY_W = 26;
const STAND_H = 34;
const DUCK_H = 18;
const GRAV = 2100;
const JUMP_V = -640;
const START_SPEED = 168;
const MAX_SPEED = 470;
const RUN_TIME = 60;

export const meta = {
  id: 'g05',
  no: 5,
  unlockAt: 0,
  accent: PALETTE.cyan,
  name: { ar: 'عدّاء الشبكة', en: 'Cyber Runner' },
  tag: { ar: 'اقفز · انخفض', en: 'jump · duck' },
desc: {
    ar: 'اركض في ممر الخوادم المحترق، اقفز فوق الاختراقات وانخفض تحت الطائرات قبل أن تسقط من جديد.',
    en: 'Sprint a burning server aisle: leap the breaches, duck the drones, never drop back to zero.',
  },
  hint: { ar: 'مسافة أو ↑ للقفز · ↓ للانخفاض', en: 'SPACE or ↑ to jump · ↓ to duck' },
};

export function create(m) {
  const FONT = '"JetBrains Mono", monospace';

  let speed;
  let dist;
  let left;
  let dead;
  let air;
  let ducking;
  let duckLock;
  let spawnIn;
  let nextIsHigh;
  let obstacles;
  let sparks;
  let bestRun;
  let trail;
  let shake;

  function reset() {
    speed = START_SPEED;
    dist = 0;
    left = RUN_TIME;
    dead = false;
    air = false;
    ducking = false;
    duckLock = 0;
    spawnIn = 0.9;
    nextIsHigh = false;
    obstacles = [];
    sparks = [];
    bestRun = 0;
    trail = [];
    shake = 0;
    m.setScore(0);
    m.hint({ ar: 'مسافة أو ↑ للقفز · ↓ للانخفاض', en: 'SPACE or ↑ to jump · ↓ to duck' });
  }

  function ceilGround(h) {
    // Obstacle height budget shrinks the safe gap as the run heats up.
    const heat = clamp((speed - START_SPEED) / (MAX_SPEED - START_SPEED), 0, 1);
    return clamp(120 - heat * 26, 74, 120);
  }

  function spawn() {
    const heat = clamp((speed - START_SPEED) / (MAX_SPEED - START_SPEED), 0, 1);
    const roll = m.rng.next();
    if (nextIsHigh) {
      // Ceiling drone: must duck.
      const w = m.rng.int(30, 44);
      obstacles.push({
        kind: 'drone',
        x: RUN_W + 20,
        y: GROUND - ceilGround(heat) - 6,
        w,
        h: 26,
        passed: false,
        bob: m.rng.range(0, 6.28),
      });
      nextIsHigh = false;
    } else if (roll < 0.62 - heat * 0.16) {
      // Ground breach: must jump.
      const w = m.rng.int(18, 34);
      obstacles.push({ kind: 'spike', x: RUN_W + 20, y: GROUND - 20, w, h: 20, passed: false });
      nextIsHigh = m.rng.chance(0.34);
    } else {
      // Floating blocker: jump timing matters but it is low enough to clear.
      const w = m.rng.int(22, 30);
      obstacles.push({
        kind: 'float',
        x: RUN_W + 20,
        y: GROUND - 46 - m.rng.int(0, 30),
        w,
        h: 18,
        passed: false,
        bob: m.rng.range(0, 6.28),
      });
    }
  }

  function burst(x, y, color, n, spread) {
    for (let i = 0; i < n; i++) {
      const a = m.rng.range(0, 6.2832);
      const s = m.rng.range(40, spread);
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: m.rng.range(0.22, 0.55),
        max: 0.55,
        color,
        size: m.rng.range(1.5, 3),
      });
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function finishRun(reason) {
    if (dead) return;
    dead = true;
    const bonus = Math.max(0, Math.ceil(left)) * 4;
    m.addScore(bonus);
    m.beep(reason === 'time' ? 'win' : 'gameover', 1);
    m.banner(reason === 'time' ? 'AISLE CLEARED' : 'RUN TERMINATED', reason === 'time' ? 'good' : 'bad', 1500);
    m.timers.after(900, () => m.finish(reason));
  }

  function update(dt, time) {
    if (dead) {
      for (const s of sparks) {
        s.life -= dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 900 * dt;
      }
      sparks = sparks.filter((s) => s.life > 0);
      if (shake > 0) shake = Math.max(0, shake - dt * 3);
      return;
    }

    if (!m.ended) left -= dt;

    speed = Math.min(MAX_SPEED, speed + 9 * dt);
    dist += speed * dt;

    if (shake > 0) shake = Math.max(0, shake - dt * 4);

    // Duck / stand.
    if (duckLock > 0) duckLock -= dt;
    const wantDuck = m.input.pointerDown || m.input.isDown('ArrowDown') || m.input.isDown('KeyS');
    ducking = wantDuck && duckLock <= 0;

    const h = ducking ? DUCK_H : STAND_H;
    const bodyY = GROUND - h;

    if (m.input.wasPressed('Space') || m.input.wasPressed('ArrowUp') || m.input.wasPressed('KeyW') || m.input.accept) {
      if (air) {
        duckLock = 0.22;
        air = true;
      } else if (!ducking) {
        air = true;
      }
    }

    // Integrate the jump arc with clamped sub-steps so nothing tunnels.
    if (air) {
      const steps = 4;
      const h1 = dt / steps;
      for (let i = 0; i < steps; i++) {
        vy += GRAV * h1;
        py = clamp(py + vy * h1, -220, 0);
        if (py >= 0) {
          py = 0;
          vy = 0;
          air = false;
        }
      }
    } else {
      py = 0;
      vy = 0;
    }

    const body = { x: PLAYER_X, y: bodyY, w: BODY_W, h };

    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawn();
      const base = 0.86 - (speed - START_SPEED) / (MAX_SPEED - START_SPEED) * 0.34;
      spawnIn = clamp(base * m.rng.range(0.72, 1.34), 0.3, 1.4);
    }

    for (const o of obstacles) {
      o.x -= speed * dt;
      if (o.kind === 'drone' || o.kind === 'float') o.bob += dt * 3.4;
      if (!o.passed) {
        const hitY = o.kind === 'drone' ? o.y + Math.sin(o.bob) * 3 : o.y;
        const ob = { x: o.x, y: hitY, w: o.w, h: o.h };
        if (rectsOverlap(body, ob)) {
          // Ducking players pass under a ceiling drone on purpose.
          const ducked = ducking && o.kind === 'drone';
          if (!ducked) {
            m.addScore(-24);
            shake = 1;
            m.flash(PALETTE.alert);
            m.beep('error', 1);
            m.banner('BREACH', 'bad', 900);
            burst(PLAYER_X + BODY_W / 2, bodyY + h / 2, PALETTE.alert, 16, 220);
            air = true;
            vy = -280;
            o.passed = true;
          }
        } else if (o.x + o.w < PLAYER_X) {
          o.passed = true;
          const gain = o.kind === 'drone' ? 14 : 9;
          m.addScore(gain);
          m.beep('coin', 0.5);
          if (o.kind === 'drone') m.banner('DUCKED', 'good', 620);
        }
      }
    }
    obstacles = obstacles.filter((o) => o.x + o.w > -30);

    trail.push({ x: PLAYER_X, y: bodyY + h / 2, h });
    if (trail.length > 9) trail.shift();

    for (const s of sparks) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 900 * dt;
    }
    sparks = sparks.filter((s) => s.life > 0);

    const d = Math.floor(dist / 10);
    if (d > bestRun) {
      bestRun = d;
      m.setScore(d);
    }

    if (left <= 0) finishRun('time');
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    // Parallax skyline bands.
    const band = (yOff, h, color, speedK, step) => {
      const off = (dist * speedK) % step;
      g.fillStyle = color;
      for (let i = -1; i * step < m.w + step; i++) {
        const x = i * step - off;
        const bump = ((i * 37) % 11) * 2;
        g.fillRect(Math.round(x), yOff - bump, step - 3, h + bump);
      }
    };
    band(196, 110, '#0B0A07', 0.06, 46);
    band(236, 70, '#10130B', 0.14, 34);

    // Grid floor.
    g.strokeStyle = PALETTE.line;
    g.lineWidth = 1;
    const gstep = 24;
    const goff = dist % gstep;
    g.beginPath();
    for (let x = -gstep; x < m.w + gstep; x += gstep) {
      g.moveTo(Math.round(x - goff) + 0.5, GROUND);
      g.lineTo(Math.round(x - goff) + 0.5, m.h);
    }
    g.stroke();

    g.fillStyle = PALETTE.line2;
    g.fillRect(0, GROUND, m.w, 2);
    g.fillStyle = '#0B0A07';
    g.fillRect(0, GROUND + 2, m.w, m.h - GROUND - 2);

    // Lane markers drifting with the world.
    g.fillStyle = PALETTE.amberDim;
    for (let i = 0; i < 10; i++) {
      const x = ((i * 58 - dist * 0.9) % (m.w + 60) + m.w + 60) % (m.w + 60) - 30;
      g.fillRect(Math.round(x), GROUND + 12, 16, 2);
    }

    // Obstacles.
    for (const o of obstacles) {
      const y = o.kind === 'drone' ? o.y + Math.sin(o.bob) * 3 : o.y;
      if (o.kind === 'spike') {
        g.fillStyle = PALETTE.alert;
        const teeth = Math.max(2, Math.round(o.w / 10));
        for (let i = 0; i < teeth; i++) {
          const tx = o.x + (i * o.w) / teeth;
          const tw = o.w / teeth;
          g.beginPath();
          g.moveTo(tx, o.y + o.h);
          g.lineTo(tx + tw / 2, o.y);
          g.lineTo(tx + tw, o.y + o.h);
          g.closePath();
          g.fill();
        }
      } else if (o.kind === 'drone') {
        g.fillStyle = PALETTE.violet;
        g.fillRect(o.x, y, o.w, 8);
        g.fillStyle = PALETTE.alert;
        g.fillRect(o.x + 4, y + 8, o.w - 8, 5);
        g.fillStyle = '#0B0A07';
        const bx = o.x + o.w / 2 + Math.sin(o.bob * 1.4) * 4;
        g.fillRect(bx - 2, y + 9, 4, 3);
        g.fillStyle = PALETTE.violet;
        g.fillRect(o.x - 4, y + 2, 4, 4);
        g.fillRect(o.x + o.w, y + 2, 4, 4);
      } else {
        g.fillStyle = PALETTE.cyan;
        g.fillRect(o.x, y, o.w, o.h);
        g.fillStyle = '#0B0A07';
        g.fillRect(o.x + 3, y + 5, o.w - 6, 3);
      }
    }

    // Player trail.
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const a = (i + 1) / trail.length;
      g.fillStyle = PALETTE.cyan;
      g.globalAlpha = a * 0.16;
      g.fillRect(t.x - 6, t.y - t.h / 2, 5, t.h);
      g.globalAlpha = 1;
    }

    // Player.
    const ph = ducking ? DUCK_H : STAND_H;
    const py2 = GROUND - ph + py;
    g.fillStyle = PALETTE.amber;
    g.fillRect(PLAYER_X, py2, BODY_W, ph);
    g.fillStyle = '#0B0A07';
    g.fillRect(PLAYER_X + 3, py2 + 4, BODY_W - 6, 3);
    if (!ducking) {
      g.fillStyle = PALETTE.phos;
      g.fillRect(PLAYER_X + BODY_W, py2 + 5, 5, 4);
    } else {
      g.fillStyle = PALETTE.phos;
      g.fillRect(PLAYER_X + BODY_W, py2 + 8, 5, 4);
    }

    // Sparks.
    for (const s of sparks) {
      g.globalAlpha = clamp(s.life / s.max, 0, 1);
      g.fillStyle = s.color;
      g.fillRect(s.x, s.y, s.size, s.size);
      g.globalAlpha = 1;
    }

    // HUD.
    g.font = `700 10px ${FONT}`;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('SPEED', 10, 10);
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${Math.round(speed)} px/s`, 10, 22);
    g.fillStyle = PALETTE.ink3;
    g.fillText('RUN', 10, 42);
    g.fillStyle = PALETTE.phos;
    g.fillText(`${bestRun} m`, 10, 54);

    g.textAlign = 'right';
    g.fillStyle = left < 10 ? PALETTE.alert : PALETTE.ink2;
    g.fillText(`${Math.ceil(Math.max(0, left))}s`, m.w - 10, 10);
    g.textAlign = 'left';

    if (ducking) {
      g.fillStyle = PALETTE.violet;
      g.fillText('DUCKING', m.w - 10, 22);
      g.textAlign = 'left';
    }
  }

  let py = 0;
  let vy = 0;

  reset();
  return { update, draw };
}