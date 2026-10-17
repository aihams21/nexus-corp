import { PALETTE } from '../kernel/render.js';

export const meta = {
  id: 'g18',
  no: 18,
  unlockAt: 0,
  accent: PALETTE.cyan,
  name: { ar: 'سبّاك الدوائر', en: 'Circuit Plumber' },
  tag: { ar: 'أدر · صلّ', en: 'rotate · link' },
  desc: {
    ar: 'أدر أنابيب الطاقة لتوصيل مقبس المصدر بخادم مركز البيانات. وكل حركة دوران تكلّف جزءاً من الوقت.',
    en: 'Rotate the power conduits to link the source socket to the server rack. Every twist costs part of the clock.',
  },
  hint: { ar: 'انقر على الأنبوب لتدويره', en: 'Click a conduit to rotate it' },
};

const COLS = 5;
const ROWS = 4;
const CELL = 56;
const OX = 100;
const OY = 62;
const RUN_TIME = 70;
const TYPES = ['h', 'v', 'ne', 'nw', 'te', 'tw'];

export function create(m) {
  const grid = [];
  let srcIdx = 0;
  let dstIdx = COLS * ROWS - 1;
  let srcType = 3;
  let dstType = 0;
  let left = RUN_TIME;
  let moves = 0;
  let solved = 0;
  let ended = false;
  let endReason = '';
  let endBonus = 0;
  let jolt = 0;
  let flow = 0;
  let flowOn = false;
  

  function idx(c, r) {
    return r * COLS + c;
  }

  function dirsOf(t) {
    switch (t) {
      case 0: return [1, -1, 0, 0];
      case 1: return [0, 0, 1, -1];
      case 2: return [1, 0, 0, -1];
      case 3: return [1, 0, 0, 1];
      case 4: return [-1, 0, 1, 0];
      default: return [-1, 0, 0, 1];
    }
  }

  function bfs() {
    const seen = new Uint8Array(COLS * ROWS);
    const queue = [srcIdx];
    seen[srcIdx] = 1;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head];
      head += 1;
      if (cur === dstIdx) return seen;
      const t = cur === srcIdx ? srcType : grid[cur];
      const d = dirsOf(t);
      const cc = cur % COLS;
      const cr = Math.floor(cur / COLS);
      for (let k = 0; k < 4; k += 1) {
        const dc = d[k] === 1 ? 1 : d[k] === -1 ? -1 : 0;
        const dr = d[k] === 2 ? 1 : d[k] === -2 ? -1 : 0;
        const nc = cc + dc;
        const nr = cr + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const ni = idx(nc, nr);
        if (seen[ni]) continue;
        const nd = dirsOf(grid[ni]);
        let back = -1;
        for (let j = 0; j < 4; j += 1) {
          if (nd[j] === -dc && nd[j + 2] === -dr) back = j;
        }
        if (back < 0) continue;
        if (d[k] === 1 && nd[back] === -1) { seen[ni] = 1; queue.push(ni); }
        else if (d[k] === -1 && nd[back] === 1) { seen[ni] = 1; queue.push(ni); }
        else if (d[k] === 2 && nd[back] === -2) { seen[ni] = 1; queue.push(ni); }
        else if (d[k] === -2 && nd[back] === 2) { seen[ni] = 1; queue.push(ni); }
      }
    }
    return seen;
  }

  function check() {
    const seen = bfs();
    flowOn = seen[dstIdx] === 1;
    if (flowOn) {
      solved += 1;
      const bonus = 400 + Math.floor(left * 12);
      m.addScore(bonus);
      endBonus += bonus;
      m.beep('perfect', 0.9);
      m.flash(PALETTE.phos);
      m.banner(`CIRCUIT LIVE +${bonus}`, 'good', 1400);
      if (solved >= 3) finish('solved');
    }
    return seen;
  }

  function scramble() {
    srcIdx = m.rng.int(0, 2);
    dstIdx = m.rng.int(COLS * ROWS - 3, COLS * ROWS - 1);
    for (let i = 0; i < grid.length; i += 1) grid[i] = m.rng.int(0, TYPES.length - 1);
    grid[dstIdx] = 0;
    srcType = 1;
    flowOn = false;
    flow = 0;
    check();
  }

  function finish(reason) {
    if (ended) return;
    ended = true;
    endReason = reason;
    endBonus = Math.round(endBonus + moves * 6 + Math.max(0, Math.floor(left * 5)));
    m.addScore(endBonus);
    m.beep(reason === 'time' ? 'win' : 'gameover', 0.9);
    m.banner(reason === 'time' ? 'GRID STABILISED' : 'BOARD BROWNOUT', reason === 'time' ? 'good' : 'bad', 1600);
    m.timers.after(1000, () => m.finish(reason));
  }

  function update(dt) {
    if (ended) {
      if (jolt > 0) jolt = Math.max(0, jolt - dt * 3.4);
      if (flowOn) flow += dt;
      return;
    }

    if (m.input.clicked) {
      const c = Math.floor((m.input.px - OX) / CELL);
      const r = Math.floor((m.input.py - OY) / CELL);
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) {
        const i = idx(c, r);
        if (i === srcIdx) {
          srcType = (srcType + 1) % TYPES.length;
        } else {
          grid[i] = (grid[i] + 1) % TYPES.length;
        }
        moves += 1;
        jolt = 1;
        m.beep('click', 0.6);
        check();
      }
    }

    if (flowOn) flow += dt;
    if (jolt > 0) jolt = Math.max(0, jolt - dt * 3.4);

    m.addScore(dt * 4);

    left -= dt;
    if (left <= 0) {
      left = 0;
      finish('time');
    }
  }

  function seg(g, x, y, w, h) {
    g.fillStyle = PALETTE.panel;
    g.fillRect(x, y, w, h);
    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
  }

  function drawCell(g, i, live) {
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    const x = OX + c * CELL;
    const y = OY + r * CELL;
    const t = i === srcIdx ? srcType : grid[i];

    g.fillStyle = i === srcIdx ? '#12301C' : PALETTE.bg2;
    g.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
    g.strokeStyle = i === srcIdx ? PALETTE.phos : i === dstIdx ? PALETTE.gold : PALETTE.line;
    g.lineWidth = 2;
    g.strokeRect(x + 3, y + 3, CELL - 6, CELL - 6);

    const col = live ? PALETTE.cyan : PALETTE.line2;
    const core = live ? PALETTE.cyan : '#4A4230';
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;
    const arm = CELL / 2 - 10;
    const d = dirsOf(t);

    g.lineCap = 'butt';
    for (let k = 0; k < 4; k += 1) {
      if (k === 0) seg(g, cx, cy - 6, arm, 12);
      else if (k === 1) seg(g, cx, cy - 6, arm, 12);
      else if (k === 2) seg(g, cx - 6, cy, 12, arm);
      else if (k === 3) seg(g, cx - 6, cy, 12, arm);
    }
    for (let k = 0; k < 4; k += 1) {
      if (k === 0 || k === 1) {
        const sx = cx + (d[k] === 1 ? arm : -arm);
        seg(g, sx - (d[k] === 1 ? 0 : 14), cy - 6, 14, 12);
      } else {
        const sy = cy + (d[k] === 2 ? arm : -arm);
        seg(g, cx - 6, sy - (d[k] === 2 ? 0 : 14), 12, 14);
      }
    }
    g.fillStyle = col;
    g.fillRect(cx - 9, cy - 9, 18, 18);
    g.fillStyle = PALETTE.bg0;
    g.fillRect(cx - 5, cy - 5, 10, 10);
    g.strokeStyle = core;
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(cx, cy, 4, 0, 6.2832);
    g.stroke();

    if (i === srcIdx) {
      g.strokeStyle = PALETTE.phos;
      g.lineWidth = 2;
      const pulse = live ? 1 : 0.45 + Math.sin(m.time * 4) * 0.2;
      g.globalAlpha = pulse;
      g.strokeRect(x + 8, y + 8, CELL - 16, CELL - 16);
      g.globalAlpha = 1;
      g.font = '8px "JetBrains Mono", monospace';
      g.textBaseline = 'bottom';
      g.textAlign = 'left';
      g.fillStyle = PALETTE.phos;
      g.fillText('SRC', x + 8, y + CELL - 8);
    }
    if (i === dstIdx) {
      g.strokeStyle = live ? PALETTE.phos : PALETTE.gold;
      g.lineWidth = 2;
      g.strokeRect(x + 10, y + 10, CELL - 20, CELL - 20);
      g.fillStyle = live ? PALETTE.phos : PALETTE.gold;
      g.font = '8px "JetBrains Mono", monospace';
      g.textBaseline = 'top';
      g.textAlign = 'center';
      g.fillText('SRV', cx, y + CELL - 22);
      g.textAlign = 'left';
    }
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);
    g.strokeStyle = PALETTE.line;
    g.globalAlpha = 0.55;
    g.lineWidth = 1;
    for (let x = 0; x <= m.w; x += 24) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, m.h);
      g.stroke();
    }
    for (let y = 0; y <= m.h; y += 24) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(m.w, y);
      g.stroke();
    }
    g.globalAlpha = 1;

    g.fillStyle = PALETTE.bg1;
    g.fillRect(OX - 8, OY - 8, COLS * CELL + 16, ROWS * CELL + 16);
    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(OX - 8, OY - 8, COLS * CELL + 16, ROWS * CELL + 16);

    const seen = ended ? bfs() : bfs();
    g.save();
    if (jolt > 0) {
      const j = jolt * jolt * 4;
      g.translate(m.rng.range(-j, j), m.rng.range(-j, j));
    }
    for (let i = 0; i < grid.length; i += 1) drawCell(g, i, seen[i] === 1);
    g.restore();

    if (flowOn) {
      g.globalAlpha = 0.3 + Math.sin(flow * 7) * 0.14;
      g.strokeStyle = PALETTE.cyan;
      g.lineWidth = 3;
      const c = srcIdx % COLS;
      const r = Math.floor(srcIdx / COLS);
      g.strokeRect(OX + c * CELL + 6, OY + r * CELL + 6, CELL - 12, CELL - 12);
      g.globalAlpha = 1;
    }

    g.font = '9px "JetBrains Mono", monospace';
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('MOVES', 10, 10);
    g.fillStyle = PALETTE.ink;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${moves}`, 10, 20);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('CIRCUITS', 66, 10);
    g.fillStyle = PALETTE.gold;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${solved}/3`, 66, 20);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('LINK', 122, 10);
    g.font = '12px "JetBrains Mono", monospace';
    g.fillStyle = flowOn ? PALETTE.phos : PALETTE.alert;
    g.fillText(flowOn ? 'LIVE' : 'OPEN', 122, 20);

    g.textAlign = 'center';
    g.font = '11px "JetBrains Mono", monospace';
    g.fillStyle = flowOn ? PALETTE.phos : PALETTE.ink2;
    g.fillText(flowOn ? 'POWER ROUTED TO SERVER' : 'TRACE A PATH FROM SRC TO SRV', m.w / 2, OY + ROWS * CELL + 18);

    g.textAlign = 'right';
    g.font = '11px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${Math.ceil(left)}s`, m.w - 10, 10);
    g.textAlign = 'left';
  }

  grid.length = 0;
  for (let i = 0; i < COLS * ROWS; i += 1) grid.push(m.rng.int(0, TYPES.length - 1));
  scramble();
  m.hint({ ar: 'انقر على الخلية لتدوير الأنبوب', en: 'Click a cell to rotate its conduit' });
  return { update, draw };
}