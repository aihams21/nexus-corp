import { PALETTE } from '../kernel/render.js';
import { clamp } from '../../core/math.js';

export const meta = {
  id: 'g19',
  no: 19,
  unlockAt: 0,
  accent: PALETTE.amber,
  name: { ar: 'المبرمج السريع', en: 'Speed Coder' },
  tag: { ar: 'اكتب · احمِ', en: 'type · defend' },
  desc: {
    ar: 'كلمات برمجية تتساقط من الأعلى على سطر الأوامر. اكتبها كاملة لتفكيكها قبل أن تصل إلى القشرة.',
    en: 'Utility keywords rain down onto the shell. Type each one in full to dismantle it before it reaches the kernel.',
  },
  hint: { ar: 'اكتب الكلمات بالأحرف الإنجليزية', en: 'Type the keywords in lowercase English' },
};

const SHELL_TOP = 300;
const LINE_Y = 344;
const RUN_TIME = 75;
const WORDS = ['async', 'docker', 'kernel', 'deploy', 'commit', 'server', 'latency', 'buffer', 'socket', 'refactor'];
const SPAWN_MIN = 1.35;
const SPAWN_MAX = 2.6;

export function create(m) {
  const drops = [];
  const typed = [];
  let left = RUN_TIME;
  let typedWord = '';
  let cleared = 0;
  let leakedCount = 0;
  let lives = 3;
  let shellHits = 0;
  let ended = false;
  let endReason = '';
  let endBonus = 0;
  let shake = 0;
  let spawnIn = 0.9;
  let speed = 26;
  let combo = 0;
  let flashT = 0;
  let flashColor = PALETTE.amber;
  const bursts = [];

  function speedNow() {
    return speed + (RUN_TIME - left) * 0.42;
  }

  function spawn() {
    const word = m.rng.pick(WORDS);
    const size = word.length > 6 ? 15 : 13;
    const width = word.length * (size * 0.62);
    drops.push({
      word,
      x: m.rng.range(width / 2 + 6, m.w - width / 2 - 6),
      y: -18,
      typed: 0,
      w: width,
      h: size + 8,
      size,
      hue: word.length > 6 ? 1 : 0,
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 14; i += 1) {
      const a = m.rng.range(0, 6.2832);
      const s = m.rng.range(40, 160);
      bursts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: m.rng.range(0.2, 0.45), t: 0, color });
    }
  }

  function dismantle(d, idx) {
    cleared += 1;
    combo += 1;
    const pts = 30 + d.word.length * 6 + Math.min(90, combo * 8);
    m.addScore(pts);
    m.beep(combo % 5 === 0 ? 'level' : 'break', 0.75);
    flashT = 0.16;
    flashColor = combo % 5 === 0 ? PALETTE.phos : PALETTE.amber;
    burst(d.x + d.w / 2, d.y + d.h / 2, combo % 5 === 0 ? PALETTE.phos : PALETTE.amber);
    drops.splice(idx, 1);
    typedWord = '';
    if (combo % 5 === 0) m.banner(`STREAK ×${combo}`, 'hot', 800);
  }

  function leak(d, idx) {

    leakedCount += 1;
    shellHits += 1;
    lives -= 1;
    combo = 0;
    m.addScore(-35);
    m.flash(PALETTE.alert);
    m.beep('error', 0.85);
    m.noise(0.26);
    shake = 1;
    m.banner(`BREACH · ${lives} SHELL${lives === 1 ? '' : 'S'} LEFT`, 'bad', 1400);
    drops.splice(idx, 1);
    typedWord = '';
    if (lives <= 0) finish('breached');
  }



  function finish(reason) {
    if (ended) return;
    ended = true;
    endReason = reason;
    endBonus = Math.floor(left * 6) + cleared * 20 + lives * 90;
    m.addScore(endBonus);
    m.beep(reason === 'time' ? 'win' : 'gameover', 0.9);
    m.banner(reason === 'time' ? 'SHELL INTACT' : 'SHELL COMPROMISED', reason === 'time' ? 'good' : 'bad', 1600);
    m.timers.after(1000, () => m.finish(reason));
  }

  function update(dt) {
    if (ended) {
      if (shake > 0) shake = Math.max(0, shake - dt * 3);
      if (flashT > 0) flashT -= dt;
      for (let i = bursts.length - 1; i >= 0; i -= 1) {
        const b = bursts[i];
        b.t += dt;
        if (b.t >= b.life) bursts.splice(i, 1);
        else {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vy += 200 * dt;
        }
      }
      return;
    }

    const input = m.input.typed;
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i].toLowerCase();
      typed.push({ ch, life: 0.5 });
      if (ch === 'backspace') {
        if (typedWord.length) typedWord = typedWord.slice(0, -1);
        continue;
      }
      typedWord += ch;
      let matched = false;
      for (let k = drops.length - 1; k >= 0; k -= 1) {
        const d = drops[k];
        if (d.word.startsWith(typedWord) && d.word.length > typedWord.length) {
          d.typed = typedWord.length;
          matched = true;
          m.beep('tap', 0.25);
          break;
        }
        if (d.word === typedWord) {
          dismantle(d, k);
          matched = true;
          break;
        }
      }
      if (matched) continue;
      if (typedWord.length) {
        typedWord = '';
        for (const d of drops) d.typed = 0;
      }
    }

    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawn();
      spawnIn = m.rng.range(SPAWN_MIN, SPAWN_MAX) * (1 - (RUN_TIME - left) / RUN_TIME * 0.42);
    }

    const v = speedNow();
    for (let i = drops.length - 1; i >= 0; i -= 1) {
      const d = drops[i];
      const steps = v > 400 ? 4 : 1;
      const hs = dt / steps;
      for (let s = 0; s < steps; s += 1) d.y += v * hs;
      if (d.y > SHELL_TOP) leak(d, i);
    }

    for (let i = typed.length - 1; i >= 0; i -= 1) {
      typed[i].life -= dt;
      if (typed[i].life <= 0) typed.splice(i, 1);
    }
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const b = bursts[i];
      b.t += dt;
      if (b.t >= b.life) bursts.splice(i, 1);
      else {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy += 200 * dt;
      }
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 3);
    if (flashT > 0) flashT -= dt;

    m.addScore(dt * 6);
    left -= dt;
    if (left <= 0) {
      left = 0;
      finish('time');
    }
  }

  function drawDrop(g, d) {
    const full = d.word;
    const shown = full.slice(0, d.typed);
    const pending = full.slice(d.typed);
    const px = d.x - d.w / 2;
    const py = d.y;
    g.fillStyle = d.hue ? 'rgba(157,123,255,.16)' : 'rgba(255,176,0,.14)';
    g.fillRect(px, py, d.w, d.h);
    g.strokeStyle = d.hue ? PALETTE.violet : PALETTE.amber;
    g.lineWidth = 2;
    g.strokeRect(px, py, d.w, d.h);
    g.fillStyle = PALETTE.ink3;
    g.fillRect(px, py + d.h - 3, d.w * (d.typed / full.length), 3);

    g.font = `${d.size}px "JetBrains Mono", monospace`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    let cursor = px + 4;
    const cw = d.size * 0.62;
    g.fillStyle = PALETTE.phos;
    for (let i = 0; i < shown.length; i += 1) {
      g.fillText(shown[i], cursor, py + d.h / 2);
      cursor += cw;
    }
    g.fillStyle = d.hue ? PALETTE.violet : PALETTE.amber;
    for (let i = 0; i < pending.length; i += 1) {
      g.fillText(pending[i], cursor, py + d.h / 2);
      cursor += cw;
    }
    g.fillStyle = Math.floor(m.time * 6) % 2 === 0 ? PALETTE.phos : PALETTE.bg0;
    g.fillRect(cursor + 1, py + 3, 7, d.h - 6);
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.save();
    if (shake > 0) {
      const j = shake * shake * 5;
      g.translate(m.rng.range(-j, j), m.rng.range(-j, j));
    }

    g.strokeStyle = PALETTE.line;
    g.globalAlpha = 0.5;
    g.lineWidth = 1;
    for (let x = 0; x <= m.w; x += 24) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, SHELL_TOP);
      g.stroke();
    }
    for (let y = 0; y <= SHELL_TOP; y += 24) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(m.w, y);
      g.stroke();
    }
    g.globalAlpha = 1;

    g.fillStyle = 'rgba(255,59,71,.08)';
    g.fillRect(0, SHELL_TOP, m.w, m.h - SHELL_TOP);
    g.strokeStyle = PALETTE.alert;
    g.lineWidth = 2;
    for (let x = 0; x < m.w; x += 14) {
      g.beginPath();
      g.moveTo(x, SHELL_TOP);
      g.lineTo(x + 7, SHELL_TOP + 8);
      g.lineTo(x, SHELL_TOP + 16);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(0, SHELL_TOP);
    g.lineTo(m.w, SHELL_TOP);
    g.stroke();

    g.fillStyle = PALETTE.panel;
    g.fillRect(48, LINE_Y - 15, m.w - 96, 30);
    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(48, LINE_Y - 15, m.w - 96, 30);
    g.font = '10px "JetBrains Mono", monospace';
    g.textBaseline = 'middle';
    g.textAlign = 'right';
    g.fillStyle = PALETTE.phos;
    g.fillText('$', 68, LINE_Y);
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink;
    g.font = '14px "JetBrains Mono", monospace';
    g.fillText(typedWord, 78, LINE_Y);
    g.fillStyle = Math.floor(m.time * 6) % 2 === 0 ? PALETTE.phos : PALETTE.bg0;
    g.fillRect(80 + typedWord.length * 8.4, LINE_Y - 9, 8, 18);

    for (const d of drops) drawDrop(g, d);

    for (const t of typed) {
      g.globalAlpha = clamp(t.life / 0.5, 0, 1) * 0.7;
      g.fillStyle = PALETTE.cyan;
      g.fillRect(m.w / 2 + m.rng.range(-24, 24), m.h - 40, 5, 8);
      g.globalAlpha = 1;
    }
    for (const b of bursts) {
      g.globalAlpha = 1 - b.t / b.life;
      g.fillStyle = b.color;
      g.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;
    g.restore();

    if (flashT > 0) {
      g.globalAlpha = flashT * 2;
      g.fillStyle = flashColor;
      g.fillRect(0, 0, m.w, SHELL_TOP);
      g.globalAlpha = 1;
    }

    g.font = '9px "JetBrains Mono", monospace';
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('DISMANTLED', 10, 10);
    g.fillStyle = PALETTE.phos;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${cleared}`, 10, 20);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('LEAKED', 96, 10);
    g.fillStyle = PALETTE.alert;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${leakedCount}`, 96, 20);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('STREAK', 152, 10);
    g.font = '12px "JetBrains Mono", monospace';
    g.fillStyle = combo >= 5 ? PALETTE.amber : PALETTE.ink2;
    g.fillText(`×${combo}`, 152, 20);

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < 3; i += 1) {
      const on = i < lives;
      g.fillStyle = on ? PALETTE.phos : PALETTE.line2;
      g.fillRect(m.w / 2 - 26 + i * 18, 16, 12, 12);
      g.strokeStyle = PALETTE.bg0;
      g.lineWidth = 1;
      g.strokeRect(m.w / 2 - 26 + i * 18, 16, 12, 12);
    }

    g.textAlign = 'right';
    g.font = '11px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${Math.ceil(left)}s`, m.w - 10, 10);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText(`FALL ${Math.round(speedNow())} px/s`, m.w - 10, 24);
    g.textAlign = 'left';
  }

  m.hint({ ar: 'اكتب الكلمات بالأحرف الإنجليزية قبل وصولها إلى القشرة', en: 'Type the keywords before they hit the shell' });
  return { update, draw };
}