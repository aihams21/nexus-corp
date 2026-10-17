import { PALETTE } from '../kernel/render.js';
import { clamp } from '../../core/math.js';

export const meta = {
  id: 'g17',
  no: 17,
  unlockAt: 0,
  accent: PALETTE.phos,
  name: { ar: 'مضارب البورصة', en: 'Stock Scalper' },
  tag: { ar: 'اشترِ · بع' , en: 'buy · sell' },
  desc: {
    ar: 'راقب شموع السعر اللحظية. اشترِ عند الانخفاض وبع عند الارتفاع قبل أن تنهار القيمة.',
    en: 'Watch the live candlestick tape. Buy the dips, sell the spikes, and cash out before the value collapses.',
  },
  hint: { ar: 'زر الفأرة الأيسر شراء · الأيمن بيع', en: 'Left mouse = buy · right mouse = sell' },
};

const PX = 62;
const PY = 44;
const PW = 388;
const PH = 232;
const BARS = 56;
const HOLD_MAX = 24;
const RUN_TIME = 75;

export function create(m) {
  const bars = [];
  let price = 100;
  let vel = 0;
  let left = RUN_TIME;
  let held = 0;
  let entry = 0;
  let cashed = 0;
  let trades = 0;
  let bestTrade = 0;
  let worstTrade = 0;
  let ended = false;
  let endReason = '';
  let endBonus = 0;
  let peak = 100;
  let valley = 100;
  let crashAt = -1;
  let flashT = 0;
  let flashGood = true;
  let lastMsg = '';
  let lastMsgT = 0;
  const pips = [];

  function step() {
    const drift = (price - 104) * 0.016;
    vel = vel * 0.9 + drift + m.rng.gauss(0, 2.6);
    if (crashAt > 0 && m.time - crashAt < 5) vel -= 2.6;
    vel = clamp(vel, -9, 9);
    price = clamp(price + vel, 12, 190);
    peak = Math.max(peak, price);
    valley = Math.min(valley, price);
    bars.push({ p: price, v: vel });
    if (bars.length > BARS) bars.shift();
    m.beep('tick', 0.06);
  }

  function gainPips() {
    if (held <= 0) return;
    const diff = price - entry;
    const pips = Math.round(diff * 10);
    m.addScore(pips);
    trades += 1;
    if (pips > bestTrade) bestTrade = pips;
    if (pips < worstTrade) worstTrade = pips;
    if (pips >= 0) {
      m.beep('cash', 0.7);
      m.flash(PALETTE.phos);
      flashT = 0.3;
      flashGood = true;
      lastMsg = pips >= 40 ? 'EXECUTED · STRONG BOOK' : 'EXECUTED · FILLED';
      cashed += pips;
    } else {
      m.beep('error', 0.7);
      m.flash(PALETTE.alert);
      flashT = 0.3;
      flashGood = false;
      lastMsg = pips <= -40 ? 'EXECUTED · BLEEDING' : 'EXECUTED · LOSS';
      cashed += pips;
    }
    lastMsgT = 1.3;
    held = 0;
  }

  function doBuy() {
    if (ended) return;
    if (held > 0) {
      m.beep('error', 0.4);
      lastMsg = 'POSITION ALREADY OPEN';
      lastMsgT = 1;
      return;
    }
    if (held < 0) {
      gainPips();
      if (held !== 0) return;
    }
    held = 1;
    entry = price;
    m.beep('buy', 0.7);
    lastMsg = `BOUGHT @ ${price.toFixed(1)}`;
    lastMsgT = 1;
  }

  function doSell() {
    if (ended) return;
    if (held > 0) {
      gainPips();
      return;
    }
    if (held < 0) {
      m.beep('error', 0.4);
      lastMsg = 'SHORT ALREADY OPEN';
      lastMsgT = 1;
      return;
    }
    held = -1;
    entry = price;
    m.beep('select', 0.6);
    lastMsg = `SHORTED @ ${price.toFixed(1)}`;
    lastMsgT = 1;
  }

  function finish(reason) {
    if (ended) return;
    if (held !== 0) gainPips();
    ended = true;
    endReason = reason;
    endBonus = Math.max(0, Math.floor(cashed * 1.5)) + trades * 25;
    m.addScore(endBonus);
    m.beep(reason === 'time' ? 'win' : 'gameover', 0.9);
    m.banner(reason === 'time' ? 'SESSION CLOSED' : 'PORTFOLIO LIQUIDATED', reason === 'time' ? 'good' : 'bad', 1600);
    m.timers.after(1000, () => m.finish(reason));
  }

  let stepIn = 0;

  function update(dt, time) {
    if (ended) {
      if (flashT > 0) flashT -= dt;
      if (lastMsgT > 0) lastMsgT -= dt;
      return;
    }

    stepIn += dt;
    const period = clamp(0.3 - time * 0.0016, 0.13, 0.3);
    while (stepIn >= period) {
      stepIn -= period;
      step();
    }

    if (m.input.clicked) doBuy();
    if (m.input.releasedClick) doSell();
    if (m.input.wasPressed('KeyB')) doBuy();
    if (m.input.wasPressed('KeyS')) doSell();
    if (m.input.wasPressed('KeyX')) gainPips();

    if (held > 0) {
      pips.push({ x: Math.round(clamp((price - 12) / 178, 0, 1) * 1000) / 1000, up: price >= entry });
    } else if (held < 0) {
      pips.push({ x: Math.round(clamp((price - 12) / 178, 0, 1) * 1000) / 1000, up: price <= entry });
    }
    if (pips.length > HOLD_MAX) pips.shift();

    const dd = price - peak;
    if (dd < -14 && crashAt < 0) {
      crashAt = time;
      m.banner('MARKET CRASH', 'bad', 1500);
      m.beep('alarm', 0.9);
      m.flash(PALETTE.alert);
    }
    if (held > 0 && dd < -9) {
      gainPips();
    }

    if (flashT > 0) flashT -= dt;
    if (lastMsgT > 0) lastMsgT -= dt;
    m.addScore(dt * 3);

    left -= dt;
    if (left <= 0) {
      left = 0;
      finish('time');
    }
  }

  function priceY(p) {
    return PY + PH - clamp((p - 12) / 178, 0, 1) * PH;
  }

  function drawChart(g) {
    g.fillStyle = PALETTE.bg1;
    g.fillRect(PX, PY, PW, PH);
    g.strokeStyle = PALETTE.line;
    g.globalAlpha = 0.7;
    g.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = PY + (PH / 4) * i;
      g.beginPath();
      g.moveTo(PX, y);
      g.lineTo(PX + PW, y);
      g.stroke();
    }
    for (let i = 0; i <= 6; i += 1) {
      const x = PX + (PW / 6) * i;
      g.beginPath();
      g.moveTo(x, PY);
      g.lineTo(x, PY + PH);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(PX, PY, PW, PH);

    if (bars.length < 2) return;
    const bw = Math.max(2, (PW / BARS) * 0.62);
    const stepX = PW / (BARS - 1);

    for (let i = 0; i < bars.length; i += 1) {
      const b = bars[i];
      const prev = i > 0 ? bars[i - 1].p : b.p;
      const x = PX + i * stepX;
      const up = b.p >= prev;
      const col = up ? PALETTE.phos : PALETTE.alert;
      g.strokeStyle = col;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, priceY(Math.max(prev, b.p)));
      g.lineTo(x, priceY(Math.min(prev, b.p)));
      g.stroke();
      const y0 = priceY(Math.max(prev, b.p));
      const y1 = priceY(Math.min(prev, b.p));
      g.fillStyle = col;
      g.globalAlpha = 0.85;
      g.fillRect(x - bw / 2, y0, bw, Math.max(1.5, y1 - y0));
      g.globalAlpha = 1;
    }

    g.strokeStyle = PALETTE.amber;
    g.lineWidth = 1.4;
    g.beginPath();
    for (let i = 0; i < bars.length; i += 1) {
      const x = PX + i * stepX;
      const y = priceY(bars[i].p);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();

    if (held !== 0) {
      const ey = priceY(entry);
      g.strokeStyle = held > 0 ? PALETTE.phosDim : PALETTE.violet;
      g.lineWidth = 1;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(PX, ey);
      g.lineTo(PX + PW, ey);
      g.stroke();
      g.setLineDash([]);
      g.font = '8px "JetBrains Mono", monospace';
      g.textBaseline = 'bottom';
      g.textAlign = 'left';
      g.fillStyle = held > 0 ? PALETTE.phos : PALETTE.violet;
      g.fillText(`ENTRY ${entry.toFixed(1)}`, PX + 4, ey - 2);
    }

    const ly = priceY(price);
    g.strokeStyle = PALETTE.cyan;
    g.lineWidth = 1;
    g.setLineDash([2, 3]);
    g.beginPath();
    g.moveTo(PX, ly);
    g.lineTo(PX + PW, ly);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = PALETTE.cyan;
    g.fillRect(PX + PW - 2, ly - 3, 6, 6);

    g.font = '9px "JetBrains Mono", monospace';
    g.textBaseline = 'middle';
    g.textAlign = 'right';
    g.fillStyle = PALETTE.ink3;
    for (let i = 0; i <= 4; i += 1) {
      const v = 12 + (178 / 4) * (4 - i);
      g.fillText(v.toFixed(0), PX - 5, PY + (PH / 4) * i);
    }
    g.textAlign = 'left';
  }

  function draw(g) {
    g.fillStyle = PALETTE.bg0;
    g.fillRect(0, 0, m.w, m.h);
    drawChart(g);

    const pos = held > 0 ? `LONG ${(price - entry) >= 0 ? '+' : ''}${(price - entry).toFixed(1)}`
      : held < 0 ? `SHORT ${(entry - price) >= 0 ? '+' : ''}${(entry - price).toFixed(1)}`
        : 'FLAT';

    g.fillStyle = PALETTE.panel;
    g.fillRect(PX, PY - 30, PW, 26);
    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(PX, PY - 30, PW, 26);
    g.font = '14px "JetBrains Mono", monospace';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillStyle = PALETTE.amber;
    g.fillText(price.toFixed(2), PX + 8, PY - 16);
    g.font = '10px "JetBrains Mono", monospace';
    g.fillStyle = held > 0 ? PALETTE.phos : held < 0 ? PALETTE.violet : PALETTE.ink3;
    g.textAlign = 'right';
    g.fillText(pos, PX + PW - 8, PY - 16);

    const chipY = PY + PH + 8;
    g.fillStyle = PALETTE.panel;
    g.fillRect(PX, chipY, PW, 26);
    g.strokeStyle = PALETTE.line2;
    g.lineWidth = 2;
    g.strokeRect(PX, chipY, PW, 26);
    g.font = '10px "JetBrains Mono", monospace';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillStyle = PALETTE.phos;
    g.fillText('LEFT CLICK / B — BUY', PX + PW * 0.22, chipY + 13);
    g.fillStyle = PALETTE.alert;
    g.fillText('RIGHT CLICK / S — SELL', PX + PW * 0.56, chipY + 13);
    g.fillStyle = PALETTE.ink3;
    g.fillText('X — CLOSE', PX + PW * 0.87, chipY + 13);

    if (flashT > 0) {
      g.globalAlpha = flashT * 1.4;
      g.fillStyle = flashGood ? PALETTE.phos : PALETTE.alert;
      g.fillRect(PX, PY, PW, PH);
      g.globalAlpha = 1;
    }

    g.textAlign = 'left';
    g.font = '9px "JetBrains Mono", monospace';
    g.textBaseline = 'top';
    g.fillStyle = PALETTE.ink3;
    g.fillText('TRADES', 10, 10);
    g.fillStyle = PALETTE.ink;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${trades}`, 10, 20);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('BEST', 62, 10);
    g.fillStyle = PALETTE.phos;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${bestTrade > 0 ? '+' : ''}${bestTrade}`, 62, 20);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.ink3;
    g.fillText('WORST', 120, 10);
    g.fillStyle = PALETTE.alert;
    g.font = '12px "JetBrains Mono", monospace';
    g.fillText(`${worstTrade}`, 120, 20);

    if (lastMsgT > 0) {
      g.textAlign = 'center';
      g.font = '11px "JetBrains Mono", monospace';
      g.fillStyle = PALETTE.ink;
      g.fillText(lastMsg, m.w / 2, PY + PH + 42);
    }

    g.textAlign = 'right';
    g.font = '11px "JetBrains Mono", monospace';
    g.fillStyle = PALETTE.cyan;
    g.fillText(`${Math.ceil(left)}s`, m.w - 10, 10);
    g.font = '9px "JetBrains Mono", monospace';
    g.fillStyle = crashAt >= 0 && m.time - crashAt < 5 ? PALETTE.alert : PALETTE.ink3;
    g.fillText(crashAt >= 0 && m.time - crashAt < 5 ? 'BEAR TAPE' : 'RANGE 12-190', m.w - 10, 24);
    g.textAlign = 'left';
  }

  bars.push({ p: 100, v: 0 });
  for (let i = 1; i < 12; i += 1) {
    price = clamp(price + m.rng.gauss(0, 2.2), 12, 190);
    bars.push({ p: price, v: 0 });
  }
  m.hint({ ar: 'زر الفأرة الأيسر شراء · الأيمن بيع', en: 'Left click buys · right click sells' });
  return { update, draw };
}
