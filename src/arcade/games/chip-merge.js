import { PALETTE } from '../kernel/render.js';

const N = 4;
const CELL = 70;
const GAP = 7;
const BOARD = N * CELL + (N - 1) * GAP;
const X0 = Math.round((480 - BOARD) / 2);
const Y0 = 34;
const TILE_MAX = 2048;

const TIERS = [
  { hex: '#3A3323', ink: '#A79C82', label: '—' },
  { hex: '#1C1913', ink: '#EDE6D6', label: '2' },
  { hex: '#332C1E', ink: '#EDE6D6', label: '4' },
  { hex: '#8A6A12', ink: '#0B0A07', label: '8' },
  { hex: '#FFB000', ink: '#0B0A07', label: '16' },
  { hex: '#E08100', ink: '#0B0A07', label: '32' },
  { hex: '#FF3B47', ink: '#0B0A07', label: '64' },
  { hex: '#B02430', ink: '#EDE6D6', label: '128' },
  { hex: '#9D7BFF', ink: '#0B0A07', label: '256' },
  { hex: '#6E55C4', ink: '#EDE6D6', label: '512' },
  { hex: '#25D0FF', ink: '#0B0A07', label: '1K' },
  { hex: '#37F57C', ink: '#0B0A07', label: '2K' },
];

const TIER_TINT = [
  PALETTE.line,
  PALETTE.ink2,
  PALETTE.ink,
  PALETTE.amberDim,
  PALETTE.amber,
  PALETTE.gold,
  PALETTE.alert,
  PALETTE.alert,
  PALETTE.violet,
  PALETTE.violet,
  PALETTE.cyan,
  PALETTE.phos,
];

function tierOf(value) {
  if (!value) return 0;
  let t = 1;
  let v = value;
  while (v > 1) {
    v = Math.floor(v / 2);
    t++;
  }
  return Math.min(t, TIER_TINT.length - 1);
}

export const meta = {
  id: 'g08',
  no: 8,
  unlockAt: 0,
  accent: PALETTE.gold,
  name: { ar: 'دمج الرقائق', en: 'Chip Merge' },
  tag: { ar: 'أزلق · ادمج', en: 'slide · merge' },
  desc: {
    ar: 'ادمج شرائح السيليكون المتجاورة لتكوين رقاقات أكبر، واطلق الدفعة النقدية مع كل عملية دمج.',
    en: 'Slide adjacent silicon wafers into bigger dies; every fusion mints an instant cash bonus.',
  },
  hint: { ar: 'الأسهم أو WASD', en: 'ARROWS or WASD' },
};

export function create(m) {
  /** @type {(number|null)[][]} */
  let grid = [];
  /** @type {{id:number,from:[number,number],to:[number,number],t:number}[]} */
  let slides = [];
  /** @type {{id:number,r:number,c:number,t:number,val:number}[]} */
  let pops = [];
  let nextId = 1;
  let best = 0;
  let moves = 0;
  let merges = 0;
  let spawnIn = 0;
  let won = false;
  let sinceSpawn = 0;

  function blank() {
    const g = [];
    for (let r = 0; r < N; r++) g.push(new Array(N).fill(null));
    return g;
  }

  function freeCells() {
    const out = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === null) out.push([r, c]);
    return out;
  }

  function spawn(base = 2) {
    const free = freeCells();
    if (!free.length) return null;
    const [r, c] = m.rng.pick(free);
    const roll = m.rng.next();
    const value = roll < 0.1 && base < 64 ? base * 2 : base;
    grid[r][c] = { id: nextId++, v: value, r, c };
    pops.push({ id: grid[r][c].id, r, c, t: 0, val: value });
    sinceSpawn = 0;
    return grid[r][c];
  }

  function pushRow(line, r, c0, dc) {
    const packed = [];
    for (let i = 0; i < N; i++) if (line[i]) packed.push({ tile: line[i], from: i });
    const out = new Array(N).fill(null);
    let write = 0;
    for (let i = 0; i < packed.length; i++) {
      const cur = packed[i];
      const nx = c0 + dc * write;
      if (
        i + 1 < packed.length &&
        packed[i + 1].tile.v === cur.tile.v &&
        cur.tile.v < TILE_MAX
      ) {
        const merged = { id: cur.tile.id, v: cur.tile.v * 2, r, c: nx };
        merged._other = packed[i + 1].tile.id;
        out[write] = merged;
        slides.push({ id: cur.tile.id, from: [r, c0 + dc * cur.from], to: [r, nx], t: 0 });
        slides.push({ id: packed[i + 1].tile.id, from: [r, c0 + dc * packed[i + 1].from], to: [r, nx], t: 0 });
        pops.push({ id: merged.id, r, c: nx, t: 0, val: merged.v });
        merges++;
        m.addScore(merged.v);
        m.beep(merged.v >= 128 ? 'level' : 'click', merged.v >= 512 ? 0.9 : 0.55);
        if (merged.v >= 128) m.flash(TIER_TINT[tierOf(merged.v)]);
        if (merged.v >= 256) m.banner(`WAFER ${merged.v}`, 'hot', 900);
        i++;
        write++;
      } else {
        out[write] = cur.tile;
        slides.push({ id: cur.tile.id, from: [r, c0 + dc * cur.from], to: [r, nx], t: 0 });
        write++;
      }
    }
    for (let i = 0; i < N; i++) {
      if (out[i]) {
        out[i].r = r;
        out[i].c = c0 + dc * i;
      }
    }
    return out;
  }

  function pushCol(line, c, r0, dr) {
    const packed = [];
    for (let i = 0; i < N; i++) if (line[i]) packed.push({ tile: line[i], from: i });
    const out = new Array(N).fill(null);
    let write = 0;
    for (let i = 0; i < packed.length; i++) {
      const cur = packed[i];
      const nr = r0 + dr * write;
      if (
        i + 1 < packed.length &&
        packed[i + 1].tile.v === cur.tile.v &&
        cur.tile.v < TILE_MAX
      ) {
        const merged = { id: cur.tile.id, v: cur.tile.v * 2, r: nr, c };
        out[write] = merged;
        slides.push({ id: cur.tile.id, from: [r0 + dr * cur.from, c], to: [nr, c], t: 0 });
        slides.push({ id: packed[i + 1].tile.id, from: [r0 + dr * packed[i + 1].from, c], to: [nr, c], t: 0 });
        pops.push({ id: merged.id, r: nr, c, t: 0, val: merged.v });
        merges++;
        m.addScore(merged.v);
        m.beep(merged.v >= 128 ? 'level' : 'click', merged.v >= 512 ? 0.9 : 0.55);
        if (merged.v >= 128) m.flash(TIER_TINT[tierOf(merged.v)]);
        if (merged.v >= 256) m.banner(`WAFER ${merged.v}`, 'hot', 900);
        i++;
        write++;
      } else {
        out[write] = cur.tile;
        slides.push({ id: cur.tile.id, from: [r0 + dr * cur.from, c], to: [nr, c], t: 0 });
        write++;
      }
    }
    for (let i = 0; i < N; i++) {
      if (out[i]) {
        out[i].r = r0 + dr * i;
        out[i].c = c;
      }
    }
    return out;
  }

  function slide(dir) {
    const before = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c]) before.push(grid[r][c].id);
    slides = [];

    if (dir === 'left') for (let r = 0; r < N; r++) grid[r] = pushRow(grid[r].slice(), r, 0, 1);
    else if (dir === 'right') for (let r = 0; r < N; r++) grid[r] = pushRow(grid[r].slice(), r, N - 1, -1);
    else if (dir === 'up') for (let c = 0; c < N; c++) {
      const col = [];
      for (let r = 0; r < N; r++) col.push(grid[r][c]);
      const out = pushCol(col, c, 0, 1);
      for (let r = 0; r < N; r++) grid[r][c] = out[r];
    } else {
      for (let c = 0; c < N; c++) {
        const col = [];
        for (let r = 0; r < N; r++) col.push(grid[r][c]);
        const out = pushCol(col, c, N - 1, -1);
        for (let r = 0; r < N; r++) grid[r][c] = out[r];
      }
    }

    const after = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c]) after.push(grid[r][c].id);
    let moved = before.length !== after.length;
    if (!moved) {
      for (let i = 0; i < before.length; i++) {
        if (before[i] !== after[i]) {
          moved = true;
          break;
        }
      }
    }
    if (!moved) {
      slides = [];
      m.beep('error', 0.35);
      if (!canMove()) deadEnd();
      return false;
    }

    moves++;
    m.beep('tap', 0.5);
    spawnIn = 0.13;
    if (!won && highest() >= TILE_MAX) {
      won = true;
      m.addScore(4000);
      m.flash(PALETTE.phos);
      m.banner('2048 SILICON DIE', 'good', 1600);
      m.beep('win', 1);
    }
    return true;
  }

  function highest() {
    let v = 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] && grid[r][c].v > v) v = grid[r][c].v;
    return v;
  }

  function canMove() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (!grid[r][c]) return true;
        if (c + 1 < N && grid[r][c + 1] && grid[r][c + 1].v === grid[r][c].v) return true;
        if (r + 1 < N && grid[r + 1][c] && grid[r + 1][c].v === grid[r][c].v) return true;
      }
    }
    return false;
  }

  function deadEnd() {
    m.addScore(Math.floor(highest() / 2));
    m.flash(PALETTE.alert);
    m.banner('WAFER LATTICE FULL', 'bad', 1400);
    m.beep('gameover', 0.9);
    m.timers.after(1200, () => m.finish('full'));
  }

  function reset() {
    grid = blank();
    slides = [];
    pops = [];
    nextId = 1;
    best = 0;
    moves = 0;
    merges = 0;
    won = false;
    sinceSpawn = 0;
    m.setScore(0);
    spawn(2);
    spawn(2);
    m.hint({ ar: 'الأسهم أو WASD · اجمع الرقائق', en: 'ARROWS or WASD · fuse the wafers' });
  }

  function tileXY(r, c) {
    return { x: X0 + c * (CELL + GAP), y: Y0 + r * (CELL + GAP) };
  }

  function update(dt) {
    for (const s of slides) s.t += dt * 15;
    slides = slides.filter((s) => s.t < 1);
    for (const p of pops) p.t += dt * 4;
    pops = pops.filter((p) => p.t < 1);
    sinceSpawn += dt;
    if (slides.length === 0 && spawnIn >= 0) {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = -1;
        spawn(2);
      }
    }

    const dir = m.input.wasPressed('ArrowLeft') || m.input.wasPressed('KeyA')
      ? 'left'
      : m.input.wasPressed('ArrowRight') || m.input.wasPressed('KeyD')
        ? 'right'
        : m.input.wasPressed('ArrowUp') || m.input.wasPressed('KeyW')
          ? 'up'
          : m.input.wasPressed('ArrowDown') || m.input.wasPressed('KeyS')
            ? 'down'
            : null;
    if (dir) slide(dir);

    const top = highest();
    if (top > best) best = top;
  }

  function drawTile(g, tile, x, y, size, popT, alpha) {
    const tier = tierOf(tile.v);
    const look = TIERS[tier] || TIERS[TIERS.length - 1];
    const tint = TIER_TINT[tier] || PALETTE.ink;
    const grow = popT === undefined ? 1 : 0.72 + 0.28 * popT;
    const s = size * grow;
    const off = (size - s) / 2;
    g.globalAlpha = alpha === undefined ? 1 : alpha;

    g.fillStyle = PALETTE.bg0;
    g.fillRect(x + off + 2, y + off + 3, s, s);
    g.fillStyle = look.hex;
    g.fillRect(x + off, y + off, s, s);
    g.strokeStyle = tint;
    g.lineWidth = 2;
    g.strokeRect(x + off + 1.5, y + off + 1.5, s - 3, s - 3);
    g.fillStyle = tint;
    g.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.35;
    g.fillRect(x + off + 5, y + off + 5, s - 10, 2);
    g.globalAlpha = alpha === undefined ? 1 : alpha;

    const fs = s < 46 ? 13 : s < 62 ? 18 : 24;
    g.font = `800 ${fs}px "JetBrains Mono", monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = look.ink;
    const label = tile.v >= 1024 ? `${(tile.v / 1024).toFixed(tile.v % 1024 ? 1 : 0)}K` : String(tile.v);
    g.fillText(label, x + s / 2, y + s / 2 + 1);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, 480, 360);

    g.fillStyle = PALETTE.line;
    g.fillRect(X0 - 10, Y0 - 10, BOARD + 20, BOARD + 20);
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        g.fillStyle = PALETTE.panel;
        g.fillRect(X0 + c * (CELL + GAP), Y0 + r * (CELL + GAP), CELL, CELL);
        g.strokeStyle = PALETTE.line;
        g.lineWidth = 1;
        g.strokeRect(X0 + c * (CELL + GAP) + 0.5, Y0 + r * (CELL + GAP) + 0.5, CELL - 1, CELL - 1);
        const pin = 6;
        g.fillStyle = PALETTE.line2;
        g.fillRect(X0 + c * (CELL + GAP) + 10, Y0 + r * (CELL + GAP) + 3, pin, 2);
        g.fillRect(X0 + c * (CELL + GAP) + 10, Y0 + r * (CELL + GAP) + CELL - 5, pin, 2);
      }
    }

    const live = new Set();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c]) live.add(grid[r][c].id);
    for (const t of grid.flat()) {
      if (!t) continue;
      const pos = tileXY(t.r, t.c);
      drawTile(g, t, pos.x, pos.y, CELL);
    }

    for (const s of slides) {
      if (live.has(s.id)) continue;
      const from = tileXY(s.from[0], s.from[1]);
      const to = tileXY(s.to[0], s.to[1]);
      const t = Math.max(0, Math.min(1, s.t));
      const e = t * t * (3 - 2 * t);
      drawTile(g, { v: 2 }, from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, CELL);
    }

    for (const p of pops) {
      const t = Math.max(0, Math.min(1, p.t));
      const pos = tileXY(p.r, p.c);
      g.strokeStyle = TIER_TINT[tierOf(p.val)] || PALETTE.ink;
      g.lineWidth = 2;
      const rad = CELL * 0.5 + t * 22;
      g.globalAlpha = 1 - t;
      g.beginPath();
      g.arc(pos.x + CELL / 2, pos.y + CELL / 2, rad, 0, 6.2832);
      g.stroke();
      g.globalAlpha = 1;
    }

    g.font = '700 10px "JetBrains Mono", monospace';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('MERGES', 10, 16);
    g.fillStyle = PALETTE.ink;
    g.fillText(String(merges), 10, 29);
    g.fillStyle = PALETTE.ink3;
    g.fillText('TOP DIE', 78, 16);
    g.fillStyle = PALETTE.gold;
    g.fillText(String(best), 78, 29);
    g.fillStyle = PALETTE.ink3;
    g.fillText('MOVES', 148, 16);
    g.fillStyle = PALETTE.ink;
    g.fillText(String(moves), 148, 29);

    g.textAlign = 'right';
    g.fillStyle = PALETTE.cyan;
    g.font = '800 11px "JetBrains Mono", monospace';
    g.fillText(best >= TILE_MAX ? '2048 REACHED' : `NEXT TIER ${best * 2}`, 470, 16);
    g.fillStyle = PALETTE.ink3;
    g.font = '700 9px "JetBrains Mono", monospace';
    g.fillText('SLIDE TO FUSE SILICON', 470, 29);
    g.textAlign = 'left';
  }

  reset();
  return { update, draw };
}