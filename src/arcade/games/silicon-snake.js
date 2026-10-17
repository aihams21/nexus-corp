import { PALETTE } from '../kernel/render.js';
import { clamp, dist2 } from '../../core/math.js';

export const meta = {
  id: 'g06',
  no: 6,
  unlockAt: 0,
  accent: PALETTE.phos,
  name: { ar: 'ثعبان السيليكون', en: 'Silicon Snake' },
  tag: { ar: 'كل · نَمُ', en: 'eat · grow' },
  desc: {
    ar: 'وجّه رأس الرقاقة عبر اللوح. اجمع رقائق الذاكرة، وتجنّب صدم الجدران أو ذيلك.',
    en: 'Steer the die across the board: swallow RAM chips, never bite the wall or your own tail.',
  },
  hint: { ar: 'الأسهم أو WASD', en: 'ARROWS or WASD' },
};

const CELL = 14;
const COLS = 30;
const ROWS = 22;
const RUN_TIME = 60;
const STEP = 0.115;

export function create(m) {
  const gridW = COLS * CELL;
  const gridH = ROWS * CELL;
  const ox = Math.round((m.w - gridW) / 2);
  const oy = 26;

  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let chip = { x: 22, y: 10 };
  let bonus = null;
  let grow = 0;
  let stepIn = STEP;
  let left = RUN_TIME;
  let eaten = 0;
  let ticks = 0;
  let dead = false;
  let snakeLen = 4;

  function reset() {
    snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
      { x: 5, y: 10 },
    ];
    snakeLen = 4;
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    chip = { x: 22, y: 10 };
    bonus = null;
    grow = 0;
    stepIn = STEP;
    left = RUN_TIME;
    eaten = 0;
    ticks = 0;
    dead = false;
    m.setScore(0);
  }

  function freeCell() {
    for (let tries = 0; tries < 200; tries++) {
      const c = { x: m.rng.int(1, COLS - 2), y: m.rng.int(1, ROWS - 2) };
      if (!hitsBody(c.x, c.y, 0)) return c;
    }
    return { x: 1, y: 1 };
  }

  function hitsBody(cx, cy, from) {
    for (let i = 0; i < snake.length; i++) {
      if (i === from) continue;
      const s = snake[i];
      if (s.x === cx && s.y === cy) return true;
    }
    return false;
  }

  function die(reason) {
    if (dead) return;
    dead = true;
    m.flash(PALETTE.alert);
    m.beep('error');
    m.banner(reason === 'wall' ? 'BUS FAULT' : 'STACK COLLAPSE', 'bad', 1400);
    m.addScore(-40);
    m.timers.after(1100, () => {
      m.addScore(Math.round(eaten * 5));
      m.finish(reason);
    });
  }

  function advance() {
    dir = nextDir;
    const head = snake[0];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      die('wall');
      return;
    }
    if (hitsBody(nx, ny, 0)) {
      die('self');
      return;
    }
    const ateChip = nx === chip.x && ny === chip.y;
    const ateBonus = bonus && nx === bonus.x && ny === bonus.y;
    snake.unshift({ x: nx, y: ny });
    if (ateChip) {
      eaten++;
      grow += 3;
      const pts = 8 + eaten;
      m.addScore(pts);
      m.beep('coin', 0.7);
      chip = freeCell();
      if (eaten % 5 === 0) {
        bonus = freeCell();
        m.timers.after(5200, () => {
          bonus = null;
        });
        m.banner('CACHE BONUS', 'hot', 900);
      }
    } else if (ateBonus) {
      grow += 6;
      m.addScore(60);
      m.beep('power');
      m.banner('CACHE +60', 'hot', 900);
      bonus = null;
    }
    if (grow > 0) grow--;
    else snake.pop();
    snakeLen = snake.length;
  }

  function finishRun(reason) {
    m.addScore(Math.round(left * 5));
    m.beep('win');
    m.banner('BOARD CLEARED', 'good', 1400);
    m.timers.after(900, () => m.finish(reason));
  }

  function update(dt) {
    if (dead || m.ended) return;
    const inp = m.input;
    const want = { x: 0, y: 0 };
    if (inp.up) want.y = -1;
    else if (inp.down) want.y = 1;
    else if (inp.left) want.x = -1;
    else if (inp.right) want.x = 1;
    if (want.x || want.y) {
      if (want.x !== -dir.x || want.y !== -dir.y) nextDir = want;
    }

    stepIn -= dt;
    ticks += dt;
    while (stepIn <= 0 && !dead) {
      stepIn += STEP;
      advance();
    }

    left -= dt;
    if (left <= 0) {
      left = 0;
      finishRun('time');
    }
  }

  function cellXY(s) {
    return { x: ox + s.x * CELL, y: oy + s.y * CELL };
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.strokeStyle = PALETTE.line;
    g.lineWidth = 1;
    for (let cx = 0; cx <= COLS; cx++) {
      const x = ox + cx * CELL + 0.5;
      g.beginPath();
      g.moveTo(x, oy);
      g.lineTo(x, oy + gridH);
      g.stroke();
    }
    for (let cy = 0; cy <= ROWS; cy++) {
      const y = oy + cy * CELL + 0.5;
      g.beginPath();
      g.moveTo(ox, y);
      g.lineTo(ox + gridW, y);
      g.stroke();
    }

    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(ox, oy, gridW, gridH);

    if (bonus) {
      const bx = ox + bonus.x * CELL + CELL / 2;
      const by = oy + bonus.y * CELL + CELL / 2;
      const pulse = 0.6 + 0.4 * Math.sin(ticks * 9);
      g.fillStyle = PALETTE.gold;
      g.globalAlpha = pulse;
      g.beginPath();
      g.arc(bx, by, 5.5, 0, 6.2832);
      g.fill();
      g.globalAlpha = 1;
      g.fillStyle = PALETTE.bg1;
      g.fillRect(bx - 3, by - 1, 6, 2);
      g.fillRect(bx - 1, by - 3, 2, 6);
    }

    const cx = ox + chip.x * CELL + CELL / 2;
    const cy = oy + chip.y * CELL + CELL / 2;
    g.fillStyle = PALETTE.phos;
    g.fillRect(cx - 5, cy - 5, 10, 10);
    g.fillStyle = PALETTE.bg1;
    for (let k = 0; k < 3; k++) {
      g.fillRect(cx - 5, cy - 4 + k * 3, 3, 2);
      g.fillRect(cx + 2, cy - 4 + k * 3, 3, 2);
    }

    for (let i = snake.length - 1; i >= 0; i--) {
      const p = cellXY(snake[i]);
      const isHead = i === 0;
      const t = i / Math.max(1, snake.length - 1);
      g.fillStyle = isHead
        ? PALETTE.amber
        : (i % 2 === 0 ? PALETTE.phos : PALETTE.phosDim);
      g.fillRect(p.x + 1, p.y + 1, CELL - 2, CELL - 2);
      if (isHead) {
        g.fillStyle = PALETTE.bg1;
        const ex = dir.x;
        const ey = dir.y;
        g.fillRect(p.x + CELL / 2 - 4 + ex * 3, p.y + CELL / 2 - 4 + ey * 3, 3, 3);
        g.fillRect(p.x + CELL / 2 + 1 + ex * 3, p.y + CELL / 2 + 1 + ey * 3, 3, 3);
      } else if (t > 0.02 && i % 3 === 0) {
        g.fillStyle = 'rgba(11,10,7,.42)';
        g.fillRect(p.x + 3, p.y + 3, CELL - 6, 1);
      }
    }

    g.font = '9px "JetBrains Mono", monospace';
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('LENGTH', 8, 14);
    g.fillStyle = PALETTE.phos;
    g.font = '11px "JetBrains Mono", monospace';
    g.fillText(String(snakeLen), 8, 24);

    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('CHIPS', 62, 14);
    g.fillStyle = PALETTE.amber;
    g.font = '11px "JetBrains Mono", monospace';
    g.fillText(String(eaten), 62, 24);

    g.font = '10px "JetBrains Mono", monospace';
    g.textAlign = 'right';
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${Math.ceil(left)}s`, m.w - 10, 12);
    g.fillStyle = PALETTE.ink3;
    g.font = '9px "JetBrains Mono", monospace';
    g.fillText('SILICON SNAKE', m.w - 10, 24);
    g.textAlign = 'left';
  }

  m.hint({ ar: 'الأسهم أو WASD · لا تصدم الجدار', en: 'ARROWS or WASD · do not bite the wall' });
  reset();
  return { update, draw };
}