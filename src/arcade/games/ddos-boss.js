import { PALETTE } from '../kernel/render.js';
import { clamp, TAU } from '../../core/math.js';
import { intersectCircle } from '../kernel/collide.js';
import { wrapPoint } from '../kernel/shapes.js';

export const meta = {
  id: 'g20',
  no: 20,
  unlockAt: 0,
  accent: PALETTE.alert,
  name: { ar: 'موجة هجمات حجب الخدمة', en: 'DDoS Bullet Hell' },
  tag: { ar: 'اصمد · أطلِق', en: 'dodge · auto-fire' },
  desc: {
    ar: 'سفينتك تطلق النار تلقائياً. تفادَ الأنماط الشعاعية من نواة الهجوم المركزية حتى ينهار قلبها.',
    en: 'Your frigate fires on its own. Dodge the radial bursts from the raid core until its heart collapses.',
  },
  hint: { ar: 'حركة الماوس أو الأسهم — إطلاق النار تلقائي', en: 'Mouse or arrows · your fire is automatic' },
};

const CX = 240;
const CY = 180;
const SHIP_R = 7;
const FIRE_GAP = 0.17;
const RUN_TIME = 90;

export function create(m) {
  const bullets = [];
  const sparks = [];
  const ring = [];
  let px = 240;
  let py = 300;
  let hp = 3;
  let inv = 0;
  let left = RUN_TIME;
  let fireIn = 0;
  let shots = 0;
  let bossHp = 100;
  let bossMax = 100;
  let phase = 1;
  let spin = 0;
  let shake = 0;
  let ended = false;
  let endReason = '';
  let endBonus = 0;
  let hitT = 0;
  let coreT = 0;
  let fanT = 0;

  function emit(n, speed, colour, offset, spread) {
    for (let i = 0; i < n; i += 1) {
      const a = offset + (i - (n - 1) / 2) * spread;
      bullets.push({
        x: CX + Math.cos(a) * 22,
        y: CY + Math.sin(a) * 22,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 4,
        color: colour,
        life: 9,
      });
    }
  }

  function burst(x, y, color, n, spd) {
    for (let i = 0; i < n; i += 1) {
      const a = m.rng.range(0, TAU);
      const s = m.rng.range(spd * 0.3, spd);
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: m.rng.range(0.2, 0.55), t: 0, color, r: m.rng.range(1.2, 2.6) });
    }
  }

  function bossDown(dmg) {
    bossHp = Math.max(0, bossHp - dmg);
    coreT = 0.18;
    if (bossHp <= 0 && phase <= 3) {
      phase += 1;
      m.addScore(1500 * phase);
      m.beep('explode', 1);
      m.noise(0.5);
      m.flash(PALETTE.gold);
      shake = 1;
      m.banner(`CORE ${phase - 1} DESTROYED`, 'good', 1500);
      burst(CX, CY, PALETTE.gold, 40, 280);
      bullets.length = 0;
      ring.push({ r: 10, life: 0.7, t: 0 });
      bossMax = 100 + (phase - 1) * 30;
      bossHp = bossMax;
    }
  }

  function hurt() {
    if (inv > 0 || ended) return;
    inv = 1.1;
    hp -= 1;
    hitT = 0.4;
    shake = 1;
    m.addScore(-160);
    m.flash(PALETTE.alert);
    m.beep('explode', 0.9);
    m.noise(0.34);
    burst(px, py, PALETTE.alert, 24, 240);
    if (hp <= 0) finish('destroyed');
  }

  function finish(reason) {
    if (ended) return;
    ended = true;
    endReason = reason;
    endBonus = reason === 'time' ? 2000 + shots * 3 : shots * 3;
    m.addScore(endBonus);
    m.beep(reason === 'time' ? 'win' : 'gameover', 0.95);
    m.banner(reason === 'time' ? 'EDGE HELD' : 'FRIGATE LOST', reason === 'time' ? 'good' : 'bad', 1700);
    m.timers.after(1050, () => m.finish(reason));
  }

  function stepSparks(dt) {
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.t += dt;
      if (s.t >= s.life) {
        sparks.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 1 - 1.6 * dt;
      s.vy *= 1 - 1.6 * dt;
    }
    for (let i = ring.length - 1; i >= 0; i -= 1) {
      ring[i].t += dt;
      if (ring[i].t >= ring[i].life) ring.splice(i, 1);
    }
  }

  function update(dt, time) {
    if (ended) {
      stepSparks(dt);
      if (shake > 0) shake = Math.max(0, shake - dt * 2.6);
      if (hitT > 0) hitT -= dt;
      if (coreT > 0) coreT -= dt;
      spin += dt * (0.6 + phase * 0.25);
      return;
    }

    const tx = clamp(m.input.px, 12, m.w - 12);
    const ty = clamp(m.input.py, 12, m.h - 12);
    px += (tx - px) * Math.min(1, dt * 11);
    py += (ty - py) * Math.min(1, dt * 11);
    px = clamp(px, 12, m.w - 12);
    py = clamp(py, 12, m.h - 12);

    fireIn -= dt;
    if (fireIn <= 0) {
      fireIn = FIRE_GAP;
      shots += 1;
      const base = bossHp / bossMax < 0.35 ? 0 : 1;
      bullets.push({
        x: px,
        y: py - 10,
        vx: 0,
        vy: -560,
        r: 2.5,
        color: PALETTE.phos,
        life: 3,
        mine: true,
      });
      if (base === 1) {
        bullets.push({ x: px - 4, y: py - 4, vx: -160, vy: -520, r: 2.5, color: PALETTE.phosDim, life: 3, mine: true });
        bullets.push({ x: px + 4, y: py - 4, vx: 160, vy: -520, r: 2.5, color: PALETTE.phosDim, life: 3, mine: true });
      }
      m.beep('shoot', 0.22);
    }

    fanT -= dt;
    if (fanT <= 0) {
      fanT = Math.max(0.34, 1.25 - phase * 0.24);
      spin += 1.9;
      const n = 6 + phase * 2;
      const spd = 92 + phase * 22;
      emit(n, spd, PALETTE.alert, spin, 0.42);
      if (phase >= 2) {
        emit(5, spd * 0.66, PALETTE.gold, -spin, 0.5);
      }
      if (phase >= 3) {
        emit(9, spd * 1.28, PALETTE.violet, spin * 0.5, 0.28);
      }
      m.beep('alarm', 0.4);
    }

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.life -= dt;
      const steps = Math.abs(b.vx) > 400 || Math.abs(b.vy) > 400 ? 4 : 1;
      const hs = dt / steps;
      for (let s = 0; s < steps; s += 1) {
        b.x += b.vx * hs;
        b.y += b.vy * hs;
        if (b.mine) {
          wrapPoint(b, 10);
        } else {
          if (b.x < -30 || b.x > m.w + 30 || b.y < -30 || b.y > m.h + 30) {
            b.life = 0;
          } else if (b.x < 12) { b.x = 12; b.vx = Math.abs(b.vx); }
          else if (b.x > m.w - 12) { b.x = m.w - 12; b.vx = -Math.abs(b.vx); }
          else if (b.y < 12) { b.y = 12; b.vy = Math.abs(b.vy); }
          else if (b.y > m.h - 12) { b.y = m.h - 12; b.vy = -Math.abs(b.vy); }
        }
      }

      if (b.mine) {
        if (intersectCircle(b, { x: CX, y: CY, r: 30 })) {
          bossDown(phase >= 3 ? 7 : 5);
          m.addScore(6);
          m.beep('hit', 0.2);
          burst(b.x, b.y, PALETTE.gold, 4, 110);
          bullets.splice(i, 1);
          continue;
        }
      } else if (intersectCircle(b, { x: px, y: py, r: SHIP_R })) {
        bullets.splice(i, 1);
        hurt();
        continue;
      }
      if (b.life <= 0) bullets.splice(i, 1);
    }

    if (inv > 0) inv -= dt;
    if (hitT > 0) hitT -= dt;
    if (coreT > 0) coreT -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 2.4);
    spin += dt * (0.5 + phase * 0.2);
    stepSparks(dt);

    m.addScore(dt * 10);
    left -= dt;
    if (left <= 0) {
      left = 0;
      finish('time');
    }
  }

  function drawBoss(g) {
    const ratio = bossHp / bossMax;
    const pulse = 1 + Math.sin(spin * 2.2) * 0.05 + coreT * 0.5;
    const outer = 30 * pulse;

    g.globalAlpha = 0.18;
    g.fillStyle = PALETTE.alert;
    g.beginPath();
    g.arc(CX, CY, outer + 14, 0, TAU);
    g.fill();
    g.globalAlpha = 1;

    g.save();
    g.translate(CX, CY);
    g.rotate(spin);
    g.strokeStyle = PALETTE.violet;
    g.lineWidth = 3;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU;
      g.beginPath();
      g.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
      g.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      g.stroke();
    }
    g.strokeStyle = PALETTE.gold;
    g.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * TAU + 0.4;
      g.beginPath();
      g.arc(0, 0, outer * 0.72, a, a + 1.1);
      g.stroke();
    }
    g.restore();

    g.fillStyle = '#3A1220';
    g.beginPath();
    g.arc(CX, CY, outer, 0, TAU);
    g.fill();
    g.strokeStyle = PALETTE.alert;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(CX, CY, outer, 0, TAU);
    g.stroke();

    g.strokeStyle = PALETTE.bg0;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(CX, CY, outer - 4, -1.5708, -1.5708 + TAU * ratio);
    g.stroke();
    g.strokeStyle = PALETTE.phos;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(CX, CY, outer - 4, -1.5708, -1.5708 + TAU * ratio);
    g.stroke();

    const coreCol = coreT > 0 ? PALETTE.gold : phase >= 3 ? PALETTE.violet : PALETTE.alert;
    g.fillStyle = coreCol;
    g.beginPath();
    g.arc(CX, CY, 11 + Math.sin(spin * 5) * 1.6, 0, TAU);
    g.fill();
    g.fillStyle = PALETTE.bg0;
    g.beginPath();
    g.arc(CX, CY, 4.5, 0, TAU);
    g.fill();
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.strokeStyle = PALETTE.line;
    g.globalAlpha = 0.4;
    g.lineWidth = 1;
    for (let x = 20; x < m.w; x += 40) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, m.h);
      g.stroke();
    }
    for (let y = 20; y < m.h; y += 40) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(m.w, y);
      g.stroke();
    }
    g.globalAlpha = 1;

    g.save();
    if (shake > 0) {
      const j = shake * shake * 6;
      g.translate(m.rng.range(-j, j), m.rng.range(-j, j));
    }

    for (const r of ring) {
      const k = r.t / r.life;
      g.strokeStyle = PALETTE.gold;
      g.globalAlpha = 1 - k;
      g.lineWidth = 4 * (1 - k) + 1;
      g.beginPath();
      g.arc(CX, CY, 10 + k * 260, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;

    drawBoss(g);

    for (const b of bullets) {
      if (b.mine) {
        g.fillStyle = b.color;
        g.fillRect(b.x - b.r, b.y - 6, b.r * 2, 12);
        g.fillStyle = PALETTE.bg0;
        g.fillRect(b.x - b.r, b.y - 1, b.r * 2, 2);
      } else {
        g.fillStyle = b.color;
        g.beginPath();
        g.arc(b.x, b.y, b.r, 0, TAU);
        g.fill();
        g.fillStyle = PALETTE.bg0;
        g.beginPath();
        g.arc(b.x, b.y, b.r * 0.42, 0, TAU);
        g.fill();
      }
    }

    for (const s of sparks) {
      g.globalAlpha = 1 - s.t / s.life;
      g.fillStyle = s.color;
      g.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
    }
    g.globalAlpha = 1;

    const blink = inv > 0 && Math.floor(inv * 14) % 2 === 0;
    if (!blink) {
      g.fillStyle = hitT > 0 ? PALETTE.alert : PALETTE.cyan;
      g.beginPath();
      g.moveTo(px, py - 11);
      g.lineTo(px + 8, py + 8);
      g.lineTo(px, py + 3);
      g.lineTo(px - 8, py + 8);
      g.closePath();
      g.fill();
      g.fillStyle = PALETTE.bg0;
      g.fillRect(px - 4, py - 2, 8, 4);
      g.strokeStyle = PALETTE.cyan;
      g.lineWidth = 1;
      g.strokeRect(px - 12, py - 13, 24, 24);
    }
    g.restore();

    g.font = '9px "JetBrains Mono", monospace';
    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('HULL', 10, 10);
    for (let i = 0; i < 3; i += 1) {
      g.fillStyle = i < hp ? PALETTE.cyan : PALETTE.line2;
      g.fillRect(10 + i * 16, 22, 12, 12);
      g.strokeStyle = PALETTE.bg0;
      g.lineWidth = 1;
      g.strokeRect(10 + i * 16, 22, 12, 12);
    }
    g.fillStyle = PALETTE.ink3;
    g.font = '9px "JetBrains Mono", monospace';
    g.fillText('PHASE', 76, 10);
    g.font = '12px "JetBrains Mono", monospace';
    g.fillStyle = phase >= 3 ? PALETTE.violet : PALETTE.alert;
    g.fillText(`${phase - 1}`, 76, 20);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('SHOTS', 112, 10);
    g.fillStyle = PALETTE.phos;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${shots}`, 112, 20);

    g.textAlign = 'center';
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('RAID CORE', CX, 10);
    g.fillStyle = PALETTE.gold;
    g.font = '11px "JetBrains Mono", monospace';
    g.fillText(`${Math.ceil(bossHp)}/${bossMax}`, CX, 20);

    g.textAlign = 'right';
    g.font = '11px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${Math.ceil(left)}s`, m.w - 10, 10);
    g.textAlign = 'left';
  }

  m.hint({ ar: 'حركة الماوس أو الأسهم — إطلاق النار تلقائي', en: 'Move with the mouse or arrows — your fire is automatic' });
  return { update, draw };
}