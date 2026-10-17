import { PALETTE } from '../kernel/render.js';
import { clamp } from '../../core/math.js';

const TRAY_W = 76;
const TRAY_H = 13;
const TRAY_Y = 330;
const TRAY_SPEED = 340;

const RUN_TIME = 60;

function trayBox(tray) {
  return { x: tray.x, y: TRAY_Y, w: TRAY_W, h: TRAY_H };
}

function bounds() {
  const half = TRAY_W / 2;
  return { lo: half, hi: 480 - half };
}

export const meta = {
  id: 'g04',
  no: 4,
  unlockAt: 0,
  accent: PALETTE.phos,
  name: { ar: 'جامع البيانات', en: 'Data Catcher' },
  tag: { ar: 'امسك · تفادَ', en: 'catch · dodge' },
  desc: {
    ar: 'حرّك خادم الصواني يميناً ويساراً، اصطد كبّات البيانات الخضراء وتفادَ قنابل البرمجيات الخبيثة.',
    en: 'Slide the server tray, scoop green data orbs, and dodge malware bombs.',
  },
  hint: { ar: 'الأسهم أو A/D', en: 'ARROWS or A/D' },
};

export function create(m) {
  const tray = { x: 240 };
  let vel = 0;
  let items = [];
  let spawnIn = 0.6;
  let left = RUN_TIME;
  let caught = 0;
  let leaked = 0;
  let bombDodged = 0;
  let streak = 0;
  let grace = 0;

  function reset() {
    items = [];
    spawnIn = 0.6;
    left = RUN_TIME;
    caught = 0;
    leaked = 0;
    bombDodged = 0;
    streak = 0;
    grace = 0;
    m.setScore(0);
    m.hint({ ar: 'التقط الكبّات الخضراء · احذر الأحمر', en: 'Green is data · red is malware' });
  }

  function spawn() {
    const isBomb = m.rng.chance(0.28 + Math.min(0.16, (RUN_TIME - left) / RUN_TIME * 0.16));
    const speed = m.rng.range(118, 152) + (RUN_TIME - left) * 1.5;
    items.push({
      x: m.rng.range(26, 480 - 26),
      y: -18,
      r: isBomb ? 10 : 8,
      vy: speed,
      kind: isBomb ? 'bomb' : 'orb',
      spin: m.rng.range(-2.4, 2.4),
      wob: m.rng.range(0, 6.28),
    });
    const gap = Math.max(0.34, 0.78 - (RUN_TIME - left) * 0.007);
    spawnIn = gap * m.rng.range(0.7, 1.35);
  }

  function pump(dt) {
    const axis = m.input.axisX;
    const target = axis * TRAY_SPEED;
    vel += (target - vel) * Math.min(1, dt * 14);
    tray.x = clamp(tray.x + vel * dt, bounds().lo, bounds().hi);

    spawnIn -= dt;
    if (spawnIn <= 0 && items.length < 26) spawn();

    const box = trayBox(tray);
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * dt;
      it.wob += dt * 3.2;
      const xOff = Math.sin(it.wob) * 6;

      if (it.kind === 'orb') {
        const nearX = Math.abs(it.x + xOff - (tray.x + TRAY_W / 2)) < TRAY_W / 2 + it.r;
        const nearY = it.y + it.r > TRAY_Y && it.y - it.r < TRAY_Y + TRAY_H + 8;
        if (nearX && nearY) {
          caught++;
          streak++;
          m.addScore(10 + Math.min(40, streak * 2));
          m.beep('coin', 0.35 + Math.min(0.3, streak * 0.02));
          if (streak >= 4) m.banner(`STREAK ×${1 + Math.floor(streak / 4)}`, 'good', 600);
          items.splice(i, 1);
          continue;
        }
      } else {
        const hitX = Math.abs(it.x + xOff - (tray.x + TRAY_W / 2)) < TRAY_W / 2 + it.r;
        const hitY = it.y + it.r > TRAY_Y && it.y - it.r < TRAY_Y + TRAY_H;
        if (hitX && hitY) {
          leaked++;
          streak = 0;
          grace = 0.9;
          m.addScore(-15);
          m.flash(PALETTE.alert);
          m.beep('error', 0.5);
          m.banner('MALWARE LEAKED', 'bad', 800);
          items.splice(i, 1);
          continue;
        }
      }

      if (it.y - it.r > 360) {
        if (it.kind === 'orb') {
          leaked++;
          streak = 0;
          m.addScore(-3);
        } else {
          bombDodged++;
          m.addScore(4);
        }
        items.splice(i, 1);
      }
    }
  }

  function finishRun(reason) {
    const bonus = caught * 6 + bombDodged * 3;
    if (bonus > 0) {
      m.addScore(bonus);
      m.beep('cash', 0.6);
    }
    m.banner(reason === 'time' ? 'SHIFT COMPLETE' : 'TRAYS DOWN', 'info', 1200);
    m.timers.after(650, () => m.finish(reason));
  }

  function update(dt) {
    if (m.ended) return;
    if (left > 0) {
      left -= dt;
      if (left <= 0) {
        left = 0;
        finishRun('time');
        return;
      }
    }
    if (grace > 0) grace -= dt;
    pump(dt);
  }

  function drawItem(g, it) {
    const x = it.x + Math.sin(it.wob) * 6;
    const y = it.y;
    if (it.kind === 'orb') {
      g.fillStyle = PALETTE.phosDim;
      g.beginPath();
      g.arc(x, y, it.r + 3, 0, 6.2832);
      g.fill();
      g.fillStyle = PALETTE.phos;
      g.beginPath();
      g.arc(x, y, it.r, 0, 6.2832);
      g.fill();
      g.fillStyle = '#0B0A07';
      g.fillRect(x - it.r + 2, y - 1, it.r * 2 - 4, 2);
      g.fillRect(x - 1, y - it.r + 2, 2, it.r * 2 - 4);
    } else {
      const r = it.r;
      g.fillStyle = PALETTE.alert;
      g.beginPath();
      g.arc(x, y, r, 0, 6.2832);
      g.fill();
      g.fillStyle = '#0B0A07';
      g.fillRect(x - r + 2, y - 1.5, r * 2 - 4, 3);
      g.fillRect(x - 1.5, y - r + 2, 3, r * 2 - 4);
      g.strokeStyle = PALETTE.gold;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x - 4, y - r - 3);
      g.lineTo(x + 4, y - r - 6);
      g.stroke();
    }
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.strokeStyle = 'rgba(58,51,35,0.5)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= m.w; x += 24) {
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, m.h);
    }
    g.stroke();

    g.fillStyle = PALETTE.line;
    g.fillRect(0, TRAY_Y + TRAY_H + 5, m.w, 2);

    for (let i = 0; i < items.length; i++) drawItem(g, items[i]);

    const box = trayBox(tray);
    if (grace > 0 && Math.floor(grace * 14) % 2 === 0) g.globalAlpha = 0.45;
    g.fillStyle = grace > 0 ? PALETTE.alert : PALETTE.panel;
    g.fillRect(box.x, box.y, box.w, box.h);
    g.globalAlpha = 1;
    g.fillStyle = PALETTE.amber;
    g.fillRect(box.x, box.y, box.w, 3);
    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2);
    g.fillStyle = PALETTE.ink3;
    for (let i = 0; i < 4; i++) {
      g.fillRect(box.x + 10 + i * 14, box.y + 6, 8, 2);
    }

    g.textBaseline = 'top';
    g.textAlign = 'left';
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText(`CATCHED ${caught}`, 10, 10);
    g.fillText(`DODGED ${bombDodged}`, 10, 22);
    g.fillText(`LEAKED ${leaked}`, 10, 34);

    g.textAlign = 'right';
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${Math.ceil(left)}s`, m.w - 10, 10);
    if (streak >= 3) {
      g.fillStyle = PALETTE.amber;
      g.fillText(`STREAK ×${1 + Math.floor(streak / 3)}`, m.w - 10, 22);
    }
    g.textAlign = 'left';
  }

  m.hint(meta.hint);
  reset();
  return { update, draw };
}
