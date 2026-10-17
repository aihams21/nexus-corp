/**
 * Arcade machine — the cabinet session.
 *
 * The machine owns everything a game is allowed to touch: the single rAF
 * loop, the input listener bag, the timer set, the canvas transform and the
 * score channel back to the tycoon. Games receive this object and nothing
 * else; they never create a loop or attach a global listener themselves, so
 * `unmount()` can guarantee a clean teardown with zero ghost input.
 *
 * Physics invariants enforced here (see core/engine.js for the maths):
 *   - dt is clamped to MAX_DT (0.033 s) every frame
 *   - anything faster than FAST_SPEED (400 px/s) is integrated in 4 sub-steps
 *     with continuous boundary clamping, via integrate()/stepClamped()
 */

import { createLoop, MAX_DT } from '../core/engine.js';
import { ListenerBag, Timers } from './kernel/loop.js';
import { Input } from './kernel/input.js';
import { fitCanvas, reset as resetCanvas, PALETTE } from './kernel/render.js';
import { makeRng } from '../core/rng.js';

export const PLANE_W = 480;
export const PLANE_H = 360;

const FLASH_MS = 190;
const BANNER_MS = 1150;

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {object}  [o.audio]    shared procedural SFX engine
 * @param {Function} [o.onScore] (score, gameId)
 * @param {Function} [o.onFinish] (score, gameId)
 * @param {Function} [o.onExit]
 * @param {Function} [o.onHint]   (text)
 * @param {Function} [o.onFlash]  (colorHex)
 * @param {Function} [o.onBanner] (text, kind)
 * @param {Function} [o.onOver]   () — machine left running state on its own
 */
export function createMachine(o = {}) {
  const canvas = o.canvas;
  if (!canvas) throw new Error('machine: canvas required');
  const g = canvas.getContext('2d', { alpha: false });
  if (!g) throw new Error('machine: 2d context unavailable');

  const bag = new ListenerBag();
  const timers = new Timers();
  const input = new Input(bag, canvas, PLANE_W, PLANE_H);
  const audio = o.audio || null;
  const onScore = o.onScore || (() => {});
  const onFinish = o.onFinish || (() => {});
  const onExit = o.onExit || (() => {});
  const onHint = o.onHint || (() => {});
  const onFlash = o.onFlash || (() => {});
  const onBanner = o.onBanner || (() => {});
  const onStop = o.onStop || (() => {});

  let handle = null;
  let updateFn = null;
  let drawFn = null;
  let loop = null;
  let gameId = null;
  let mounted = false;
  let ended = false;
  let time = 0;
  let score = 0;
  let flashUntil = 0;
  let flashColor = '#FFFFFF';
  let bannerUntil = 0;
  let bannerText = '';
  let bannerKind = 'info';
  let endedReason = '';
  const rng = makeRng(((o.seed || Date.now()) ^ 0x5f356495) >>> 0);

  function fit() {
    const box = fitCanvas(canvas, PLANE_W, PLANE_H);
    g.imageSmoothingEnabled = false;
    g.setTransform(box.dpr, 0, 0, box.dpr, 0, 0);
    return box;
  }

  function step(dt) {
    time += dt;
    if (updateFn) updateFn(dt, time);
    input.endFrame();
  }

  function paint() {
    if (drawFn) drawFn(g, time);
    else {
      g.fillStyle = PALETTE.bg0;
      g.fillRect(0, 0, PLANE_W, PLANE_H);
    }
    drawOverlays();
  }

  function drawOverlays() {
    if (bannerText && performance.now() < bannerUntil) {
      const w = Math.min(PLANE_W - 24, bannerText.length * 9 + 28);
      g.save();
      g.globalAlpha = 0.92;
      g.fillStyle = PALETTE.bg1;
      g.fillRect((PLANE_W - w) / 2, PLANE_H / 2 - 20, w, 40);
      g.strokeStyle = bannerColor();
      g.lineWidth = 2;
      g.strokeRect((PLANE_W - w) / 2, PLANE_H / 2 - 20, w, 40);
      g.restore();
      g.save();
      g.fillStyle = bannerColor();
      g.font = '700 15px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(bannerText, PLANE_W / 2, PLANE_H / 2);
      g.restore();
    }
    if (performance.now() < flashUntil) {
      g.save();
      g.globalAlpha = 0.32;
      g.fillStyle = flashColor;
      g.fillRect(0, 0, PLANE_W, PLANE_H);
      g.restore();
    }
  }

  function bannerColor() {
    if (bannerKind === 'bad') return PALETTE.alert;
    if (bannerKind === 'good') return PALETTE.phos;
    if (bannerKind === 'hot') return PALETTE.amber;
    return PALETTE.cyan;
  }

  /** Boot a game module's factory result and start the loop. */
  function mount(id, factory, seed) {
    unmount();
    gameId = id;
    ended = false;
    endedReason = '';
    time = 0;
    score = 0;
    updateFn = null;
    drawFn = null;
    bannerText = '';
    flashUntil = 0;
    fit();

    handle = factory(machine) || null;
    if (handle && typeof handle.update === 'function') updateFn = handle.update;
    if (handle && typeof handle.draw === 'function') drawFn = handle.draw;

    mounted = true;
    loop = createLoop(step, paint);
    loop.start();
    return machine;
  }

  /** Cancel rAF, drop every listener and timer, release the game. */
  function unmount() {
    if (loop) {
      loop.stop();
      loop = null;
    }
    timers.clear();
    input.releaseAll();
    bag.clear();
    if (handle && typeof handle.dispose === 'function') {
      try { handle.dispose(); } catch (err) { console.error('[machine] dispose threw', err); }
    }
    handle = null;
    updateFn = null;
    drawFn = null;
    mounted = false;
    gameId = null;
    try {
      resetCanvas(g);
      g.fillStyle = PALETTE.bg0;
      g.fillRect(0, 0, PLANE_W, PLANE_H);
    } catch (_) { /* canvas already gone */ }
  }

  function addScore(n) {
    const delta = Number(n);
    if (!Number.isFinite(delta) || delta === 0) return score;
    score += delta;
    if (score < 0) score = 0;
    onScore(score, gameId);
    return score;
  }

  function finish(reason) {
    if (ended) return;
    ended = true;
    endedReason = reason || 'done';
    if (loop) loop.stop();
    onFinish(Math.floor(score), gameId, endedReason);
  }

  function bail() {
    if (ended) return;
    ended = true;
    endedReason = 'quit';
    if (loop) loop.stop();
    onExit();
  }

  const machine = {
    // constants
    w: PLANE_W,
    h: PLANE_H,
    MAX_DT,
    // services
    g,
    canvas,
    input,
    bag,
    timers,
    rng,
    audio,
    // session
    get id() { return gameId; },
    get mounted() { return mounted; },
    get ended() { return ended; },
    get reason() { return endedReason; },
    get time() { return time; },
    get score() { return score; },
    // control
    mount,
    unmount,
    finish,
    bail,
    refit: fit,
    addScore,
    setScore(v) {
      const n = Math.max(0, Math.floor(Number(v) || 0));
      if (n === score) return score;
      score = n;
      onScore(score, gameId);
      return score;
    },
    // feedback helpers
    flash(color) {
      flashColor = color || '#FFFFFF';
      flashUntil = performance.now() + FLASH_MS;
      onFlash(flashColor);
    },
    banner(text, kind, ms) {
      bannerText = String(text || '');
      bannerKind = kind || 'info';
      bannerUntil = performance.now() + (ms || BANNER_MS);
      onBanner(bannerText, bannerKind);
    },
    hint(text) {
      onHint(String(text || ''));
    },
    beep(name, gain) {
      if (audio && typeof audio.play === 'function') audio.play(name, gain);
    },
    noise(dur, gain) {
      if (audio && typeof audio.burst === 'function') audio.burst(dur, gain);
    },
    stop() {
      onStop();
    },
  };

  return machine;
}