/**
 * 02 · Flappy Packet — gravity flyer through firewall pipes.
 *
 * The packet falls under gravity; each tap applies an impulse. Terminal
 * velocity is high enough to exceed the 400 px/s sub-step threshold, so the
 * packet is integrated with the shared sub-stepping kernel and clamped to the
 * play area every sub-step.
 */

import { PALETTE } from '../kernel/render.js';
import { clamp } from '../../core/math.js';
import { integrate, stepClamped } from '../../core/engine.js';

const GROUND_Y = 336;
const CEIL_Y = 46;
const PIPE_W = 52;
const FIRST_X = 210;
const GAP_DX = 152;
const R = 9;
const GRAVITY = 1500;
const FLAP = 300;
const FALL_MAX = 520;

export const meta = {
  id: 'g02',
  no: 2,
  accent: PALETTE.cyan,
  name: { ar: 'رزمة البيانات', en: 'Flappy Packet' },
  tag: { ar: 'انزلاق بالجاذبية', en: 'GRAVITY FLYER' },
  desc: {
    ar: 'وجّه رزمة بيانات عبر فجوات جدار الحماية بنقرة واحدة قبل أن تسقط.',
    en: 'Thread a data packet through firewall pipe gaps with a single tap before it drops.',
  },
  hint: { ar: 'مسافة أو نقرة للإقلاع', en: 'SPACE or click to lift' },
};

export function create(m) {
  const pipes = [];
  let px = 96;
  let py = 170;
  let vy = 0;
  let dead = false;
  let passed = 0;
  let best = 0;
  let tilt = 0;
  let flapT = 0;
  let scroll = 0;
  let index = 0;

  function gapFor(i) {
    const gap = Math.max(102, 170 - i * 6);
    const center = 168 + Math.sin(i * 1.73) * 78 + Math.sin(i * 0.61 + 1.2) * 44;
    return { gap, center: clamp(center, CEIL_Y + gap / 2 + 10, GROUND_Y - gap / 2 - 10) };
  }

  function placePipe(p, i) {
    const info = gapFor(i);
    p.gap = info.gap;
    p.center = info.center;
  }

  function reset() {
    px = 96;
    py = 170;
    vy = 0;
    dead = false;
    passed = 0;
    index = 1;
    pipes.length = 0;
    for (let k = 0; k < 5; k++) {
      const i = index + k;
      const p = { x: FIRST_X + k * GAP_DX };
      placePipe(p, i);
      pipes.push(p);
    }
  }

  function die(reason) {
    if (dead) return;
    dead = true;
    best = Math.max(best, passed);
    m.flash(PALETTE.alert);
    m.noise(0.3, 0.55);
    m.beep('gameover', 0.7);
    m.banner('LINK LOST', 'bad', 950);
    m.timers.after(1050, () => m.finish(reason));
  }

  reset();
  m.hint(meta.hint);

  function update(dt) {
    if (dead) {
      vy = Math.min(vy + GRAVITY * dt, FALL_MAX);
      py = stepClamped(py, vy, dt, CEIL_Y, GROUND_Y - R);
      scroll = (scroll + 150 * dt) % 18;
      return;
    }

    vy = Math.min(vy + GRAVITY * dt, FALL_MAX);
    flapT = Math.max(0, flapT - dt);
    scroll = (scroll + 160 * dt) % 18;

    if (m.input.anyPressed || m.input.clicked) {
      vy = -FLAP;
      flapT = 0.16;
      m.beep('jump', 0.45);
    }

    // Physics invariant: >400 px/s runs four clamped sub-steps.
    integrate(dt, 0, vy, (sub) => {
      py = stepClamped(py, vy, sub, CEIL_Y, GROUND_Y - R);
    });
    px = stepClamped(px, 0, dt, 24, m.w - 24);

    for (const p of pipes) {
      if (p.x + PIPE_W < px - R) {
        index += 1;
        p.x += GAP_DX * pipes.length;
        placePipe(p, index);
        passed += 1;
        m.addScore(passed * 25);
        m.beep('coin', 0.42);
      }
    }

    tilt = clamp(vy / 480, -0.5, 1);

    if (py + R >= GROUND_Y - 1) die('ground');
    else if (py - R <= CEIL_Y) die('ceiling');
    else {
      for (const p of pipes) {
        if (px + R < p.x || px - R > p.x + PIPE_W) continue;
        if (py - R < p.center - p.gap / 2 || py + R > p.center + p.gap / 2) {
          die('pipe');
          break;
        }
      }
    }
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.fillStyle = PALETTE.line;
    for (let x = -18; x < m.w + 18; x += 18) {
      const off = ((scroll + x) % 18) - 18;
      g.fillRect(off, 0, 1, CEIL_Y);
      g.fillRect(off, GROUND_Y, 1, m.h - GROUND_Y);
    }

    for (const p of pipes) {
      drawPipe(g, p.x, 0, PIPE_W, p.center - p.gap / 2);
      drawPipe(g, p.x, p.center + p.gap / 2, PIPE_W, GROUND_Y - (p.center + p.gap / 2));
    }

    g.save();
    g.translate(px, py);
    g.rotate(tilt * 0.45);
    g.fillStyle = flapT > 0 ? PALETTE.gold : PALETTE.cyan;
    g.fillRect(-R, -R * 0.6, R * 2, R * 1.2);
    g.fillStyle = PALETTE.bg0;
    g.fillRect(-R, -1, R * 2, 2);
    g.fillRect(-1, -R * 0.6, 2, R * 1.2);
    g.restore();

    g.fillStyle = PALETTE.line2;
    g.fillRect(0, GROUND_Y, m.w, 2);

    g.textBaseline = 'middle';
    g.font = '800 12px "JetBrains Mono", monospace';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('FIREWALL ROUTE', 10, 16);
    g.textAlign = 'center';
    g.fillStyle = PALETTE.amber;
    g.font = '800 22px "JetBrains Mono", monospace';
    g.fillText(String(passed), m.w / 2, 18);
    if (m.ended) {
      g.fillStyle = PALETTE.ink2;
      g.font = '700 10px "JetBrains Mono", monospace';
      g.fillText('BEST ' + best, m.w / 2, 36);
    }
  }

  function drawPipe(g, x, y, w, h) {
    if (h <= 0.5) return;
    g.fillStyle = PALETTE.panel;
    g.fillRect(x, y, w, h);
    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle = PALETTE.cyan;
    g.fillRect(x + 4, y + 5, w - 8, 3);
    g.fillStyle = PALETTE.line;
    for (let yy = y + 16; yy < y + h - 4; yy += 16) g.fillRect(x + 4, yy, w - 8, 2);
  }

  return { update, draw };
}