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

export class FX {
  constructor() {
    this.parts = [];
    this.shots = [];
    this.flashes = [];
  }

  clear() { this.parts = []; this.shots = []; this.flashes = []; }

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

  ring(x, y, r0, r1, dur, col, w = 2, add = true) {
    this.parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: dur, size: r0, size1: r1, shape: 'ring', col, add,
                      rot: 0, vr: 0, alpha: 1, w });
  }

  glow(x, y, r, dur, col, grow = 1.6) {
    this.parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: dur, size: r, size1: r * grow, shape: 'glow', col,
                      add: true, rot: 0, vr: 0, alpha: 1 });
  }

  bolt(x0, y0, x1, y1, dur, col, w = 2) {                // jagged lightning, re-rolled every frame
    this.parts.push({ x: x0, y: y0, x1, y1, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: dur, size: w, size1: w,
                      shape: 'bolt', col, add: true, rot: 0, vr: 0, alpha: 1 });
  }

  slash(x, y, ang, len, dur, col, w = 3) {                // a crescent swipe across the target
    this.parts.push({ x, y, vx: 0, vy: 0, g: 0, drag: 0, t: 0, life: dur, size: len, size1: len * 1.15, shape: 'slash',
                      col, add: true, rot: ang, vr: 0, alpha: 1, w });
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
  }

  // ---------------------------------------------------------------- drawing
  draw(g, W, H) {
    for (const f of this.flashes) {
      g.globalAlpha = f.a * (1 - f.t / f.dur);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = f.col; g.fillRect(0, 0, W, H);
    }
    g.globalCompositeOperation = 'source-over';
    for (const p of this.parts) this.drawPart(g, p);
    for (const s of this.shots) this.drawShot(g, s);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
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
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
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
        const w = p.w * (1 - k * 0.6);
        g.globalAlpha *= 0.35; g.lineWidth = w * 3.5;
        g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.stroke();
        g.globalAlpha /= 0.35; g.lineWidth = w; g.strokeStyle = '#ffffff';
        g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.stroke(); break;
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
      case 'slash': {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        const sweep = Math.min(1, k * 3.5);
        g.lineCap = 'round';
        for (const [wm, al] of [[p.w * 2.4, 0.35], [p.w, 1]]) {
          g.globalAlpha = Math.max(0, a * al);
          g.lineWidth = wm * (1 - k * 0.7);
          g.beginPath();
          g.arc(0, s * 0.9, s, -Math.PI / 2 - 0.9, -Math.PI / 2 - 0.9 + 1.8 * sweep);
          g.stroke();
        }
        g.restore(); break;
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

const SLASHES = (fx, x, y, n, col, len = 26, w = 3) => {
  for (let i = 0; i < n; i++) fx.slash(x + R(-6, 6), y + R(-6, 6), R(-0.6, 0.6) + (i % 2 ? Math.PI : 0) + 0.8, len, 0.32, pick(col), w);
};

export const RECIPES = {
  sword: blade({ hit(fx, x, y, S, I) { SLASHES(fx, x, y, 1, C.steel); sparks(fx, x, y, C.steel, 12); S.play('slash'); } }),
  sword2: blade({ hit(fx, x, y, S, I) { SLASHES(fx, x, y, 2, C.steel, 30); sparks(fx, x, y, C.steel, 18); S.play('slash2'); } }),
  sword3: blade({
    col: C.gold,
    hit(fx, x, y, S, I) { SLASHES(fx, x, y, 2, C.gold, 32, 4); sparks(fx, x, y, C.gold, 20); stars(fx, x, y, C.gold, 6); S.play('shing'); },
  }),
  sword4: blade({
    col: C.gold, head: { r: 10, col: 'rgba(255,210,74,0.6)' },
    hit(fx, x, y, S, I) {
      SLASHES(fx, x, y, 2, C.gold, 34, 4);
      fx.burst(x, y, { n: 14, speed: [60, 160], life: [0.6, 1.0], size: [3, 5], shape: 'coin', col: C.gold, g: 320, spin: 2 });
      S.play('fortune');
    },
  }),
  dagger: blade({
    travel: 0.18, arc: 6, spin: 0, point: Math.PI / 4, col: C.poison,
    hit(fx, x, y, S, I) {
      sparks(fx, x, y, C.steel, 8, [60, 140]);
      fx.burst(x, y, { n: 12, speed: [10, 40], life: [0.6, 1.1], size: [1.5, 3], shape: 'bubble', col: C.poison, g: -50, jx: 12 });
      S.play('stab');
    },
  }),
  spear: blade({
    travel: 0.16, arc: 0, spin: 0, point: Math.PI / 4, scale: 1.3,
    trail: { shape: 'spark', col: C.silver, speed: [2, 8], life: [0.2, 0.35], add: true, len: 0.08, w: 2 }, rate: 120,
    hit(fx, x, y, S, I) { sparks(fx, x, y, C.silver, 16, [120, 260], -Math.PI / 2, 1.2); fx.ring(x, y, 4, 24, 0.25, '#e8eef8'); S.play('thrust'); },
  }),
  axe: blade({
    spin: 26, arc: 40, scale: 1.25, trail: { shape: 'px', col: C.wood, speed: [5, 30], life: [0.2, 0.4], size: [1, 2] },
    hit(fx, x, y, S, I) {
      SLASHES(fx, x, y, 1, ['#ffd0b0'], 34, 5);
      fx.burst(x, y, { n: 14, speed: [80, 200], life: [0.4, 0.8], size: [2, 4], shape: 'shard', col: C.wood, g: 380, spin: 3 });
      if (I.pierce) { fx.burst(x, y, { n: 10, speed: [60, 160], life: [0.3, 0.6], size: [2, 4], shape: 'shard', col: C.silver, g: 300 }); }
      S.shake(0.5); S.play('chop');
    },
  }),
  knives: {
    target: 'enemy', travel: 0.2,
    launch(fx, a, b, S) {
      for (let i = 0; i < 2; i++) {
        setTimeout(() => S.play('throw'), i * 90);
        fx.shot({ from: [a[0] + (i ? 8 : -8), a[1]], to: [b[0] + (i ? 10 : -10), b[1] + (i ? 6 : -6)], dur: 0.2 + i * 0.08, arc: 10,
                  img: S.icon, spin: 30, scale: 0.8, trail: { shape: 'spark', col: C.steel, speed: [3, 10], life: [0.12, 0.2], add: true } });
      }
    },
    impact(fx, x, y, S, I) {
      sparks(fx, x - 8, y - 6, C.steel, 8); setTimeout(() => { sparks(fx, x + 8, y + 6, C.steel, 8); S.play('stab'); }, 80); S.play('stab');
    },
  },
  hammer: blade({
    spin: 12, arc: 70, scale: 1.3, travel: 0.34, ease: k => k * k,
    hit(fx, x, y, S, I) {
      fx.ring(x, y, 6, 46, 0.35, '#ffe8a0', 3); fx.ring(x, y, 4, 30, 0.3, '#ffffff', 2);
      fx.burst(x, y + 10, { n: 16, speed: [60, 140], life: [0.3, 0.6], size: [2, 3.5], col: ['#b8a890', '#8a7a66'], g: 300, dir: -Math.PI / 2, spread: 1.3 });
      if (I.stun) for (let i = 0; i < 5; i++) {
        fx.burst(x + Math.cos(i * 1.26) * 18, y - 26 + Math.sin(i * 1.26) * 5, { n: 1, speed: [0, 1], life: [1.0, 1.2], size: [2.5, 2.5], shape: 'star', col: '#ffe070', add: true });
      }
      S.shake(0.8); S.play(I.stun ? 'stun' : 'bonk');
    },
  }),
  crossbow: blade({
    travel: 0.12, arc: 0, spin: 0, point: Math.PI / 4, scale: 1.0,
    trail: { shape: 'spark', col: ['#ffe8c0', '#fff'], speed: [1, 4], life: [0.15, 0.25], add: true, len: 0.1 }, rate: 140, launchSfx: 'twang',
    hit(fx, x, y, S, I) {
      sparks(fx, x, y, ['#ffe8c0', '#fff'], 10, [100, 220]);
      if (I.crit) { fx.ring(x, y, 3, 30, 0.3, '#ffea4a', 3); stars(fx, x, y, C.gold, 8); }
      S.play('thunk');
    },
  }),
  flail: blade({
    spin: 20, arc: 50, scale: 1.2, trail: { shape: 'px', col: ['#8a8a94', '#c8c8d0'], speed: [0, 5], life: [0.25, 0.35], size: [1, 1.5] }, rate: 90,
    hit(fx, x, y, S, I) {
      fx.burst(x, y, { n: 10 + I.dmg * 4, speed: [80, 220], life: [0.3, 0.6], size: [1.5, 3], shape: 'spark', col: ['#fff', '#ffd08a'], add: true, drag: 3 });
      fx.ring(x, y, 4, 14 + I.dmg * 6, 0.3, '#fff0c8', 2);
      puff(fx, x, y + 12, C.smoke, 6);
      S.play('clank');
    },
  }),
  flame: blade({
    head: { r: 12, col: 'rgba(255,120,30,0.8)', core: '#fff4c0' }, spin: 10, scale: 0.9, rate: 110,
    trail: { col: C.fire, speed: [5, 30], life: [0.25, 0.5], size: [1.5, 3.5], add: true, g: -80 }, launchSfx: 'fireball',
    hit(fx, x, y, S, I) {
      fx.glow(x, y, 34, 0.4, 'rgba(255,130,30,1)', 1.8);
      fx.burst(x, y, { n: 8, speed: [20, 60], life: [0.3, 0.6], size: [5, 8], grow: 1.7, shape: 'glow', col: ['rgba(255,150,40,0.9)', 'rgba(255,80,20,0.9)'], g: -90 });
      fx.burst(x, y, { n: 30, speed: [40, 160], life: [0.4, 0.9], size: [2, 4], col: C.fire, add: true, g: -120, drag: 2 });
      embers(fx, x, y, C.fire, 20);
      S.play('burn');
    },
  }),
  scythe: blade({
    spin: 22, arc: 20, col: C.dark, scale: 1.3,
    trail: { shape: 'smoke', col: ['#4a2a8a', '#2a1a4a'], speed: [2, 12], life: [0.3, 0.5], size: [2, 4], grow: 1.8, alpha: 0.5 },
    hit(fx, x, y, S, I) {
      fx.slash(x, y, 2.4, 40, 0.4, '#c8a0ff', 4);
      fx.burst(x, y, { n: 16, speed: [20, 80], life: [0.6, 1.1], size: [3, 6], grow: 1.8, shape: 'smoke', col: C.dark, g: -40, alpha: 0.7 });
      if (I.execute) {
        fx.flash('#6a2aa8', 0.35, 0.55); fx.ring(x, y, 6, 70, 0.5, '#c8a0ff', 4);
        fx.burst(x, y, { n: 20, speed: [30, 120], life: [0.8, 1.4], size: [1.5, 3], shape: 'star', col: C.dark, add: true, g: -50 });
        S.play('reap');
      } else S.play('scythe');
    },
  }),
  dawnblade: blade({
    col: C.holy, head: { r: 9, col: 'rgba(140,210,255,0.7)' },
    hit(fx, x, y, S, I) {
      SLASHES(fx, x, y, 2, C.holy, 34, 4);
      sparks(fx, x, y, C.holy, 20);
      stars(fx, x, y, ['#ffe84a', '#fff6c0'], 6);
      S.play(I.beam ? 'beam' : 'holy');
    },
    launchSfx: 'whoosh',
  }),
  slabcleaver: blade({
    spin: 8, arc: 24, scale: 1.5, travel: 0.3,
    hit(fx, x, y, S, I) {
      if (I.limit) {
        fx.flash('#ffffff', 0.3, 0.7);
        for (let i = 0; i < 3; i++) fx.slash(x, y, 0.4 + i * 2.1, 60, 0.5, pick(['#ffffff', '#ffd08a', '#ff8a3a']), 7);
        fx.ring(x, y, 8, 90, 0.5, '#ffb04a', 5);
        fx.burst(x, y, { n: 40, speed: [100, 300], life: [0.4, 0.9], shape: 'spark', col: C.orange, add: true, drag: 2.5, len: 0.05, w: 2 });
        S.shake(1.4); S.play('limit');
      } else {
        fx.slash(x, y, 0.8, 46, 0.35, '#ffffff', 6);
        sparks(fx, x, y, C.silver, 22, [100, 260]);
        S.shake(0.7); S.play('heavy');
      }
    },
  }),
  wyrmbreaker: blade({
    spin: 6, arc: 60, scale: 1.7, travel: 0.36, ease: k => k * k,
    trail: { shape: 'px', col: ['#3a3438', '#5a4c50'], speed: [0, 10], life: [0.3, 0.5], size: [2, 3] },
    hit(fx, x, y, S, I) {
      fx.flash('#8a1a1a', 0.3, 0.4);
      fx.slash(x, y, 0.9, 56, 0.4, '#e8d0c8', 8);
      fx.burst(x, y, { n: 30, speed: [80, 240], life: [0.4, 0.9], size: [2, 4.5], shape: 'shard', col: ['#8a1a1a', '#3a3438', '#c8b8b0'], g: 420, spin: 3 });
      fx.burst(x, y, { n: 14, speed: [20, 70], life: [0.6, 1.0], size: [4, 8], grow: 2, shape: 'smoke', col: C.smoke, alpha: 0.6 });
      S.shake(1.6); S.play('slab');
    },
  }),
  picklock: blade({
    spin: 18, arc: 34, col: C.gold, head: { r: 8, col: 'rgba(255,230,120,0.6)' },
    trail: { shape: 'star', col: ['#fff6c0', '#ffe84a', '#fff'], speed: [4, 20], life: [0.3, 0.5], size: [1, 2], add: true }, rate: 50,
    hit(fx, x, y, S, I) {
      SLASHES(fx, x, y, 1, C.gold, 30, 4);
      fx.burst(x, y, { n: 12, speed: [60, 160], life: [0.3, 0.6], size: [1.5, 2.5], shape: 'shard', col: ['#ffd24a', '#fff6c0', '#c89a30'], add: true, drag: 2 });  // tumblers
      fx.ring(x, y, 3, 16, 0.2, '#ffe070', 2);
      stars(fx, x, y, ['#fff6c0', '#ffe84a'], 10);
      S.play('picklock');
    },
  }),
  whisperblade: {
    target: 'enemy', travel: 0.14,
    launch(fx, a, b, S) {
      S.play('whoosh');
      fx.shot({ from: a, to: b, dur: 0.14, arc: 0, img: S.icon, point: Math.PI / 4, scale: 1.3,
                trail: { shape: 'spark', col: C.silver, speed: [1, 4], life: [0.2, 0.3], add: true, len: 0.1 }, rate: 150 });
    },
    impact(fx, x, y, S, I) {
      for (let i = 0; i < 3; i++) setTimeout(() => {
        fx.slash(x + R(-10, 10), y + R(-10, 10), R(0, TAU), 36, 0.28, '#ffffff', 3);
        sparks(fx, x, y, C.silver, 8, [120, 240]);
        S.play('shing');
      }, i * 90);
      fx.burst(x, y, { n: 16, speed: [40, 110], life: [0.9, 1.5], size: [1.5, 2.5], shape: 'leaf', col: ['#c8f0d8', '#8ad8b0', '#ffffff'], g: 20, spin: 3, drag: 1.5 });  // a gust of leaves
    },
  },
  powder_saber: blade({
    hit(fx, x, y, S, I) {
      SLASHES(fx, x, y, 1, C.steel, 32, 4);
      if (I.trigger) {
        fx.glow(x, y, 22, 0.18, 'rgba(255,220,120,1)', 1.3);
        fx.burst(x, y, { n: 18, speed: [120, 300], life: [0.15, 0.3], shape: 'spark', col: ['#fff', '#ffe08a'], add: true, len: 0.04 });
        puff(fx, x, y, C.smoke, 10);
        S.shake(0.6); S.play('powder');
      } else { sparks(fx, x, y, C.steel, 14); S.play('slash2'); }
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

// ---------------------------------------------------------------- status / event effects
export const EVENTS = {
  miss(fx, x, y, S) { fx.burst(x, y, { n: 8, speed: [120, 200], life: [0.15, 0.25], shape: 'spark', col: '#c8c8d8', dir: 0, spread: 0.2, add: true, len: 0.06 }); S.play('miss'); },
  block(fx, x, y, S) { sparks(fx, x, y, ['#ffffff', '#b8c8ff'], 10, [80, 180]); fx.ring(x, y, 3, 16, 0.2, '#b8c8ff', 2); S.play('clank'); },
  crit(fx, x, y, S) { fx.ring(x, y, 4, 40, 0.3, '#ffea4a', 3); stars(fx, x, y, ['#ffea4a', '#ffffff'], 10); fx.flash('#ffffff', 0.12, 0.3); },
  burnTick(fx, x, y, S) { fx.burst(x, y, { n: 16, speed: [20, 60], life: [0.5, 0.9], size: [2, 3.5], col: C.fire, add: true, g: -120, jx: 16, jy: 12 }); S.play('burn'); },
  poisonTick(fx, x, y, S) { fx.burst(x, y, { n: 14, speed: [10, 40], life: [0.6, 1.0], size: [1.5, 3], shape: 'bubble', col: C.poison, g: -60, jx: 18, jy: 12 }); S.play('poison'); },
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
  rebirth(fx, x, y, S) {
    fx.flash('#ff8a3a', 0.5, 0.6);
    fx.glow(x, y, 50, 0.9, 'rgba(255,150,60,1)', 1.5);
    fx.burst(x, y, { n: 40, speed: [30, 160], life: [0.8, 1.5], size: [2, 4], shape: 'feather', col: C.fire, add: true, g: -80, spin: 2 });
    embers(fx, x, y, C.fire, 30, 1.5);
    S.play('rebirth');
  },
};
