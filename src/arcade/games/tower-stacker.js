import { PALETTE } from '../kernel/render.js';
import { clamp, easeToward } from '../../core/math.js';

const BW = 64;
const BH = 18;
const BASE_Y = 322;
const FIRST_X = (480 - BW) / 2;
const PERFECT_AT = 3;
const RUN_TIME = 60;
const SPEED_BASE = 92;
const SPEED_STEP = 6.5;
const SPEED_CAP = 320;
const MONO = '"JetBrains Mono", monospace';

export const meta = {
  id: 'g11',
  no: 11,
  unlockAt: 0,
  accent: PALETTE.amber,
  name: { ar: 'برج الطوابق', en: 'Tower Stacker' },
  tag: { ar: 'اسقط · اقتطع', en: 'drop · slice' },
  desc: {
    ar: 'أفلت الطوابق المتحركة فوق بعضها. كل تطابق دقيق يثبت العرض كاملاً، وأي تجاوز يُقتطع من الجانب.',
    en: 'Drop the sweeping floors onto the stack. A perfect overlap keeps the full width; any overhang is sliced away.',
  },
  hint: { ar: 'مسافة للإفلات', en: 'SPACE to drop' },
};

export function create(m) {
  let tower = [];
  let cur = null;
  let dir = 1;
  let speed = SPEED_BASE;
  let camY = 0;
  let perfects = 0;
  let best = 0;
  let left = RUN_TIME;
  let slices = [];
  let parts = [];
  let guide = 0;
  let shake = 0;
  let dropping = null;
  let dropT = 0;
  let endReason = '';
  let ended = false;

  function topBlock() {
    return tower.length ? tower[tower.length - 1] : { x: FIRST_X, w: BW };
  }

  function newFloor() {
    const t = topBlock();
    cur = { x: t.x, w: t.w, y: BASE_Y - (tower.length + 1) * BH };
    dir = tower.length % 2 === 0 ? 1 : -1;
    speed = Math.min(SPEED_CAP, SPEED_BASE + tower.length * SPEED_STEP);
  }

  function fall() {
    if (ended) return;
    ended = true;
    endReason = 'fell';
    m.addScore(-30);
    m.beep('gameover');
    m.flash(PALETTE.alert);
    m.banner('TOWER COLLAPSED', 'bad', 2000);
    shake = 1;
    const t = topBlock();
    for (let i = 0; i < 22; i += 1) {
      parts.push({
        x: t.x + m.rng.range(0, t.w), y: BASE_Y - tower.length * BH,
        vx: m.rng.range(-160, 160), vy: m.rng.range(-260, -40),
        life: 1.1, max: 1.1, r: m.rng.range(2, 5), color: PALETTE.amber,
      });
    }
    m.timers.after(1500, () => m.finish('fell'));
  }

  function drop() {
    if (ended || !cur || dropping) return;
    const t = topBlock();
    const leftEdge = Math.max(cur.x, t.x);
    const rightEdge = Math.min(cur.x + cur.w, t.x + t.w);
    const w = rightEdge - leftEdge;
    const off = Math.abs(cur.x - t.x);
    const perfect = w > 0.4 && off <= PERFECT_AT && Math.abs(cur.w - t.w) <= PERFECT_AT;

    if (w <= 0.4) {
      dropping = { x: cur.x, w: cur.w, y: cur.y, vx: dir * speed * 0.7, vy: 0, landed: false };
      m.beep('error');
      fall();
      return;
    }

    const nx = perfect ? t.x : leftEdge;
    const nw = perfect ? t.w : w;
    tower.push({ x: nx, w: nw, y: cur.y, perfect });
    if (tower.length > 90) tower.shift();

    if (perfect) {
      perfects += 1;
      if (perfects > best) best = perfects;
      m.addScore(60 + perfects * 25);
      m.beep('perfect');
      m.flash(PALETTE.phos);
      m.banner(`PERFECT ×${perfects}`, 'good', 900);
      shake = 0.5;
      const cx = t.x + t.w / 2;
      for (let i = 0; i < 14; i += 1) {
        parts.push({
          x: cx + m.rng.range(-10, 10), y: t.y,
          vx: m.rng.range(-120, 120), vy: m.rng.range(-180, -40),
          life: 0.6, max: 0.6, r: m.rng.range(1.4, 3), color: PALETTE.phos,
        });
      }
    } else {
      perfects = 0;
      m.addScore(10 + tower.length * 4);
      m.beep('land');
      shake = 0.3;
      if (cur.x > t.x) slices.push({ x: rightEdge, y: cur.y, w: cur.x + cur.w - rightEdge, life: 0.5 });
      else if (cur.x < t.x) slices.push({ x: cur.x, y: cur.y, w: leftEdge - cur.x, life: 0.5 });
    }

    cur = null;
  }

  function finishRun(reason) {
    const bonus = tower.length * 45 + perfects * 120;
    if (bonus > 0) m.addScore(bonus);
    m.beep('win');
    m.banner(reason === 'time' ? 'TOWER SEALED' : 'RUN OVER', 'info', 1600);
    m.timers.after(1100, () => m.finish(reason));
  }

  function update(dt) {
    if (m.ended) return;

    if (ended) {
      dropT += dt;
      if (dropping) {
        const steps = 4;
        const h = dt / steps;
        for (let i = 0; i < steps; i += 1) {
          dropping.vy += 1500 * h;
          dropping.y = clamp(dropping.y + dropping.vy * h, 0, m.h + 80);
          dropping.x = clamp(dropping.x + dropping.vx * h, -60, m.w + 60);
        }
      }
      stepFx(dt);
      return;
    }

    left -= dt;
    if (left <= 0) {
      left = 0;
      finishRun('time');
      return;
    }

    stepFx(dt);

    if (dropping) {
      if (!dropping.landed) {
        dropT += dt;
        const steps = 4;
        const h = dt / steps;
        for (let i = 0; i < steps; i += 1) {
          dropping.vy += 1500 * h;
          dropping.y = clamp(dropping.y + dropping.vy * h, 0, m.h + 80);
          dropping.x = clamp(dropping.x + dropping.vx * h, -60, m.w + 60);
        }
        if (dropT > 0.4) dropping.landed = true;
      } else {
        dropT += dt;
        if (dropT > 0.8) dropping = null;
      }
      return;
    }

    if (!cur) newFloor();

    cur.x += dir * speed * dt;
    const half = cur.w / 2;
    if (cur.x < half) {
      cur.x = half;
      dir = 1;
      m.beep('tick', 0.35);
    } else if (cur.x + half > m.w) {
      cur.x = m.w - half;
      dir = -1;
      m.beep('tick', 0.35);
    }

    const t = topBlock();
    guide = Math.abs(cur.x - t.x) <= PERFECT_AT ? 1 : Math.max(0, guide - dt * 5);

    if (m.input.wasPressed('Space') || m.input.accept || m.input.clicked) drop();

    const target = Math.max(0, (tower.length - 9) * BH);
    camY = easeToward(camY, target, 7, dt);
  }

  function stepFx(dt) {
    if (shake > 0) shake = Math.max(0, shake - dt * 2.2);
    if (guide > 0) guide = Math.max(0, guide - dt * 2.2);
    for (let i = slices.length - 1; i >= 0; i -= 1) {
      slices[i].life -= dt;
      slices[i].y += 220 * dt;
      if (slices[i].life <= 0) slices.splice(i, 1);
    }
    for (let i = parts.length - 1; i >= 0; i -= 1) {
      const p = parts[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 620 * dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
  }

  function drawBlock(g, x, y, w, h, fill, edge) {
    g.fillStyle = fill;
    g.fillRect(x, y, w, h);
    g.strokeStyle = edge;
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    g.fillStyle = PALETTE.bg0;
    g.globalAlpha = 0.35;
    g.fillRect(x + 3, y + h - 6, w - 6, 2);
    g.globalAlpha = 1;
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.fillStyle = PALETTE.bg1;
    g.fillRect(0, 0, m.w, BASE_Y + 12 - camY);
    g.strokeStyle = PALETTE.line;
    g.lineWidth = 1;
    for (let x = 0; x < m.w; x += 40) {
      g.beginPath();
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, m.h);
      g.stroke();
    }

    g.save();
    if (shake > 0) {
      g.translate(Math.round((m.rng.next() - 0.5) * shake * 8), Math.round((m.rng.next() - 0.5) * shake * 8));
    }
    g.translate(0, -camY);

    g.fillStyle = PALETTE.panel;
    g.fillRect(0, BASE_Y, m.w, m.h - BASE_Y + 40);
    g.strokeStyle = PALETTE.amberDim;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, BASE_Y + 1);
    g.lineTo(m.w, BASE_Y + 1);
    g.stroke();

    const t = topBlock();
    for (let i = 0; i < tower.length; i += 1) {
      const b = tower[i];
      const fill = b.perfect ? PALETTE.phosDim : (i % 2 ? PALETTE.amberDim : PALETTE.amber);
      const edge = b.perfect ? PALETTE.phos : PALETTE.gold;
      drawBlock(g, b.x, b.y, b.w, BH, fill, edge);
      g.fillStyle = PALETTE.bg0;
      g.globalAlpha = 0.5;
      g.fillRect(b.x + 4, b.y + 5, b.w - 8, 2);
      g.globalAlpha = 1;
      if (b.perfect) {
        g.fillStyle = PALETTE.bg0;
        g.fillRect(b.x + b.w / 2 - 4, b.y + 6, 8, 6);
      }
    }

    for (let i = 0; i < slices.length; i += 1) {
      const s = slices[i];
      g.globalAlpha = Math.min(1, s.life / 0.5);
      g.fillStyle = PALETTE.alert;
      g.fillRect(s.x, s.y, Math.max(1, s.w), BH - 4);
      g.globalAlpha = 1;
    }

    if (cur && !ended) {
      g.strokeStyle = guide > 0.4 ? PALETTE.phos : PALETTE.ink3;
      g.lineWidth = 1;
      g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(t.x + t.w / 2, t.y - BH - 4);
      g.lineTo(t.x + t.w / 2, cur.y + BH + 4);
      g.stroke();
      g.setLineDash([]);

      drawBlock(g, cur.x, cur.y, cur.w, BH, PALETTE.cyan, PALETTE.phos);
      g.fillStyle = PALETTE.bg0;
      g.globalAlpha = 0.55;
      g.fillRect(cur.x + 4, cur.y + 5, cur.w - 8, 2);
      g.globalAlpha = 1;
    }

    if (dropping) {
      drawBlock(g, dropping.x, dropping.y, dropping.w, BH, PALETTE.alert, PALETTE.gold);
    }

    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.color;
      g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    g.globalAlpha = 1;
    g.restore();

    g.font = `700 10px ${MONO}`;
    g.textBaseline = 'top';
    g.textAlign = 'left';

    g.fillStyle = PALETTE.bg2;
    g.fillRect(10, 8, 138, 42);
    g.strokeStyle = PALETTE.line;
    g.lineWidth = 2;
    g.strokeRect(11, 9, 136, 40);

    g.fillStyle = PALETTE.ink3;
    g.fillText('HEIGHT', 18, 14);
    g.fillStyle = PALETTE.amber;
    g.fillText(`${tower.length}`, 18, 26);

    g.fillStyle = PALETTE.ink3;
    g.fillText('PERFECT', 74, 14);
    g.fillStyle = perfects ? PALETTE.phos : PALETTE.ink2;
    g.fillText(`${perfects} (best ${best})`, 74, 26);

    g.textAlign = 'right';
    g.fillStyle = PALETTE.ink3;
    g.fillText(ended ? endReason.toUpperCase() : 'STACK THE TOWER', m.w - 12, 14);
    g.fillStyle = PALETTE.amber;
    g.fillText(`${Math.ceil(left)}s`, m.w - 12, 26);

    g.fillStyle = PALETTE.bg2;
    g.fillRect(m.w - 112, 40, 100, 6);
    g.strokeStyle = PALETTE.line;
    g.lineWidth = 2;
    g.strokeRect(m.w - 111, 41, 98, 4);
    g.fillStyle = PALETTE.cyan;
    g.fillRect(m.w - 110, 42, 96 * Math.max(0, Math.min(1, left / RUN_TIME)), 2);

    g.textAlign = 'left';
  }

  function reset() {
    tower = [];
    cur = null;
    dir = 1;
    speed = SPEED_BASE;
    camY = 0;
    perfects = 0;
    best = 0;
    left = RUN_TIME;
    slices = [];
    parts = [];
    guide = 0;
    shake = 0;
    dropping = null;
    ended = false;
    endReason = '';
    m.setScore(0);
    newFloor();
    m.hint({ ar: 'مسافة لإفلات الطابق', en: 'SPACE drops the floor' });
  }

  reset();
  return { update, draw };
}