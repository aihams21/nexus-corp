/**
 * 01 · Bug Squasher — reflex grid.
 *
 * Bugs crawl out of the server racks and crawl back in. Squash them before
 * they vanish. Red SYSTEM FILES are booby-trapped: popping one costs score.
 */

import { PALETTE } from '../kernel/render.js';
import { clamp, clamp01 } from '../../core/math.js';

const COLS = 8;
const ROWS = 5;
const PAD = 14;
const CELL_GAP = 4;
const SESSION = 60;

export const meta = {
  id: 'g01',
  no: 1,
  unlockAt: 0,
  accent: PALETTE.phos,
  name: { ar: 'سحق البرمجيات', en: 'Bug Squasher' },
  tag: { ar: 'شبكة رد فعل', en: 'REFLEX GRID' },
  desc: {
    ar: 'برمجيات تتكاثر في خزائن الخوادم. اضغطها قبل أن تختفي، وتجنّب الملفات الحمراء.',
    en: 'Bugs breed across the server racks. Pop them before they vanish — never touch a red system file.',
  },
  hint: {
    ar: 'انقر على البرمجيات الخضراء — الملفات الحمراء خدعة',
    en: 'Click the green bugs — red files are a trap',
  },
};

export function create(m) {
  const inner = { x: PAD, y: 40, w: m.w - PAD * 2, h: m.h - 40 - 30 };
  const cw = (inner.w - CELL_GAP * (COLS - 1)) / COLS;
  const ch = (inner.h - CELL_GAP * (ROWS - 1)) / ROWS;

  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      cells.push({ c, r, x: inner.x + c * (cw + CELL_GAP), y: inner.y + r * (ch + CELL_GAP), w: cw, h: ch, bug: null, shake: 0 });
    }
  }

  let left = SESSION;
  let spawnIn = 0.4;
  let elapsed = 0;
  let streak = 0;
  let streakLeft = 0;
  let popTotal = 0;
  let panic = 0;
  let message = '';

  function cellAt(x, y) {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
    }
    return null;
  }

  function emptyCell() {
    const free = cells.filter((c) => !c.bug);
    if (!free.length) return null;
    return free[Math.floor(m.rng.next() * free.length)];
  }

  function difficulty() {
    return 1 + elapsed / SESSION;
  }

  function spawn() {
    const cell = emptyCell();
    if (!cell) return;
    const hot = m.rng.chance(0.05 + difficulty() * 0.05);
    const life = hot ? 2.3 : Math.max(0.75, 1.75 - difficulty() * 0.55);
    cell.bug = { life, max: life, hot, phase: m.rng.range(0, 6.28) };
  }

  function update(dt, t) {
    elapsed += dt;
    left = Math.max(0, SESSION - elapsed);
    panic = Math.max(0, panic - dt);
    for (const c of cells) c.shake = Math.max(0, c.shake - dt * 4);

    if (streakLeft > 0) {
      streakLeft -= dt;
      if (streakLeft <= 0) streak = 0;
    }

    if (left > 0) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        const rate = 0.44 / difficulty();
        spawnIn = Math.max(0.13, rate) * m.rng.range(0.7, 1.3);
      }
      for (const c of cells) {
        if (c.bug) {
          c.bug.life -= dt;
          if (c.bug.life <= 0) c.bug = null;
        }
      }
    }

    if (m.input.cancel) m.bail();

    if (m.input.clicked) {
      const cell = cellAt(m.input.px, m.input.py);
      if (cell && cell.bug) {
        const bug = cell.bug;
        cell.bug = null;
        cell.shake = 1;
        if (bug.hot) {
          popTotal += 1;
          streak = 0;
          panic = 0.35;
          message = 'SYSTEM FILE';
          m.addScore(-30);
          m.flash(PALETTE.alert);
          m.beep('error', 0.7);
        } else {
          streak += 1;
          streakLeft = 0.9;
          popTotal += 1;
          const mult = 1 + Math.min(9, streak - 1) * 0.5;
          const gain = Math.round(12 * mult);
          m.addScore(gain);
          m.flash(PALETTE.phos);
          m.beep('hit', 0.5 + Math.min(0.4, streak * 0.04));
          if (streak > 0 && streak % 5 === 0) {
            m.banner(`STREAK ×${(1 + Math.min(9, streak - 1) * 0.5).toFixed(1)}`, 'good', 700);
            m.beep('level', 0.5);
          }
        }
      }
    }

    if (left <= 0 && !m.ended) {
      m.banner('FLOOR SECURED', 'good', 900);
      m.beep('win', 0.6);
      m.timers.after(950, () => m.finish('time'));
    }
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.fillStyle = PALETTE.bg2;
    g.fillRect(0, 0, m.w, 30);
    g.fillStyle = PALETTE.line;
    g.fillRect(0, 29, m.w, 2);

    g.font = '800 12px "JetBrains Mono", monospace';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.amber;
    g.fillText('RACK SWEEP', 12, 15);
    g.textAlign = 'right';
    g.fillStyle = left < 10 ? PALETTE.alert : PALETTE.ink;
    g.fillText(`${left.toFixed(1)}s`, m.w - 12, 15);
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink2;
    g.font = '700 11px "JetBrains Mono", monospace';
    g.fillText(`POP ${popTotal}`, 12, 45);

    for (const c of cells) {
      const sx = c.shake > 0 ? Math.sin(c.shake * 40) * 3 * c.shake : 0;
      g.fillStyle = PALETTE.panel;
      g.fillRect(c.x + sx, c.y, c.w, c.h);
      g.strokeStyle = PALETTE.line;
      g.lineWidth = 1;
      g.strokeRect(c.x + 0.5 + sx, c.y + 0.5, c.w - 1, c.h - 1);
      g.fillStyle = PALETTE.bg0;
      for (let i = 1; i < 4; i++) {
        g.fillRect(c.x + sx + 5, c.y + (c.h / 4) * i, 7, 2);
      }
      if (!c.bug) continue;
      const b = c.bug;
      const frac = clamp01(b.life / b.max);
      const blink = b.life < b.max * 0.34 ? (Math.sin(performance.now() / 42) > -0.2 ? 1 : 0.25) : 1;
      const cx = c.x + c.w / 2 + sx;
      const cy = c.y + c.h / 2;
      const r = Math.min(c.w, c.h) * 0.3 * (0.55 + 0.45 * frac);
      g.globalAlpha = blink;
      g.fillStyle = b.hot ? PALETTE.alert : PALETTE.phos;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = PALETTE.bg0;
      g.fillRect(cx - r * 0.55, cy - 1.5, r * 1.1, 3);
      g.fillRect(cx - 1.5, cy - r * 0.55, 3, r * 1.1);
      g.globalAlpha = 1;
      g.strokeStyle = b.hot ? PALETTE.alert : PALETTE.phosDim;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(cx, cy, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      g.stroke();
    }

    if (panic > 0) {
      g.fillStyle = PALETTE.alert;
      g.font = '800 16px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.fillText(message, m.w / 2, m.h - 16);
      g.textAlign = 'left';
    }
    if (streak > 2 && streakLeft > 0) {
      g.fillStyle = PALETTE.amber;
      g.font = '800 12px "JetBrains Mono", monospace';
      g.textAlign = 'right';
      g.fillText(`STREAK ${streak}`, m.w - 12, 45);
      g.textAlign = 'left';
    }
  }

  m.hint(meta.hint.en);
  return { update, draw };
}