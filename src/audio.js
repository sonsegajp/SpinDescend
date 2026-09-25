// audio.js - every sound is synthesized with WebAudio (no sound files).
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
      case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, { vol: 0.09, type: 'square', delay: i * 0.12 })); break;
      case 'die': this.tone(220, 1.2, { vol: 0.15, type: 'sawtooth', slide: 0.25 }); this.noise(0.8, { vol: 0.2, freq: 200, q: 0.5 }); break;
      case 'enemydie': this.noise(0.4, { vol: 0.3, freq: 900, q: 0.8, slide: 0.2 }); break;
      case 'click': this.tone(700, 0.05, { vol: 0.06, type: 'triangle' }); break;
    }
  }

  ambience(biome) {
    if (!this.ctx) return;
    if (this.amb) { this.amb.forEach(n => { try { n.stop(); } catch (e) { /* already stopped */ } }); this.amb = null; }
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(biome === 'ruins' ? 0.05 : 0.07, t + 2);
    g.connect(this.master);
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = biome === 'ruins' ? 700 : 220;
    s.connect(f); f.connect(g);
    const o = this.ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = biome === 'mines' ? 49 : biome === 'ruins' ? 82 : 55;
    const og = this.ctx.createGain(); og.gain.value = biome === 'ruins' ? 0.08 : 0.25;
    o.connect(og); og.connect(g);
    s.start(); o.start();
    this.amb = [s, o];
  }
}
