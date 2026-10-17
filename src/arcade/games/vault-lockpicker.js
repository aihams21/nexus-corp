import { PALETTE } from '../kernel/render.js';
import { angleDelta, TAU } from '../../core/math.js';

export const meta = {
  id: 'g14',
  no: 14,
  unlockAt: 0,
  accent: PALETTE.gold,
  name: { ar: 'قارئ الأقفال الدوّار', en: 'Vault Lockpicker' },
  tag: { ar: 'دوّار · توقيت', en: 'spin · time' },
  desc: {
    ar: 'راقب المؤشر الدوّار واضربه في اللحظة التي يلامس فيها القوس الذهبي. كل قفل يضيق نافذته أكثر.',
    en: 'Watch the dial and strike the instant the needle crosses the gold arc. Every lock narrows the window.',
  },
  hint: { ar: 'مسافة أو انقر عند التوقيت المناسب', en: 'SPACE or click at the perfect instant' },
};

export function create(m) {
  const CX = 240;
  const CY = 178;
  const R = 100;

  const RUN_TIME = 60;
  const LOCKS = 5;
  const STRIKES_MAX = 3;

  const WINDOW_START = 0.46;
  const WINDOW_MIN = 0.13;
  const SPD_START = 1.55;
  const SPD_STEP = 0.62;
  const SPD_CAP = 8.4;

  let ang = 0;
  let spd = SPD_START;
  let lock = 0;
  let solved = 0;
  let strikes = 0;
  let left = RUN_TIME;
  let target = 0;
  let half = WINDOW_START;
  let spin = 0;
  let dead = false;
  let perfects = 0;
  let best = 0;
  let lastGrade = '';
  let lastGradeT = 0;
  let flashT = 0;
  let flashColor = PALETTE.gold;
  let hintMsg = '';
  let endKind = '';
  let endBonus = 0;

  const marks = [];
  for (let i = 0; i < 48; i++) marks.push(i);

  function armLock() {
    lock = Math.min(LOCKS, solved + 1);
    target = m.rng.range(0, TAU);
    half = Math.max(WINDOW_MIN, WINDOW_START - (solved / LOCKS) * (WINDOW_START - WINDOW_MIN) - solved * 0.012);
    spd = Math.min(SPD_CAP, SPD_START + solved * SPD_STEP);
    spin = 0;
  }

  function gradeOf(ratio) {
    if (ratio <= 0.16) return 'PERFECT';
    if (ratio <= 0.45) return 'GREAT';
    return 'LOCKED';
  }

  function strike() {
    if (dead) return;
    const d = Math.abs(angleDelta(ang, target));
    const ratio = half > 0 ? d / half : 99;
    if (d <= half) {
      solved++;
      const grade = gradeOf(ratio);
      if (grade === 'PERFECT') {
        perfects++;
        best++;
        m.addScore(60 + perfects * 40);
        m.beep('perfect');
        flashColor = PALETTE.phos;
        flashT = 0.35;
      } else if (grade === 'GREAT') {
        m.addScore(45);
        m.beep('cash');
        flashColor = PALETTE.gold;
        flashT = 0.28;
      } else {
        m.addScore(30);
        m.beep('coin');
        flashColor = PALETTE.amber;
        flashT = 0.22;
      }
      lastGrade = grade;
      lastGradeT = 1.5;
      if (solved >= LOCKS) {
        endKind = 'cleared';
        endBonus = 400 + perfects * 220;
        m.addScore(endBonus);
        m.beep('win');
        hintMsg = 'VAULT OPENED';
        m.timers.after(1000, () => m.finish('cleared'));
        dead = true;
        return;
      }
      m.timers.after(680, () => {
        if (!dead) armLock();
      });
    } else if (ratio > 2.1) {
      strikes++;
      m.addScore(-30);
      m.beep('error');
      m.noise(0.16);
      m.flash(PALETTE.alert);
      flashColor = PALETTE.alert;
      flashT = 0.3;
      lastGrade = 'OFF BY ' + Math.round(ratio * 100) + '%';
      lastGradeT = 1.5;
      if (strikes >= STRIKES_MAX) {
        endKind = 'alarm';
        endBonus = solved * 90;
        hintMsg = 'ALARM TRIPPED';
        m.beep('alarm');
        m.timers.after(1050, () => m.finish('alarm'));
        dead = true;
      }
    } else {
      m.beep('tick');
    }
  }

  function reset() {
    ang = m.rng.range(0, TAU);
    solved = 0;
    perfects = 0;
    best = 0;
    strikes = 0;
    left = RUN_TIME;
    dead = false;
    flashT = 0;
    lastGradeT = 0;
    endKind = '';
    endBonus = 0;
    hintMsg = 'STRIKE ON THE GOLD ARC';
    m.setScore(0);
    armLock();
  }

  function update(dt) {
    if (dead) return;
    if (lastGradeT > 0) lastGradeT -= dt;
    if (flashT > 0) flashT -= dt;
    left -= dt;
    const steps = 4;
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      ang = (ang + spd * h) % TAU;
    }
    if (m.input.wasPressed('Space') || m.input.accept || m.input.clicked) strike();
    if (left <= 0) {
      left = 0;
      endKind = 'time';
      endBonus = solved * 160 + perfects * 90;
      hintMsg = 'SHIFT ENDED';
      m.beep('gameover');
      m.timers.after(1000, () => m.finish('time'));
      dead = true;
    }
  }

  function drawDial(g) {
    const inWin = Math.abs(angleDelta(ang, target)) <= half;
    g.strokeStyle = PALETTE.line;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(CX, CY, R, 0, TAU);
    g.stroke();

    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 1;
    for (let i = 0; i < marks.length; i++) {
      const a = (i / marks.length) * TAU;
      const long = i % 4 === 0;
      const r0 = R - (long ? 11 : 6);
      g.beginPath();
      g.moveTo(CX + Math.cos(a) * r0, CY + Math.sin(a) * r0);
      g.lineTo(CX + Math.cos(a) * (R - 1), CY + Math.sin(a) * (R - 1));
      g.stroke();
    }

    g.lineCap = 'butt';
    g.strokeStyle = inWin ? PALETTE.gold : PALETTE.amberDim;
    g.lineWidth = 16;
    g.beginPath();
    g.arc(CX, CY, R - 8, target - half, target + half);
    g.stroke();
    g.strokeStyle = inWin ? '#FFF0B8' : PALETTE.gold;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(CX, CY, R - 16, target - half, target + half);
    g.stroke();
    g.beginPath();
    g.arc(CX, CY, R, target - half, target + half);
    g.stroke();

    const pulse = inWin ? 1 : 0.55 + 0.45 * Math.sin(m.time * 9);
    g.strokeStyle = PALETTE.phos;
    g.globalAlpha = 0.5 * pulse;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(CX, CY);
    g.lineTo(CX + Math.cos(ang) * (R - 22), CY + Math.sin(ang) * (R - 22));
    g.stroke();
    g.globalAlpha = 1;

    g.strokeStyle = inWin ? PALETTE.phos : PALETTE.ink;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(CX, CY);
    g.lineTo(CX + Math.cos(ang) * (R - 20), CY + Math.sin(ang) * (R - 20));
    g.stroke();

    g.fillStyle = PALETTE.bg2;
    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(CX, CY, 13, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = PALETTE.gold;
    g.fillRect(CX - 3, CY - 3, 6, 6);
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);

    g.strokeStyle = PALETTE.line;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(CX, CY, R + 12, 0, TAU);
    g.stroke();

    drawDial(g);

    g.font = '9px "JetBrains Mono", monospace';
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.ink3;
    g.fillText('LOCK', 10, 12);
    g.font = '13px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.gold;
    g.fillText(`${Math.min(LOCKS, lock)}/${LOCKS}`, 10, 26);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('STRIKES', 10, 44);
    g.font = '13px "JetBrains Mono", monospace';
    g.fillStyle = strikes > 0 ? PALETTE.alert : PALETTE.phos;
    g.fillText('■'.repeat(STRIKES_MAX - strikes) + '□'.repeat(strikes), 10, 58);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('PERFECT', 10, 76);
    g.font = '13px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.phos;
    g.fillText(`${perfects}   BEST ${best}`, 10, 90);

    g.textAlign = 'right';
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('WINDOW', m.w - 10, 12);
    g.font = '13px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.amber;
    g.fillText(`±${(half * 57.2958).toFixed(1)}°`, m.w - 10, 26);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('SPIN', m.w - 10, 44);
    g.font = '13px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${(spd * 57.2958).toFixed(0)}°/s`, m.w - 10, 58);
    g.font = '13px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.phos;
    g.fillText(`${Math.max(0, Math.ceil(left))}s`, m.w - 10, 82);
    g.textAlign = 'center';
    g.font = '11px "JetBrains Mono", monospace';
    g.fillStyle = flashT > 0 ? flashColor : PALETTE.ink2;
    g.fillText(lastGradeT > 0 ? lastGrade : hintMsg, CX, CY + R + 34);
    g.textAlign = 'left';
  }

  reset();
  return { update, draw };
}