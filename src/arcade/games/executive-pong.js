import { PALETTE } from '../kernel/render.js';
import { clamp, TAU } from '../../core/math.js';
import { integrate, stepClamped } from '../../core/engine.js';
import { intersectAABB, bounceCircleAABB } from '../kernel/collide.js';
import { rect } from '../kernel/shapes.js';

const WALL_T = 8;
const WALL_B = 8;
const PW = 9;
const PH = 56;
const PR = 6;
const BALL_SPEED = 320;
const SERVE_TIME = 0.8;
const SPEED_STEP = 7;
const SPEED_CAP = 780;

export const meta = {
  id: 'g09',
  no: 9,
  unlockAt: 0,
  accent: PALETTE.cyan,
  name: { ar: 'بونغ تنفيذي', en: 'Executive Pong' },
  tag: { ar: 'اضرب · اربح', en: 'rally · cash' },
  desc: {
    ar: 'مضرب تنفيذي سريع أمام خصم يقرأ تحركاتك. كل ضربة متتالية تضاعف الجائزة النقدية.',
    en: 'A fast executive paddle against a reading AI. Every rally step multiplies the cash jackpot.',
  },
  hint: { ar: 'الأسهم أو W/S · المسافة للإرسال', en: 'ARROWS or W/S · SPACE to serve' },
};

export function create(m) {
  const top = WALL_T;
  const bottom = m.h - WALL_B;
  let py = m.h / 2;
  let ax = m.h / 2;
  let pvy = 0;
  let avy = 0;
  let ball = { x: m.w / 2, y: m.h / 2, vx: 0, vy: 0 };
  let speed = BALL_SPEED;
  let rally = 0;
  let bestRally = 0;
  let pHits = 0;
  let aHits = 0;
  let owned = 0;
  let serveIn = SERVE_TIME;
  let served = false;
  let idle = true;
  let flashT = 0;
  let trail = [];
  let lastP = -1;
  let lastA = -1;
  let angleShow = 0;

  function box(x, y, w, h) {
    return rect(x, y, w, h);
  }

  function resetBall(dir) {
    const a = m.rng.range(-0.55, 0.55) + (dir === 'right' ? 0 : Math.PI);
    ball = {
      x: m.w / 2,
      y: m.h / 2,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
    };
    trail = [];
    served = false;
    serveIn = SERVE_TIME;
    idle = true;
  }

  function rallyPay() {
    return rally;
  }

  function speedUp() {
    speed = Math.min(SPEED_CAP, speed + SPEED_STEP);
  }

  function point(who) {
    rally = 0;
    lastP = -1;
    lastA = -1;
    if (who === 'ai') {
      owned++;
      m.flash(PALETTE.alert);
      m.beep('error', 0.8);
      m.banner(`POINT FOR AI · RUN ${owned}`, 'bad', 900);
    } else {
      m.flash(PALETTE.cyan);
      m.beep('cash', 0.7);
      m.banner('ACE — BOARD POINT', 'good', 900);
    }
    m.timers.after(700, () => resetBall(who === 'ai' ? 'right' : 'left'));
  }

  function serve(dir) {
    if (!idle) return;
    const a = m.rng.range(-0.5, 0.5) + (dir === 'right' ? 0 : Math.PI);
    ball.x = m.w / 2;
    ball.y = m.h / 2;
    ball.vx = Math.cos(a) * speed;
    ball.vy = Math.sin(a) * speed;
    served = true;
    idle = false;
    serveIn = 0;
    m.beep('shoot', 0.6);
  }

  function aiTarget() {
    const lead = clamp(ball.vx * 0.11, -70, 70);
    return ball.y + lead;
  }

  function update(dt) {
    if (flashT > 0) flashT -= dt;
    if (angleShow > 0) angleShow -= dt;

    const ax1 = m.input.axisY;
    pvy = easeAxis(pvy, ax1, dt);
    py = clamp(py + pvy * dt * 330, top + PH / 2, bottom - PH / 2);

    const target = aiTarget();
    const diff = target - ax;
    avy = easeAxis(avy, clamp(diff / 40, -1, 1), dt);
    ax = clamp(ax + avy * dt * 288, top + PH / 2, bottom - PH / 2);

    if (idle) {
      serveIn -= dt;
      ball.y = m.h / 2 + Math.sin(m.time * 9) * 9;
      ball.x = m.w / 2 + Math.sin(m.time * 2.2) * 16;
      if (serveIn <= 0 || m.input.accept || m.input.clicked) serve(m.rng.chance(0.5) ? 'right' : 'left');
    } else {
      const steps = integrate(dt, ball.vx, ball.vy, (h) => {
        ball.x = stepClamped(ball.x, ball.vx, h, PR, m.w - PR);
        ball.y = stepClamped(ball.y, ball.vy, h, top + PR, bottom - PR);
      });
      if (steps > 1) {
        angleShow = 0.6;
      }

      if (ball.y <= top + PR || ball.y >= bottom - PR) {
        ball.vy = -ball.vy;
        ball.y = clamp(ball.y, top + PR, bottom - PR);
        m.beep('bounce', 0.4);
      }

      const pb = box(14, py - PH / 2, PW, PH);
      if (ball.vx < 0 && intersectAABB(box(ball.x - PR, ball.y - PR, PR * 2, PR * 2), pb)) {
        const rel = clamp((ball.y - py) / (PH / 2), -1, 1);
        const a = -Math.PI / 2 + rel * 1.02;
        speedUp();
        ball.x = 14 + PW + PR;
        ball.vx = Math.cos(a) * speed;
        ball.vy = Math.sin(a) * speed;
        rally++;
        pHits++;
        if (rally > bestRally) bestRally = rally;
        lastP = rally;
        m.addScore(6 + rallyPay() * 4);
        m.beep('bounce', 0.75);
        m.flash(PALETTE.cyan);
        if (rally > 0 && rally % 4 === 0) m.banner(`RALLY ×${rally}`, 'hot', 800);
      }

      const ab = box(m.w - 14 - PW, ax - PH / 2, PW, PH);
      if (ball.vx > 0 && intersectAABB(box(ball.x - PR, ball.y - PR, PR * 2, PR * 2), ab)) {
        const rel = clamp((ball.y - ax) / (PH / 2), -1, 1);
        const a = Math.PI / 2 + rel * 1.02;
        speedUp();
        ball.x = m.w - 14 - PW - PR;
        ball.vx = Math.cos(a) * speed;
        ball.vy = Math.sin(a) * speed;
        rally++;
        aHits++;
        if (rally > bestRally) bestRally = rally;
        lastA = rally;
        m.addScore(3 + rallyPay() * 2);
        m.beep('tap', 0.6);
        if (rally > 0 && rally % 5 === 0) m.banner(`RALLY ×${rally}`, 'hot', 800);
      }

      if (ball.x < -30) point('ai');
      else if (ball.x > m.w + 30) point('p');
    }

    trail.push({ x: ball.x, y: ball.y, life: 1 });
    if (trail.length > 12) trail.shift();
    for (const t of trail) t.life -= dt * 3.6;
    while (trail.length && trail[0].life <= 0) trail.shift();

    if (owned >= 7) {
      m.addScore(owned * 120);
      m.flash(PALETTE.alert);
      m.beep('gameover', 0.9);
      m.banner('BOARD SOLD — MATCH OVER', 'bad', 1500);
      m.timers.after(1500, () => m.finish('lost'));
    }
  }

  function easeAxis(v, target, dt) {
    const rate = 18;
    v += (target - v) * Math.min(1, rate * dt);
    if (Math.abs(v) < 0.01) v = 0;
    return clamp(v, -1, 1);
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, 480, 360);

    const grd = g.createLinearGradient(0, 0, 0, 360);
    grd.addColorStop(0, '#080B06');
    grd.addColorStop(1, '#050604');
    g.fillStyle = grd;
    g.fillRect(0, 0, 480, 360);

    g.strokeStyle = PALETTE.line;
    g.lineWidth = 1;
    for (let x = 0; x <= 480; x += 30) {
      g.beginPath();
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, 360);
      g.stroke();
    }
    for (let y = 0; y <= 360; y += 30) {
      g.beginPath();
      g.moveTo(0, y + 0.5);
      g.lineTo(480, y + 0.5);
      g.stroke();
    }

    g.fillStyle = PALETTE.line2;
    g.fillRect(0, 0, 14, 360);
    g.fillRect(466, 0, 14, 360);
    g.fillRect(0, 0, 480, WALL_T);
    g.fillRect(0, 352, 480, WALL_B);

    g.save();
    g.setLineDash([7, 9]);
    g.strokeStyle = PALETTE.line;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(240.5, WALL_T);
    g.lineTo(240.5, 352);
    g.stroke();
    g.restore();

    for (const t of trail) {
      if (t.life <= 0) continue;
      g.globalAlpha = t.life * 0.42;
      g.fillStyle = PALETTE.cyan;
      g.beginPath();
      g.arc(t.x, t.y, PR * (0.4 + t.life * 0.7), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;

    drawPaddle(g, 14, py, PW, PH, PALETTE.cyan, 'EXO');
    drawPaddle(g, 466 - PW, ax, PW, PH, PALETTE.violet, 'AI');

    g.fillStyle = flashT > 0 ? PALETTE.gold : PALETTE.ink;
    g.beginPath();
    g.arc(ball.x, ball.y, PR, 0, TAU);
    g.fill();
    g.fillStyle = PALETTE.bg0;
    g.beginPath();
    g.arc(ball.x - 1.4, ball.y - 1.4, PR * 0.42, 0, TAU);
    g.fill();

    if (angleShow > 0) {
      g.globalAlpha = angleShow / 0.6;
      g.strokeStyle = PALETTE.amber;
      g.lineWidth = 1;
      const a = Math.atan2(ball.vy, ball.vx);
      g.beginPath();
      g.moveTo(ball.x, ball.y);
      g.lineTo(ball.x + Math.cos(a) * 40, ball.y + Math.sin(a) * 40);
      g.stroke();
      g.globalAlpha = 1;
    }

    g.font = '700 9px "JetBrains Mono", monospace';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('RALLY', 22, top + 16);
    g.fillStyle = PALETTE.amber;
    g.font = '800 15px "JetBrains Mono", monospace';
    g.fillText(String(rally), 22, top + 33);
    g.fillStyle = PALETTE.ink3;
    g.font = '700 9px "JetBrains Mono", monospace';
    g.fillText('BEST', 22, bottom - 20);
    g.fillStyle = PALETTE.ink;
    g.font = '800 12px "JetBrains Mono", monospace';
    g.fillText(String(bestRally), 22, bottom - 7);

    g.textAlign = 'right';
    g.fillStyle = PALETTE.ink3;
    g.fillText('BOARDS', 458, top + 16);
    g.fillStyle = PALETTE.alert;
    g.font = '800 15px "JetBrains Mono", monospace';
    g.fillText(`${owned}/7`, 458, top + 33);
    g.fillStyle = PALETTE.ink3;
    g.font = '700 9px "JetBrains Mono", monospace';
    g.fillText('BALL SPEED', 458, bottom - 20);
    g.fillStyle = PALETTE.cyan;
    g.font = '800 12px "JetBrains Mono", monospace';
    g.fillText(String(Math.round(speed)), 458, bottom - 7);

    g.textAlign = 'center';
    g.fillStyle = PALETTE.ink3;
    g.font = '800 11px "JetBrains Mono", monospace';
    g.fillText(idle ? `SERVE IN ${serveIn.toFixed(1)}s` : 'RALLY IN PLAY', 240, 24);
    g.textAlign = 'left';
  }

  function drawPaddle(g, x, y, w, h, color, label) {
    g.fillStyle = PALETTE.bg1;
    g.fillRect(x + 2, y - h / 2 + 3, w, h);
    g.fillStyle = color;
    g.fillRect(x, y - h / 2, w, h);
    g.fillStyle = PALETTE.bg0;
    for (let i = -h / 2 + 6; i < h / 2 - 2; i += 8) g.fillRect(x + 2, y + i, w - 4, 2);
    g.save();
    g.translate(x + w / 2, y);
    g.rotate(Math.PI / 2);
    g.fillStyle = PALETTE.bg0;
    g.font = '800 8px "JetBrains Mono", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 0, 1);
    g.restore();
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
  }

  resetBall('right');
  m.hint({ ar: 'الأسهم · مسافة للإرسال', en: 'ARROWS · SPACE to serve' });
  return { update, draw };
}