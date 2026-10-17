/**
 * Arcade registry — the catalogue of 20 cabinets.
 *
 * Each game module exports `meta` (identity, bilingual copy, accent colour)
 * and `create(machine)` (the play function). The registry is the only place
 * that knows the whole lineup; the machine never does.
 */

import * as g01 from './games/bug-squasher.js';
import * as g02 from './games/flappy-packet.js';
import * as g03 from './games/brick-firewall.js';
import * as g04 from './games/data-catcher.js';
import * as g05 from './games/cyber-runner.js';
import * as g06 from './games/silicon-snake.js';
import * as g07 from './games/malware-invaders.js';
import * as g08 from './games/chip-merge.js';
import * as g09 from './games/executive-pong.js';
import * as g10 from './games/memory-matrix.js';
import * as g11 from './games/tower-stacker.js';
import * as g12 from './games/asteroid-firewall.js';
import * as g13 from './games/security-minesweeper.js';
import * as g14 from './games/vault-lockpicker.js';
import * as g15 from './games/data-frogger.js';
import * as g16 from './games/orbital-dodge.js';
import * as g17 from './games/stock-scalper.js';
import * as g18 from './games/circuit-plumber.js';
import * as g19 from './games/speed-coder.js';
import * as g20 from './games/ddos-boss.js';

import { PALETTE } from './kernel/render.js';

export const ARCADE_UNLOCK_CASH = 10000;

const MODULES = [g01, g02, g03, g04, g05, g06, g07, g08, g09, g10, g11, g12, g13, g14, g15, g16, g17, g18, g19, g20];

export const GAMES = MODULES.map((mod, i) => {
  const meta = mod.meta;
  return {
    id: meta.id,
    no: meta.no || i + 1,
    unlockAt: meta.unlockAt || 0,
    accent: meta.accent || PALETTE.amber,
    name: meta.name,
    tag: meta.tag,
    desc: meta.desc,
    hint: meta.hint,
    create: mod.create,
  };
});

export const GAME_IDS = GAMES.map((g) => g.id);
export const TOTAL_GAMES = GAMES.length;

const BY_ID = new Map(GAMES.map((g) => [g.id, g]));

export function gameById(id) {
  return BY_ID.get(id) || null;
}

export function gameIndex(id) {
  return GAMES.findIndex((g) => g.id === id);
}

/** First cabinet is free; the rest of the floor opens once the Arcade floor is funded. */
export function cabinetUnlocked(state, id) {
  const entry = gameById(id);
  if (!entry) return false;
  if (entry.no === 1) return true;
  if (entry.unlockAt > 0) return state.cash >= entry.unlockAt;
  return state.cash >= ARCADE_UNLOCK_CASH;
}

function hashCode(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic cabinet thumbnail: a little circuit board unique to each
 * game id, drawn from a seeded stream so it never changes between frames.
 */
export function drawPoster(g, id, w, h) {
  const entry = gameById(id);
  const accent = entry ? entry.accent : PALETTE.amber;
  let seed = hashCode(id || 'nexus');
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  g.save();
  g.fillStyle = PALETTE.bg0;
  g.fillRect(0, 0, w, h);

  g.strokeStyle = PALETTE.line;
  g.lineWidth = 1;
  g.globalAlpha = 0.55;
  const step = Math.max(7, Math.round(w / 12));
  g.beginPath();
  for (let x = step; x < w; x += step) {
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, h);
  }
  for (let y = step; y < h; y += step) {
    g.moveTo(0, y + 0.5);
    g.lineTo(w, y + 0.5);
  }
  g.stroke();
  g.globalAlpha = 1;

  const traces = 5 + Math.floor(rnd() * 4);
  g.strokeStyle = accent;
  g.lineWidth = 1.5;
  g.globalAlpha = 0.85;
  for (let t = 0; t < traces; t++) {
    let x = Math.round(rnd() * (w - 1));
    let y = Math.round(rnd() * (h - 1));
    g.beginPath();
    g.moveTo(x, y);
    const legs = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < legs; i++) {
      if (rnd() < 0.5) x = Math.round(Math.min(w - 1, Math.max(0, x + (rnd() < 0.5 ? -1 : 1) * step)));
      else y = Math.round(Math.min(h - 1, Math.max(0, y + (rnd() < 0.5 ? -1 : 1) * step)));
      g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = accent;
    g.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  g.globalAlpha = 1;

  g.fillStyle = 'rgba(5,6,4,.78)';
  g.fillRect(0, 0, w, Math.round(h * 0.34));
  g.fillStyle = accent;
  g.font = '800 13px "JetBrains Mono", monospace';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(String((entry ? entry.no : 0)).padStart(2, '0'), 5, Math.round(h * 0.2));
  g.fillStyle = PALETTE.ink2;
  g.fillRect(5, Math.round(h * 0.34) - 1, w - 10, 1);
  g.restore();
}