// fx.js - the flashy side of the slot machine: a small 2D particle engine drawn on the
// HUD overlay (virtual 640x360 units) plus one recipe per reel symbol. A symbol's own
// icon flies from its reel cell to its target (the enemy, your HP, the gold counter)
// trailing its particles, then lands with its own burst and sound. All drawn in code.
const TAU = Math.PI * 2;
const R = (a, b) => a + Math.random() * (b - a);
const pick = a => (Array.isArray(a) ? a[(Math.random() * a.length) | 0] : a);
const MAX_PARTS = 900;

// soft round sprites (glows, smoke, projectile heads) are painted ONCE per colour and then
// just drawImage'd - building a radial gradient per particle per frame is what made it lag
const SPR = new Map();
function sprite(kind, col, core) {
  const key = kind + '|' + col + '|' + (core || '');
  let c = SPR.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  if (kind === 'smoke') { grd.addColorStop(0, col); grd.addColorStop(0.7, col); }
  else { grd.addColorStop(0, core || 'rgba(255,255,255,0.95)'); grd.addColorStop(kind === 'head' ? 0.4 : 0.22, col); }
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, 32, 32);
  SPR.set(key, c);
  return c;
}

// the PS1's 15-bit colour: 5 bits a channel under a 4x4 ordered dither, and alpha cut to a few hard steps
// (its sprites were cut-outs and screen-door blends, never smooth gradients)
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);
function ps1Dither(g, w, h) {
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = d[i + 3];
      if (!a) continue;
      const b = BAYER4[(y & 3) * 4 + (x & 3)];
      const aq = Math.round(a / 255 * 3 + b) / 3;                // four alpha steps
      if (aq <= 0) { d[i + 3] = 0; continue; }
      d[i + 3] = Math.min(255, aq * 255);
      for (let k = 0; k < 3; k++) d[i + k] = Math.min(255, Math.max(0, Math.round(d[i + k] / 255 * 31 + b) / 31 * 255));
    }
  }
  g.putImageData(img, 0, 0);
}

export class FX {
  constructor() {
    this.parts = [];
    this.shots = [];
    this.flashes = [];
    this.wparts = [];                                   // world-space particles (pipe smoke): projected each frame
  }

  clear() { this.parts = []; this.shots = []; this.flashes = []; this.wparts = []; }

  // a world-space particle: position/velocity in world units; size in world units (grows to size*grow);
  // lift = upward acceleration, drag slows it; drawn through the camera every frame so it stays in the scene
  wpart(x, y, z, o) {
    if (this.wparts.length > 300) return;
    this.wparts.push({ x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, lift: o.lift || 0, drag: o.drag || 0, t: 0,
                       life: o.life, size: o.size, size1: o.size * (o.grow ?? 1), shape: o.shape || 'smoke',
                       col: o.col, add: !!o.add, alpha: o.alpha ?? 1, w: o.w || 1, rot: 0, vr: 0 });
  }

  // ---------------------------------------------------------------- emitters
  // o: n, speed [a,b], life [a,b], size [a,b], grow (end size x), dir + spread (radians),
  //    g (gravity px/s^2), drag (1/s), shape, col (colour or list), add (additive), spin, jx/jy
  burst(x, y, o) {
    const n = o.n || 10;
    for (let i = 0; i < n && this.parts.length < MAX_PARTS; i++) {
      const a = o.dir !== undefined ? o.dir + R(-(o.spread ?? 0.6), o.spread ?? 0.6) : R(0, TAU);
      const sp = R(...(o.speed || [40, 140]));
      const life = R(...(o.life || [0.35, 0.7]));
      const size = R(...(o.size || [1.5, 3])) * 1.4;                    // chunky pixels read at 360p
      this.parts.push({
        x: x + R(-(o.jx || 0), o.jx || 0), y: y + R(-(o.jy || 0), o.jy || 0),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g || 0, drag: o.drag || 0, t: 0, life, size,
        size1: size * (o.grow ?? 1), shape: o.shape || 'px', col: pick(o.col || '#fff'), add: !!o.add,
        rot: R(0, TAU), vr: R(-8, 8) * (o.spin ?? 1), alpha: o.alpha ?? 1, len: o.len || 0.03, w: o.w || 1,
      });
    }
  }

  ring(x, y, r0, r1, dur, col, w = 2, add = true, squash = 1) {   // squash < 1: a flat shockwave along the ground
    this.parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: dur, size: r0, size1: r1, shape: 'ring', col, add,
                      rot: 0, vr: 0, alpha: 1, w, squash });
  }

  glow(x, y, r, dur, col, grow = 1.6) {
    this.parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: dur, size: r, size1: r * grow, shape: 'glow', col,
                      add: true, rot: 0, vr: 0, alpha: 1 });
  }

  bolt(x0, y0, x1, y1, dur, col, w = 2) {                // jagged lightning, re-rolled every frame
    this.parts.push({ x: x0, y: y0, x1, y1, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: dur, size: w, size1: w,
                      shape: 'bolt', col, add: true, rot: 0, vr: 0, alpha: 1 });
  }

  beam(x0, y0, x1, y1, dur, col, w = 4) {                // a straight ray that thins out as it fades
    this.parts.push({ x: x0, y: y0, x1, y1, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: dur, size: w, size1: w * 0.2,
                      shape: 'beam', col, add: true, rot: 0, vr: 0, alpha: 1 });
  }

  // an animated cut: a tapered crescent whose leading edge sweeps along an arc (through x, y at its middle, the
  // circle's centre r behind it) while its tail chases it down - glow, body and white-hot core layers.
  // o: rot, r, span (radians), w (thickness), dir (+1 / -1), life, delay, sweep (share of life the edge takes),
  //    col (glow), edge (body), core, alpha
  swipe(x, y, o) {
    this.parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 0, t: -(o.delay || 0), life: o.life || 0.34, size: 0, size1: 0,
                      shape: 'swipe', col: o.col || '#6aa8ff', edge: o.edge || '#d8ecff', core: o.core || '#ffffff', add: true,
                      rot: o.rot || 0, vr: 0, alpha: o.alpha ?? 1, r: o.r || 30, span: o.span || 2, w: o.w || 6, dir: o.dir || 1,
                      sweep: o.sweep || 0.32 });
  }

  // a straight thrust / flying streak: a pointed sliver that shoots from `back` behind x, y to `len` past it
  streak(x, y, o) {
    this.parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 0, t: -(o.delay || 0), life: o.life || 0.28, size: 0, size1: 0,
                      shape: 'streak', col: o.col || '#6aa8ff', edge: o.edge || '#d8ecff', core: o.core || '#ffffff', add: true,
                      rot: o.rot || 0, vr: 0, alpha: o.alpha ?? 1, len: o.len || 40, back: o.back || 20, w: o.w || 5,
                      sweep: o.sweep || 0.3 });
  }

  // a lens flare: long thin crossed spikes and a hot core that punch out and fade (the moment a blow connects)
  flare(x, y, size, col = '#ffffff', dur = 0.22, rot = 0, delay = 0) {
    this.parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 0, t: -delay, life: dur, size: size * 0.4, size1: size, shape: 'flare',
                      col, add: true, rot, vr: 0.8, alpha: 1 });
  }

  flash(col, dur = 0.22, a = 0.45) { this.flashes.push({ col, t: 0, dur, a }); }

  // a projectile: flies from -> to over dur (with an arc), drawing img / a head, emitting a trail
  shot(o) {
    this.shots.push({ t: 0, dur: 0.28, arc: 0, spin: 0, scale: 1, rate: 60, acc: 0, ...o, x: o.from[0], y: o.from[1] });
  }

  // ---------------------------------------------------------------- simulation
  update(dt) {
    for (const p of this.parts) {
      p.t += dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const s of this.shots) {
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      const e = s.ease ? s.ease(k) : k;
      s.x = s.from[0] + (s.to[0] - s.from[0]) * e;
      s.y = s.from[1] + (s.to[1] - s.from[1]) * e - Math.sin(Math.PI * e) * s.arc;
      if (s.trail) {
        s.acc += dt * s.rate;
        while (s.acc >= 1) { s.acc -= 1; this.burst(s.x, s.y, { ...s.trail, n: 1 }); }
      }
      if (k >= 1 && !s.done) { s.done = true; if (s.onHit) s.onHit(s.to[0], s.to[1]); }
    }
    this.shots = this.shots.filter(s => !s.done);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter(f => f.t < f.dur);
    for (const p of this.wparts) {
      p.t += dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
      p.vy += p.lift * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    this.wparts = this.wparts.filter(p => p.t < p.life);
  }

  // ---------------------------------------------------------------- drawing
  // project(x, y, z) -> [screenX, screenY, pixelsPerWorldUnit] (or null when behind the camera).
  // pixel > 0: the PS1 look - everything is drawn on low-res layers (one texel = `pixel` units), dithered down to
  // 15-bit colour and a few alpha steps, and blown back up with hard edges (a normal layer, then an additive one)
  draw(g, W, H, project, pixel = 0) {
    for (const f of this.flashes) {
      g.globalAlpha = f.a * (1 - f.t / f.dur);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = f.col; g.fillRect(0, 0, W, H);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    const any = this.parts.length || this.shots.length || this.wparts.length;
    if (!any) return;
    let norm = g, add = g, lw = 0, lh = 0;
    if (pixel) {
      lw = Math.ceil(W / pixel); lh = Math.ceil(H / pixel);
      if (!this.layers) this.layers = [0, 1].map(() => { const c = document.createElement('canvas'); return { c, g: c.getContext('2d', { willReadFrequently: true }) }; });
      for (const L of this.layers) {
        if (L.c.width !== lw || L.c.height !== lh) { L.c.width = lw; L.c.height = lh; }
        L.g.setTransform(1, 0, 0, 1, 0, 0);
        L.g.clearRect(0, 0, lw, lh);
        L.g.setTransform(1 / pixel, 0, 0, 1 / pixel, 0, 0);
      }
      [norm, add] = [this.layers[0].g, this.layers[1].g];
    }
    const layer = p => (p.add ? add : norm);
    if (project) {
      for (const p of this.wparts) {
        const s = project(p.x, p.y, p.z);
        if (!s) continue;
        this.drawPart(layer(p), { ...p, x: s[0], y: s[1], size: p.size * s[2], size1: p.size1 * s[2] });
      }
    }
    for (const p of this.parts) this.drawPart(layer(p), p);
    for (const s of this.shots) this.drawShot(norm, s);
    for (const c of pixel ? [norm, add] : [g]) { c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    if (!pixel) return;
    for (const L of this.layers) ps1Dither(L.g, lw, lh);
    g.save();
    g.imageSmoothingEnabled = false;
    g.drawImage(this.layers[0].c, 0, 0, lw * pixel, lh * pixel);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(this.layers[1].c, 0, 0, lw * pixel, lh * pixel);
    g.restore();
  }

  drawShot(g, s) {
    const k = Math.min(1, s.t / s.dur);
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return;
    if (s.head) {
      g.globalCompositeOperation = 'lighter';
      const r = s.head.r * (1 + 0.15 * Math.sin(s.t * 40));
      g.globalAlpha = 1;
      g.drawImage(sprite('head', s.head.col, s.head.core || '#fff'), s.x - r, s.y - r, r * 2, r * 2);
      g.globalCompositeOperation = 'source-over';
    }
    if (s.img) {
      const sz = 22 * s.scale * (s.grow ? 1 + s.grow * Math.sin(Math.PI * k) : 1);
      g.save();
      g.translate(s.x, s.y);
      let ang = s.spin * s.t;
      if (s.point) ang = Math.atan2(s.to[1] - s.from[1], s.to[0] - s.from[0]) + s.point;
      g.rotate(ang);
      g.globalAlpha = 1;
      g.drawImage(s.img, -sz / 2, -sz / 2, sz, sz);
      g.restore();
    }
  }

  drawPart(g, p) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.t < 0) return;          // t < 0: still waiting on its delay
    const k = p.t / p.life;
    const a = p.alpha * (k < 0.1 ? k / 0.1 : 1 - Math.max(0, (k - 0.35) / 0.65));
    const s = p.size + (p.size1 - p.size) * k;
    g.globalAlpha = Math.max(0, Math.min(1, a));
    g.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
    g.fillStyle = p.col; g.strokeStyle = p.col;
    switch (p.shape) {
      case 'px':
        g.fillRect(Math.round(p.x * 2) / 2 - s / 2, Math.round(p.y * 2) / 2 - s / 2, s, s); break;
      case 'spark': {
        g.lineWidth = p.w;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * p.len, p.y - p.vy * p.len); g.stroke(); break;
      }
      case 'glow':                                                       // white-hot core fading into its colour
        g.drawImage(sprite('glow', p.col), p.x - s, p.y - s, s * 2, s * 2); break;
      case 'ring': {                                                     // a soft wide band under a bright thin edge
        const w = p.w * (1 - k * 0.6), sq = p.squash || 1;
        g.globalAlpha *= 0.35; g.lineWidth = w * 3.5;
        g.beginPath(); g.ellipse(p.x, p.y, s, s * sq, 0, 0, TAU); g.stroke();
        g.globalAlpha /= 0.35; g.lineWidth = w; g.strokeStyle = '#ffffff';
        g.beginPath(); g.ellipse(p.x, p.y, s, s * sq, 0, 0, TAU); g.stroke(); break;
      }
      case 'star': {
        const l = s * 1.6;
        g.fillRect(p.x - l, p.y - 0.5, l * 2, 1); g.fillRect(p.x - 0.5, p.y - l, 1, l * 2);
        g.fillRect(p.x - s / 2, p.y - s / 2, s, s); break;
      }
      case 'plus':
        g.fillRect(p.x - s, p.y - s / 3, s * 2, s * 2 / 3); g.fillRect(p.x - s / 3, p.y - s, s * 2 / 3, s * 2); break;
      case 'heart': {
        const u = s / 3;
        g.fillRect(p.x - 2 * u, p.y - u, 2 * u, 2 * u); g.fillRect(p.x, p.y - u, 2 * u, 2 * u);
        g.fillRect(p.x - 1.5 * u, p.y, 3 * u, 2 * u); g.fillRect(p.x - 0.5 * u, p.y + 1.5 * u, u, u); break;
      }
      case 'coin': {
        const w = Math.max(0.6, Math.abs(Math.cos(p.rot)) * s);
        g.fillStyle = '#b8801c'; g.fillRect(p.x - w / 2, p.y - s / 2, w, s);
        g.fillStyle = p.col; g.fillRect(p.x - w / 2 + 0.5, p.y - s / 2 + 0.5, Math.max(0.5, w - 1), s - 1.5);
        g.fillStyle = '#fff6c0'; g.fillRect(p.x - w / 4, p.y - s / 3, Math.max(0.5, w / 4), 1); break;
      }
      case 'leaf': case 'shard': case 'petal': case 'feather': {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.beginPath();
        if (p.shape === 'shard') { g.moveTo(0, -s); g.lineTo(s * 0.6, s * 0.7); g.lineTo(-s * 0.5, s * 0.5); }
        else if (p.shape === 'feather') { g.ellipse(0, 0, s * 0.35, s * 1.3, 0, 0, TAU); }
        else if (p.shape === 'petal') { g.ellipse(0, 0, s * 0.5, s, 0, 0, TAU); }
        else { g.moveTo(0, -s); g.lineTo(s * 0.55, 0); g.lineTo(0, s); g.lineTo(-s * 0.55, 0); }
        g.closePath(); g.fill(); g.restore(); break;
      }
      case 'card': {                                                     // a card-shaped flash pulsing outwards
        const cw = 46 * s, ch = 66 * s;
        g.lineWidth = p.w;
        g.strokeRect(p.x - cw / 2, p.y - ch / 2, cw, ch);
        g.globalAlpha *= 0.22; g.fillRect(p.x - cw / 2, p.y - ch / 2, cw, ch); break;
      }
      case 'bubble':
        g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.stroke();
        g.fillRect(p.x - s / 2, p.y - s / 2, 1, 1); break;
      case 'smoke':                                                      // soft puff
        g.globalAlpha *= 0.6;
        g.drawImage(sprite('smoke', p.col), p.x - s, p.y - s, s * 2, s * 2); break;
      case 'die': {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillStyle = '#f4f0e8'; g.fillRect(-s, -s, s * 2, s * 2);
        g.fillStyle = '#2a1a1a';
        const u = s * 0.5, pips = 1 + ((p.col.length * 7 + Math.floor(p.rot)) % 6 + 6) % 6;
        const spots = { 1: [[0, 0]], 2: [[-u, -u], [u, u]], 3: [[-u, -u], [0, 0], [u, u]], 4: [[-u, -u], [u, -u], [-u, u], [u, u]],
                        5: [[-u, -u], [u, -u], [0, 0], [-u, u], [u, u]], 6: [[-u, -u], [u, -u], [-u, 0], [u, 0], [-u, u], [u, u]] }[pips];
        for (const [dx, dy] of spots) g.fillRect(dx - 0.6, dy - 0.6, 1.2, 1.2);
        g.restore(); break;
      }
      case 'flare': {
        const fa = Math.max(0, 1 - k) ** 1.5;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        for (const [len, wd, al, c] of [[s, s * 0.09, 0.9, p.col], [s * 0.55, s * 0.16, 0.5, p.col], [s * 0.35, s * 0.05, 1, '#ffffff']]) {
          g.globalAlpha = al * fa; g.fillStyle = c;
          for (const r of [0, Math.PI / 2]) {
            g.rotate(r);
            g.beginPath(); g.moveTo(-len, 0); g.lineTo(0, -wd); g.lineTo(len, 0); g.lineTo(0, wd); g.closePath(); g.fill();
            g.rotate(-r);
          }
        }
        g.globalAlpha = fa;
        g.drawImage(sprite('glow', p.col), -s * 0.25, -s * 0.25, s * 0.5, s * 0.5);
        g.restore(); break;
      }
      case 'swipe': {
        const h = 1 - (1 - Math.min(1, k / p.sweep)) ** 2;                   // the edge races out...
        const tail = Math.max(0, (k - p.sweep * 0.6) / (1 - p.sweep * 0.6)) ** 2;   // ...the tail chases it down
        if (h - tail < 0.005) break;
        const fade = p.alpha * (1 - Math.max(0, (k - 0.55) / 0.45)), thin = 1 - 0.45 * k, N = 20;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        for (const [wm, col, al, off] of [[3.6, p.col, 0.2, 0.5], [2.1, p.col, 0.5, 0.5], [1, p.edge, 1, 0.35], [0.4, p.core, 1, 0.9]]) {
          g.globalAlpha = Math.max(0, al * fade); g.fillStyle = col;
          g.beginPath();
          const inner = [];
          for (let i = 0; i <= N; i++) {
            const f = i / N, u = tail + (h - tail) * f;
            const th = p.dir * (-p.span / 2 + p.span * u);
            const wd = p.w * wm * thin * Math.sin(Math.PI * f ** 1.4) ** 0.7;   // thickest just behind the edge
            const ro = p.r + wd * off, ri = p.r - wd * (1 - off), c = Math.cos(th), sn = Math.sin(th);
            if (i === 0) g.moveTo(-p.r + ro * c, ro * sn); else g.lineTo(-p.r + ro * c, ro * sn);
            inner.push(-p.r + ri * c, ri * sn);
          }
          for (let i = inner.length - 2; i >= 0; i -= 2) g.lineTo(inner[i], inner[i + 1]);
          g.closePath(); g.fill();
        }
        g.restore(); break;
      }
      case 'streak': {
        const h = 1 - (1 - Math.min(1, k / p.sweep)) ** 2;
        const tail = Math.max(0, (k - p.sweep * 0.5) / (1 - p.sweep * 0.5)) ** 2;
        const Lt = p.len + p.back, x0 = -p.back + Lt * tail, x1 = -p.back + Lt * h;
        if (x1 - x0 < 0.5) break;
        const fade = p.alpha * (1 - Math.max(0, (k - 0.55) / 0.45)), thin = 1 - 0.4 * k;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        for (const [wm, col, al] of [[3.8, p.col, 0.2], [2.3, p.col, 0.5], [1, p.edge, 1], [0.4, p.core, 1]]) {
          const hw = p.w * wm * thin / 2, xm = x0 + (x1 - x0) * 0.72;
          g.globalAlpha = Math.max(0, al * fade); g.fillStyle = col;
          g.beginPath(); g.moveTo(x0, 0); g.lineTo(xm, -hw); g.lineTo(x1, 0); g.lineTo(xm, hw); g.closePath(); g.fill();
        }
        g.restore(); break;
      }
      case 'beam': {
        g.lineCap = 'round';
        g.lineWidth = s * 2.2; g.globalAlpha *= 0.35;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x1, p.y1); g.stroke();
        g.globalAlpha /= 0.35; g.lineWidth = s;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x1, p.y1); g.stroke();
        g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(0.5, s * 0.35);
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x1, p.y1); g.stroke(); break;
      }
      case 'bolt': {
        g.lineWidth = p.size; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(p.x, p.y);
        const steps = 7;
        for (let i = 1; i < steps; i++) {
          const f = i / steps;
          g.lineTo(p.x + (p.x1 - p.x) * f + R(-6, 6), p.y + (p.y1 - p.y) * f + R(-6, 6));
        }
        g.lineTo(p.x1, p.y1); g.stroke(); break;
      }
      default:
        g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
  }
}

// ==================================================================== recipes
// Palettes
const C = {
  steel: ['#ffffff', '#dfe6f0', '#b8c4d4'], gold: ['#fff2a0', '#ffd24a', '#e8a020'], fire: ['#fff0a0', '#ffb030', '#ff6a1a', '#d82a10'],
  holy: ['#ffffff', '#c8f0ff', '#8ad8ff', '#fff6c0'], poison: ['#b8ff7a', '#6ae04a', '#3a9a2a'], blood: ['#ff6a6a', '#e02a3a', '#8a1020'],
  dark: ['#c8a0ff', '#8a5ad8', '#4a2a8a', '#1a0a2a'], ice: ['#ffffff', '#c8f4ff', '#7ad8ff'], green: ['#d8ffb0', '#8ae05a', '#3aa03a'],
  blue: ['#ffffff', '#b8d8ff', '#5a8aff'], wood: ['#d8a060', '#a06a30', '#6a4020'], smoke: ['#6a6470', '#4a4450', '#8a8490'],
  pink: ['#fff0f8', '#ffb0d8', '#ff6aa8'], rainbow: ['#ff5a5a', '#ffb03a', '#ffe84a', '#6aff6a', '#5ac8ff', '#b07aff'],
  orange: ['#fff0c0', '#ffb04a', '#ff7a1a'], silver: ['#ffffff', '#e8eef8', '#a8b4c8'],
};

// generic pieces used by the recipes
function sparks(fx, x, y, col, n = 14, sp = [80, 220], dir, spread) {
  fx.burst(x, y, { n, speed: sp, life: [0.18, 0.4], shape: 'spark', col, add: true, drag: 3, len: 0.035, dir, spread });
}
function embers(fx, x, y, col, n = 16, rise = 1) {
  fx.burst(x, y, { n, speed: [10, 50], life: [0.6, 1.2], size: [1, 2.5], col, add: true, g: -60 * rise, drag: 1.5, jx: 14, jy: 10 });
}
function puff(fx, x, y, col, n = 8, sz = [4, 8]) {
  fx.burst(x, y, { n, speed: [10, 50], life: [0.5, 1.0], size: sz, grow: 2.2, shape: 'smoke', col, g: -20, drag: 2, alpha: 0.55 });
}
function stars(fx, x, y, col, n = 8, r = 18) {
  fx.burst(x, y, { n, speed: [20, 90], life: [0.4, 0.8], size: [1.5, 3], shape: 'star', col, add: true, drag: 2.5, jx: r * 0.3, jy: r * 0.3 });
}

// A recipe: target ('enemy' | 'hp' | 'gold' | 'reel'), travel secs, launch(fx, from, to, S) -> sets up the shot,
// impact(fx, x, y, S, info) at arrival. S = { play(name), icon, flash(), shake(n) }.
const blade = (o) => ({
  target: 'enemy', travel: o.travel || 0.26,
  launch(fx, a, b, S) {
    S.play(o.launchSfx || 'whoosh');
    fx.shot({ from: a, to: b, dur: this.travel, arc: o.arc ?? 30, img: S.icon, spin: o.spin ?? 16, point: o.point, scale: o.scale || 1.1,
              trail: o.trail || { shape: 'spark', col: o.col || C.steel, speed: [5, 20], life: [0.15, 0.3], add: true, len: 0.05 },
              rate: o.rate || 70, head: o.head, ease: o.ease });
  },
  impact(fx, x, y, S, I) { o.hit(fx, x, y, S, I); },
});

// ---- melee strokes
const later = (s, fn) => setTimeout(fn, s * 1000);
const STEEL = { col: '#4a8aff', edge: '#d0e4ff', core: '#ffffff' };
const GOLD = { col: '#e88a10', edge: '#ffd870', core: '#fffbe8' };
const FIRE = { col: '#e83a0a', edge: '#ffa030', core: '#fff0b0' };
const HOLY = { col: '#3a9aff', edge: '#c8f0ff', core: '#ffffff' };
const DARK = { col: '#5a1a9a', edge: '#b890ff', core: '#f4e8ff' };
const POISON = { col: '#2a8a2a', edge: '#a8ff6a', core: '#f0ffe0' };
const BLOOD = { col: '#8a0a14', edge: '#ff6a5a', core: '#ffe8e0' };

let SZ = 1;                     // stroke scale for the blow being drawn: set from the foe's size on screen

// the frame of a cut through (x, y) travelling toward `ang`: bend flips which way the crescent bows; the arc is
// slid out so the crescent's centre of mass (not its outermost point) sits on the foe
function arcFrame(x, y, ang, r, span, bend) {
  const rot = bend > 0 ? ang - Math.PI / 2 : ang + Math.PI / 2, dir = bend > 0 ? 1 : -1;
  const out = r * (1 - Math.sin(span / 2) / (span / 2));
  return { rot, dir, x: x + Math.cos(rot) * out, y: y + Math.sin(rot) * out };
}
function cut(fx, x, y, ang, o) {
  const r = o.r * SZ, w = o.w * SZ, bend = o.bend ?? 1, F = arcFrame(x, y, ang, r, o.span, bend);
  fx.swipe(F.x, F.y, { ...o, r, w, rot: F.rot, dir: F.dir });
  const t = (o.delay || 0) + (o.life || 0.34) * (o.sweep || 0.32) * 0.7;                // sparks stream off its path
  const z = SZ;                                                                       // (SZ may belong to another blow by then)
  later(t, () => alongArc(x, y, ang, o.r, o.span, 7, (px, py, u) => fx.burst(px, py, {
    n: 2, speed: [60, 180] , life: [0.15, 0.32], shape: 'spark', col: [o.edge || '#fff', o.core || '#fff'], add: true, drag: 3, len: 0.045,
    dir: ang + R(-0.5, 0.5), spread: 0.4 }), bend, z));
}
// n points spaced along that cut's arc (embers off a flaming blade, powder going off down its fuller)
function alongArc(x, y, ang, r0, span, n, fn, bend = 1, z = SZ) {
  const r = r0 * z, F = arcFrame(x, y, ang, r, span, bend), c = Math.cos(F.rot), s = Math.sin(F.rot);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n, th = F.dir * (-span / 2 + span * u);
    const lx = -r + r * Math.cos(th), ly = r * Math.sin(th);
    fn(F.x + lx * c - ly * s, F.y + lx * s + ly * c, u);
  }
}
// a thrust / flying streak sized to the foe
function thrust(fx, x, y, o) {
  fx.streak(x, y, { ...o, len: o.len * SZ, back: o.back * SZ, w: o.w * SZ });
}
// the symbol flashes on its reel as the blow is struck
function glint(fx, x, y, col) {
  fx.glow(x, y, 16, 0.22, col, 1.5);
  fx.burst(x, y, { n: 1, speed: [0, 1], life: [0.25, 0.3], size: [4, 4], shape: 'star', col: '#ffffff', add: true });
}
const melee = (o) => ({
  target: 'enemy', travel: o.travel ?? 0.16,
  launch(fx, a, b, S) { S.play(o.launchSfx || 'whoosh'); glint(fx, a[0], a[1], o.glint || '#e8f4ff'); },
  impact(fx, x, y, S, I) {
    SZ = 1.5 * (I.size || 1);
    fx.flare(x, y, 46 * SZ, o.glint || '#e8f4ff', 0.2, R(0, 0.8), o.flareAt || 0.03);
    fx.glow(x, y, 15 * SZ, 0.2, o.glint || '#e8f4ff', 1.5);
    o.hit(fx, x, y, S, I);
  },
});

export const RECIPES = {
  // ---- melee: nothing is thrown - the symbol flashes on its reel and the blow lands on the foe as its own
  // animated cut (see swipe / streak above): every weapon has a stroke of its own
  sword: melee({
    hit(fx, x, y, S, I) {
      cut(fx, x, y, 0.3 * Math.PI, { r: 34, span: 1.9, w: 7, ...STEEL });
      sparks(fx, x, y, C.steel, 12, [80, 200], 0.3 * Math.PI, 0.5);
      S.play('slash');
    },
  }),
  sword2: melee({                                        // a fast X: down-right, then back down-left
    hit(fx, x, y, S, I) {
      cut(fx, x, y, 0.28 * Math.PI, { r: 32, span: 1.8, w: 6, ...STEEL, life: 0.3 });
      cut(fx, x, y, 0.72 * Math.PI, { r: 32, span: 1.8, w: 6, ...STEEL, life: 0.3, delay: 0.09, bend: -1 });
      sparks(fx, x, y, C.steel, 10, [80, 200], 0.28 * Math.PI, 0.5);
      later(0.09, () => { sparks(fx, x, y, C.steel, 10, [80, 200], 0.72 * Math.PI, 0.5); S.play('slash2'); });
      S.play('slash');
    },
  }),
  sword3: melee({                                        // a wide golden crescent with its afterimage
    glint: '#ffe08a',
    hit(fx, x, y, S, I) {
      cut(fx, x, y, 0.25 * Math.PI, { r: 42, span: 2.3, w: 10, ...GOLD });
      cut(fx, x - 5, y + 4, 0.25 * Math.PI, { r: 42, span: 2.3, w: 6, ...GOLD, delay: 0.05, alpha: 0.45 });
      alongArc(x, y, 0.25 * Math.PI, 42, 2.3, 5, (px, py) => stars(fx, px, py, C.gold, 2, 6));
      sparks(fx, x, y, C.gold, 16, [80, 220], 0.25 * Math.PI, 0.6);
      S.play('shing');
    },
  }),
  sword4: melee({                                        // the Blade of Fortune writes a golden Z
    glint: '#ffe08a',
    hit(fx, x, y, S, I) {
      cut(fx, x, y - 14 * SZ, 0, { r: 70, span: 0.8, w: 7, ...GOLD, life: 0.3 });
      cut(fx, x, y, 0.78 * Math.PI, { r: 60, span: 0.8, w: 8, ...GOLD, life: 0.3, delay: 0.07 });
      cut(fx, x, y + 14 * SZ, 0, { r: 70, span: 0.8, w: 7, ...GOLD, life: 0.3, delay: 0.14 });
      later(0.16, () => fx.burst(x, y, { n: 14, speed: [60, 160], life: [0.6, 1.0], size: [3, 5], shape: 'coin', col: C.gold, g: 320, spin: 2 }));
      S.play('fortune');
    },
  }),
  dagger: melee({                                        // three quick poisoned nicks
    travel: 0.12, glint: '#b8ff7a',
    hit(fx, x, y, S, I) {
      for (let i = 0; i < 3; i++) {
        const a = R(0, TAU);
        cut(fx, x + R(-10, 10), y + R(-10, 10), a, { r: 16, span: 1.6, w: 4, ...POISON, life: 0.22, delay: i * 0.06, bend: i % 2 ? -1 : 1 });
        later(i * 0.06, () => { sparks(fx, x, y, C.steel, 5, [60, 140], a, 0.6); S.play('stab'); });
      }
      fx.burst(x, y, { n: 12, speed: [10, 40], life: [0.6, 1.1], size: [1.5, 3], shape: 'bubble', col: C.poison, g: -50, jx: 12 });
    },
  }),
  spear: melee({                                         // a thrust: the point drives straight through
    travel: 0.14,
    hit(fx, x, y, S, I) {
      thrust(fx, x, y, { rot: -0.12, len: 60, back: 46, w: 9, ...STEEL, life: 0.3 });
      thrust(fx, x, y + 6, { rot: -0.12, len: 44, back: 30, w: 4, ...STEEL, life: 0.26, delay: 0.05, alpha: 0.6 });
      fx.ring(x + 34 * SZ, y - 4, 3, 22 * SZ, 0.25, '#e8eef8', 2, true, 0.5);
      sparks(fx, x + 20, y - 2, C.silver, 16, [140, 280], -0.12, 0.45);
      S.play('thrust');
    },
  }),
  axe: melee({                                           // an overhead chop, straight down, that bites
    travel: 0.2, glint: '#ffd0b0',
    hit(fx, x, y, S, I) {
      cut(fx, x, y, Math.PI / 2, { r: 48, span: 1.5, w: 13, col: '#c8501a', edge: '#ffc8a0', core: '#fff4e8', life: 0.34 });
      later(0.08, () => {
        fx.ring(x, y + 20 * SZ, 4, 40 * SZ, 0.3, '#ffe0c0', 3, true, 0.3);
        fx.burst(x, y + 10, { n: 14, speed: [80, 200], life: [0.4, 0.8], size: [2, 4], shape: 'shard', col: C.wood, g: 380, spin: 3, dir: -Math.PI / 2, spread: 1.2 });
        if (I.pierce) fx.burst(x, y, { n: 10, speed: [60, 160], life: [0.3, 0.6], size: [2, 4], shape: 'shard', col: C.silver, g: 300 });
        S.shake(0.6);
      });
      S.play('chop');
    },
  }),
  knives: melee({                                        // two blurs of steel whip in from either side
    travel: 0.14,
    hit(fx, x, y, S, I) {
      thrust(fx, x - 6, y - 5, { rot: 0.18, len: 18, back: 70, w: 3, ...STEEL, life: 0.24 });
      thrust(fx, x + 6, y + 6, { rot: Math.PI - 0.18, len: 18, back: 70, w: 3, ...STEEL, life: 0.24, delay: 0.08 });
      sparks(fx, x - 8, y - 6, C.steel, 8, [80, 180], 0.18, 0.7);
      later(0.08, () => { sparks(fx, x + 8, y + 6, C.steel, 8, [80, 180], Math.PI - 0.18, 0.7); S.play('stab'); });
      S.play('stab');
    },
  }),
  hammer: melee({                                        // the head comes down: a smash and a shockwave
    travel: 0.22, glint: '#ffe8a0',
    hit(fx, x, y, S, I) {
      thrust(fx, x, y, { rot: Math.PI / 2, len: 8, back: 70, w: 14, col: '#c89a4a', edge: '#ffe8b8', core: '#ffffff', life: 0.2 });
      later(0.06, () => {
        fx.flash('#fff0c0', 0.12, 0.3);
        fx.ring(x, y + 18 * SZ, 6, 64 * SZ, 0.4, '#ffe8a0', 4, true, 0.3);
        fx.ring(x, y + 18 * SZ, 4, 40 * SZ, 0.3, '#ffffff', 2, true, 0.3);
        fx.glow(x, y + 8, 30, 0.25, 'rgba(255,230,160,1)', 1.4);
        fx.burst(x, y + 16, { n: 18, speed: [60, 160], life: [0.3, 0.7], size: [2, 3.5], col: ['#b8a890', '#8a7a66'], g: 320, dir: -Math.PI / 2, spread: 1.4 });
        if (I.stun) for (let i = 0; i < 5; i++) {
          fx.burst(x + Math.cos(i * 1.26) * 18, y - 26 + Math.sin(i * 1.26) * 5, { n: 1, speed: [0, 1], life: [1.0, 1.2], size: [2.5, 2.5], shape: 'star', col: '#ffe070', add: true });
        }
        S.shake(0.9);
      });
      S.play(I.stun ? 'stun' : 'bonk');
    },
  }),
  crossbow: melee({                                      // a bolt snaps home: a streak of light, a puncture
    travel: 0.1, launchSfx: 'twang',
    hit(fx, x, y, S, I) {
      thrust(fx, x, y, { rot: 0.08, len: 10, back: 110, w: 3.5, col: '#c8a060', edge: '#ffe8c0', core: '#ffffff', life: 0.2 });
      sparks(fx, x, y, ['#ffe8c0', '#fff'], 12, [100, 240], 0.08, 0.8);
      fx.ring(x, y, 2, 14, 0.18, '#ffe8c0', 2);
      if (I.crit) { fx.ring(x, y, 3, 30, 0.3, '#ffea4a', 3); stars(fx, x, y, C.gold, 8); }
      S.play('thunk');
    },
  }),
  flail: melee({                                         // the ball whirls a full circle round the foe
    travel: 0.18,
    hit(fx, x, y, S, I) {
      const a0 = R(0, TAU);
      const rr = 26 * SZ;
      fx.swipe(x + Math.cos(a0) * rr, y + Math.sin(a0) * rr, { rot: a0, r: rr, span: TAU * 0.92, w: 6 * SZ, dir: 1, col: '#6a6a80', edge: '#d8d8e8', core: '#ffffff', life: 0.4, sweep: 0.5 });
      for (let i = 0; i < 3; i++) later(0.08 + i * 0.07, () => {
        const a = a0 + (i + 1) * 1.9;
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        fx.burst(px, py, { n: 6 + I.dmg * 2, speed: [80, 200], life: [0.25, 0.5], size: [1.5, 3], shape: 'spark', col: ['#fff', '#ffd08a'], add: true, drag: 3 });
        fx.ring(px, py, 3, 12 + I.dmg * 3, 0.25, '#fff0c8', 2);
      });
      puff(fx, x, y + 12, C.smoke, 6);
      S.play('clank');
    },
  }),
  flame: melee({                                         // a burning crescent that leaves the air on fire
    glint: '#ffb030', launchSfx: 'fireball',
    hit(fx, x, y, S, I) {
      cut(fx, x, y, 0.3 * Math.PI, { r: 40, span: 2.1, w: 11, ...FIRE, life: 0.4 });
      alongArc(x, y, 0.3 * Math.PI, 40, 2.1, 6, (px, py) => embers(fx, px, py, C.fire, 5));
      fx.glow(x, y, 30, 0.35, 'rgba(255,130,30,1)', 1.8);
      S.play('burn');
    },
  }),
  scythe: melee({                                        // a vast reaping sweep, dragging shadow behind it
    travel: 0.2, glint: '#c8a0ff',
    hit(fx, x, y, S, I) {
      cut(fx, x, y, Math.PI, { r: 72, span: 1.35, w: 13, ...DARK, life: 0.45, bend: -1 });
      alongArc(x, y, Math.PI, 72, 1.35, 6, (px, py) => puff(fx, px, py, C.dark, 2, [3, 6]), -1);
      if (I.execute) {
        cut(fx, x, y + 6, 0, { r: 72, span: 1.35, w: 13, ...DARK, life: 0.45, delay: 0.14, bend: -1 });
        later(0.14, () => {
          fx.flash('#6a2aa8', 0.35, 0.55); fx.ring(x, y, 6, 70 * SZ, 0.5, '#c8a0ff', 4);
          fx.burst(x, y, { n: 20, speed: [30, 120], life: [0.8, 1.4], size: [1.5, 3], shape: 'star', col: C.dark, add: true, g: -50 });
        });
        S.play('reap');
      } else S.play('scythe');
    },
  }),
  dawnblade: melee({                                     // a cross of dawn light, then its rays
    glint: '#c8f0ff',
    hit(fx, x, y, S, I) {
      cut(fx, x, y, Math.PI / 2, { r: 80, span: 0.75, w: 8, ...HOLY, life: 0.4 });
      cut(fx, x, y, 0, { r: 80, span: 0.75, w: 8, ...HOLY, life: 0.4, delay: 0.08 });
      later(0.12, () => {
        for (let i = 0; i < 8; i++) fx.beam(x, y, x + Math.cos(i * TAU / 8 + 0.4) * 30 * SZ, y + Math.sin(i * TAU / 8 + 0.4) * 30 * SZ, 0.26, '#8ad8ff', 1.2);
        stars(fx, x, y, ['#ffe84a', '#fff6c0'], 8);
        if (I.beam) { fx.beam(x, y - 160 * SZ, x, y + 40 * SZ, 0.5, '#8ad8ff', 10); fx.flash('#c8f0ff', 0.2, 0.4); }
      });
      S.play(I.beam ? 'beam' : 'holy');
    },
  }),
  slabcleaver: melee({                                   // one enormous cut (Overdrive: three)
    travel: 0.2,
    hit(fx, x, y, S, I) {
      if (I.limit) {
        fx.flash('#ffffff', 0.3, 0.7);
        const cols = [STEEL, FIRE, GOLD];
        for (let i = 0; i < 3; i++) cut(fx, x, y, 0.2 * Math.PI + i * 0.7, { r: 70, span: 1.8, w: 18, ...cols[i], life: 0.45, delay: i * 0.08, bend: i % 2 ? -1 : 1 });
        later(0.18, () => {
          fx.ring(x, y, 8, 90 * SZ, 0.5, '#ffb04a', 5);
          fx.burst(x, y, { n: 40, speed: [100, 300], life: [0.4, 0.9], shape: 'spark', col: C.orange, add: true, drag: 2.5, len: 0.05, w: 2 });
        });
        S.shake(1.4); S.play('limit');
      } else {
        cut(fx, x, y, 0.3 * Math.PI, { r: 62, span: 1.9, w: 18, ...STEEL, life: 0.4 });
        sparks(fx, x, y, C.silver, 22, [100, 260], 0.3 * Math.PI, 0.5);
        S.shake(0.7); S.play('heavy');
      }
    },
  }),
  wyrmbreaker: melee({                                   // a dragon-killing cleave that splits the ground
    travel: 0.24, glint: '#ff8a8a',
    hit(fx, x, y, S, I) {
      fx.flash('#8a1a1a', 0.3, 0.4);
      cut(fx, x, y, 0.55 * Math.PI, { r: 66, span: 1.5, w: 20, ...BLOOD, life: 0.45 });
      later(0.1, () => {
        fx.ring(x, y + 22 * SZ, 6, 70 * SZ, 0.45, '#e8d0c8', 4, true, 0.28);
        fx.burst(x, y, { n: 30, speed: [80, 240], life: [0.4, 0.9], size: [2, 4.5], shape: 'shard', col: ['#8a1a1a', '#3a3438', '#c8b8b0'], g: 420, spin: 3 });
        fx.burst(x, y, { n: 14, speed: [20, 70], life: [0.6, 1.0], size: [4, 8], grow: 2, shape: 'smoke', col: C.smoke, alpha: 0.6 });
      });
      S.shake(1.6); S.play('slab');
    },
  }),
  picklock: melee({                                      // three tiny precise ticks - and the lock gives
    travel: 0.12, glint: '#ffe070',
    hit(fx, x, y, S, I) {
      for (let i = 0; i < 3; i++) cut(fx, x + R(-6, 6), y + R(-6, 6), R(0, TAU), { r: 12, span: 1.4, w: 3, ...GOLD, life: 0.2, delay: i * 0.05 });
      later(0.15, () => {
        fx.burst(x, y, { n: 12, speed: [60, 160], life: [0.3, 0.6], size: [1.5, 2.5], shape: 'shard', col: ['#ffd24a', '#fff6c0', '#c89a30'], add: true, drag: 2 });
        fx.ring(x, y, 3, 16, 0.2, '#ffe070', 2);
        stars(fx, x, y, ['#fff6c0', '#ffe84a'], 10);
      });
      S.play('picklock');
    },
  }),
  whisperblade: melee({                                  // iaido: three hairline cuts appear... then open
    travel: 0.1,
    hit(fx, x, y, S, I) {
      const as = [R(-0.5, 0.5), R(0.9, 1.4), R(1.9, 2.5)];
      as.forEach((a, i) => {
        thrust(fx, x + R(-6, 6), y + R(-6, 6), { rot: a, len: 42, back: 42, w: 2, col: '#8ab8d0', edge: '#e8f4ff', core: '#ffffff', life: 0.5, delay: i * 0.04, sweep: 0.15 });
        later(i * 0.04, () => S.play('shing'));
      });
      later(0.28, () => {
        fx.glow(x, y, 26, 0.3, 'rgba(220,240,255,1)', 1.5);
        as.forEach(a => sparks(fx, x, y, C.silver, 8, [120, 260], a, 0.3));
        fx.burst(x, y, { n: 16, speed: [40, 110], life: [0.9, 1.5], size: [1.5, 2.5], shape: 'leaf', col: ['#c8f0d8', '#8ad8b0', '#ffffff'], g: 20, spin: 3, drag: 1.5 });
      });
    },
  }),
  powder_saber: melee({                                  // a cut - and the powder in the fuller goes off
    hit(fx, x, y, S, I) {
      cut(fx, x, y, 0.3 * Math.PI, { r: 36, span: 1.9, w: 8, ...STEEL });
      if (I.trigger) {
        alongArc(x, y, 0.3 * Math.PI, 36, 1.9, 5, (px, py, k) => later(0.05 + k * 0.03, () => {
          fx.glow(px, py, 12, 0.18, 'rgba(255,220,120,1)', 1.3);
          fx.burst(px, py, { n: 6, speed: [120, 260], life: [0.15, 0.3], shape: 'spark', col: ['#fff', '#ffe08a'], add: true, len: 0.04 });
        }));
        later(0.2, () => puff(fx, x, y, C.smoke, 10));
        S.shake(0.6); S.play('powder');
      } else { sparks(fx, x, y, C.steel, 14, [80, 200], 0.3 * Math.PI, 0.5); S.play('slash2'); }
    },
  }),
  skull_cursed: blade({
    spin: 6, col: C.dark, head: { r: 10, col: 'rgba(160,90,255,0.6)' },
    trail: { shape: 'smoke', col: ['#6a3aa8', '#2a1a4a'], speed: [2, 14], life: [0.3, 0.6], size: [2, 4], grow: 1.8, alpha: 0.5 },
    hit(fx, x, y, S, I) {
      fx.burst(x, y, { n: 18, speed: [30, 110], life: [0.5, 0.9], size: [3, 6], grow: 1.6, shape: 'smoke', col: C.dark, alpha: 0.7, g: -30 });
      fx.ring(x, y, 4, 36, 0.4, '#a070ff', 3);
      S.play('cursehit');
    },
  }),
  bomb: {
    target: 'enemy', travel: 0.42,
    launch(fx, a, b, S) {
      S.play('fuse');
      fx.shot({ from: a, to: b, dur: this.travel, arc: 90, img: S.icon, spin: 9, scale: 1.2, ease: k => k,
                trail: { shape: 'star', col: ['#fff6a0', '#ffb030'], speed: [10, 40], life: [0.15, 0.3], size: [1, 2], add: true }, rate: 80 });
    },
    impact(fx, x, y, S, I) {
      fx.flash('#ffd08a', 0.3, 0.6);
      fx.glow(x, y, 48, 0.4, 'rgba(255,170,60,1)', 1.6);
      fx.glow(x, y, 28, 0.25, 'rgba(255,240,180,1)', 1.3);
      fx.ring(x, y, 8, 80, 0.45, '#ffb04a', 4);
      fx.burst(x, y, { n: 10, speed: [20, 70], life: [0.3, 0.55], size: [6, 10], grow: 1.8, shape: 'glow', col: ['rgba(255,140,40,0.9)', 'rgba(255,90,20,0.9)'] });
      fx.burst(x, y, { n: 40, speed: [60, 260], life: [0.4, 0.9], size: [2, 5], col: C.fire, add: true, drag: 2.5 });
      fx.burst(x, y, { n: 18, speed: [30, 100], life: [0.8, 1.5], size: [5, 10], grow: 2.2, shape: 'smoke', col: C.smoke, g: -30, drag: 1.5, alpha: 0.65 });
      fx.burst(x, y, { n: 12, speed: [120, 260], life: [0.5, 0.9], size: [2, 3], shape: 'shard', col: ['#3a3a44', '#6a5a4a'], g: 420 });
      S.shake(I.chain ? 2 : 1.3); S.play('explode');
    },
  },
  spiked: {
    target: 'hp', travel: 0.22,
    launch(fx, a, b, S) { fx.shot({ from: a, to: b, dur: 0.22, arc: 16, img: S.icon, scale: 1.2, trail: { col: C.blue, speed: [3, 12], life: [0.2, 0.3], size: [1, 2], add: true } }); },
    impact(fx, x, y, S, I) {
      shieldPop(fx, x, y, C.blue, 1);
      if (I.enemy) for (let i = 0; i < 5; i++) {
        fx.shot({ from: [x, y], to: [I.enemy[0] + R(-14, 14), I.enemy[1] + R(-10, 10)], dur: 0.2 + i * 0.03, arc: 12,
                  trail: { shape: 'spark', col: C.silver, speed: [1, 4], life: [0.1, 0.2], add: true }, rate: 60,
                  onHit: (hx, hy) => sparks(fx, hx, hy, C.silver, 4) });
      }
      S.play('spikes');
    },
  },
};

function shieldPop(fx, x, y, col, big) {
  fx.ring(x, y, 6, 28 + big * 10, 0.4, col[1], 3);
  fx.ring(x, y, 4, 18 + big * 6, 0.3, '#ffffff', 2);
  fx.burst(x, y, { n: 10 + big * 6, speed: [40, 120], life: [0.35, 0.7], size: [2, 3.5], shape: 'shard', col, add: true, drag: 2 });
  fx.glow(x, y, 20 + big * 6, 0.3, 'rgba(120,170,255,0.8)');
}

function toHp(o) {
  return {
    target: 'hp', travel: o.travel || 0.26,
    launch(fx, a, b, S) {
      fx.shot({ from: a, to: b, dur: this.travel, arc: o.arc ?? 28, img: S.icon, spin: o.spin ?? 0, scale: 1.1, grow: 0.3,
                trail: o.trail, rate: o.rate || 60 });
      if (o.launchSfx) S.play(o.launchSfx);
    },
    impact(fx, x, y, S, I) { o.hit(fx, x, y, S, I); },
  };
}
const HEAL = (fx, x, y, n, col = C.green) => {
  fx.burst(x, y, { n, speed: [20, 60], life: [0.6, 1.1], size: [2, 3.5], shape: 'plus', col, add: true, g: -70, jx: 16, jy: 6 });
  fx.glow(x, y, 20, 0.4, 'rgba(120,255,140,0.7)');
};
Object.assign(RECIPES, {
  shield: toHp({ trail: { col: C.blue, speed: [3, 12], life: [0.2, 0.3], size: [1, 2], add: true },
                 hit(fx, x, y, S) { shieldPop(fx, x, y, C.blue, 0); S.play('shieldup'); } }),
  shield2: toHp({ trail: { col: C.blue, speed: [3, 12], life: [0.2, 0.3], size: [1, 2], add: true },
                  hit(fx, x, y, S) { shieldPop(fx, x, y, C.blue, 1); stars(fx, x, y, C.gold, 6); S.play('shieldup2'); } }),
  bulwark: toHp({ trail: { shape: 'star', col: ['#fff6c0', '#8ad8ff'], speed: [3, 12], life: [0.2, 0.4], size: [1, 2], add: true },
                 hit(fx, x, y, S) {
                   shieldPop(fx, x, y, C.blue, 2);
                   fx.ring(x, y, 10, 44, 0.5, '#d8b060', 4);
                   stars(fx, x, y, ['#fff6c0', '#d8b060'], 10);
                   S.play('bulwark');
                 } }),
  potion: toHp({ trail: { shape: 'bubble', col: C.blood, speed: [3, 12], life: [0.25, 0.4], size: [1, 2] },
                 hit(fx, x, y, S) { HEAL(fx, x, y, 10); fx.burst(x, y, { n: 8, speed: [20, 60], life: [0.5, 0.9], size: [1.5, 2.5], shape: 'bubble', col: C.blood, g: -60 }); S.play('potion'); } }),
  potion2: toHp({ trail: { shape: 'bubble', col: C.blood, speed: [3, 12], life: [0.25, 0.4], size: [1, 2] },
                  hit(fx, x, y, S) { HEAL(fx, x, y, 16); fx.burst(x, y, { n: 12, speed: [20, 70], life: [0.5, 1.0], size: [1.5, 3], shape: 'bubble', col: C.blood, g: -60 }); S.play('potion'); } }),
  potion3: toHp({ trail: { shape: 'heart', col: C.blood, speed: [3, 12], life: [0.3, 0.5], size: [2, 3] },
                  hit(fx, x, y, S) { HEAL(fx, x, y, 26); fx.burst(x, y, { n: 10, speed: [30, 90], life: [0.8, 1.3], size: [3, 4.5], shape: 'heart', col: C.blood, g: -50 }); fx.ring(x, y, 5, 40, 0.5, '#8aff9a', 3); S.play('bigheal'); } }),
  ember_flask: toHp({ trail: { col: C.orange, speed: [5, 25], life: [0.3, 0.5], size: [1.5, 3], add: true, g: -60 },
                hit(fx, x, y, S) {
                  fx.glow(x, y, 30, 0.6, 'rgba(255,160,60,0.9)', 1.4);
                  fx.burst(x, y, { n: 26, speed: [20, 80], life: [0.7, 1.3], size: [1.5, 3], col: C.orange, add: true, g: -90, jx: 14 });
                  HEAL(fx, x, y, 12, ['#fff0c0', '#ffc86a']); S.play('emberflask');
                } }),
  charm: toHp({ trail: { shape: 'heart', col: C.pink, speed: [3, 12], life: [0.3, 0.5], size: [1.5, 2.5] },
                hit(fx, x, y, S) { fx.burst(x, y, { n: 14, speed: [20, 80], life: [0.7, 1.2], size: [2, 3.5], shape: 'heart', col: C.pink, g: -50 }); stars(fx, x, y, C.pink, 8); S.play('charm'); } }),
});

// vampiric vial: red orbs pulled out of the enemy into your HP
RECIPES.vial = {
  target: 'hp', travel: 0.3,
  launch(fx, a, b, S) { fx.shot({ from: a, to: b, dur: 0.3, arc: 20, img: S.icon, scale: 1.1, trail: { shape: 'bubble', col: C.blood, speed: [3, 10], life: [0.2, 0.4], size: [1, 2] } }); },
  impact(fx, x, y, S, I) {
    const src = I.enemy || [x, y - 80];
    for (let i = 0; i < 8; i++) {
      fx.shot({ from: [src[0] + R(-16, 16), src[1] + R(-12, 12)], to: [x + R(-6, 6), y + R(-4, 4)], dur: 0.35 + i * 0.05, arc: R(-30, 30),
                head: { r: 4, col: 'rgba(255,40,70,0.9)', core: '#ffd0d8' }, onHit: (hx, hy) => fx.burst(hx, hy, { n: 3, speed: [10, 40], life: [0.2, 0.4], col: C.blood, add: true }) });
    }
    S.play('drain');
  },
};

// coins: a spray of coins arcs from the reel into the gold counter
const COIN = (n, sfx = 'coins', big = false) => ({
  target: 'gold', travel: 0.34,
  launch(fx, a, b, S) {
    fx.burst(a[0], a[1], { n: 6, speed: [40, 100], life: [0.3, 0.5], shape: 'star', col: C.gold, add: true, drag: 3 });
    for (let i = 0; i < n; i++) {
      fx.shot({ from: [a[0] + R(-8, 8), a[1] + R(-6, 6)], to: [b[0] + R(-4, 4), b[1] + R(-3, 3)], dur: 0.3 + i * 0.045, arc: R(40, 80),
                trail: { shape: 'star', col: ['#fff6c0', '#ffd24a'], speed: [0, 6], life: [0.15, 0.25], size: [0.8, 1.5], add: true }, rate: 30,
                head: { r: 5, col: 'rgba(255,210,74,0.9)', core: '#fff8d0' } });
    }
  },
  impact(fx, x, y, S, I) {
    fx.burst(x, y, { n: 6 + n * 2, speed: [30, 90], life: [0.4, 0.8], size: [3, 4], shape: 'coin', col: C.gold, g: 200, dir: -Math.PI / 2, spread: 1.2, spin: 3 });
    fx.glow(x, y, 14 + n * 2, 0.3, 'rgba(255,220,90,0.9)');
    if (big || I.jackpot) { fx.flash('#ffd24a', 0.25, 0.35); stars(fx, x, y, C.gold, 14); S.play('coinrain'); } else S.play(sfx);
  },
});
Object.assign(RECIPES, {
  coin: COIN(2, 'coin'), coin_copper: COIN(2, 'coin'), coins: COIN(3), coin_silver: COIN(3, 'coin_silver'),
  coin_gold: COIN(5, 'coins'), coin_royal: COIN(6, 'coins', false),
});
RECIPES.chest = {
  target: 'gold', travel: 0.4,
  launch(fx, a, b, S) {
    S.play('chestopen');
    fx.glow(a[0], a[1], 26, 0.5, 'rgba(255,220,120,0.9)');
    fx.burst(a[0], a[1], { n: 18, speed: [60, 160], life: [0.5, 0.9], size: [2, 3], shape: 'star', col: C.gold, add: true, dir: -Math.PI / 2, spread: 0.9, g: 120 });
    fx.burst(a[0], a[1], { n: 8, speed: [60, 140], life: [0.6, 1.0], size: [2.5, 3.5], shape: 'shard', col: ['#6aff8a', '#5ac8ff', '#ff5a8a', '#c87aff'], dir: -Math.PI / 2, spread: 0.8, g: 260, add: true });
    COIN(3).launch(fx, a, b, S);
  },
  impact(fx, x, y, S, I) { COIN(3).impact(fx, x, y, S, I); },
};

// in-place magic on the reel itself
const HERE = (o) => ({ target: 'reel', travel: 0.05, launch() {}, impact(fx, x, y, S, I) { o(fx, x, y, S, I); } });
Object.assign(RECIPES, {
  clover: HERE((fx, x, y, S, I) => {
    for (let i = 0; i < 14; i++) fx.burst(x + Math.cos(i * 0.45) * 14, y + Math.sin(i * 0.45) * 10, { n: 1, speed: [20, 50], life: [0.8, 1.3], size: [2.5, 4], shape: 'leaf', col: C.green, g: -40, spin: 2, dir: -Math.PI / 2 + R(-0.8, 0.8), spread: 0.3 });
    stars(fx, x, y, ['#d8ffb0', '#ffffff'], I.lucky ? 16 : 6);
    if (I.lucky) { fx.ring(x, y, 4, 46, 0.5, '#8aff6a', 3); fx.flash('#6aff6a', 0.2, 0.25); }
    S.play(I.lucky ? 'lucky' : 'clover');
  }),
  wild: HERE((fx, x, y, S) => {
    fx.burst(x, y, { n: 30, speed: [40, 150], life: [0.5, 0.9], size: [1.5, 3], shape: 'star', col: C.rainbow, add: true, drag: 2 });
    fx.ring(x, y, 4, 30, 0.4, '#ffffff', 2);
    S.play('wild');
  }),
  dice: HERE((fx, x, y, S) => {
    fx.burst(x, y, { n: 3, speed: [60, 120], life: [0.8, 1.0], size: [3.5, 4.5], shape: 'die', col: ['a', 'bb', 'ccc', 'dddd', 'eeeee', 'ffffff'], g: 360, dir: -Math.PI / 2, spread: 0.9, spin: 2 });
    S.play('dice');
  }),
  mimic: HERE((fx, x, y, S) => {
    fx.burst(x, y, { n: 16, speed: [40, 120], life: [0.4, 0.8], size: [2, 3.5], shape: 'shard', col: ['#ffffff', '#e8e0d0'], add: false, g: 200 });
    stars(fx, x, y, C.gold, 10);
    S.play('chomp');
  }),
  skull: HERE((fx, x, y, S, I) => {
    fx.burst(x, y, { n: 14, speed: [20, 70], life: [0.7, 1.2], size: [3, 6], grow: 1.8, shape: 'smoke', col: C.dark, g: -50, alpha: 0.7 });
    if (I.hp) fx.shot({ from: [x, y], to: I.hp, dur: 0.3, arc: 30, head: { r: 7, col: 'rgba(150,80,255,0.8)' },
                         trail: { shape: 'smoke', col: C.dark, speed: [2, 10], life: [0.3, 0.5], size: [2, 4], grow: 1.6, alpha: 0.5 },
                         onHit: (hx, hy) => { fx.burst(hx, hy, { n: 10, speed: [30, 90], life: [0.3, 0.6], col: C.blood, add: true }); } });
    S.play('cackle');
  }),
});


// ---------------------------------------------------------------- curios
Object.assign(RECIPES, {
  lodestone: {
    target: 'gold', travel: 0.4,
    launch(fx, a, b, S) {
      S.play('magnet');
      fx.ring(a[0], a[1], 26, 4, 0.35, '#c8b8e8', 2);
      COIN(4).launch(fx, a, b, S);
    },
    impact(fx, x, y, S, I) { COIN(4).impact(fx, x, y, S, I); },
  },
  thorn: toHp({ trail: { shape: 'leaf', col: ['#3a8a2a', '#62ae46'], speed: [3, 12], life: [0.3, 0.5], size: [1.5, 2.5], spin: 2 },
                hit(fx, x, y, S) {
                  shieldPop(fx, x, y, ['#d8ffb0', '#8ad85a', '#3a8a2a'], 1);
                  fx.burst(x, y, { n: 14, speed: [60, 160], life: [0.4, 0.7], size: [2, 3], shape: 'shard', col: ['#c8d890', '#8a5a30'], drag: 2 });
                  S.play('thorns');
                } }),
  warhorn: {
    target: 'reel', travel: 0.05, launch() {},
    impact(fx, x, y, S) {
      fx.ring(x, y, 6, 90, 0.6, '#ff9a5a', 4);
      fx.ring(x, y, 4, 60, 0.45, '#ffffff', 2);
      fx.flash('#ff6a2a', 0.18, 0.25);
      fx.burst(x, y, { n: 18, speed: [60, 180], life: [0.5, 0.9], size: [2, 3], shape: 'star', col: ['#ffd08a', '#ff9a5a', '#ffffff'], add: true, drag: 2 });
      S.shake(0.5); S.play('horn');
    },
  },
  apple: toHp({ trail: { shape: 'star', col: C.gold, speed: [3, 12], life: [0.3, 0.5], size: [1, 2], add: true },
                hit(fx, x, y, S) {
                  HEAL(fx, x, y, 18, ['#fff6c0', '#ffd060']);
                  fx.ring(x, y, 5, 44, 0.5, '#ffd060', 3);
                  stars(fx, x, y, C.gold, 12);
                  S.play('apple');
                } }),
});

// ---------------------------------------------------------------- the Mage's spells
// Every spell leaves the reel with a casting flash and its own sigil ring, flies (or strikes) at the foe,
// and lands with its own element's burst and sound.
C.arcane = ['#ffffff', '#e0c8ff', '#b07aff', '#7a4ae0'];
const castFlash = (fx, x, y, col) => {
  fx.glow(x, y, 20, 0.3, col);
  fx.ring(x, y, 3, 22, 0.3, col, 2);
};
const SPELL = (o) => ({
  target: 'enemy', travel: o.travel || 0.3,
  launch(fx, a, b, S) {
    S.play(o.cast || 'cast');
    castFlash(fx, a[0], a[1], o.glow || 'rgba(176,122,255,0.9)');
    if (o.launch) { o.launch(fx, a, b, S, this.travel); return; }
    fx.shot({ from: a, to: b, dur: this.travel, arc: o.arc ?? 18, img: o.img ? S.icon : null, spin: o.spin ?? 0, point: o.point,
              scale: o.scale || 1, head: o.head, trail: o.trail, rate: o.rate || 90, ease: o.ease });
  },
  impact(fx, x, y, S, I) { o.hit(fx, x, y, S, I); },
});
Object.assign(RECIPES, {
  spark: SPELL({
    head: { r: 5, col: 'rgba(176,122,255,0.85)' },
    trail: { shape: 'star', col: C.arcane, speed: [4, 16], life: [0.2, 0.35], size: [0.8, 1.6], add: true },
    hit(fx, x, y, S) { stars(fx, x, y, C.arcane, 12); fx.ring(x, y, 3, 20, 0.25, '#c8a0ff', 2); S.play('zap'); },
  }),
  bolt_arcane: SPELL({
    head: { r: 8, col: 'rgba(160,96,255,0.9)' }, travel: 0.26,
    trail: { shape: 'smoke', col: ['#7a4ae0', '#a07aff'], speed: [2, 10], life: [0.25, 0.45], size: [2, 3.5], grow: 1.6, alpha: 0.6 },
    hit(fx, x, y, S) {
      fx.glow(x, y, 26, 0.35, 'rgba(176,122,255,1)');
      fx.ring(x, y, 4, 34, 0.35, '#b07aff', 3);
      sparks(fx, x, y, C.arcane, 18);
      S.play('arcane');
    },
  }),
  firebolt: SPELL({
    cast: 'firecast', glow: 'rgba(255,150,60,0.9)', head: { r: 7, col: 'rgba(255,130,40,0.9)', core: '#fff6c0' },
    trail: { col: C.fire, speed: [5, 25], life: [0.2, 0.4], size: [1.5, 3], add: true, g: -60 },
    hit(fx, x, y, S) {
      fx.glow(x, y, 24, 0.35, 'rgba(255,150,50,1)');
      fx.burst(x, y, { n: 22, speed: [40, 140], life: [0.35, 0.7], size: [2, 3.5], col: C.fire, add: true, drag: 2.5 });
      embers(fx, x, y, C.fire, 12);
      S.play('firebolt');
    },
  }),
  frost: SPELL({
    cast: 'icecast', glow: 'rgba(140,220,255,0.9)', img: true, point: Math.PI / 4, scale: 0.9, travel: 0.24,
    trail: { shape: 'shard', col: C.ice, speed: [4, 16], life: [0.2, 0.4], size: [1, 2], add: true },
    hit(fx, x, y, S) {
      fx.burst(x, y, { n: 18, speed: [60, 170], life: [0.4, 0.8], size: [2, 3.5], shape: 'shard', col: C.ice, add: true, drag: 2, spin: 2 });
      fx.ring(x, y, 4, 30, 0.35, '#bfefff', 2);
      puff(fx, x, y, ['#e8fbff', '#c8f0ff'], 6, [3, 6]);
      S.play('frost');
    },
  }),
  toxic: SPELL({
    cast: 'toxcast', glow: 'rgba(120,230,90,0.9)', travel: 0.42, arc: 26, ease: k => 1 - (1 - k) * (1 - k),
    head: { r: 6, col: 'rgba(110,220,80,0.7)' },
    trail: { shape: 'smoke', col: ['#5ac03a', '#3a8a2a', '#8ae05a'], speed: [2, 12], life: [0.4, 0.7], size: [3, 5], grow: 1.8, alpha: 0.55 },
    hit(fx, x, y, S) {
      fx.burst(x, y, { n: 16, speed: [15, 60], life: [0.8, 1.4], size: [5, 9], grow: 1.9, shape: 'smoke', col: ['#5ac03a', '#3a8a2a'], alpha: 0.6, g: -15, drag: 1.5 });
      fx.burst(x, y, { n: 14, speed: [10, 50], life: [0.7, 1.2], size: [1.5, 3], shape: 'bubble', col: C.poison, g: -60, jx: 16, jy: 10 });
      S.play('toxic');
    },
  }),
  chain: SPELL({
    cast: 'thunder', glow: 'rgba(255,240,120,0.95)', travel: 0.08,
    launch(fx, a, b, S) {
      fx.bolt(a[0], a[1], b[0], b[1], 0.35, '#fff6a0', 3);
      fx.bolt(a[0], a[1], b[0] + R(-14, 14), b[1] + R(-10, 10), 0.3, '#8ad8ff', 2);
    },
    hit(fx, x, y, S, I) {
      fx.flash('#fff6c0', 0.12, 0.35);
      for (let i = 0; i < 4; i++) fx.bolt(x, y, x + R(-60, 60), y + R(-40, 40), 0.25, i % 2 ? '#8ad8ff' : '#fff6a0', 1.5);
      sparks(fx, x, y, ['#ffffff', '#fff6a0', '#8ad8ff'], 22, [100, 260]);
      S.shake(0.6);
    },
  }),
  fireball: SPELL({
    cast: 'firecast', glow: 'rgba(255,150,60,0.9)', img: true, spin: 5, scale: 1.3, arc: 40, travel: 0.38,
    head: { r: 12, col: 'rgba(255,120,30,0.7)', core: '#fff0a0' },
    trail: { col: C.fire, speed: [10, 40], life: [0.3, 0.6], size: [2, 4], add: true, g: -50 },
    hit(fx, x, y, S) {
      fx.flash('#ffb060', 0.25, 0.45);
      fx.glow(x, y, 44, 0.45, 'rgba(255,140,40,1)', 1.6);
      fx.ring(x, y, 8, 70, 0.45, '#ff9a3a', 4);
      fx.burst(x, y, { n: 40, speed: [60, 240], life: [0.4, 0.9], size: [2, 5], col: C.fire, add: true, drag: 2.5 });
      fx.burst(x, y, { n: 14, speed: [30, 90], life: [0.8, 1.4], size: [5, 9], grow: 2, shape: 'smoke', col: C.smoke, g: -30, drag: 1.5, alpha: 0.6 });
      embers(fx, x, y, C.fire, 20, 1.2);
      S.shake(1.1); S.play('explode');
    },
  }),
  missiles: SPELL({
    travel: 0.36,
    launch(fx, a, b, S, dur) {
      for (let i = 0; i < 3; i++) {
        fx.shot({ from: [a[0] + R(-6, 6), a[1] + R(-4, 4)], to: [b[0] + R(-12, 12), b[1] + R(-10, 10)], dur: dur - 0.1 + i * 0.05,
                  arc: [-50, 40, 70][i], head: { r: 5, col: 'rgba(170,110,255,0.9)' },
                  trail: { shape: 'star', col: C.arcane, speed: [2, 10], life: [0.2, 0.35], size: [0.8, 1.5], add: true }, rate: 70,
                  onHit: (hx, hy) => { stars(fx, hx, hy, C.arcane, 6); fx.ring(hx, hy, 2, 14, 0.2, '#c8a0ff', 2); } });
      }
    },
    hit(fx, x, y, S) { S.play('missiles'); },
  }),
  drain: SPELL({
    cast: 'drain', glow: 'rgba(255,60,100,0.9)', head: { r: 6, col: 'rgba(160,30,90,0.9)' },
    trail: { shape: 'smoke', col: ['#5a1a4a', '#a0306a'], speed: [2, 10], life: [0.3, 0.5], size: [2, 3.5], grow: 1.5, alpha: 0.6 },
    hit(fx, x, y, S, I) {
      fx.ring(x, y, 36, 4, 0.35, '#ff5a7a', 2);
      const to = I.hp || [x, y + 120];
      for (let i = 0; i < 7; i++) {
        fx.shot({ from: [x + R(-16, 16), y + R(-12, 12)], to: [to[0] + R(-6, 6), to[1] + R(-4, 4)], dur: 0.4 + i * 0.05, arc: R(-40, 40),
                  head: { r: 4, col: 'rgba(255,40,80,0.9)', core: '#ffd0d8' },
                  onHit: (hx, hy) => fx.burst(hx, hy, { n: 3, speed: [10, 40], life: [0.2, 0.4], shape: 'heart', col: C.blood, add: true }) });
      }
      S.play('drain');
    },
  }),
  icelance: SPELL({
    cast: 'icecast', glow: 'rgba(140,220,255,0.9)', img: true, point: Math.PI / 4, scale: 1.4, travel: 0.2, arc: 0, ease: k => k * k,
    trail: { shape: 'shard', col: C.ice, speed: [10, 30], life: [0.25, 0.5], size: [1.5, 2.5], add: true }, rate: 120,
    hit(fx, x, y, S) {
      fx.flash('#c8f4ff', 0.15, 0.3);
      fx.burst(x, y, { n: 30, speed: [80, 240], life: [0.4, 0.9], size: [2, 4.5], shape: 'shard', col: C.ice, add: true, drag: 2, spin: 2 });
      fx.ring(x, y, 5, 46, 0.45, '#bfefff', 3);
      puff(fx, x, y, ['#ffffff', '#c8f0ff'], 10, [4, 8]);
      S.shake(0.7); S.play('icelance');
    },
  }),
  meteor: SPELL({
    cast: 'meteorcall', glow: 'rgba(255,150,60,0.9)', travel: 0.55,
    launch(fx, a, b, S, dur) {
      fx.shot({ from: [b[0] - 140, b[1] - 220], to: b, dur, arc: 0, img: S.icon, spin: 3, scale: 1.8, ease: k => k * k,
                head: { r: 16, col: 'rgba(255,120,30,0.6)', core: '#fff0a0' },
                trail: { col: C.fire, speed: [10, 50], life: [0.4, 0.8], size: [3, 6], add: true, g: -30 }, rate: 140 });
    },
    hit(fx, x, y, S) {
      fx.flash('#ffc080', 0.4, 0.7);
      fx.glow(x, y, 70, 0.6, 'rgba(255,140,40,1)', 1.7);
      fx.ring(x, y, 10, 120, 0.6, '#ffb04a', 5);
      fx.ring(x, y, 6, 70, 0.4, '#ffffff', 2);
      fx.burst(x, y, { n: 60, speed: [80, 320], life: [0.5, 1.1], size: [2, 6], col: C.fire, add: true, drag: 2 });
      fx.burst(x, y, { n: 20, speed: [120, 300], life: [0.6, 1.0], size: [3, 5], shape: 'shard', col: ['#3a2a24', '#6a4a3a'], g: 460 });
      fx.burst(x, y, { n: 24, speed: [30, 110], life: [1.0, 1.8], size: [6, 12], grow: 2.2, shape: 'smoke', col: C.smoke, g: -30, drag: 1.4, alpha: 0.7 });
      S.shake(2.2); S.play('meteor');
    },
  }),
  void: SPELL({
    cast: 'voidcast', glow: 'rgba(120,60,220,0.9)', head: { r: 7, col: 'rgba(60,20,120,0.9)', core: '#c89aff' },
    trail: { shape: 'smoke', col: ['#2a1a4a', '#5a2a9a'], speed: [2, 10], life: [0.3, 0.6], size: [2, 4], grow: 1.6, alpha: 0.7 },
    hit(fx, x, y, S, I) {
      fx.ring(x, y, 70, 3, 0.55, '#8a5ad8', 4);
      fx.ring(x, y, 45, 2, 0.4, '#ffffff', 2);
      for (let i = 0; i < 24; i++) {
        const a = R(0, TAU), r = R(40, 80);
        fx.shot({ from: [x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7], to: [x, y], dur: R(0.25, 0.5), arc: R(-20, 20),
                  head: { r: 2.5, col: 'rgba(170,110,255,0.9)' } });
      }
      fx.glow(x, y, 18, 0.6, 'rgba(20,0,40,1)', 0.4);
      if (I.execute) fx.flash('#3a0a6a', 0.4, 0.5);
      S.play('void');
    },
  }),
  starfall: SPELL({
    cast: 'starcall', glow: 'rgba(255,220,120,0.9)', travel: 0.5,
    launch(fx, a, b, S, dur) {
      for (let i = 0; i < 5; i++) {
        const sx = b[0] + R(-120, 60), sy = b[1] - R(160, 240);
        fx.shot({ from: [sx, sy], to: [b[0] + R(-22, 22), b[1] + R(-14, 14)], dur: dur - 0.2 + i * 0.07, arc: 0, ease: k => k * k,
                  head: { r: 6, col: 'rgba(255,220,90,0.9)', core: '#ffffff' },
                  trail: { shape: 'star', col: C.gold, speed: [2, 12], life: [0.25, 0.5], size: [1, 2], add: true }, rate: 90,
                  onHit: (hx, hy) => { stars(fx, hx, hy, C.gold, 10); fx.glow(hx, hy, 16, 0.3, 'rgba(255,230,120,1)'); } });
      }
    },
    hit(fx, x, y, S) { fx.flash('#fff0b0', 0.2, 0.3); S.shake(0.9); S.play('starfall'); },
  }),
  prism: SPELL({
    cast: 'prism', glow: 'rgba(255,255,255,0.95)', travel: 0.12,
    launch(fx, a, b, S) {
      fx.beam(a[0], a[1], b[0], b[1], 0.45, '#ffffff', 5);
      C.rainbow.forEach((col, i) => fx.beam(a[0] + (i - 2.5) * 2, a[1], b[0] + (i - 2.5) * 5, b[1] + (i - 2.5) * 3, 0.5, col, 2.5));
    },
    hit(fx, x, y, S, I) {
      fx.flash('#ffffff', 0.15, 0.4);
      fx.burst(x, y, { n: 40, speed: [60, 220], life: [0.5, 1.0], size: [1.5, 3], shape: 'star', col: C.rainbow, add: true, drag: 2 });
      fx.ring(x, y, 5, 50, 0.45, '#ffffff', 3);
      if (I.beam) for (let i = 0; i < 6; i++) fx.beam(x, y, x + Math.cos(i * 1.05) * 90, y + Math.sin(i * 1.05) * 60, 0.35, C.rainbow[i], 2);
      S.shake(0.8);
    },
  }),
});

// ---------------------------------------------------------------- status / event effects
export const EVENTS = {
  miss(fx, x, y, S) { fx.burst(x, y, { n: 8, speed: [120, 200], life: [0.15, 0.25], shape: 'spark', col: '#c8c8d8', dir: 0, spread: 0.2, add: true, len: 0.06 }); S.play('miss'); },
  block(fx, x, y, S) { sparks(fx, x, y, ['#ffffff', '#b8c8ff'], 10, [80, 180]); fx.ring(x, y, 3, 16, 0.2, '#b8c8ff', 2); S.play('clank'); },
  crit(fx, x, y, S) { fx.ring(x, y, 4, 40, 0.3, '#ffea4a', 3); stars(fx, x, y, ['#ffea4a', '#ffffff'], 10); fx.flash('#ffffff', 0.12, 0.3); },
  burnTick(fx, x, y, S) { fx.burst(x, y, { n: 16, speed: [20, 60], life: [0.5, 0.9], size: [2, 3.5], col: C.fire, add: true, g: -120, jx: 16, jy: 12 }); S.play('burn'); },
  poisonTick(fx, x, y, S) { fx.burst(x, y, { n: 14, speed: [10, 40], life: [0.6, 1.0], size: [1.5, 3], shape: 'bubble', col: C.poison, g: -60, jx: 18, jy: 12 }); S.play('poison'); },
  chill(fx, x, y, S) { fx.burst(x, y, { n: 12, speed: [10, 40], life: [0.6, 1.0], size: [1.5, 3], shape: 'shard', col: C.ice, add: true, g: 40, jx: 18, jy: 10 }); },
  bossCast(fx, x, y, S) {
    fx.ring(x, y, 10, 120, 0.6, '#ff6a4a', 4);
    fx.ring(x, y, 6, 80, 0.45, '#ffffff', 2);
    fx.burst(x, y, { n: 30, speed: [80, 240], life: [0.5, 1.0], size: [2, 4], shape: 'shard', col: ['#ff8a5a', '#ffd08a', '#ffffff'], add: true, drag: 2 });
    fx.flash('#ff4a2a', 0.2, 0.25);
  },
  mirror(fx, x, y, S) {
    fx.burst(x, y, { n: 14, speed: [50, 150], life: [0.35, 0.7], size: [2, 3.5], shape: 'shard', col: ['#ffffff', '#d8ecff', '#9ab4d0'], add: true, drag: 2, spin: 2 });
    fx.ring(x, y, 4, 30, 0.35, '#d8ecff', 2);
    S.play('mirror');
  },
  thorns(fx, x, y, S) {
    fx.burst(x, y, { n: 16, speed: [60, 180], life: [0.3, 0.6], size: [2, 3.5], shape: 'shard', col: ['#c8d890', '#8ad85a', '#3a8a2a'], drag: 2 });
    fx.burst(x, y, { n: 8, speed: [20, 70], life: [0.6, 1.0], size: [2, 3], shape: 'leaf', col: ['#3a8a2a', '#62ae46'], g: 120, spin: 2 });
    S.play('thorns');
  },
  chainStrike(fx, x, y, S) {
    fx.bolt(x + R(-40, 40), y - 140, x + R(-8, 8), y, 0.3, '#fff6a0', 3);
    sparks(fx, x, y, ['#ffffff', '#fff6a0', '#8ad8ff'], 14, [80, 200]);
    fx.flash('#fff6c0', 0.08, 0.25);
    S.play('thunder');
  },
  echo(fx, x, y, S) { fx.ring(x, y, 4, 34, 0.45, '#c8a0ff', 3); fx.ring(x, y, 4, 22, 0.35, '#ffffff', 2); stars(fx, x, y, C.arcane, 10); S.play('echo'); },
  // the Rogue's forest reels bursting into being: whirling leaves, motes of green light
  summon(fx, x, y, S) {
    fx.glow(x, y, 40, 0.5, 'rgba(120,230,110,0.9)', 1.6);
    fx.ring(x, y, 6, 60, 0.5, '#8ae05a', 3);
    fx.burst(x, y, { n: 26, speed: [60, 200], life: [0.7, 1.3], size: [2.5, 4], shape: 'leaf', col: ['#3f8a36', '#62ae46', '#8ad85a', '#2a6a2c'], g: 120, spin: 3, drag: 1.5 });
    stars(fx, x, y, ['#d8ffb0', '#ffffff', '#6aff8a'], 12, 30);
  },
  stun(fx, x, y, S) { for (let i = 0; i < 6; i++) fx.burst(x + Math.cos(i * 1.05) * 20, y + Math.sin(i * 1.05) * 6, { n: 1, speed: [0, 2], life: [1.0, 1.3], size: [2.5, 3], shape: 'star', col: '#ffe070', add: true }); S.play('stun'); },
  kill(fx, x, y, S) {
    fx.flash('#ffffff', 0.18, 0.35);
    fx.ring(x, y, 6, 70, 0.5, '#fff0c0', 4);
    fx.burst(x, y, { n: 40, speed: [60, 240], life: [0.5, 1.0], size: [2, 4], shape: 'shard', col: ['#fff6c0', '#ffd24a', '#ffffff'], add: true, g: 150, drag: 1.5 });
    fx.burst(x, y, { n: 12, speed: [10, 40], life: [1.0, 1.6], size: [3, 5], shape: 'glow', col: 'rgba(200,220,255,0.8)', g: -60 });
  },
  line(fx, cells, col, S) {
    for (const [x, y] of cells) {
      fx.glow(x, y, 26, 0.6, 'rgba(255,240,180,0.8)');
      fx.burst(x, y, { n: 18, speed: [60, 180], life: [0.6, 1.1], size: [1.5, 3], shape: 'star', col: [col, '#ffffff', '#ffe84a'], add: true, g: 120, drag: 1.5 });
    }
    const [x0, y0] = cells[0], [x1, y1] = cells[cells.length - 1];
    fx.bolt(x0, y0, x1, y1, 0.4, col, 2);
    for (let i = 0; i < 40; i++) fx.burst((x0 + x1) / 2 + R(-120, 120), y0 - 60, { n: 1, speed: [20, 80], life: [1.2, 1.8], size: [2, 3], shape: 'shard', col: C.rainbow, g: 160, spin: 3, dir: -Math.PI / 2, spread: 1.2 });
  },
  pixie(fx, x, y, S) {
    for (let i = 0; i < 12; i++) fx.shot({ from: [x + R(-60, 60), y - R(40, 90)], to: [x + R(-6, 6), y], dur: R(0.4, 0.8), arc: R(-20, 20),
                                            head: { r: 4, col: 'rgba(255,170,240,0.9)', core: '#ffffff' }, trail: { shape: 'star', col: C.pink, speed: [0, 5], life: [0.2, 0.35], size: [1, 1.5], add: true } });
    HEAL(fx, x, y, 20, C.pink);
    S.play('pixie');
  },
  // taking a card: a burst in its rarity colour, bigger and louder up the rarity ladder
  card(fx, x, y, S, col, tier) {
    fx.parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: 0.5, size: 1, size1: 1.45, shape: 'card', col: '#ffffff',
                    add: true, rot: 0, vr: 0, alpha: 1, w: 3 });
    fx.parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: 0.7, size: 1.05, size1: 1.9, shape: 'card', col,
                    add: true, rot: 0, vr: 0, alpha: 0.8, w: 2 });
    fx.glow(x, y, 50 + tier * 12, 0.6, col, 1.5);
    fx.glow(x, y, 24, 0.3, '#ffffff', 1.5);
    fx.ring(x, y, 10, 70 + tier * 24, 0.55, col, 3 + tier);
    fx.burst(x, y, { n: 36 + tier * 18, speed: [80, 200 + tier * 50], life: [0.5, 1.1], size: [1.5, 3.2], shape: 'star', col: [col, '#ffffff', '#ffe84a'], add: true, drag: 2, g: 60, jx: 22, jy: 30 });
    if (tier >= 2) fx.burst(x, y - 20, { n: 30 + tier * 10, speed: [80, 220], life: [1.0, 1.7], size: [2, 3.5], shape: 'shard', col: C.rainbow, g: 220, spin: 3, dir: -Math.PI / 2, spread: 1.1 });
    if (tier >= 3) { fx.flash(col, 0.35, 0.3 + (tier - 3) * 0.2); fx.ring(x, y, 20, 180, 0.8, '#ffffff', 3); }
    if (tier >= 4) for (let i = 0; i < 8; i++) fx.bolt(x, y, x + Math.cos(i * 0.785) * 140, y + Math.sin(i * 0.785) * 90, 0.4, col, 2);
    S.play(['pick', 'pick', 'rare_pick', 'epic_pick', 'legend_pick'][tier]);
  },
  // a cracked wall blown open: fire, a wall of dust and a rain of masonry
  wallblast(fx, x, y, S) {
    fx.flash('#ffd08a', 0.35, 0.7);
    fx.glow(x, y, 90, 0.5, 'rgba(255,170,60,1)', 1.8);
    fx.ring(x, y, 10, 160, 0.55, '#ffb04a', 5);
    fx.burst(x, y, { n: 60, speed: [80, 360], life: [0.4, 1.0], size: [2, 5], col: C.fire, add: true, drag: 2.5 });
    fx.burst(x, y, { n: 30, speed: [40, 160], life: [1.0, 2.0], size: [8, 16], grow: 2.4, shape: 'smoke', col: C.smoke, g: -20, drag: 1.2, alpha: 0.75, jx: 60, jy: 30 });
    fx.burst(x, y, { n: 30, speed: [140, 340], life: [0.7, 1.2], size: [3, 6], shape: 'shard', col: ['#4a4652', '#6a6270', '#8a8090'], g: 520, spin: 3 });
    S.shake(2.2); S.play('explode');
  },
  // a draught from the fountain: cool light and droplets
  splash(fx, x, y, S) {
    fx.glow(x, y, 60, 0.7, 'rgba(110,190,255,1)', 1.5);
    fx.ring(x, y, 6, 90, 0.5, '#8ad8ff', 3);
    fx.burst(x, y, { n: 40, speed: [60, 200], life: [0.6, 1.1], size: [1.5, 3], shape: 'bubble', col: ['#8ad8ff', '#d8f4ff', '#4aa8e8'], g: 260, dir: -Math.PI / 2, spread: 1.2 });
    S.play('bigheal');
  },
  // the gambler's dice tumble
  dice(fx, x, y, S) {
    fx.burst(x, y, { n: 6, speed: [120, 220], life: [0.6, 0.9], size: [5, 6], shape: 'shard', col: ['#f0ece0'], g: 500, spin: 5, dir: -Math.PI / 2, spread: 1.4 });
    S.play('dice');
  },
  // stepping into a rune circle: a violet flare, rings and rising motes
  warp(fx, x, y, S) {
    fx.flash('#c890ff', 0.4, 0.7);
    fx.glow(x, y, 80, 0.8, 'rgba(190,130,255,1)', 1.6);
    for (let i = 0; i < 3; i++) fx.ring(x, y, 6 + i * 10, 140 + i * 40, 0.6 + i * 0.15, i ? '#e0c8ff' : '#b070ff', 3);
    fx.burst(x, y, { n: 50, speed: [40, 200], life: [0.8, 1.5], size: [1.5, 3.5], shape: 'star', col: ['#c890ff', '#ffffff', '#8ad8ff'], add: true, g: -160, drag: 1.5, jx: 80 });
  },
  rebirth(fx, x, y, S) {
    fx.flash('#ff8a3a', 0.5, 0.6);
    fx.glow(x, y, 50, 0.9, 'rgba(255,150,60,1)', 1.5);
    fx.burst(x, y, { n: 40, speed: [30, 160], life: [0.8, 1.5], size: [2, 4], shape: 'feather', col: C.fire, add: true, g: -80, spin: 2 });
    embers(fx, x, y, C.fire, 30, 1.5);
    S.play('rebirth');
  },
};
