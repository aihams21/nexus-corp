import { PALETTE } from '../kernel/render.js';
import { clamp01 } from '../../core/math.js';

const N = 4;
const CELL = 66;
const GAP = 8;
const GRID = N * CELL + (N - 1) * GAP;
const GX = Math.round((480 - GRID) / 2);
const GY = 62;
const RUN_TIME = 60;
const SHOW_STEP = 0.4;
const SHOW_GAP = 0.14;
const FIRST = 3;
const MONO = '"JetBrains Mono", monospace';

export const meta = {
  id: 'g10',
  no: 10,
  unlockAt: 0,
  accent: PALETTE.violet,
  name: { ar: 'مصفوفة الذاكرة', en: 'Memory Matrix' },
  tag: { ar: 'راقب · ردّ', en: 'watch · recall' },
  desc: {
    ar: 'راقب تسلسل العقد المضيئة ثم كرّره بالنقر قبل انتهاء المهلة. كل مستوى يضيف عقدة جديدة إلى السلسلة.',
    en: 'Watch the node sequence light up, then repeat it by clicking before the clock runs out. Every level appends one more node.',
  },
  hint: { ar: 'انقر العقد بالترتيب', en: 'Click the nodes in order' },
};

export function create(m) {
  let seq = [];
  let level = 1;
  let phase = 'show';
  let showPos = 0;
  let showT = 0;
  let inputPos = 0;
  let lit = -1;
  let litT = 0;
  let left = RUN_TIME;
  let hits = 0;
  let faults = 0;
  let best = 0;
  let shake = 0;
  let particles = [];

  function nodeRect(i) {
    const r = Math.floor(i / N);
    const c = i % N;
    return { x: GX + c * (CELL + GAP), y: GY + r * (CELL + GAP), w: CELL, h: CELL };
  }

  function pickNode() {
    const last = seq.length ? seq[seq.length - 1] : -1;
    let n = last;
    let guard = 0;
    while (n === last && guard < 24) {
      n = m.rng.int(0, N * N - 1);
      guard += 1;
    }
    return n;
  }

  function beginShow() {
    phase = 'show';
    showPos = 0;
    showT = 0;
    inputPos = 0;
    lit = -1;
  }

  function beginInput() {
    phase = 'input';
    inputPos = 0;
    lit = -1;
    litT = 0;
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i += 1) {
      const a = m.rng.range(0, 6.2832);
      const sp = m.rng.range(40, 150);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.5, max: 0.5, color, r: m.rng.range(1.2, 2.6),
      });
    }
    if (particles.length > 90) particles.splice(0, particles.length - 90);
  }

  function levelUp() {
    level += 1;
    if (level > best) best = level;
    seq.push(pickNode());
    m.addScore(120 + level * 15);
    m.beep('level');
    m.flash(PALETTE.phos);
    m.banner(`CHAIN ${level}`, 'good', 900);
    beginShow();
  }

  function fault() {
    faults += 1;
    m.addScore(-40);
    m.beep('error');
    m.flash(PALETTE.alert);
    m.banner('SEQUENCE LOST', 'bad', 900);
    shake = 1;
    for (let i = 0; i < N * N; i += 1) {
      const b = nodeRect(i);
      burst(b.x + b.w / 2, b.y + b.h / 2, PALETTE.alert, 3);
    }
    if (level > 1) level -= 1;
    if (seq.length > level) seq.length = level;
    beginShow();
  }

  function finishRun(reason) {
    const bonus = level * 150 + hits * 12;
    if (bonus > 0) m.addScore(bonus);
    m.beep(reason === 'time' ? 'win' : 'gameover');
    m.banner(reason === 'time' ? 'CACHE HELD' : 'RUN ENDED', reason === 'time' ? 'good' : 'info', 1500);
    m.timers.after(1100, () => m.finish(reason));
  }

  function update(dt) {
    if (m.ended) return;

    left -= dt;
    if (litT > 0) litT -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 2.6);

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (left <= 0) {
      left = 0;
      finishRun('time');
      return;
    }

    if (phase === 'show') {
      showT += dt;
      if (showPos < seq.length) {
        if (showT >= SHOW_STEP) {
          showT = 0;
          lit = seq[showPos];
          litT = SHOW_STEP - 0.06;
          const b = nodeRect(lit);
          m.beep('tap', 0.55 + showPos * 0.045);
          burst(b.x + b.w / 2, b.y + b.h / 2, PALETTE.violet, 3);
          showPos += 1;
        }
      } else if (showT >= SHOW_STEP + SHOW_GAP) {
        beginInput();
      }
      return;
    }

    if (phase === 'input' && m.input.clicked) {
      const px = m.input.px;
      const py = m.input.py;
      for (let i = 0; i < N * N; i += 1) {
        const b = nodeRect(i);
        if (px < b.x || px > b.x + b.w || py < b.y || py > b.y + b.h) continue;
        lit = i;
        litT = 0.26;
        if (i === seq[inputPos]) {
          hits += 1;
          inputPos += 1;
          m.beep('tap', 0.6 + inputPos * 0.03);
          m.addScore(12);
          burst(b.x + b.w / 2, b.y + b.h / 2, PALETTE.phos, 5);
          if (inputPos >= seq.length) levelUp();
        } else {
          burst(b.x + b.w / 2, b.y + b.h / 2, PALETTE.alert, 8);
          fault();
        }
        break;
      }
    }
  }

  function drawNode(g, i, on, expect) {
    const b = nodeRect(i);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const glow = clamp01(litT / 0.26);

    g.fillStyle = on ? PALETTE.bg1 : PALETTE.bg2;
    g.fillRect(b.x, b.y, b.w, b.h);

    g.strokeStyle = on ? PALETTE.phos : expect ? PALETTE.amberDim : PALETTE.line;
    g.lineWidth = 2;
    g.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);

    if (on) {
      g.fillStyle = PALETTE.phosDim;
      g.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
      g.fillStyle = PALETTE.phos;
      const s = 6 + glow * 6;
      g.fillRect(cx - s, cy - s, s * 2, s * 2);
      g.fillStyle = PALETTE.bg0;
      g.fillRect(cx - s + 3, cy - s + 3, (s - 3) * 2, (s - 3) * 2);
    } else {
      g.fillStyle = PALETTE.line2;
      for (let k = 0; k < 3; k += 1) {
        g.fillRect(b.x + 10, b.y + 14 + k * 14, 5, 5);
        g.fillRect(b.x + b.w - 15, b.y + 14 + k * 14, 5, 5);
      }
      g.fillStyle = PALETTE.line;
      g.fillRect(cx - 12, cy - 1, 24, 2);
    }

    if (expect && !on) {
      g.strokeStyle = PALETTE.amber;
      g.lineWidth = 1;
      g.strokeRect(b.x + 5.5, b.y + 5.5, b.w - 11, b.h - 11);
    }
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.strokeStyle = PALETTE.line;
    g.lineWidth = 1;
    for (let x = 0; x < m.w; x += 24) {
      g.beginPath();
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, m.h);
      g.stroke();
    }
    for (let y = 0; y < m.h; y += 24) {
      g.beginPath();
      g.moveTo(0, y + 0.5);
      g.lineTo(m.w, y + 0.5);
      g.stroke();
    }

    g.save();
    if (shake > 0) {
      g.translate(Math.round((m.rng.next() - 0.5) * shake * 7), Math.round((m.rng.next() - 0.5) * shake * 7));
    }

    g.fillStyle = PALETTE.panel;
    g.fillRect(GX - 10, GY - 10, GRID + 20, GRID + 20);
    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(GX - 9, GY - 9, GRID + 18, GRID + 18);

    const expect = phase === 'input' ? seq[inputPos] : -1;
    for (let i = 0; i < N * N; i += 1) {
      drawNode(g, i, i === lit && litT > 0, i === expect);
    }

    g.fillStyle = PALETTE.bg0;
    g.strokeStyle = PALETTE.violet;
    g.lineWidth = 2;
    g.strokeRect(GX - 9.5, GY - 9.5, GRID + 19, GRID + 19);
    g.restore();

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      const a = clamp01(p.life / p.max);
      g.globalAlpha = a;
      g.fillStyle = p.color;
      g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    g.globalAlpha = 1;

    g.font = `700 10px ${MONO}`;
    g.textBaseline = 'top';

    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('LEVEL', 12, 10);
    g.fillStyle = PALETTE.violet;
    g.fillText(String(level), 12, 22);

    g.fillStyle = PALETTE.ink3;
    g.fillText('CHAIN', 66, 10);
    g.fillStyle = PALETTE.phos;
    g.fillText(String(hits), 66, 22);

    g.fillStyle = PALETTE.ink3;
    g.fillText('FAULTS', 118, 10);
    g.fillStyle = faults ? PALETTE.alert : PALETTE.ink2;
    g.fillText(String(faults), 118, 22);

    g.fillStyle = PALETTE.bg2;
    g.fillRect(12, 44, 132, 8);
    g.strokeStyle = PALETTE.line;
    g.lineWidth = 2;
    g.strokeRect(13, 45, 130, 6);
    g.fillStyle = PALETTE.violet;
    g.fillRect(14, 46, 128 * clamp01(left / RUN_TIME), 4);

    g.textAlign = 'right';
    g.fillStyle = PALETTE.ink3;
    g.fillText(phase === 'show' ? 'WATCH' : 'REPEAT', m.w - 12, 10);
    g.fillStyle = PALETTE.amber;
    g.fillText(`${Math.ceil(left)}s`, m.w - 12, 22);

    if (phase === 'show') {
      g.fillStyle = PALETTE.ink2;
      g.fillText(`NODE ${Math.min(showPos + 1, seq.length)}/${seq.length}`, m.w - 12, 40);
    } else {
      g.fillStyle = PALETTE.phos;
      g.fillText(`STEP ${inputPos}/${seq.length}`, m.w - 12, 40);
    }

    g.textAlign = 'center';
    g.fillStyle = PALETTE.ink3;
    g.fillText('MEMORY MATRIX', m.w / 2, GY + GRID + 24);
    g.textAlign = 'left';
  }

  function reset() {
    seq = [];
    level = 1;
    left = RUN_TIME;
    hits = 0;
    faults = 0;
    best = 0;
    shake = 0;
    lit = -1;
    litT = 0;
    particles = [];
    for (let i = 0; i < FIRST; i += 1) seq.push(pickNode());
    m.setScore(0);
    beginShow();
    m.hint({ ar: 'راقب التسلسل ثم كرّره بالنقر', en: 'Watch the sequence, then click it back' });
  }

  reset();
  return { update, draw };
}