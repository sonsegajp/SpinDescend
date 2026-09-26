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


// ---------------------------------------------------------------- music
// A small generative soundtrack, one song per area: a slow pad on the chord of the bar, a bass on the
// strong beats, a wandering lead on the area's scale in its own instrument, and the area's percussion.
// Intensity 'combat' adds a driving kick/snare and a busier bass; the merchant and the title have their own.
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
export const SONGS = {
  title:   { bpm: 66, root: 50, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], pad: 'triangle', cut: 1100, bass: 'triangle', lead: 'harp', oct: 1, density: 0.5, perc: 'none' },
  dungeon: { bpm: 70, root: 50, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 0, 5, 4, 0, 0, 3, 4], pad: 'triangle', cut: 900, bass: 'triangle', lead: 'square', oct: 1, density: 0.32, perc: 'drip' },
  mines:   { bpm: 84, root: 45, scale: [0, 3, 5, 7, 10], prog: [0, 0, 2, 3], pad: 'sawtooth', cut: 600, bass: 'triangle', lead: 'pluck', oct: 1, density: 0.42, perc: 'clink' },
  crypt:   { bpm: 56, root: 47, scale: [0, 1, 3, 5, 7, 8, 10], prog: [0, 1, 0, 5], pad: 'organ', cut: 1300, bass: 'sine', lead: 'choir', oct: 1, density: 0.24, perc: 'bell' },
  frozen:  { bpm: 62, root: 52, scale: [0, 2, 4, 6, 7, 9, 11], prog: [0, 1, 4, 3], pad: 'sine', cut: 2200, bass: 'sine', lead: 'bell', oct: 2, density: 0.3, perc: 'chime' },
  magma:   { bpm: 92, root: 40, scale: [0, 1, 4, 5, 7, 8, 10], prog: [0, 0, 1, 0, 5, 4, 1, 0], pad: 'sawtooth', cut: 480, bass: 'sawtooth', lead: 'square', oct: 1, density: 0.28, perc: 'tom' },
  ruins:   { bpm: 76, root: 55, scale: [0, 2, 4, 5, 7, 9, 10], prog: [0, 4, 5, 3], pad: 'triangle', cut: 1600, bass: 'triangle', lead: 'flute', oct: 1, density: 0.4, perc: 'wind' },
  grotto:  { bpm: 68, root: 48, scale: [0, 2, 3, 7, 8], prog: [0, 3, 0, 4], pad: 'sine', cut: 1400, bass: 'sine', lead: 'pluck', oct: 2, density: 0.36, perc: 'drip' },
  vault:   { bpm: 80, root: 53, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 0], pad: 'organ', cut: 1500, bass: 'triangle', lead: 'bell', oct: 1, density: 0.34, perc: 'tick' },
  shop:    { bpm: 104, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 0], pad: 'triangle', cut: 1800, bass: 'triangle', lead: 'pluck', oct: 1, density: 0.55, perc: 'shaker' },
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
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.2;
    this.musicBus.connect(this.master);
    if (this.pendingAmb) this.ambience(this.pendingAmb);                  // the area we were already in
    if (this.pendingSong) this.song(this.pendingSong);
  }

  // ---------------------------------------------------------------- music
  // song(name): crossfade to another area's song; intensity('explore' | 'combat')
  song(name) {
    this.pendingSong = name;
    if (!this.ctx || !SONGS[name]) return;
    if (this.cur && this.cur.name === name) return;
    this.cur = { name, ...SONGS[name], bar: 0, step: 0, next: this.ctx.currentTime + 0.1, note: 0 };
    if (!this.musicTimer) this.musicTimer = setInterval(() => this.tickMusic(), 80);
  }

  intensity(k) { this.heat = k; }

  tickMusic() {
    const S = this.cur;
    if (!S || !this.ctx) return;
    const eighth = 60 / S.bpm / 2;
    while (S.next < this.ctx.currentTime + 0.3) {
      this.musicStep(S, S.next, eighth);
      S.next += eighth;
      S.step = (S.step + 1) % 8;
      if (S.step === 0) S.bar++;
    }
  }

  // one voice at an absolute time: shaped oscillator(s) through a lowpass
  mvoice(type, f, t, dur, vol, o = {}) {
    const c = this.ctx;
    const g = c.createGain(), flt = c.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = o.cut || 2400; flt.Q.value = o.q || 0.7;
    const att = o.att ?? 0.01, rel = o.rel ?? dur * 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.setValueAtTime(vol, t + Math.max(att, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    flt.connect(g); g.connect(this.musicBus);
    const oscs = [];
    const add = (tp, fr, dt = 0, lvl = 1) => {
      const osc = c.createOscillator(), og = c.createGain();
      osc.type = tp; osc.frequency.setValueAtTime(fr, t); osc.detune.value = dt;
      og.gain.value = lvl;
      osc.connect(og); og.connect(flt);
      oscs.push(osc);
      return osc;
    };
    if (type === 'organ') { add('sine', f, 0, 0.7); add('sine', f * 2, 0, 0.35); add('sine', f * 3, 0, 0.18); add('triangle', f / 2, 0, 0.3); }
    else if (type === 'choir') { add('sawtooth', f, -8, 0.4); add('sawtooth', f, 9, 0.4); }
    else if (type === 'bell') { add('sine', f, 0, 0.8); add('sine', f * 2.76, 0, 0.25); add('sine', f * 5.4, 0, 0.08); }
    else if (type === 'flute') { add('sine', f, 0, 0.9); add('triangle', f * 2, 0, 0.12); }
    else if (type === 'harp' || type === 'pluck') { add('triangle', f, 0, 0.9); add('sine', f * 2, 0, 0.3); }
    else { add(type, f, -5, 0.6); add(type, f, 6, 0.6); }
    if (o.vib) {                                                   // gentle vibrato
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 5.2; lg.gain.value = f * 0.008;
      lfo.connect(lg);
      for (const osc of oscs) lg.connect(osc.frequency);
      lfo.start(t); lfo.stop(t + dur + 0.1);
    }
    for (const osc of oscs) { osc.start(t); osc.stop(t + dur + 0.1); }
  }

  mnoise(t, dur, vol, freq, q = 1, type = 'bandpass') {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.value = freq; flt.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.musicBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  mkick(t, vol = 0.5, f0 = 120) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 0.3);
  }

  musicStep(S, t, e) {
    const fight = this.heat === 'combat';
    const deg = S.prog[S.bar % S.prog.length];
    const sc = S.scale, n = sc.length;
    const tone = (d, oct = 0) => S.root + sc[((d % n) + n) % n] + 12 * (Math.floor(d / n) + oct);
    const bar = e * 8;
    if (S.step === 0) {                                          // pad: the bar's chord
      for (const k of [0, 2, 4]) this.mvoice(S.pad, midi(tone(deg + k)), t, bar * 0.98, 0.05, { cut: S.cut, att: bar * 0.3, rel: bar * 0.4 });
    }
    // bass on the strong beats (busier in a fight)
    if (S.step === 0 || S.step === 4 || (fight && (S.step === 6 || S.step === 3)))
      this.mvoice(S.bass, midi(tone(deg, -1)), t, e * (fight ? 1.4 : 3.2), fight ? 0.16 : 0.12, { cut: 700, att: 0.01 });
    // the wandering lead
    const strong = S.step % 2 === 0;
    if (Math.random() < S.density * (strong ? 1.25 : 0.6) * (fight ? 1.2 : 1)) {
      const chordTones = [deg, deg + 2, deg + 4];
      S.note = Math.random() < 0.45 ? chordTones[(Math.random() * 3) | 0] : S.note + ((Math.random() * 5) | 0) - 2;
      S.note = Math.max(deg - 3, Math.min(deg + 9, S.note));
      const len = e * (Math.random() < 0.3 ? 3 : Math.random() < 0.5 ? 2 : 1);
      const L = S.lead;
      const vol = L === 'square' ? 0.035 : L === 'bell' ? 0.07 : L === 'choir' ? 0.035 : 0.06;
      this.mvoice(L, midi(tone(S.note, S.oct)), t, L === 'bell' ? len + e * 2 : len,
        vol, { cut: L === 'square' ? 1500 : 3000, att: L === 'choir' || L === 'flute' ? 0.08 : 0.005, vib: L === 'flute' || L === 'choir', rel: len * 0.7 });
    }
    // percussion: the area's own texture, plus a beat when fighting
    if (fight) {
      if (S.step === 0 || S.step === 4) this.mkick(t, 0.45);
      if (S.step === 2 || S.step === 6) this.mnoise(t, 0.16, 0.14, 1800, 0.8);
      if (S.step % 2 === 1) this.mnoise(t, 0.04, 0.05, 7000, 1.5, 'highpass');
    }
    const r = Math.random();
    switch (S.perc) {
      case 'drip': if (r < 0.08) this.mvoice('sine', midi(84 + ((Math.random() * 6) | 0)), t, 0.12, 0.03, { att: 0.002 }); break;
      case 'clink': if (S.step === 0 && r < 0.5 || r < 0.06) this.mvoice('bell', midi(90 + ((Math.random() * 4) | 0)), t, 0.2, 0.025, { att: 0.001 }); break;
      case 'bell': if (S.step === 0 && S.bar % 2 === 0) this.mvoice('bell', midi(S.root + 12), t, 2.5, 0.05, { att: 0.002 }); break;
      case 'chime': if (r < 0.1) this.mvoice('bell', midi(tone(deg + ((Math.random() * 5) | 0), 3)), t, 1.2, 0.025, { att: 0.002 }); break;
      case 'tom': if (S.step === 0 || (S.step === 5 && r < 0.5)) this.mkick(t, 0.3, 90); break;
      case 'wind': if (S.step === 0 && S.bar % 4 === 0) this.mnoise(t, bar * 2, 0.03, 500, 0.6); break;
      case 'tick': if (S.step % 2 === 0) this.mnoise(t, 0.03, 0.04, 5000, 3); break;
      case 'shaker': if (S.step % 2 === 1) this.mnoise(t, 0.06, 0.05, 6000, 1.2, 'highpass'); if (S.step === 0) this.mkick(t, 0.25); break;
    }
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
    this.pendingAmb = biome;
    this.song(biome);
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
