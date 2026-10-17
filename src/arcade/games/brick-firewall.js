// g03 — BRICK FIREWALL / جدار الطوب
// Arkanoid: slide the firewall paddle, smash the encrypted brick tiers.
import { PALETTE } from '../kernel/render.js';
import { clamp, clamp01, TAU } from '../../core/math.js';
import { integrate, stepClamped } from '../../core/engine.js';
import { intersectCircleAABB, resolveCircleAABB, bounceCircleAABB } from '../kernel/collide.js';

export const meta = {
  id: 'g03',
  no: 3,
  unlockAt: 0,
  accent: PALETTE.cyan,
  name: { ar: 'جدار الطوب', en: 'Brick Firewall' },
  tag: { ar: 'حائط رد', en: 'Arkanoid' },
  desc: {
    ar: 'حرّك لوحة الجدار لتفكّك طبقات البلوك المشفّرة قبل انتهاء المهلة.',
    en: 'Slide the firewall paddle to crack the encrypted brick tiers before time runs out.',
  },
  hint: { ar: '← → لتحريك اللوحة · مسافة للإطلاق', en: '← → to slide · SPACE to launch' },
};

const COLS = 11;
const ROWS = 5;
const BRICK_W = 36;
const BRICK_H = 15;
const GAP = 4;
const LEFT = 22;
const TOP = 40;
const PADDLE_W = 74;
const PADDLE_H = 9;
const SPEED0 = 236;

const TIER_COLOR = [PALETTE.violet, PALETTE.cyan, PALETTE.phos, PALETTE.gold, PALETTE.alert];

function makeBricks() {
  const list = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      list.push({
        x: LEFT + c * (BRICK_W + GAP),
        y: TOP + r * (BRICK_H + GAP),
        w: BRICK_W,
        h: BRICK_H,
        tier: r,
        hp: 1,
        flash: 0,
      });
    }
  }
  return list;
}

export function create(m) {
  const g = m.g;
  const paddle = { x: m.w / 2 - PADDLE_W / 2, y: m.h - 34, w: PADDLE_W, h: PADDLE_H, vx: 0 };
  const ball = { x: m.w / 2, y: m.h - 60, vx: 0, vy: 0, r: 5, spd: SPEED0, stuck: true, trail: [] };
  let bricks = makeBricks();
  let combo = 0;
  let bestCombo = 0;
  let timeLeft = 72;
  let done = false;
  let phase = 'run';

  function launch() {
    const ang = (-Math.PI / 2) + m.rng.range(-0.42, 0.42);
    ball.spd = Math.min(ball.spd + 6, 400);
    ball.vx = Math.cos(ang) * ball.spd;
    ball.vy = Math.sin(ang) * ball.spd;
    ball.stuck = false;
    m.beep('shoot', 0.7);
  }

  function resetBall() {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.stuck = true;
    ball.trail.length = 0;
  }

  function shatter(b) {
    b.hp = 0;
    combo++;
    if (combo > bestCombo) bestCombo = combo;
    m.addScore(12 + combo * 2);
    b.flash = 1;
    m.flash(b.tier === ROWS - 1 ? PALETTE.gold : PALETTE.cyan);
    m.beep('break', 0.75);
    m.noise(0.1, 0.35);
    if (combo > 0 && combo % 6 === 0) m.banner('CHAIN ×' + combo, 'hot', 700);
  }

  function remaining() {
    let n = 0;
    for (let i = 0; i < bricks.length; i++) if (bricks[i].hp > 0) n++;
    return n;
  }

  function finishRun(won) {
    if (done) return;
    done = true;
    phase = 'over';
    if (won) {
      m.addScore(500 + Math.round(timeLeft * 6));
      m.banner('FIREWALL BREACHED', 'good', 1400);
      m.beep('win', 1);
    } else {
      m.banner('BREACH', 'bad', 1400);
      m.beep('gameover', 0.9);
    }
    m.finish(won ? 'cleared' : 'time');
  }

  function loseLife() {
    if (done) return;
    combo = 0;
    m.addScore(-14);
    m.flash(PALETTE.alert);
    m.beep('explode', 0.6);
    m.noise(0.24, 0.5);
    m.banner('PACKET LOST', 'bad', 800);
    ball.spd = SPEED0;
    resetBall();
    timeLeft = Math.max(0, timeLeft - 12);
    if (timeLeft <= 0) finishRun(false);
  }

  function update(dt) {
    if (done) return;
    if (m.time < 0.9 && phase === 'run') phase = 'run';

    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      finishRun(false);
      return;
    }

    // paddle
    const ax = m.input.axisX;
    const target = paddle.x + ax * 340 * dt;
    paddle.vx = (target - paddle.x) / Math.max(dt, 0.0001);
    paddle.x = target;
    if (m.input.isDown('ArrowLeft') || m.input.isDown('KeyA')) paddle.x -= 300 * dt;
    if (m.input.isDown('ArrowRight') || m.input.isDown('KeyD')) paddle.x += 300 * dt;
    paddle.x = clamp(paddle.x, 4, m.w - paddle.w - 4);

    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 2;
      if (m.input.accept || m.input.clicked) launch();
    } else {
      // spec invariant: >400 px/s runs 4 sub-steps with continuous clamping
      integrate(dt, ball.vx, ball.vy, (sdt) => {
        ball.x = stepClamped(ball.x, ball.vx, sdt, ball.r, m.w - ball.r);
        ball.y = stepClamped(ball.y, ball.vy, sdt, ball.r, m.h - ball.r);
        // bricks
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i];
          if (b.hp <= 0) continue;
          if (!intersectCircleAABB(ball, b)) continue;
          const res = bounceCircleAABB(ball, b, { x: ball.vx, y: ball.vy }, 1);
          ball.vx = res.vx;
          ball.vy = res.vy;
          const nx = res.nx || 0;
          const ny = res.ny || -1;
          if (nx !== 0) ball.x = b.x + (nx > 0 ? b.w + ball.r + 1 : -ball.r - 1);
          if (ny !== 0) ball.y = b.y + (ny > 0 ? b.h + ball.r + 1 : -ball.r - 1);
          shatter(b);
          break;
        }
        // paddle
        if (intersectCircleAABB(ball, paddle)) {
          const res = bounceCircleAABB(ball, paddle, { x: ball.vx, y: ball.vy }, 1);
          const rel = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
          const ang = -Math.PI / 2 + rel * 1.05;
          ball.vx = Math.cos(ang) * ball.spd;
          ball.vy = Math.sin(ang) * ball.spd;
          if (res.ny !== undefined) { /* normal resolved above */ }
          ball.y = paddle.y - ball.r - 1;
          combo = 0;
          m.addScore(3);
          m.beep('bounce', 0.6);
        }
      });
      ball.trail.unshift({ x: ball.x, y: ball.y, a: 1 });
      if (ball.trail.length > 8) ball.trail.pop();
      for (let i = 0; i < ball.trail.length; i++) ball.trail[i].a = 1 - i / ball.trail.length;

      if (ball.y > m.h - 4) loseLife();
      if (remaining() === 0) finishRun(true);
    }

    for (let i = 0; i < bricks.length; i++) if (bricks[i].flash > 0) bricks[i].flash -= dt * 4;
  }

  function draw(g) {
    // playfield frame
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);
    g.strokeStyle = PALETTE.line;
    g.lineWidth = 2;
    g.strokeRect(1, 1, m.w - 2, m.h - 2);

    // grid
    g.strokeStyle = PALETTE.line;
    g.globalAlpha = 0.28;
    g.lineWidth = 1;
    for (let x = 0; x <= m.w; x += 24) {
      g.beginPath();
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, m.h);
      g.stroke();
    }
    for (let y = 0; y <= m.h; y += 24) {
      g.beginPath();
      g.moveTo(0, y + 0.5);
      g.lineTo(m.w, y + 0.5);
      g.stroke();
    }
    g.globalAlpha = 1;

    // bricks
    for (let i = 0; i < bricks.length; i++) {
      const b = bricks[i];
      if (b.hp <= 0) continue;
      g.fillStyle = b.flash > 0 ? PALETTE.ink : TIER_COLOR[b.tier % TIER_COLOR.length];
      g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = 'rgba(0,0,0,.34)';
      g.fillRect(b.x, b.y + b.h - 3, b.w, 3);
      g.fillStyle = 'rgba(255,255,255,.10)';
      g.fillRect(b.x, b.y, b.w, 1);
    }

    // ball trail
    for (let i = 0; i < ball.trail.length; i++) {
      const p = ball.trail[i];
      g.globalAlpha = p.a * 0.4;
      g.fillStyle = PALETTE.cyan;
      g.fillRect(p.x - ball.r * 0.6, p.y - ball.r * 0.6, ball.r * 1.2, ball.r * 1.2);
    }
    g.globalAlpha = 1;

    // ball
    g.fillStyle = PALETTE.ink;
    g.beginPath();
    g.arc(ball.x, ball.y, ball.r, 0, TAU);
    g.fill();
    g.strokeStyle = PALETTE.cyan;
    g.lineWidth = 1.5;
    g.stroke();

    // paddle
    g.fillStyle = PALETTE.amber;
    g.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    g.fillStyle = PALETTE.amberDim;
    g.fillRect(paddle.x, paddle.y + paddle.h - 2, paddle.w, 2);
    g.fillStyle = 'rgba(0,0,0,.4)';
    for (let i = 0; i < 4; i++) g.fillRect(paddle.x + 6 + i * 18, paddle.y + 3, 10, 2);

    // hud
    g.font = '700 10px "JetBrains Mono", monospace';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = PALETTE.ink3;
    g.fillText('TIERS LEFT', 10, 18);
    g.fillStyle = PALETTE.ink;
    g.font = '700 14px "JetBrains Mono", monospace';
    g.fillText(String(remaining()), 10, 34);

    g.textAlign = 'right';
    g.fillStyle = PALETTE.ink3;
    g.font = '700 10px "JetBrains Mono", monospace';
    g.fillText('COMBO', m.w - 10, 18);
    g.fillStyle = combo > 3 ? PALETTE.gold : PALETTE.ink2;
    g.font = '700 14px "JetBrains Mono", monospace';
    g.fillText('×' + combo, m.w - 10, 34);

    g.textAlign = 'left';
    g.fillStyle = timeLeft < 12 ? PALETTE.alert : PALETTE.cyan;
    g.font = '700 12px "JetBrains Mono", monospace';
    g.fillText('T-' + Math.ceil(timeLeft) + 's', 10, m.h - 10);

    if (ball.stuck && !done) {
      g.textAlign = 'center';
      g.fillStyle = PALETTE.amber;
      g.font = '700 12px "JetBrains Mono", monospace';
      g.fillText('SPACE / TAP TO LAUNCH', m.w / 2, m.h - 56);
    }
    g.textAlign = 'left';
  }

  return {
    update,
    draw,
    hint() {
      return m.hint({ ar: '← → لتحريك اللوحة · مسافة للإطلاق', en: '← → to slide · SPACE to launch' });
    },
  };
}