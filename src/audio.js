// audio.js - every sound is synthesized with WebAudio (no sound files).
// ---------------------------------------------------------------- symbol / card effect sounds
// Each reel symbol lands with its own sound (fx.js RECIPES pick them by name).
const arp = (A, notes, step, o) => notes.forEach((f, i) => A.tone(f, o.dur || 0.16, { ...o, delay: (o.delay || 0) + i * step }));
const crackle = (A, n, span, o = {}) => { for (let i = 0; i < n; i++) A.noise(0.03, { vol: o.vol || 0.12, freq: 2200 + Math.random() * 3000, q: 2, delay: Math.random() * span }); };
const SFX = {
  whoosh: A => A.noise(0.22, { vol: 0.16, freq: 500, q: 0.8, slide: 4 }),
  slash: A => { A.noise(0.14, { vol: 0.28, freq: 2400, q: 0.9, slide: 0.4 }); A.tone(1900, 0.14, { vol: 0.05, type: 'triangle', slide: 1.2 }); },
  slash2: A => { SFX.slash(A); A.noise(0.14, { vol: 0.22, freq: 1800, q: 0.9, slide: 0.4, delay: 0.07 }); A.tone(160, 0.12, { vol: 0.1, slide: 0.5, delay: 0.07 }); },
  shing: A => { A.tone(2400, 0.4, { vol: 0.06, type: 'sine' }); A.tone(3210, 0.34, { vol: 0.04, type: 'sine', delay: 0.02 }); A.noise(0.1, { vol: 0.14, freq: 6000, q: 2 }); },
  fortune: A => { SFX.slash(A); arp(A, [1320, 1760, 2093], 0.05, { vol: 0.07, type: 'square', dur: 0.12, delay: 0.05 }); },
  stab: A => { A.noise(0.08, { vol: 0.26, freq: 2600, q: 1.5 }); A.tone(620, 0.07, { vol: 0.05, slide: 0.6 }); },
  thrust: A => { A.noise(0.16, { vol: 0.26, freq: 1400, q: 1, slide: 0.35 }); A.tone(300, 0.12, { vol: 0.08, slide: 0.5 }); },
  chop: A => { A.tone(150, 0.14, { vol: 0.18, slide: 0.45 }); A.noise(0.14, { vol: 0.36, freq: 900, q: 1.2 }); A.noise(0.06, { vol: 0.2, freq: 3500, q: 2, delay: 0.02 }); },
  throw: A => { A.noise(0.1, { vol: 0.12, freq: 3200, q: 3, slide: 0.5 }); },
  bonk: A => { A.tone(110, 0.22, { vol: 0.32, type: 'sine', slide: 0.5 }); A.noise(0.08, { vol: 0.34, freq: 420 }); A.tone(1560, 0.5, { vol: 0.05, type: 'triangle', delay: 0.02 }); },
  stun: A => { SFX.bonk(A); arp(A, [1760, 2093, 1760, 2093, 2349], 0.07, { vol: 0.04, type: 'sine', dur: 0.1, delay: 0.12 }); },
  twang: A => { A.tone(220, 0.25, { vol: 0.1, type: 'sawtooth', slide: 0.96 }); A.noise(0.06, { vol: 0.14, freq: 3000, q: 4 }); },
  thunk: A => { A.noise(0.07, { vol: 0.34, freq: 640 }); A.tone(180, 0.08, { vol: 0.1, slide: 0.6 }); },
  clank: A => { A.tone(700, 0.16, { vol: 0.06, slide: 0.8 }); A.tone(1130, 0.13, { vol: 0.05, delay: 0.03 }); A.noise(0.1, { vol: 0.24, freq: 2100, q: 2 }); },
  fireball: A => { A.noise(0.42, { vol: 0.2, freq: 380, q: 0.6, slide: 2.6, type: 'lowpass' }); crackle(A, 6, 0.35, { vol: 0.08 }); },
  burn: A => { A.noise(0.5, { vol: 0.28, freq: 900, q: 0.5, slide: 0.4 }); crackle(A, 10, 0.5); A.tone(90, 0.3, { vol: 0.12, type: 'sine', slide: 0.6 }); },
  scythe: A => { A.noise(0.3, { vol: 0.2, freq: 700, q: 2, slide: 0.35 }); A.tone(260, 0.35, { vol: 0.06, type: 'sawtooth', slide: 0.5 }); },
  reap: A => { SFX.scythe(A); A.tone(130, 0.8, { vol: 0.12, type: 'sawtooth', slide: 0.35, delay: 0.05 }); arp(A, [392, 311, 262], 0.1, { vol: 0.07, type: 'square', dur: 0.25 }); },
  holy: A => { SFX.slash(A); arp(A, [1047, 1319, 1568, 2093], 0.045, { vol: 0.06, type: 'triangle', dur: 0.22 }); A.noise(0.3, { vol: 0.06, freq: 7000, q: 1 }); },
  beam: A => { A.tone(880, 0.5, { vol: 0.07, type: 'sawtooth', slide: 2.2 }); A.noise(0.45, { vol: 0.12, freq: 5000, q: 1 }); arp(A, [1568, 2093, 2637], 0.06, { vol: 0.05, type: 'sine', dur: 0.3 }); },
  heavy: A => { A.noise(0.3, { vol: 0.3, freq: 320, q: 0.8, slide: 3 }); A.tone(92, 0.35, { vol: 0.2, type: 'sawtooth', slide: 0.45 }); },
  limit: A => { A.noise(0.7, { vol: 0.5, freq: 200, type: 'lowpass', slide: 3 }); A.tone(58, 0.7, { vol: 0.4, type: 'sine', slide: 0.5 }); arp(A, [523, 784, 1047, 1568], 0.06, { vol: 0.07, type: 'square', dur: 0.3 }); },
  slab: A => { A.tone(52, 0.6, { vol: 0.45, type: 'sine', slide: 0.6 }); A.noise(0.5, { vol: 0.5, freq: 240, type: 'lowpass' }); A.noise(0.22, { vol: 0.24, freq: 1500, q: 0.5 }); },
  picklock: A => { SFX.whoosh(A); arp(A, [1568, 2093, 2637, 3136], 0.04, { vol: 0.05, type: 'sine', dur: 0.2 }); },
  powder: A => { SFX.slash(A); A.noise(0.26, { vol: 0.55, freq: 1800, q: 0.4, slide: 0.2, delay: 0.05 }); A.tone(80, 0.18, { vol: 0.24, slide: 0.4, delay: 0.05 }); },
  cursehit: A => { A.tone(200, 0.32, { vol: 0.1, type: 'sawtooth', slide: 0.5 }); A.tone(151, 0.32, { vol: 0.07, slide: 0.6, delay: 0.05 }); A.noise(0.3, { vol: 0.12, freq: 500, q: 3 }); },
  fuse: A => { A.noise(0.36, { vol: 0.07, freq: 5200, q: 4 }); A.noise(0.36, { vol: 0.1, freq: 400, q: 0.8, slide: 2.5 }); },
  explode: A => { A.noise(0.9, { vol: 0.65, freq: 220, type: 'lowpass', slide: 0.45 }); A.tone(66, 0.7, { vol: 0.45, type: 'sine', slide: 0.4 }); A.noise(0.2, { vol: 0.24, freq: 3000 }); crackle(A, 8, 0.6, { vol: 0.08 }); },
  cackle: A => { [520, 440, 540, 400, 300].forEach((f, i) => A.tone(f, 0.08, { vol: 0.06, type: 'square', slide: 0.8, delay: i * 0.075 })); A.noise(0.4, { vol: 0.08, freq: 500, q: 4 }); },
  shieldup: A => { A.tone(400, 0.25, { vol: 0.13, type: 'triangle', slide: 1.5 }); A.tone(1200, 0.3, { vol: 0.05, type: 'sine', delay: 0.05 }); A.noise(0.12, { vol: 0.1, freq: 4000, q: 3 }); },
  shieldup2: A => { SFX.shieldup(A); arp(A, [784, 988], 0.06, { vol: 0.06, type: 'triangle', dur: 0.25, delay: 0.08 }); },
  bulwark: A => { SFX.shieldup(A); arp(A, [587, 740, 880, 1175], 0.07, { vol: 0.07, type: 'triangle', dur: 0.4, delay: 0.06 }); },
  spikes: A => { SFX.shieldup(A); for (let i = 0; i < 4; i++) A.noise(0.06, { vol: 0.16, freq: 3600, q: 3, delay: 0.12 + i * 0.05 }); },
  potion: A => { for (let i = 0; i < 5; i++) A.tone(300 + Math.random() * 300, 0.07, { vol: 0.06, type: 'sine', slide: 1.9, delay: i * 0.05 }); arp(A, [660, 880, 1100], 0.06, { vol: 0.07, type: 'triangle', dur: 0.18, delay: 0.2 }); },
  bigheal: A => { SFX.potion(A); arp(A, [880, 1109, 1319, 1760], 0.07, { vol: 0.07, type: 'triangle', dur: 0.3, delay: 0.3 }); },
  drain: A => { A.tone(180, 0.5, { vol: 0.11, type: 'sine', slide: 3.2 }); A.noise(0.4, { vol: 0.09, freq: 800, q: 5, slide: 2 }); },
  emberflask: A => { A.noise(0.55, { vol: 0.14, freq: 600, q: 0.8, slide: 2 }); arp(A, [523, 659, 784], 0.1, { vol: 0.07, type: 'triangle', dur: 0.5 }); },
  charm: A => arp(A, [880, 1109, 1319, 1109, 1760], 0.07, { vol: 0.06, type: 'sine', dur: 0.2 }),
  coin_silver: A => { A.tone(1568, 0.08, { vol: 0.1 }); A.tone(2093, 0.2, { vol: 0.09, delay: 0.07 }); },
  coins: A => { for (let i = 0; i < 4; i++) { A.tone(1320 + i * 90, 0.07, { vol: 0.08, delay: i * 0.06 }); A.tone(1760 + i * 110, 0.14, { vol: 0.07, delay: i * 0.06 + 0.05 }); } },
  coinrain: A => { for (let i = 0; i < 9; i++) A.tone(1200 + Math.random() * 1200, 0.1, { vol: 0.07, delay: i * 0.045 }); arp(A, [784, 988, 1175, 1568], 0.07, { vol: 0.07, type: 'square', dur: 0.2, delay: 0.1 }); },
  chestopen: A => { A.tone(160, 0.32, { vol: 0.06, type: 'sawtooth', slide: 1.7 }); A.noise(0.3, { vol: 0.1, freq: 700, q: 6, slide: 1.8 }); arp(A, [1047, 1319, 1568, 2093], 0.05, { vol: 0.06, type: 'triangle', dur: 0.2, delay: 0.25 }); },
  clover: A => { arp(A, [784, 988, 1175, 1568], 0.05, { vol: 0.05, type: 'sine', dur: 0.2 }); A.noise(0.3, { vol: 0.05, freq: 6000, q: 1 }); },
  lucky: A => { arp(A, [784, 988, 1175, 1568, 1976, 2349], 0.05, { vol: 0.06, type: 'square', dur: 0.2 }); A.noise(0.5, { vol: 0.06, freq: 7000, q: 1 }); },
  wild: A => { A.tone(400, 0.5, { vol: 0.07, type: 'triangle', slide: 4.5 }); arp(A, [1319, 1760, 2349, 2637], 0.06, { vol: 0.04, type: 'sine', dur: 0.2, delay: 0.2 }); },
  dice: A => { for (let i = 0; i < 6; i++) A.noise(0.03, { vol: 0.18, freq: 2600 + Math.random() * 1500, q: 3, delay: i * 0.055 + Math.random() * 0.02 }); A.noise(0.06, { vol: 0.2, freq: 700, delay: 0.42 }); A.noise(0.06, { vol: 0.16, freq: 800, delay: 0.52 }); },
  poison: A => { for (let i = 0; i < 4; i++) A.tone(220 + i * 40, 0.08, { vol: 0.06, type: 'sine', slide: 1.8, delay: i * 0.07 }); A.noise(0.3, { vol: 0.07, freq: 3000, q: 1 }); },
  miss: A => A.noise(0.16, { vol: 0.1, freq: 1200, q: 0.6, slide: 3 }),
  pixie: A => { arp(A, [1760, 2093, 2637, 3136, 3520], 0.05, { vol: 0.05, type: 'sine', dur: 0.25 }); arp(A, [660, 880, 1100], 0.08, { vol: 0.07, type: 'triangle', dur: 0.25, delay: 0.3 }); },
  rebirth: A => { A.noise(0.9, { vol: 0.3, freq: 300, q: 0.6, slide: 3 }); arp(A, [392, 523, 659, 784, 1047], 0.09, { vol: 0.08, type: 'square', dur: 0.4, delay: 0.2 }); crackle(A, 12, 0.9); },
  rare_pick: A => { arp(A, [523, 659, 784, 1047, 1319], 0.06, { vol: 0.07, type: 'triangle', dur: 0.22 }); A.noise(0.4, { vol: 0.06, freq: 7000, q: 1 }); },
  epic_pick: A => { arp(A, [392, 523, 659, 784, 1047, 1319, 1568], 0.06, { vol: 0.08, type: 'square', dur: 0.28 }); A.noise(0.6, { vol: 0.08, freq: 6000, q: 1 }); A.tone(98, 0.6, { vol: 0.15, type: 'sine' }); },
  legend_pick: A => { A.noise(0.9, { vol: 0.3, freq: 250, type: 'lowpass', slide: 3 }); A.tone(65, 0.9, { vol: 0.3, type: 'sine', slide: 0.7 }); arp(A, [523, 659, 784, 1047, 1319, 1568, 2093], 0.075, { vol: 0.09, type: 'square', dur: 0.4, delay: 0.1 }); arp(A, [1047, 1568, 2093, 2637], 0.1, { vol: 0.05, type: 'sine', dur: 0.6, delay: 0.7 }); },
  kill: A => { A.noise(0.5, { vol: 0.3, freq: 1200, q: 0.8, slide: 0.2 }); arp(A, [659, 523, 392], 0.08, { vol: 0.06, type: 'square', dur: 0.2 }); },
  // ---- the Mage's spells
  cast: A => { A.tone(660, 0.18, { vol: 0.06, type: 'sine', slide: 1.8 }); A.noise(0.16, { vol: 0.07, freq: 5000, q: 2, slide: 0.6 }); },
  zap: A => { A.tone(1760, 0.1, { vol: 0.07, type: 'square', slide: 0.4 }); A.noise(0.08, { vol: 0.12, freq: 4200, q: 3 }); },
  arcane: A => { A.tone(440, 0.3, { vol: 0.1, type: 'sawtooth', slide: 0.5 }); A.tone(880, 0.26, { vol: 0.06, type: 'sine', slide: 0.5, delay: 0.02 }); A.noise(0.2, { vol: 0.14, freq: 2400, q: 1.5 }); },
  firecast: A => { A.noise(0.3, { vol: 0.12, freq: 700, q: 0.8, slide: 2.4 }); crackle(A, 4, 0.2, { vol: 0.06 }); },
  firebolt: A => { A.noise(0.35, { vol: 0.26, freq: 500, q: 0.6, slide: 0.5 }); crackle(A, 8, 0.4, { vol: 0.08 }); A.tone(110, 0.2, { vol: 0.12, type: 'sine', slide: 0.6 }); },
  icecast: A => { arp(A, [2093, 2637, 3136], 0.035, { vol: 0.04, type: 'sine', dur: 0.2 }); A.noise(0.2, { vol: 0.06, freq: 7000, q: 2 }); },
  frost: A => { for (let i = 0; i < 5; i++) A.tone(2400 + Math.random() * 1800, 0.12, { vol: 0.05, type: 'triangle', delay: i * 0.03 }); A.noise(0.25, { vol: 0.16, freq: 5500, q: 1.5, slide: 0.5 }); },
  toxcast: A => { for (let i = 0; i < 3; i++) A.tone(200 + i * 60, 0.1, { vol: 0.05, type: 'sine', slide: 1.8, delay: i * 0.06 }); },
  toxic: A => { A.noise(0.6, { vol: 0.14, freq: 600, q: 0.6, slide: 0.6 }); for (let i = 0; i < 6; i++) A.tone(180 + Math.random() * 200, 0.08, { vol: 0.05, type: 'sine', slide: 2, delay: 0.1 + i * 0.07 }); },
  thunder: A => { A.noise(0.12, { vol: 0.5, freq: 3000, q: 0.5 }); A.noise(0.9, { vol: 0.4, freq: 180, type: 'lowpass', slide: 0.6, delay: 0.04 }); A.tone(60, 0.6, { vol: 0.25, type: 'sine', slide: 0.5, delay: 0.04 }); crackle(A, 10, 0.3, { vol: 0.1 }); },
  missiles: A => { for (let i = 0; i < 3; i++) { A.tone(1320 - i * 120, 0.12, { vol: 0.06, type: 'square', slide: 0.5, delay: i * 0.06 }); A.noise(0.08, { vol: 0.1, freq: 3000, q: 2, delay: i * 0.06 }); } },
  icelance: A => { A.noise(0.12, { vol: 0.3, freq: 6000, q: 1 }); A.tone(3136, 0.4, { vol: 0.05, type: 'sine', slide: 0.7 }); for (let i = 0; i < 8; i++) A.tone(2000 + Math.random() * 2500, 0.1, { vol: 0.04, type: 'triangle', delay: 0.04 + i * 0.03 }); A.tone(90, 0.25, { vol: 0.16, type: 'sine', slide: 0.6 }); },
  meteorcall: A => { A.noise(0.6, { vol: 0.18, freq: 300, q: 0.7, slide: 3.5 }); A.tone(180, 0.6, { vol: 0.07, type: 'sawtooth', slide: 0.4 }); },
  meteor: A => { A.noise(1.2, { vol: 0.75, freq: 160, type: 'lowpass', slide: 0.4 }); A.tone(44, 1.0, { vol: 0.55, type: 'sine', slide: 0.5 }); A.noise(0.3, { vol: 0.3, freq: 2400 }); crackle(A, 14, 0.9, { vol: 0.09 }); },
  voidcast: A => { A.tone(120, 0.4, { vol: 0.1, type: 'sawtooth', slide: 0.6 }); A.tone(127, 0.4, { vol: 0.08, type: 'sawtooth', slide: 0.6 }); },
  void: A => { A.noise(0.8, { vol: 0.25, freq: 2000, q: 1, slide: 0.1 }); A.tone(300, 0.8, { vol: 0.12, type: 'sine', slide: 0.15 }); A.tone(75, 0.9, { vol: 0.2, type: 'sine', slide: 0.6, delay: 0.2 }); },
  starcall: A => arp(A, [1568, 2093, 2637, 3136], 0.06, { vol: 0.05, type: 'sine', dur: 0.3 }),
  starfall: A => { for (let i = 0; i < 5; i++) { A.tone(2093 - i * 180, 0.25, { vol: 0.05, type: 'sine', slide: 0.5, delay: i * 0.07 }); A.noise(0.1, { vol: 0.14, freq: 1400, delay: 0.05 + i * 0.07 }); } A.tone(98, 0.5, { vol: 0.16, type: 'sine', delay: 0.3 }); },
  prism: A => { A.tone(1047, 0.6, { vol: 0.06, type: 'sine' }); A.tone(1319, 0.6, { vol: 0.05, type: 'sine', delay: 0.03 }); A.tone(1568, 0.6, { vol: 0.05, type: 'sine', delay: 0.06 }); A.noise(0.5, { vol: 0.1, freq: 6000, q: 1 }); A.tone(220, 0.5, { vol: 0.08, type: 'sawtooth', slide: 2 }); },
  echo: A => { arp(A, [880, 1319, 1760], 0.05, { vol: 0.05, type: 'sine', dur: 0.3 }); arp(A, [880, 1319, 1760], 0.05, { vol: 0.025, type: 'sine', dur: 0.3, delay: 0.18 }); },
  // ---- the Rogue's summoned forest reels: a rustle of leaves and a wooden chime
  summon: A => { A.noise(0.5, { vol: 0.16, freq: 3500, q: 0.8, slide: 0.5 }); arp(A, [523, 659, 784, 1047], 0.06, { vol: 0.07, type: 'triangle', dur: 0.3 }); A.tone(196, 0.3, { vol: 0.12, type: 'sine', slide: 1.5 }); },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.amb = null;
  }

  unlock() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  tone(freq, dur, { type = 'square', vol = 0.15, slide = 0, delay = 0, attack = 0.004 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.2, freq = 1200, q = 1, delay = 0, type = 'bandpass', slide = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'spin': this.noise(0.5, { vol: 0.12, freq: 900, q: 2, slide: 2.5 }); this.tone(160, 0.3, { vol: 0.08, slide: 2 }); break;
      case 'tick': this.tone(1400, 0.03, { vol: 0.04, type: 'triangle' }); break;
      case 'stop': this.noise(0.12, { vol: 0.35, freq: 260, q: 1.5 }); this.tone(110, 0.12, { vol: 0.15, type: 'triangle' }); break;
      case 'hit': this.noise(0.18, { vol: 0.4, freq: 1800, q: 0.8, slide: 0.3 }); this.tone(220, 0.12, { vol: 0.12, slide: 0.5 }); break;
      case 'crit': this.play('hit'); this.tone(880, 0.25, { vol: 0.1, type: 'sawtooth', slide: 0.5, delay: 0.03 }); break;
      case 'hurt': this.noise(0.25, { vol: 0.45, freq: 300, q: 0.7 }); this.tone(90, 0.3, { vol: 0.2, type: 'sawtooth', slide: 0.6 }); break;
      case 'block': this.tone(520, 0.12, { vol: 0.1, type: 'triangle' }); this.noise(0.1, { vol: 0.2, freq: 3000, q: 3 }); break;
      case 'coin': this.tone(1320, 0.08, { vol: 0.1, type: 'square' }); this.tone(1760, 0.18, { vol: 0.1, delay: 0.07 }); break;
      case 'heal': [660, 880, 1100].forEach((f, i) => this.tone(f, 0.18, { vol: 0.08, type: 'triangle', delay: i * 0.06 })); break;
      case 'curse': this.tone(180, 0.4, { vol: 0.12, type: 'sawtooth', slide: 0.5 }); break;
      case 'luck': [990, 1320, 1760].forEach((f, i) => this.tone(f, 0.14, { vol: 0.07, type: 'sine', delay: i * 0.05 })); break;
      case 'step': this.noise(0.08, { vol: 0.12, freq: 400, q: 1 }); break;
      case 'bump': this.noise(0.1, { vol: 0.18, freq: 180, q: 1 }); break;
      case 'chest': this.noise(0.4, { vol: 0.2, freq: 500, q: 4, slide: 2 }); this.tone(330, 0.35, { vol: 0.06, type: 'triangle', slide: 1.5 }); break;
      case 'chomp': this.noise(0.15, { vol: 0.5, freq: 700, q: 1 }); this.tone(70, 0.3, { vol: 0.25, type: 'square', slide: 0.5 }); break;
      case 'card': this.noise(0.18, { vol: 0.15, freq: 3000, q: 1, slide: 0.4 }); break;
      case 'pick': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, { vol: 0.08, type: 'triangle', delay: i * 0.07 })); break;
      case 'buy': this.play('coin'); this.play('pick'); break;
      case 'deny': this.tone(140, 0.2, { vol: 0.1, type: 'square' }); break;
      case 'descend': this.noise(1.2, { vol: 0.2, freq: 600, q: 1, slide: 0.2 }); this.tone(220, 1.0, { vol: 0.08, type: 'sine', slide: 0.4 }); break;
      case 'jackpot': [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.22, { vol: 0.08, type: 'square', delay: i * 0.07 }));
        this.tone(2637, 0.5, { vol: 0.05, type: 'sine', delay: 0.38 }); break;
      case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, { vol: 0.09, type: 'square', delay: i * 0.12 })); break;
      case 'die': this.tone(220, 1.2, { vol: 0.15, type: 'sawtooth', slide: 0.25 }); this.noise(0.8, { vol: 0.2, freq: 200, q: 0.5 }); break;
      case 'enemydie': this.noise(0.4, { vol: 0.3, freq: 900, q: 0.8, slide: 0.2 }); break;
      case 'click': this.tone(700, 0.05, { vol: 0.06, type: 'triangle' }); break;
      default: if (SFX[name]) SFX[name](this);
    }
  }

  ambience(biome) {
    if (!this.ctx) return;
    if (this.amb) { this.amb.forEach(n => { try { n.stop(); } catch (e) { /* already stopped */ } }); this.amb = null; }
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    // [gain, noise lowpass Hz, drone Hz, drone gain]: wind for the ruins and the ice, rumble for the forge
    const A = { dungeon: [0.07, 220, 55, 0.25], mines: [0.07, 220, 49, 0.25], crypt: [0.06, 160, 41, 0.3],
                frozen: [0.06, 1100, 98, 0.06], magma: [0.08, 140, 36, 0.35], ruins: [0.05, 700, 82, 0.08] }[biome] ||
              [0.07, 220, 55, 0.25];
    g.gain.linearRampToValueAtTime(A[0], t + 2);
    g.connect(this.master);
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = A[1];
    s.connect(f); f.connect(g);
    const o = this.ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = A[2];
    const og = this.ctx.createGain(); og.gain.value = A[3];
    o.connect(og); og.connect(g);
    s.start(); o.start();
    this.amb = [s, o];
  }
}
