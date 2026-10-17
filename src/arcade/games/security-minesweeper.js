// g13 — Security Minesweeper: first click is always safe, flood fill reveals zero regions.
import { PALETTE } from '../kernel/render.js';

export const meta = {
  id: 'g13',
  no: 13,
  unlockAt: 0,
  accent: PALETTE.gold,
  name: { ar: 'ألغام الأمان السيبراني', en: 'Security Minesweeper' },
  tag: { ar: 'افحص · اكشف', en: 'scan · reveal' },
  desc: {
    ar: 'افحص شبكة الخوادم واكشف الخلايا الآمنة. أول نقرة دائماً خالية، وكل رقم يعرض عدد التهديدات المجاورة له.',
    en: 'Scan the server grid and expose the safe cells. The first click is always clean and every number shows its neighbouring threats.'
  },
  hint: { ar: 'انقر للكشف · انقر مرتين لتعليم خلية', en: 'Click to reveal · double-click to flag' }
};

const COLS = 12;
const ROWS = 9;
const CELL = 33;
const GX = 30;
const GY = 46;
const RUN_TIME = 120;

export function create(m) {
  const W = m.w;
  const H = m.h;
  const N = COLS * ROWS;

  let cells = [];
  let mines = 0;
  let opened = 0;
  let flags = 0;
  let left = RUN_TIME;
  let firstClick = true;
  let exploded = false;
  let deadCell = -1;
  let hover = -1;
  let endKind = '';
  let endBonus = 0;
  let hintMsg = '';

  function idx(c, r) { return r * COLS + c; }
  function colOf(i) { return i % COLS; }
  function rowOf(i) { return Math.floor(i / COLS); }
  function cellAt(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS ? idx(c, r) : -1;
  }
  function neighbours(i, out) {
    out.length = 0;
    const c = colOf(i);
    const r = rowOf(i);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const j = cellAt(c + dx, r + dy);
        if (j >= 0) out.push(j);
      }
    }
    return out;
  }

  function buildField(safe) {
    cells = new Array(N);
    for (let i = 0; i < N; i++) {
      cells[i] = { mine: false, open: false, flag: false, n: 0, born: m.rng.next() };
    }
    const sc = colOf(safe);
    const sr = rowOf(safe);
    let placed = 0;
    let guard = 0;
    while (placed < mines && guard < N * 40) {
      guard++;
      const c = m.rng.int(0, COLS - 1);
      const r = m.rng.int(0, ROWS - 1);
      if (Math.abs(c - sc) <= 1 && Math.abs(r - sr) <= 1) continue;
      const i = idx(c, r);
      if (cells[i].mine) continue;
      cells[i].mine = true;
      placed++;
    }
    const buf = [];
    for (let i = 0; i < N; i++) {
      if (cells[i].mine) continue;
      neighbours(i, buf);
      let n = 0;
      for (let k = 0; k < buf.length; k++) if (cells[buf[k]].mine) n++;
      cells[i].n = n;
    }
  }

  function openCell(i) {
    if (cells[i].open || cells[i].flag) return;
    cells[i].open = true;
    opened++;
    m.beep('tap', 0.34);
    if (cells[i].n === 0) {
      const buf = [];
      neighbours(i, buf);
      for (let k = 0; k < buf.length; k++) openCell(buf[k]);
    }
  }

  function blast(i) {
    exploded = true;
    deadCell = i;
    cells[i].open = true;
    m.addScore(-90);
    m.beep('explode', 0.85);
    m.noise(0.4, 0.75);
    m.flash(PALETTE.alert);
    m.banner('MINE DETONATED', 'bad', 1900);
    const buf = [];
    for (let k = 0; k < N; k++) {
      if (!cells[k].mine) continue;
      cells[k].open = true;
      neighbours(k, buf);
      for (let q = 0; q < buf.length; q++) cells[buf[q]].revealFlash = 0.6;
    }
    endKind = 'boom';
    finish();
  }

  function finish() {
    if (endKind) return;
    m.addScore(endBonus);
    if (endKind === 'clear') {
      m.beep('win', 0.75);
      m.banner('NETWORK AUDIT PASSED', 'good', 1700);
    } else {
      m.beep('gameover', 0.7);
      m.banner('SHIFT OVER', 'info', 1600);
    }
    m.timers.after(1050, () => m.finish(endKind));
  }

  function checkClick() {
    if (m.input.clicked && hover >= 0) {
      const cell = cells[hover];
      if (!cell.open) {
        if (firstClick) {
          firstClick = false;
          buildField(hover);
          m.beep('select', 0.5);
        }
        if (cell.mine) { blast(hover); return; }
        openCell(hover);
        if (opened >= N - mines) {
          for (let k = 0; k < N; k++) if (cells[k].mine) cells[k].flag = true;
          flags = mines;
          endKind = 'clear';
          endBonus = 600 + Math.ceil(left) * 8 + mines * 25;
          m.flash(PALETTE.phos);
          m.addScore(mines * 25);
          finish();
        }
      }
      return;
    }
    if (m.input.releasedClick && hover >= 0) {
      const cell = cells[hover];
      if (!cell.open) {
        cell.flag = !cell.flag;
        flags += cell.flag ? 1 : -1;
        m.addScore(cell.flag ? 2 : -2);
        m.beep(cell.flag ? 'click' : 'select', 0.4);
        m.banner(cell.flag ? 'THREAT FLAGGED' : 'FLAG CLEARED', cell.flag ? 'bad' : 'info', 700);
      }
    }
  }

  function update(dt) {
    if (endKind) return;
    if (left > 0) {
      left -= dt;
      if (left <= 0) { left = 0; endKind = 'time'; endBonus = Math.floor(opened * 6); finish(); return; }
    }
    hover = -1;
    const c = Math.floor((m.input.px - GX) / CELL);
    const r = Math.floor((m.input.py - GY) / CELL);
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) hover = idx(c, r);
    checkClick();
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, W, H);

    g.strokeStyle = 'rgba(58,51,35,.7)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, 34); g.lineTo(W, 34);
    g.stroke();

    for (let i = 0; i < N; i++) {
      const c = colOf(i);
      const r = rowOf(i);
      const x = GX + c * CELL;
      const y = GY + r * CELL;
      const cell = cells[i];
      if (!cell) continue;
      const isHover = i === hover && !cell.open && !cell.flag;

      if (cell.open) {
        g.fillStyle = PALETTE.bg1;
        g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        if (cell.mine) {
          const boom = i === deadCell;
          g.fillStyle = boom ? PALETTE.alert : '#6A2030';
          g.beginPath();
          g.arc(x + CELL / 2, y + CELL / 2, 7, 0, 6.2832);
          g.fill();
          g.strokeStyle = PALETTE.bg0;
          g.lineWidth = 1.5;
          g.beginPath();
          for (let k = 0; k < 4; k++) {
            const a = k * 0.7854;
            g.moveTo(x + CELL / 2 - Math.cos(a) * 8, y + CELL / 2 - Math.sin(a) * 8);
            g.lineTo(x + CELL / 2 + Math.cos(a) * 8, y + CELL / 2 + Math.sin(a) * 8);
          }
          g.stroke();
        } else if (cell.n > 0) {
          const col = cell.n === 1 ? PALETTE.cyan : cell.n === 2 ? PALETTE.phos
            : cell.n === 3 ? PALETTE.alert : cell.n === 4 ? PALETTE.violet
            : cell.n === 5 ? PALETTE.amber : PALETTE.gold;
          g.font = '800 15px "JetBrains Mono", monospace';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = col;
          g.fillText(String(cell.n), x + CELL / 2, y + CELL / 2 + 1);
        }
      } else {
        g.fillStyle = isHover ? PALETTE.s2 : PALETTE.panel;
        g.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        g.strokeStyle = PALETTE.line;
        g.lineWidth = 1;
        g.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
        g.fillStyle = PALETTE.line2;
        g.fillRect(x + 4, y + 4, CELL - 8, 2);
        g.fillRect(x + 4, y + 4, 2, CELL - 8);
        if (cell.flag) {
          g.fillStyle = PALETTE.alert;
          g.fillRect(x + CELL / 2 - 1, y + 9, 2, 13);
          g.fillRect(x + CELL / 2 - 7, y + 10, 8, 5);
          g.fillStyle = PALETTE.gold;
          g.fillRect(x + CELL / 2 - 7, y + 22, 10, 3);
        }
      }
    }

    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(GX - 3, GY - 3, COLS * CELL + 6, ROWS * CELL + 6);

    if (hintMsg) {
      g.font = '800 11px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillStyle = PALETTE.ink2;
      g.fillText(hintMsg, W / 2, 24);
    }

    g.font = '700 9px "JetBrains Mono", monospace';
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText(`OPENED ${opened}`, 8, 41);
    g.fillStyle = PALETTE.gold;
    g.fillText(`FLAGS ${flags}/${mines}`, 8, 53);

    g.textAlign = 'right';
    g.fillStyle = PALETTE.ink3;
    g.fillText(`THREATS ${mines}`, W - 8, 41);
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${Math.ceil(left)}s`, W - 8, 53);
    g.textAlign = 'left';
  }

  function reset() {
    mines = 12;
    opened = 0;
    flags = 0;
    left = RUN_TIME;
    firstClick = true;
    exploded = false;
    deadCell = -1;
    endKind = '';
    endBonus = 0;
    hintMsg = 'FIRST CLICK IS SAFE';
    buildField(idx(5, 4));
    cells[idx(5, 4)].mine = false;
    cells[idx(5, 4)].n = 0;
    const buf = [];
    neighbours(idx(5, 4), buf);
    for (let k = 0; k < buf.length; k++) {
      cells[buf[k]].mine = false;
      cells[buf[k]].n = 0;
    }
    for (let i = 0; i < N; i++) {
      if (cells[i].mine) continue;
      neighbours(i, buf);
      let n = 0;
      for (let k = 0; k < buf.length; k++) if (cells[buf[k]].mine) n++;
      cells[i].n = n;
    }
    m.setScore(0);
    m.hint({ ar: 'انقر للكشف · انقر مرتين لتعليم خلية', en: 'Click to reveal · double-click to flag' });
  }

  reset();
  return { update, draw };
}