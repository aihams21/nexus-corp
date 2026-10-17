// Unified keyboard + pointer state for a game. Register through the ListenerBag
// so teardown removes every listener, and call `endFrame()` once per frame to
// roll the held state into the just-pressed / just-released edges.

import { clamp } from '../../core/math.js';

const MOVE_UP = ['ArrowUp', 'KeyW'];
const MOVE_DOWN = ['ArrowDown', 'KeyS'];
const MOVE_LEFT = ['ArrowLeft', 'KeyA'];
const MOVE_RIGHT = ['ArrowRight', 'KeyD'];
const ACCEPT = ['Space', 'Enter', 'NumpadEnter'];
const CANCEL = ['Escape', 'Backspace'];

export class Input {
  /**
   * @param {ListenerBag} bag
   * @param {HTMLCanvasElement} canvas
   * @param {number} planeW game-space width
   * @param {number} planeH game-space height
   */
  constructor(bag, canvas, planeW, planeH) {
    this.bag = bag;
    this.canvas = canvas;
    this.planeW = planeW;
    this.planeH = planeH;

    this.held = new Set();
    this.pressed = new Set();
    this.released = new Set();
    /** Raw characters typed since the last endFrame, in arrival order. */
    this.typed = '';
    this.blockedCodes = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'F1',
    ]);

    this.px = planeW / 2;
    this.py = planeH / 2;
    this.pointerDownFlag = false;
    this.clicked = false;
    this.releasedClick = false;
    this.wheel = 0;
    this.inside = false;
    this.anyInput = false;

    this._bind();
  }

  _bind() {
    const isTypingTarget = (el) => {
      if (!el || !el.tagName) return false;
      const tag = el.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea' || el.isContentEditable === true;
    };

    this.bag.add(window, 'keydown', (e) => {
      if (isTypingTarget(e.target)) return;
      if (this.blockedCodes.has(e.code) && !e.metaKey && !e.ctrlKey) e.preventDefault();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key && e.key.length === 1) this.typed += e.key;
      if (!this.held.has(e.code)) this.pressed.add(e.code);
      this.held.add(e.code);
      this.anyInput = true;
    }, { passive: false });

    this.bag.add(window, 'keyup', (e) => {
      if (this.held.has(e.code)) this.released.add(e.code);
      this.held.delete(e.code);
    });

    // A tab switch must not leave a key stuck down.
    this.bag.add(window, 'blur', () => this.releaseAll());

    const toGame = (clientX, clientY) => {
      const el = this.canvas;
      if (!el || !el.getBoundingClientRect) return null;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const nx = (clientX - rect.left) / rect.width;
      const ny = (clientY - rect.top) / rect.height;
      return {
        x: clamp(nx * this.planeW, -this.planeW, this.planeW * 2),
        y: clamp(ny * this.planeH, -this.planeH, this.planeH * 2),
      };
    };

    this.bag.add(this.canvas, 'pointermove', (e) => {
      const p = toGame(e.clientX, e.clientY);
      if (p) {
        this.px = p.x;
        this.py = p.y;
        this.inside = true;
      }
    });

    this.bag.add(this.canvas, 'pointerdown', (e) => {
      const p = toGame(e.clientX, e.clientY);
      if (p) {
        this.px = p.x;
        this.py = p.y;
      }
      this.pointerDownFlag = true;
      this.clicked = true;
      this.anyInput = true;
      if (typeof e.preventDefault === 'function') e.preventDefault();
    });

    this.bag.add(window, 'pointerup', () => {
      if (this.pointerDownFlag) this.releasedClick = true;
      this.pointerDownFlag = false;
    });

    this.bag.add(this.canvas, 'pointerleave', () => {
      this.inside = false;
    });

    this.bag.add(this.canvas, 'contextmenu', (e) => {
      if (typeof e.preventDefault === 'function') e.preventDefault();
    });

    this.bag.add(this.canvas, 'wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }, { passive: false });
  }

  releaseAll() {
    this.held.clear();
    this.pointerDownFlag = false;
    this.clicked = false;
    this.releasedClick = false;
    this.wheel = 0;
    this.inside = false;
    this.anyInput = false;
  }

  isDown(code) {
    return this.held.has(code);
  }

  /** True only on the frame the key went down. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  wasReleased(code) {
    return this.released.has(code);
  }

  anyDown(codes) {
    for (const c of codes) if (this.held.has(c)) return true;
    return false;
  }

  anyPressed(codes) {
    for (const c of codes) if (this.pressed.has(c)) return true;
    return false;
  }

  /** Pointer state. `down`/`up`/`left`/`right` below are the direction getters. */
  get pointerDown() { return this.pointerDownFlag; }

  get up() { return this.anyDown(MOVE_UP); }
  get down() { return this.anyDown(MOVE_DOWN); }
  get left() { return this.anyDown(MOVE_LEFT); }
  get right() { return this.anyDown(MOVE_RIGHT); }
  get axisX() { return (this.right ? 1 : 0) - (this.left ? 1 : 0); }
  get axisY() { return (this.down ? 1 : 0) - (this.up ? 1 : 0); }

  get accept() { return this.anyPressed(ACCEPT); }
  get cancel() { return this.anyPressed(CANCEL); }
  get pause() { return this.wasPressed('KeyP'); }

  /** Roll edges over. Call exactly once per frame, after update. */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.typed = '';
    this.clicked = false;
    this.releasedClick = false;
    this.wheel = 0;
    this.anyInput = false;
  }
}
