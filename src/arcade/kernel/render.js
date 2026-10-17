// Canvas plumbing and the small drawing vocabulary every Ops Deck game uses.
// The palette is the same phosphor/amber set as the CSS shell so the cabinet
// and the shell read as one machine.

export const PALETTE = {
  bg0: '#050604',
  bg1: '#0B0A07',
  bg2: '#14120C',
  panel: '#1C1913',
  line: '#3A3323',
  line2: '#4C4229',
  ink: '#EDE6D6',
  ink2: '#A79C82',
  ink3: '#6E6552',
  amber: '#FFB000',
  amberDim: '#C98600',
  phos: '#37F57C',
  phosDim: '#1F9C50',
  cyan: '#25D0FF',
  alert: '#FF3B47',
  gold: '#FFD24A',
  violet: '#9D7BFF',
};

export const FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/**
 * Size the backing store to the CSS box at a capped DPR while the drawing
 * surface stays at the fixed game plane. Returns the live transform scale.
 */
export function fitCanvas(canvas, planeW, planeH, maxDpr = 2) {
  const dpr = Math.min(Number(window.devicePixelRatio) || 1, maxDpr);
  const rect = canvas.getBoundingClientRect();
  const cssW = rect && rect.width ? rect.width : planeW;
  const cssH = rect && rect.height ? rect.height : planeH;
  const w = Math.max(1, Math.round(planeW * dpr));
  const h = Math.max(1, Math.round(planeH * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  return { dpr, cssW, cssH, sx: w / cssW, sy: h / cssH };
}

/** Map a client point into game space. */
export function toGamePoint(canvas, planeW, planeH, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0, y: 0 };
  return {
    x: ((clientX - rect.left) / rect.width) * planeW,
    y: ((clientY - rect.top) / rect.height) * planeH,
  };
}

export function box(g, x, y, w, h, fill) {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
}

export function stroke(g, x, y, w, h, color, lw = 1) {
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
}

export function roundBox(g, x, y, w, h, r, fill, border) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  g.beginPath();
  g.moveTo(x + rad, y);
  g.lineTo(x + w - rad, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rad);
  g.lineTo(x + w, y + h - rad);
  g.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  g.lineTo(x + rad, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rad);
  g.lineTo(x, y + rad);
  g.quadraticCurveTo(x, y, x + rad, y);
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 1;
    g.stroke();
  }
}

export function disc(g, x, y, r, fill) {
  g.beginPath();
  g.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
}

export function ring(g, x, y, r, color, lw = 1) {
  g.beginPath();
  g.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.stroke();
}

export function line(g, x0, y0, x1, y1, color, lw = 1) {
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

export function poly(g, pts, fill, border) {
  if (!pts.length) return;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 1;
    g.stroke();
  }
}

/** Uppercase monospace label. `size` is in game-space pixels. */
export function text(g, str, x, y, opts = {}) {
  const size = opts.size || 10;
  g.font = `${opts.weight || 700} ${size}px ${FONT}`;
  g.textAlign = opts.align || 'left';
  g.textBaseline = opts.baseline || 'alphabetic';
  if (opts.glow) {
    g.shadowColor = opts.glow;
    g.shadowBlur = size * 0.9;
  } else {
    g.shadowBlur = 0;
  }
  g.fillStyle = opts.color || PALETTE.ink;
  g.fillText(String(str), x, y);
  g.shadowBlur = 0;
}

/** Word-wrap a string to a pixel width and return the lines. */
export function wrapText(g, str, maxWidth, size = 10) {
  g.font = `700 ${size}px ${FONT}`;
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function centeredText(g, str, cx, y, opts = {}) {
  text(g, str, cx, y, { ...opts, align: 'center' });
}

/** The repeating hazard tape used on panel headers and the boss bar. */
export function hazardTape(g, x, y, w, h, phase = 0, a = PALETTE.amber, b = '#0B0A07') {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = b;
  g.fillRect(x, y, w, h);
  g.fillStyle = a;
  const step = 9;
  const off = ((phase % (step * 2)) + step * 2) % (step * 2);
  for (let i = -h; i < w + h; i += step * 2) {
    g.beginPath();
    g.moveTo(x + i + off, y + h);
    g.lineTo(x + i + off + h, y);
    g.lineTo(x + i + off + h + step, y);
    g.lineTo(x + i + off + step, y + h);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** Darken the whole frame — used for pause and for game-over curtains. */
export function scrim(g, w, h, alpha = 0.6, color = '#050604') {
  g.save();
  g.globalAlpha = Math.max(0, Math.min(1, alpha));
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  g.restore();
}

/** Small uppercase tag used by every game's HUD row. */
export function hudTag(g, label, x, y, value, color = PALETTE.phos, size = 9) {
  text(g, label, x, y, { size, color: PALETTE.ink3, weight: 700 });
  const w = String(label).length * size * 0.62 + 6;
  text(g, value, x + w, y, { size: size + 1, color, weight: 800, glow: color });
}

/** Restore the 2D context to the game's baseline style. */
export function reset(g) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.shadowBlur = 0;
  g.lineWidth = 1;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
}
