/**
 * Procedural Web Audio synthesizer.
 *
 * Every sound is generated from oscillators and shaped gain envelopes at play
 * time. There are no audio files anywhere in the project.
 */

const VOICES = {
  tap:      { type: 'square',   f0: 620,  f1: 480,  dur: 0.05, gain: 0.16, decay: 0.9 },
  click:    { type: 'square',   f0: 880,  f1: 660,  dur: 0.05, gain: 0.14, decay: 0.9 },
  select:   { type: 'square',   f0: 420,  f1: 720,  dur: 0.07, gain: 0.13, decay: 0.8 },
  bounce:   { type: 'triangle', f0: 240,  f1: 420,  dur: 0.07, gain: 0.16, decay: 0.7 },
  jump:     { type: 'square',   f0: 300,  f1: 620,  dur: 0.09, gain: 0.14, decay: 0.7 },
  land:     { type: 'triangle', f0: 180,  f1: 110,  dur: 0.06, gain: 0.13, decay: 0.7 },
  shoot:    { type: 'sawtooth', f0: 900,  f1: 320,  dur: 0.06, gain: 0.11, decay: 0.8 },
  laser:    { type: 'sawtooth', f0: 1400, f1: 420,  dur: 0.08, gain: 0.10, decay: 0.8 },
  hit:      { type: 'square',   f0: 260,  f1: 140,  dur: 0.06, gain: 0.15, decay: 0.8 },
  break:    { type: 'square',   f0: 520,  f1: 180,  dur: 0.1,  gain: 0.16, decay: 0.6 },
  explode:  { type: 'sawtooth', f0: 320,  f1: 48,   dur: 0.32, gain: 0.24, decay: 0.45 },
  error:    { type: 'square',   f0: 220,  f1: 110,  dur: 0.16, gain: 0.15, decay: 0.7 },
  cash:     { type: 'triangle', f0: 760,  f1: 1180, dur: 0.1,  gain: 0.15, decay: 0.7 },
  coin:     { type: 'square',   f0: 980,  f1: 1480, dur: 0.07, gain: 0.13, decay: 0.7 },
  level:    { type: 'triangle', f0: 520,  f1: 1320, dur: 0.2,  gain: 0.17, decay: 0.55 },
  power:    { type: 'sawtooth', f0: 300,  f1: 1000, dur: 0.22, gain: 0.15, decay: 0.5 },
  perfect:  { type: 'triangle', f0: 880,  f1: 1760, dur: 0.26, gain: 0.19, decay: 0.45 },
  win:      { type: 'triangle', f0: 660,  f1: 1560, dur: 0.36, gain: 0.2,  decay: 0.4 },
  gameover: { type: 'sawtooth', f0: 420,  f1: 90,   dur: 0.5,  gain: 0.2,  decay: 0.35 },
  alarm:    { type: 'square',   f0: 880,  f1: 620,  dur: 0.14, gain: 0.14, decay: 0.6 },
  tick:     { type: 'square',   f0: 1200, f1: 1200, dur: 0.02, gain: 0.08, decay: 0.9 },
  buy:      { type: 'triangle', f0: 440,  f1: 880,  dur: 0.14, gain: 0.16, decay: 0.6 },
  ipo:      { type: 'triangle', f0: 320,  f1: 1400, dur: 0.44, gain: 0.22, decay: 0.35 },
};

/**
 * Create the synthesizer. The AudioContext is created lazily on the first
 * sound so browsers never warn about autoplay before a real user gesture.
 */
export function createSfx() {
  let actx = null;
  let master = null;
  let enabled = true;
  let noiseBuf = null;

  const ensure = () => {
    if (!actx) {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) return null;
      actx = new Ctor();
      master = actx.createGain();
      master.gain.value = 0.5;
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  };

  const noise = () => {
    if (!noiseBuf) {
      const len = Math.floor(actx.sampleRate * 0.4);
      noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = actx.createBufferSource();
    src.buffer = noiseBuf;
    return src;
  };

  /** Play a named voice. Safe to call before the context exists. */
  function play(name, gainScale = 1) {
    if (!enabled) return;
    const spec = VOICES[name];
    if (!spec) return;
    const ctx = ensure();
    if (!ctx) return;

    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.f1), t0 + spec.dur);

    const peak = Math.max(0.0001, spec.gain * gainScale);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);

    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + spec.dur + 0.02);
  }

  /** Short filtered noise burst — used for explosions and impacts. */
  function burst(dur = 0.22, gainScale = 1) {
    if (!enabled) return;
    const ctx = ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const src = noise();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(1800, t0);
    filt.frequency.exponentialRampToValueAtTime(120, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22 * gainScale, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** Arpeggio used on milestone and IPO moments. */
  function arp(notes = [523, 659, 784, 1047], step = 0.08) {
    if (!enabled) return;
    notes.forEach((f, i) => {
      setTimeout(() => play('coin', 0.8), i * step * 1000);
      void f;
    });
  }

  return {
    play,
    burst,
    arp,
    setEnabled(v) {
      enabled = !!v;
      if (master) master.gain.value = enabled ? 0.5 : 0;
    },
    enabled: () => enabled,
    /** Call from a user gesture to satisfy autoplay policies early. */
    unlock() {
      const ctx = ensure();
      return !!ctx;
    },
    names: () => Object.keys(VOICES),
  };
}

export const sfx = createSfx();
export default sfx;