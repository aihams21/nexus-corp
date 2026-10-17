import { PALETTE } from '../kernel/render.js';
import { clamp } from '../../core/math.js';
import { intersectAABB } from '../kernel/collide.js';
import { rect } from '../kernel/shapes.js';

export const meta = {
  id: 'g15',
  no: 15,
  unlockAt: 0,
  accent: PALETTE.phos,
  name: { ar: 'ضفدع البيانات', en: 'Data Frogger' },
  tag: { ar: 'اقفز · اعبر', en: 'hop · cross' },
  desc: {
    ar: 'اقفز عبر مسارات حركة الخوادم السريعة ووصل إلى فتحات المعالج قبل أن تُغلق نافذة الوردية.',
    en: 'Hop across the fast data lanes and reach the processor sockets before the shift closes.',
  },
  hint: { ar: 'الأسهم أو WASD للقفز', en: 'ARROWS or WASD to hop' },
};

export function create(m) {
  const COLS = 9;
  const ROWS = 13;
  const CW = 36;
  const CH = 24;
  const GX = 78;
  const GY = 32;

  const RUN_TIME = 70;
  const SOCKETS = 5;
  const HOP_TIME = 0.105;

  const LANE_TOP = 4;
  const LANE_BOT = 8;
  const START_ROW = 12;

  const LANES = [
    { row: 4, spd: 74, dir: 1, len: 40, kind: 'bus', gap: 96, tint: PALETTE.cyan },
    { row: 5, spd: 104, dir: -1, len: 30, kind: 'car', gap: 132, tint: PALETTE.gold },
    { row: 6, spd: 62, dir: 1, len: 54, kind: 'truck', gap: 152, tint: PALETTE.violet },
    { row: 7, spd: 128, dir: -1, len: 26, kind: 'car', gap: 116, tint: PALETTE.alert },
    { row: 8, spd: 88, dir: 1, len: 36, kind: 'bus', gap: 138, tint: PALETTE.phos },
  ];

  const cars = [];
  let pc;
  let pr;
  let hopT;
  let hopFrom;
  let hopTo;
  let lanes = [];
  let socketCols;
  let filled;
  let left = RUN_TIME;
  let dead;
  let deadT;
  let shake;
  let deadCol;
  let hops;
  let reached;
  let hintMsg;

  function rowY(r) {
    return GY + r * CH + CH / 2;
  }

  function colX(c) {
    return GX + c * CW + CW / 2;
  }

  function laneCars(lane) {
    const width = COLS * CW + 90;
    let x = -40 - m.rng.range(0, lane.gap);
    const out = [];
    while (x < width) {
      out.push({ x });
      x += lane.gap;
    }
    return out;
  }

  function buildLanes() {
    lanes = LANES.slice();
    cars.length = 0;
    for (const lane of lanes) {
      for (const spot of laneCars(lane)) {
        cars.push({ x: spot.x, lane: lane.row, len: lane.len, spd: lane.spd * lane.dir, kind: lane.kind });
      }
    }
    socketCols = [1, 2, 3, 5, 6].slice();
    filled = [];
  }

  function laneSpec(r) {
    for (const lane of lanes) if (lane.row === r) return lane;
    return null;
  }

  function place(col, row) {
    pc = col;
    pr = row;
    hopT = 0;
  }

  function tryHop(dc, dr) {
    if (dead || hopT > 0) return;
    const c = clamp(pc + dc, 0, COLS - 1);
    const r = pr + dr;
    if (r < 0 || r > ROWS - 1) return;
    if (dc !== 0) {
      const target = r === 0 ? socketCols.indexOf(c) : -1;
      if (r === 0 && target < 0) {
        m.beep('error');
        return;
      }
    }
    hopFrom = { c: pc, r: pr };
    hopTo = { c, r };
    hopT = HOP_TIME;
    m.beep('jump', 0.7);
    if (dr < 0) m.addScore(6);
  }

  function crush() {
    dead = true;
    deadT = 0.9;
    deadCol = pr;
    hops++;
    m.addScore(-70);
    m.beep('explode');
    m.noise(0.3);
    m.flash(PALETTE.alert);
    shake = 1;
    m.banner('BANDWIDTH HIT', 'bad', 900);
  }

  function home() {
    filled.push(pc);
    reached++;
    m.addScore(500 + Math.round(left) * 8);
    m.beep('cash');
    m.flash(PALETTE.phos);
    m.banner(`SOCKET ${reached}/${SOCKETS} ONLINE`, 'good', 1000);
    place(4, START_ROW);
    if (reached >= SOCKETS) {
      m.addScore(1500 + Math.round(left) * 15);
      m.beep('win');
      m.timers.after(1100, () => m.finish('cleared'));
      dead = true;
    }
  }

  function reset() {
    buildLanes();
    place(4, START_ROW);
    left = RUN_TIME;
    dead = false;
    deadT = 0;
    shake = 0;
    hops = 0;
    reached = 0;
    hintMsg = 'REACH A SOCKET';
    m.setScore(0);
    m.hint({ ar: 'اقفز إلى أعلى عبر المسارات', en: 'Hop upward through the lanes' });
  }

  function playerBox() {
    return rect(colX(pc) - 12, rowY(pr) - 10, 24, 20);
  }

  function update(dt) {
    if (shake > 0) shake = Math.max(0, shake - dt * 3);
    if (dead) {
      deadT -= dt;
      if (deadT <= 0 && reached < SOCKETS) {
        dead = false;
        place(4, START_ROW);
      }
      return;
    }
    left -= dt;
    if (left <= 0) {
      left = 0;
      m.beep('gameover');
      m.timers.after(950, () => m.finish('time'));
      dead = true;
      deadT = 1;
      return;
    }

    const steps = 4;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const span = COLS * CW + 120;
      for (const car of cars) {
        car.x += car.spd * h;
        if (car.spd > 0 && car.x > span) car.x -= span;
        if (car.spd < 0 && car.x < -span) car.x += span;
      }
    }

    if (hopT > 0) {
      hopT -= dt;
      if (hopT <= 0) {
        pc = hopTo.c;
        pr = hopTo.r;
        hopT = 0;
        if (pr === 0) home();
      }
    } else {
      if (m.input.wasPressed('ArrowUp') || m.input.wasPressed('KeyW')) tryHop(0, -1);
      if (m.input.wasPressed('ArrowDown') || m.input.wasPressed('KeyS')) tryHop(0, 1);
      if (m.input.wasPressed('ArrowLeft') || m.input.wasPressed('KeyA')) tryHop(-1, 0);
      if (m.input.wasPressed('ArrowRight') || m.input.wasPressed('KeyD')) tryHop(1, 0);
    }

    if (!dead && hopT === 0 && pr >= LANE_TOP && pr <= LANE_BOT) {
      const pb = playerBox();
      for (const car of cars) {
        if (car.lane !== pr) continue;
        if (intersectAABB(pb, rect(car.x - car.len / 2, rowY(pr) - 9, car.len, 18))) {
          crush();
          break;
        }
      }
    }
  }

  function drawCar(g, car) {
    const y = rowY(car.lane) - 9;
    const x = car.x - car.len / 2;
    const tint = laneSpec(car.lane) ? laneSpec(car.lane).tint : PALETTE.ink2;
    g.fillStyle = PALETTE.bg2;
    g.fillRect(x, y, car.len, 18);
    g.strokeStyle = tint;
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, car.len - 2, 16);
    g.fillStyle = tint;
    if (car.kind === 'bus') {
      for (let i = 0; i < car.len; i += 9) g.fillRect(x + 3 + i, y + 4, 5, 10);
    } else if (car.kind === 'truck') {
      g.fillRect(x + 4, y + 3, 12, 12);
      g.fillRect(x + car.len - 14, y + 5, 10, 8);
    } else {
      g.fillRect(x + car.len / 2 - 4, y + 4, 8, 10);
    }
    g.fillStyle = PALETTE.gold;
    g.fillRect(x + 1, y + 3, 2, 3);
    g.fillRect(x + car.len - 3, y + 12, 2, 3);
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.save();
    if (shake > 0) g.translate((m.rng.next() - 0.5) * shake * 7, (m.rng.next() - 0.5) * shake * 5);

    const topY = GY;
    const botY = GY + ROWS * CH;
    g.fillStyle = PALETTE.bg1;
    g.fillRect(GX - 8, topY - 6, COLS * CW + 16, botY - topY + 12);

    g.fillStyle = '#141A12';
    g.fillRect(GX - 8, GY + 9 * CH - 2, COLS * CW + 16, 3 * CH + 4);
    g.fillRect(GX - 8, GY - 6, COLS * CW + 16, 3 * CH);

    for (const lane of lanes) {
      const y = rowY(lane.row);
      g.fillStyle = '#0D100B';
      g.fillRect(GX - 8, y - 11, COLS * CW + 16, 22);
      g.strokeStyle = PALETTE.line;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(GX - 8, y + 11.5);
      g.lineTo(GX + COLS * CW + 8, y + 11.5);
      g.stroke();
    }

    for (let c = 0; c < COLS; c++) {
      const x = colX(c);
      const occupied = filled.indexOf(c) >= 0;
      const open = socketCols.indexOf(c) >= 0;
      g.strokeStyle = occupied ? PALETTE.phos : open ? PALETTE.gold : PALETTE.line;
      g.lineWidth = 2;
      g.strokeRect(x - 14, rowY(0) - 11, 28, 22);
      g.fillStyle = occupied ? PALETTE.phos : open ? PALETTE.bg2 : PALETTE.bg1;
      g.fillRect(x - 12, rowY(0) - 9, 24, 18);
      if (open) {
        g.fillStyle = PALETTE.gold;
        g.fillRect(x - 7, rowY(0) - 5, 14, 10);
        g.fillStyle = PALETTE.bg0;
        for (let i = -2; i <= 2; i += 2) g.fillRect(x + i - 1, rowY(0) - 9, 2, 3);
      }
    }

    for (const car of cars) {
      if (car.x < -car.len || car.x > COLS * CW + 120) continue;
      drawCar(g, car);
    }

    const sx = hopT > 0 && hopTo ? colX(hopTo.c) : colX(pc);
    const sy = hopT > 0 && hopTo ? rowY(hopTo.r) : rowY(pr);
    const squash = hopT > 0 ? Math.sin((1 - hopT / HOP_TIME) * Math.PI) : 0;
    if (!(dead && deadCol === pr && deadT > 0.55)) {
      g.save();
      g.translate(sx, sy);
      g.scale(1, 1 - squash * 0.42);
      g.fillStyle = dead ? PALETTE.alert : PALETTE.phos;
      g.fillRect(-11, -8, 22, 16);
      g.fillStyle = PALETTE.bg0;
      g.fillRect(-7, -4, 14, 8);
      g.fillStyle = dead ? PALETTE.alert : PALETTE.phosDim;
      g.fillRect(-15, -5, 4, 4);
      g.fillRect(11, -5, 4, 4);
      g.fillRect(-15, 3, 4, 4);
      g.fillRect(11, 3, 4, 4);
      g.fillStyle = PALETTE.gold;
      for (let i = -6; i <= 6; i += 4) g.fillRect(i - 1, -10, 2, 3);
      g.restore();
    }

    g.restore();

    g.font = '9px "JetBrains Mono", monospace';
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('SOCKETS', 10, 14);
    g.font = '13px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.gold;
    g.fillText(`${reached}/${SOCKETS}`, 10, 28);
    g.fillStyle = PALETTE.ink3;
    g.font = '9px "JetBrains Mono", monospace';
    g.fillText('HITS', 10, 46);
    g.font = '13px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.alert;
    g.fillText(`${hops}`, 10, 60);

    g.textAlign = 'right';
    g.fillStyle = PALETTE.ink3;
    g.font = '9px "JetBrains Mono", monospace';
    g.fillText('SHIFT', m.w - 10, 14);
    g.font = '13px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.phos;
    g.fillText(`${Math.max(0, Math.ceil(left))}s`, m.w - 10, 28);

    g.textAlign = 'center';
    g.font = '10px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink2;
    g.fillText(hintMsg, m.w / 2, m.h - 8);
    g.textAlign = 'left';
  }

  reset();
  return { update, draw };
}