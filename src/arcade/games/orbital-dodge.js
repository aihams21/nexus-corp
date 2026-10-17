import { PALETTE } from '../kernel/render.js';
import { clamp, dist2, TAU } from '../../core/math.js';
import { intersectCircle } from '../kernel/collide.js';

export const meta = {
  id: 'g16',
  no: 16,
  unlockAt: 0,
  accent: PALETTE.violet,
  name: { ar: 'المناورة المدارية', en: 'Orbital Dodge' },
  tag: { ar: 'تفادَ · انجُ', en: 'dodge · survive' },
  desc: {
    ar: 'قد النواة بالماوس أو باللمس داخل حقل بلازما نابض. اصمد أطول فترة قبل أن تحطمك موجة.',
    en: 'Steer the core with mouse or touch inside a pulsing plasma field. Survive as long as possible before a wave tears you apart.',
  },
  hint: { ar: 'حرّك الماوس أو إصبعك', en: 'Move the mouse or your finger' },
};

const CORE_R = 9;
const RUN_TIME = 60;
const FIELD_X = 16;
const FIELD_Y = 34;
const FIELD_W = 448;
const FIELD_H = 290;

export function create(m) {
  let px = 240;
  let py = 180;
  let coreV = 0;
  let pulse = 0;
  let left = RUN_TIME;
  let survived = 0;
  let waves = 0;
  let shake = 0;
  let ended = false;
  let endReason = '';
  let endBonus = 0;
  let hurtT = 0;
  let grace = 0;
  let shockT = 0;
  let shockAt = { x: 240, y: 180 };
  const hazards = [];
  const sparks = [];

  function spawnWave() {
    waves += 1;
    const count = Math.min(9, 2 + waves);
    const base = Math.min(210, 70 + waves * 16);
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * TAU + m.rng.range(-0.2, 0.2);
      const spd = base * m.rng.range(0.86, 1.18);
      const r = m.rng.range(7, 15);
      hazards.push({
        x: 240 + Math.cos(a) * 150,
        y: 180 + Math.sin(a) * 104,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        r,
        hot: m.rng.chance(0.24),
        rot: m.rng.range(0, TAU),
      });
    }
    m.beep('alarm', 0.5);
    m.banner(`WAVE ${waves}`, 'bad', 900);
  }

  function burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i += 1) {
      const a = m.rng.range(0, TAU);
      const s = m.rng.range(spd * 0.35, spd);
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: m.rng.range(0.22, 0.55), t: 0, color, r: m.rng.range(1.2, 2.8) });
    }
  }

  function hazardBounce(h, xMin, yMin, xMax, yMax) {
    if (h.x - h.r < xMin) {
      h.x = xMin + h.r;
      h.vx = Math.abs(h.vx);
    } else if (h.x + h.r > xMax) {
      h.x = xMax - h.r;
      h.vx = -Math.abs(h.vx);
    }
    if (h.y - h.r < yMin) {
      h.y = yMin + h.r;
      h.vy = Math.abs(h.vy);
    } else if (h.y + h.r > yMax) {
      h.y = yMax - h.r;
      h.vy = -Math.abs(h.vy);
    }
  }

  function hit(h) {
    if (grace > 0 || ended) return;
    const d = Math.sqrt(dist2(h, { x: px, y: py }));
    const reach = h.r + CORE_R - 3;
    if (d >= reach) return;
    if (h.hot && grace <= 0) {
      grace = 1.2;
      hurtT = 0.4;
      shake = 1;
      m.addScore(-70);
      m.flash(PALETTE.alert);
      m.beep('explode', 0.85);
      m.noise(0.34);
      burst(px, py, PALETTE.alert, 24, 250);
      m.banner('PLASMA BURN', 'bad', 1200);
    }
    h.x += (h.x - px) * 0.34;
    h.y += (h.y - py) * 0.34;
  }

  function finish(reason) {
    if (ended) return;
    ended = true;
    endReason = reason;
    endBonus = reason === 'time' ? Math.floor(survived * 8) + waves * 120 : Math.floor(survived * 4);
    m.addScore(endBonus);
    m.beep(reason === 'time' ? 'win' : 'gameover', 0.9);
    m.banner(reason === 'time' ? 'ARENA SURVIVED' : 'CORE LOST', reason === 'time' ? 'good' : 'bad', 1600);
    m.timers.after(1000, () => m.finish(reason));
  }

  function stepSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.t += dt;
      if (s.t >= s.life) {
        sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - 1.8 * dt;
      s.vy *= 1 - 1.8 * dt;
    }
  }

  function update(dt, time) {
    if (ended) {
      stepSparks(dt);
      if (shake > 0) shake = Math.max(0, shake - dt * 3);
      return;
    }

    const tx = clamp(m.input.px, FIELD_X + CORE_R, FIELD_X + FIELD_W - CORE_R);
    const ty = clamp(m.input.py, FIELD_Y + CORE_R, FIELD_Y + FIELD_H - CORE_R);
    const dx = tx - px;
    const dy = ty - py;
    const want = Math.min(1, Math.hypot(dx, dy) / 26);
    coreV += (want - coreV) * Math.min(1, dt * 13);
    px = clamp(px + dx * Math.min(1, dt * 10.5), FIELD_X + CORE_R, FIELD_X + FIELD_W - CORE_R);
    py = clamp(py + dy * Math.min(1, dt * 10.5), FIELD_Y + CORE_R, FIELD_Y + FIELD_H - CORE_R);

    const ramp = Math.min(1, time / RUN_TIME);
    const spdScale = 1 + ramp * 0.55;
    const xMin = FIELD_X;
    const xMax = FIELD_X + FIELD_W;
    const yMin = FIELD_Y;
    const yMax = FIELD_Y + FIELD_H;
    for (const h of hazards) {
      const steps = Math.abs(h.vx) > 400 || Math.abs(h.vy) > 400 ? 4 : 1;
      const hs = dt / steps;
      for (let s = 0; s < steps; s += 1) {
        h.x += h.vx * hs;
        h.y += h.vy * hs;
        hazardBounce(h, xMin, yMin, xMax, yMax);
      }
      h.vx *= 1 + 0.12 * dt;
      h.vy *= 1 + 0.12 * dt;
      h.rot += dt * 1.7;
      const sp = Math.hypot(h.vx, h.vy);
      if (sp > 0.001) {
        const k = (spdScale * (h.hot ? 1.22 : 1)) / sp;
        h.vx *= k;
        h.vy *= k;
      }
      hit(h);
    }

    if (time > 1.6 && time - shockT > 1.9 && hazards.length > 0) {
      shockT = time;
      const src = hazards[m.rng.int(0, hazards.length - 1)];
      shockAt.x = src.x;
      shockAt.y = src.y;
      m.beep('laser', 0.35);
    }

    if (grace > 0) grace -= dt;
    if (hurtT > 0) hurtT -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 2.6);
    pulse += dt;

    survived += dt;
    m.addScore(dt * 14);
    left -= dt;
    if (time > 1.1 && Math.floor(time / 9) > waves) spawnWave();
    if (left <= 0) {
      left = 0;
      finish('time');
    }
    stepSparks(dt);
  }

  function drawHazard(g, h) {
    const c = h.hot ? PALETTE.alert : PALETTE.violet;
    g.fillStyle = c;
    g.globalAlpha = 0.16;
    g.beginPath();
    g.arc(h.x, h.y, h.r + 6, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = h.hot ? '#5A1420' : '#241B3C';
    g.beginPath();
    g.arc(h.x, h.y, h.r, 0, TAU);
    g.fill();
    g.strokeStyle = c;
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(h.x, h.y, h.r, 0, TAU);
    g.stroke();
    g.save();
    g.translate(h.x, h.y);
    g.rotate(h.rot);
    g.strokeStyle = c;
    g.lineWidth = 1.2;
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a) * h.r * 0.34, Math.sin(a) * h.r * 0.34);
      g.lineTo(Math.cos(a) * h.r * 0.78, Math.sin(a) * h.r * 0.78);
      g.stroke();
    }
    g.restore();
    g.fillStyle = h.hot ? PALETTE.gold : PALETTE.cyan;
    g.beginPath();
    g.arc(h.x, h.y, 2, 0, TAU);
    g.fill();
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.save();
    if (shake > 0) {
      const j = shake * shake * 6;
      g.translate(m.rng.range(-j, j), m.rng.range(-j, j));
    }

    g.fillStyle = PALETTE.bg1;
    g.fillRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);
    g.strokeStyle = PALETTE.line;
    g.lineWidth = 2;
    g.strokeRect(FIELD_X, FIELD_Y, FIELD_W, FIELD_H);

    g.strokeStyle = PALETTE.line;
    g.globalAlpha = 0.6;
    g.lineWidth = 1;
    for (let x = FIELD_X + 28; x < FIELD_X + FIELD_W; x += 28) {
      g.beginPath();
      g.moveTo(x, FIELD_Y);
      g.lineTo(x, FIELD_Y + FIELD_H);
      g.stroke();
    }
    for (let y = FIELD_Y + 28; y < FIELD_Y + FIELD_H; y += 28) {
      g.beginPath();
      g.moveTo(FIELD_X, y);
      g.lineTo(FIELD_X + FIELD_W, y);
      g.stroke();
    }
    g.globalAlpha = 1;

    const shockR = (pulse % 1.9) / 1.9;
    if (shockR < 0.5) {
      g.strokeStyle = PALETTE.cyan;
      g.globalAlpha = 0.4 * (1 - shockR * 2);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(shockAt.x, shockAt.y, shockR * 220 + 6, 0, TAU);
      g.stroke();
      g.globalAlpha = 1;
    }

    for (const h of hazards) drawHazard(g, h);

    g.globalAlpha = 1;
    for (const s of sparks) {
      g.globalAlpha = 1 - s.t / s.life;
      g.fillStyle = s.color;
      g.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
    }
    g.globalAlpha = 1;

    const beat = 1 + Math.sin(pulse * 5.2) * 0.09 + coreV * 0.14;
    const flick = grace > 0 && Math.floor(grace * 16) % 2 === 0;
    const cc = flick ? PALETTE.alert : PALETTE.phos;
    g.strokeStyle = PALETTE.cyan;
    g.globalAlpha = 0.5;
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(px, py, CORE_R * 1.85 * beat, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = cc;
    g.beginPath();
    g.arc(px, py, CORE_R * beat, 0, TAU);
    g.fill();
    g.fillStyle = PALETTE.bg0;
    g.beginPath();
    g.arc(px, py, CORE_R * 0.42, 0, TAU);
    g.fill();
    if (hurtT > 0) {
      g.strokeStyle = PALETTE.alert;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(px, py, CORE_R * (2 + (0.4 - hurtT) * 10), 0, TAU);
      g.stroke();
    }
    g.restore();

    g.font = '9px "JetBrains Mono", monospace';
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('SURVIVED', 10, 10);
    g.fillStyle = PALETTE.phos;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${survived.toFixed(1)}s`, 10, 20);

    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('WAVE', 96, 10);
    g.fillStyle = PALETTE.violet;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${waves}`, 96, 20);

    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('HAZARDS', 140, 10);
    g.fillStyle = PALETTE.amber;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${hazards.length}`, 140, 20);

    g.textAlign = 'right';
    g.font = '11px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${Math.ceil(left)}s`, m.w - 10, 10);
    if (grace > 0) {
      g.fillStyle = PALETTE.alert;
      g.font = '9px "JetBrains Mono", monospace';
      g.fillText('SHIELD REGEN', m.w - 10, 24);
    }
    g.textAlign = 'left';
  }

  m.hint({
    ar: 'حرّك الماوس أو إصبعك لتوجيه النواة',
    en: 'Steer the core with the mouse or your finger',
  });
  return { update, draw };
}
