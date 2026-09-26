// cards.js - 3D upgrade cards (card mesh + concept card art) for loot rewards,
// the merchant, and the title's character plate. Cards fly in face-down, flip,
// hover-tilt toward the pointer, and fly into the reels when chosen.
import { gl, texFromImage } from './gl.js?v=20260926035407';
import { perspective, lookAt, mul, trs, xform, easeOutBack, easeOut, clamp } from './math.js?v=20260926035407';

export class CardView {
  constructor(renderer, assets) {
    this.r = renderer;
    this.assets = assets;
    this.model = assets.models.card;
    this.front = new Map();
    this.cards = [];
    this.active = false;
    this.time = 0;
  }

  frontTex(id) {
    let t = this.front.get(id);
    if (!t) {
      const img = this.assets.cards[id];
      t = texFromImage(img, { nearest: false, repeat: false, mips: true });
      this.front.set(id, t);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    return t;
  }

  layout(W, H, slot, band, scale) {
    this.W = W; this.H = H;
    const aspect = W / H;
    this.fov = 30 * Math.PI / 180;
    this.proj = perspective(this.fov, aspect, 0.1, 50);
    this.view = lookAt([0, 0, 4.2], [0, 0, 0]);
    // cards sit in the region above the slot machine
    const hh = 4.2 * Math.tan(this.fov / 2);
    const topFrac = slot ? slot.screenTop / H : 0.55;
    // free area: below the header text (~17% of the screen) down to the machine top
    const [areaTop, areaBot] = band || [0.155, topFrac + 0.03];   // cards may overlap the machine's top edge
    this.centerY = hh * (1 - (areaTop + areaBot));
    this.cardScale = scale || Math.min(1.2, (hh * 2 * (areaBot - areaTop) * 0.92) / 0.96);
    this.hw = hh * aspect;
    this.hh = hh;
  }

  // entries: [{ id, price? , label? }]
  // side: 0 = centred, -1 = packed into the left half of the screen (the merchant stands on the right)
  show(entries, now, from = 'below', side = 0) {
    const n = entries.length;
    const gap = 0.7 * this.cardScale;
    const shift = side < 0 ? -this.hw * 0.5 : 0;
    this.cards = entries.map((e, i) => ({
      ...e, x: (i - (n - 1) / 2) * gap + shift, t0: now + i * 0.12, hover: 0, picked: false, pickT: 0, gone: false,
      from,
    }));
    this.active = true;
    this.pickedIndex = -1;
  }

  hide() { this.active = false; this.cards = []; }

  // where card i's centre sits, as fractions of the screen - effects burst from here
  screenFrac(i) {
    const c = this.cards[i];
    if (!c) return [0.5, 0.5];
    const aspect = this.W / this.H;
    return [0.5 + (c.x / (this.hh * aspect)) * 0.5, 0.5 - (this.centerY / this.hh) * 0.5];
  }

  pick(i, now) {
    const c = this.cards[i];
    if (!c || c.picked) return;
    c.picked = true;
    c.pickT = now;
    this.pickedIndex = i;
  }

  cardMatrix(c, now) {
    const t = clamp((now - c.t0) / 0.55, 0, 1);
    const e = easeOutBack(t);
    let y = this.centerY + (c.from === 'below' ? -2.4 : 0) * (1 - e);
    let x = c.x, z = -1.5 * (1 - e), ry = Math.PI * (1 - easeOut(clamp((now - c.t0 - 0.2) / 0.5, 0, 1)));
    let s = this.cardScale * (1 + 0.06 * c.hover);
    let rx = 0, rz = 0;
    // idle float + hover tilt toward the pointer
    y += Math.sin(now * 1.6 + c.x * 3) * 0.02;
    if (c.hover > 0 && this.pointer) {
      ry += (this.pointer[0] - c.sx) / this.W * 1.4 * c.hover;
      rx += (this.pointer[1] - c.sy) / this.H * 1.6 * c.hover;
    }
    if (c.picked) {
      const p = clamp((now - c.pickT) / 0.6, 0, 1);
      const q = easeOut(p);
      y = y + q * 0.35 - (p > 0.45 ? (p - 0.45) * 5.5 : 0);
      s *= 1 + 0.15 * Math.sin(Math.min(p, 0.45) / 0.45 * Math.PI) - (p > 0.45 ? (p - 0.45) * 1.5 : 0);
      rz = q * 0.2;
      if (p >= 1) c.gone = true;
    }
    return trs(x, y, z, ry, rx, rz, Math.max(s, 0.01));
  }

  update(now, pointer) {
    this.time = now;
    this.pointer = pointer;
    const vp = mul(this.proj, this.view);
    let hoverIdx = -1;
    for (const [i, c] of this.cards.entries()) {
      const m = this.cardMatrix(c, now);
      const mvp = mul(vp, m);
      const pts = [[-0.288, -0.48], [0.288, -0.48], [0.288, 0.48], [-0.288, 0.48]].map(([x, y]) => {
        const p = xform(mvp, x, y, 0);
        return [(p[0] * 0.5 + 0.5) * this.W, (1 - (p[1] * 0.5 + 0.5)) * this.H];
      });
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      c.rect = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      c.sx = c.rect.x + c.rect.w / 2; c.sy = c.rect.y + c.rect.h / 2;
      const inside = pointer && !c.picked && pointer[0] >= c.rect.x && pointer[0] <= c.rect.x + c.rect.w &&
        pointer[1] >= c.rect.y && pointer[1] <= c.rect.y + c.rect.h && now - c.t0 > 0.6;
      if (inside) hoverIdx = i;
    }
    if (this.keyFocus !== undefined && this.keyFocus >= 0 && hoverIdx < 0) hoverIdx = this.keyFocus;
    for (const [i, c] of this.cards.entries()) c.hover += ((i === hoverIdx ? 1 : 0) - c.hover) * 0.25;
    this.hoverIdx = hoverIdx;
    return hoverIdx;
  }

  draw(now) {
    if (!this.active) return;
    const R = this.r;
    gl.clear(gl.DEPTH_BUFFER_BIT);
    R.begin({
      proj: this.proj, view: this.view, cam: [0, 0, 4.2], ambient: [0.78, 0.76, 0.74],
      dir: { dir: [0.3, -0.4, -1], col: [0.32, 0.3, 0.26] }, fog: false, bands: 0, time: now, lights: [],
    });
    for (const c of this.cards) {
      if (c.gone || now < c.t0) continue;
      const tex = this.frontTex(c.id);
      const glow = c.hover > 0.05 ? [1 + 0.12 * c.hover, 1 + 0.12 * c.hover, 1 + 0.12 * c.hover] : [1, 1, 1];
      R.drawModel(this.model, this.cardMatrix(c, now), { texOverride: { '@card_front': tex }, tint: glow });
    }
  }
}
