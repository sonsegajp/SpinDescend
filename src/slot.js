// slot.js - the 3D slot machine HUD (concept: stone housing, three parchment
// reels, HP panel on the left, SPIN button + gold counter on the right).
//
// Reels are cylinders with 8 symbol slots around them; their texture is a
// canvas strip redrawn whenever the slots change. Rotation theta = k * PI/4
// shows slot k in the top row and slot k-1 in the bottom row.
import { gl, updateTex } from './gl.js';
import { perspective, lookAt, mul, trs, xform, easeOut, clamp } from './math.js';
import { SYMBOLS } from './data.js';

const SLOTS = 8, CELLPX = 96;
const STEP = Math.PI * 2 / SLOTS;
const FONT = 'Georgia, "Times New Roman", serif';

export class SlotMachine {
  constructor(renderer, assets) {
    this.r = renderer;
    this.assets = assets;
    this.model = assets.models.slot_machine;
    this.reels = [0, 1, 2].map(i => ({
      slots: new Array(SLOTS).fill('sword'), k: 0, theta: 0, from: 0, to: 0, t0: 0, dur: 0, spinning: false,
      canvas: Object.assign(document.createElement('canvas'), { width: CELLPX, height: CELLPX * SLOTS }),
      tex: gl.createTexture(), highlight: -1, dirty: true, bounce: 0,
    }));
    for (const [i, r] of this.reels.entries()) this.r.runtime.set('@reel' + i, r.tex);
    this.hp = this.panel('@hp', 128, 128);
    this.spinFace = this.panel('@spin', 192, 108);
    this.gold = this.panel('@gold', 176, 60);
    this.state = { hp: 25, maxHp: 25, gold: 0, spinEnabled: false, spinHover: false, spinLabel: 'SPIN' };
    this.press = 0;
    this.shake = 0;
    this.time = 0;
    this.drawnState = '';
    this.parchment = assets.textures.parchment;
  }

  panel(name, w, h) {
    const p = { canvas: Object.assign(document.createElement('canvas'), { width: w, height: h }), tex: gl.createTexture() };
    this.r.runtime.set(name, p.tex);
    return p;
  }

  // ---------------------------------------------------------------- layout / camera
  layout(W, H) {
    this.W = W; this.H = H;
    const aspect = W / H;
    const fov = 24 * Math.PI / 180, D = 10;
    const hh = D * Math.tan(fov / 2), hw = hh * aspect;
    const fw = Math.min(0.985, 1.32 / aspect);
    const s = fw * 2 * hw / 4.26;
    this.proj = perspective(fov, aspect, 0.5, 60);
    this.view = lookAt([0, 0, D], [0, 0, 0]);
    this.base = { s, y: -hh - 0.04 * s };
    this.topY = -hh + 1.47 * s;                                   // machine top (world, for layout of cards)
    this.screenTop = (1 - (this.topY / hh + 1) / 2) * H;          // machine top in screen pixels
    this.hudHalfH = hh;
  }

  matrix() {
    const { s, y } = this.base;
    const sh = this.shake > 0 ? (Math.sin(this.time * 70) * 0.03 * this.shake) : 0;
    return trs(sh, y, 0, 0, 0, 0, s);
  }

  project(x, y, z) {
    const vp = mul(this.proj, this.view);
    const p = xform(mul(vp, this.matrix()), x, y, z);
    return [(p[0] * 0.5 + 0.5) * this.W, (1 - (p[1] * 0.5 + 0.5)) * this.H];
  }

  spinRect() {
    const a = this.project(1.42, 0.9, 0.16), b = this.project(2.02, 0.54, 0.16);
    return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
  }

  hpAnchor() { return this.project(-1.72, 1.0, 0.16); }
  goldAnchor() { return this.project(1.72, 0.4, 0.16); }
  reelAnchor(i, row) { return this.project([-0.655, 0, 0.655][i], row === 0 ? 0.92 : 0.44, 0.2); }

  // ---------------------------------------------------------------- spinning
  // grid[row][reel]: final symbols; pool(): random filler symbol
  spin(grid, pool, now) {
    this.spinStart = now;
    this.reels.forEach((r, i) => {
      const old = r.k;
      let k;
      do { k = Math.floor(Math.random() * SLOTS); } while ([old - 1, old, old + 1].some(v => ((v % SLOTS) + SLOTS) % SLOTS === k));
      for (let s = 0; s < SLOTS; s++) {
        if (s === old || s === (old + SLOTS - 1) % SLOTS) continue;
        r.slots[s] = pool();
      }
      r.slots[k] = grid[0][i];
      r.slots[(k + SLOTS - 1) % SLOTS] = grid[1][i];
      const delta = ((k - old) % SLOTS + SLOTS) % SLOTS;
      r.from = r.theta;
      r.to = r.theta + Math.PI * 2 * (3 + i) + delta * STEP;
      r.k = k;
      r.t0 = now;
      r.dur = 1.15 + i * 0.42;
      r.spinning = true;
      r.stopped = false;
      r.highlight = -1;
      r.dirty = true;
    });
    this.press = 1;
  }

  get spinning() { return this.reels.some(r => r.spinning); }

  // show a fixed result instantly (start of a run)
  setStatic(grid) {
    this.reels.forEach((r, i) => {
      r.slots[r.k] = grid[0][i];
      r.slots[(r.k + SLOTS - 1) % SLOTS] = grid[1][i];
      r.dirty = true;
    });
  }

  highlight(row, reel) {
    this.reels.forEach((r, i) => {
      const h = (i === reel) ? (row === 0 ? r.k : (r.k + SLOTS - 1) % SLOTS) : -1;
      if (r.highlight !== h) { r.highlight = h; r.dirty = true; }
    });
  }

  update(dt, now, onReelStop) {
    this.time = now;
    // repaint the canvases a few times early on: an icon can still be decoding at first paint
    this.frames = (this.frames || 0) + 1;
    if (this.frames === 30 || this.frames === 90 || this.frames === 180) {
      this.reels.forEach(r => { r.dirty = true; });
      this.drawnState = '';
    }
    this.press = Math.max(0, this.press - dt * 4);
    this.shake = Math.max(0, this.shake - dt * 3);
    for (const [i, r] of this.reels.entries()) {
      if (r.spinning) {
        const t = clamp((now - r.t0) / r.dur, 0, 1);
        // fast constant spin, then ease out with a small overshoot settle
        const e = t < 0.55 ? t / 0.55 * 0.72 : 0.72 + 0.28 * easeOut((t - 0.55) / 0.45);
        r.theta = r.from + (r.to - r.from) * e;
        if (t >= 1) {
          r.spinning = false;
          r.theta = r.to;
          r.bounce = 1;
          onReelStop && onReelStop(i);
        }
      }
      r.bounce = Math.max(0, r.bounce - dt * 5);
      if (r.dirty) this.drawReel(r);
    }
    const key = JSON.stringify(this.state) + (this.press > 0.5);
    if (key !== this.drawnState) { this.drawnState = key; this.drawPanels(); }
  }

  // ---------------------------------------------------------------- canvases
  drawReel(r) {
    const c = r.canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    for (let k = 0; k < SLOTS; k++) {
      const y = (SLOTS - 1 - k) * CELLPX;                        // slot k -> canvas row (7 - k)
      if (this.parchment) c.drawImage(this.parchment, 0, (k * 17) % 32, 64, 64, 0, y, CELLPX, CELLPX);
      else { c.fillStyle = '#e0cfa8'; c.fillRect(0, y, CELLPX, CELLPX); }
      c.fillStyle = 'rgba(255,245,220,0.35)';
      c.fillRect(0, y, CELLPX, CELLPX);
      if (k === r.highlight) {
        c.fillStyle = 'rgba(255,214,90,0.55)';
        c.fillRect(0, y, CELLPX, CELLPX);
        c.strokeStyle = '#d8a030'; c.lineWidth = 6;
        c.strokeRect(3, y + 3, CELLPX - 6, CELLPX - 6);
      }
      c.fillStyle = 'rgba(60,40,20,0.55)';
      c.fillRect(0, y, CELLPX, 2);
      c.fillRect(0, y + CELLPX - 2, CELLPX, 2);
      const sym = SYMBOLS[r.slots[k]];
      const img = sym && this.assets.icons48[sym.icon];
      if (img) c.drawImage(img, (CELLPX - 72) / 2, y + (CELLPX - 72) / 2, 72, 72);
    }
    updateTex(r.tex, r.canvas, { nearest: true, mips: false, repeat: true });
    r.dirty = false;
  }

  drawPanels() {
    const s = this.state;
    // HP screen
    {
      const c = this.hp.canvas.getContext('2d');
      c.fillStyle = '#0d0b0f'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#151218'; c.fillRect(6, 6, 116, 116);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#f2ead8'; c.font = `bold 26px ${FONT}`;
      c.fillText('HP', 64, 30);
      c.font = `bold 32px ${FONT}`;
      c.fillText(`${Math.max(0, s.hp)}/${s.maxHp}`, 64, 66);
      c.fillStyle = '#2a1416'; c.fillRect(14, 92, 100, 16);
      c.fillStyle = '#c82a30'; c.fillRect(16, 94, Math.round(96 * clamp(s.hp / s.maxHp, 0, 1)), 12);
      c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(16, 94, Math.round(96 * clamp(s.hp / s.maxHp, 0, 1)), 3);
      updateTex(this.hp.tex, this.hp.canvas, { nearest: false, mips: true });
    }
    // SPIN button face
    {
      const c = this.spinFace.canvas.getContext('2d');
      const on = s.spinEnabled;
      c.fillStyle = on ? (s.spinHover ? '#c8303a' : '#b02630') : '#5a2a2c';
      c.fillRect(0, 0, 192, 108);
      c.fillStyle = on ? 'rgba(255,190,190,0.18)' : 'rgba(0,0,0,0.1)';
      c.fillRect(0, 0, 192, 20);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `bold ${s.spinLabel.length > 5 ? 36 : 52}px ${FONT}`;
      c.lineWidth = 7; c.strokeStyle = '#3a0c10';
      c.strokeText(s.spinLabel, 96, 58);
      c.fillStyle = on ? '#f6ece0' : '#a08880';
      c.fillText(s.spinLabel, 96, 58);
      updateTex(this.spinFace.tex, this.spinFace.canvas, { nearest: false, mips: true });
    }
    // gold counter
    {
      const c = this.gold.canvas.getContext('2d');
      c.fillStyle = '#0d0b0f'; c.fillRect(0, 0, 176, 60);
      const coin = this.assets.icons48.coin;
      c.imageSmoothingEnabled = false;
      if (coin) c.drawImage(coin, 12, 6, 48, 48);
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = '#f2ead8'; c.font = `bold 34px ${FONT}`;
      c.fillText(String(s.gold), 72, 32);
      updateTex(this.gold.tex, this.gold.canvas, { nearest: false, mips: true });
    }
  }

  // ---------------------------------------------------------------- draw
  draw(time) {
    const R = this.r;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    R.begin({
      proj: this.proj, view: this.view, cam: [0, 0, 10], ambient: [0.5, 0.5, 0.56],
      dir: { dir: [0.35, -0.55, -0.75], col: [0.62, 0.58, 0.5] }, fog: false, bands: 12, time,
      lights: [{ pos: [0, 3.5 * this.base.s + this.base.y, 3], col: [0.35, 0.28, 0.18], radius: 12 }],
    });
    const pose = { spin_button: { tz: -0.05 * this.press } };
    this.reels.forEach((r, i) => { pose['reel' + i] = { rx: r.theta - Math.sin(r.bounce * Math.PI) * 0.05 }; });
    R.drawModel(this.model, this.matrix(), { pose });
  }
}
