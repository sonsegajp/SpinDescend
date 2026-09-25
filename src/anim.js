// anim.js - authored animation clips (.sda, exported from the Blender rigs) and
// a small animator: play / queue / crossfade, sampled into per-part matrices.
//
// SDA1: 'SDA1' u32 nparts u32 nclips | part names char[32]
//       clip: char name[32] u32 frames f32 fps u32 loop | frames*nparts*12 f32
//       (3x4 column-major deform matrix per part, model space, engine axes)
const dec = new TextDecoder();
const cstr = (u8) => { let n = u8.indexOf(0); if (n < 0) n = u8.length; return dec.decode(u8.subarray(0, n)); };

export function parseSDA(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  if (cstr(u8.subarray(0, 4)) !== 'SDA1') throw new Error('bad sda');
  const np = dv.getUint32(4, true), nc = dv.getUint32(8, true);
  let o = 12;
  const parts = [];
  for (let i = 0; i < np; i++) { parts.push(cstr(u8.subarray(o, o + 32))); o += 32; }
  const clips = {};
  for (let c = 0; c < nc; c++) {
    const name = cstr(u8.subarray(o, o + 32));
    const frames = dv.getUint32(o + 32, true), fps = dv.getFloat32(o + 36, true), loop = !!dv.getUint32(o + 40, true);
    o += 44;
    const n = frames * np * 12;
    const data = new Float32Array(buf.slice(o, o + n * 4));
    o += n * 4;
    clips[name] = { name, frames, fps, loop, data, dur: frames / fps };
  }
  return { parts, clips };
}

function sampleInto(clip, t, np, out) {
  let f = t * clip.fps;
  if (clip.loop) f = ((f % clip.frames) + clip.frames) % clip.frames;
  else f = Math.min(Math.max(f, 0), clip.frames - 1);
  const f0 = Math.floor(f), f1 = clip.loop ? (f0 + 1) % clip.frames : Math.min(f0 + 1, clip.frames - 1);
  const k = f - f0, d = clip.data;
  const a = f0 * np * 12, b = f1 * np * 12;
  for (let i = 0; i < np * 12; i++) out[i] = d[a + i] + (d[b + i] - d[a + i]) * k;
}

export class Animator {
  // model: gl Model (for part order), anim: parsed SDA
  constructor(model, anim) {
    this.model = model;
    this.anim = anim;
    this.np = anim.parts.length;
    this.map = model.parts.map(p => anim.parts.indexOf(p.name));   // model part -> anim part
    this.cur = null; this.prev = null;
    this.t = 0; this.pt = 0; this.fade = 0; this.fadeDur = 0;
    this.speed = 1;
    this.bufA = new Float32Array(this.np * 12);
    this.bufB = new Float32Array(this.np * 12);
    this.queue = null;
  }

  has(name) { return !!this.anim.clips[name]; }

  // opts: { fade, speed, then: 'idle' | null, at: startTime, onEnd }
  play(name, opts = {}) {
    const clip = this.anim.clips[name];
    if (!clip) return;
    if (this.cur && opts.fade !== 0) { this.prev = this.cur; this.pt = this.t; this.fade = 0; this.fadeDur = opts.fade ?? 0.12; }
    else { this.prev = null; }
    this.cur = clip;
    this.t = opts.at || 0;
    this.speed = opts.speed || 1;
    this.then = opts.then === undefined ? (clip.loop ? null : 'idle') : opts.then;
    this.onEnd = opts.onEnd || null;
  }

  get name() { return this.cur ? this.cur.name : ''; }
  get done() { return this.cur && !this.cur.loop && this.t >= this.cur.dur; }

  update(dt) {
    if (!this.cur) return;
    this.t += dt * this.speed;
    if (this.prev) { this.pt += dt; this.fade += dt; if (this.fade >= this.fadeDur) this.prev = null; }
    if (!this.cur.loop && this.t >= this.cur.dur) {
      const cb = this.onEnd;
      this.onEnd = null;
      if (this.then) this.play(this.then, { fade: 0.18 });
      if (cb) cb();
    }
  }

  // per model part: Float32Array(16) deform matrix (model space)
  matrices() {
    const out = [];
    if (!this.cur) return null;
    sampleInto(this.cur, this.t, this.np, this.bufA);
    let w = 0;
    if (this.prev) {
      sampleInto(this.prev, this.pt, this.np, this.bufB);
      w = 1 - Math.min(1, this.fade / Math.max(this.fadeDur, 1e-3));
    }
    for (let i = 0; i < this.model.parts.length; i++) {
      const j = this.map[i];
      const m = new Float32Array(16);
      m[15] = 1;
      if (j < 0) { m[0] = m[5] = m[10] = 1; out.push(m); continue; }
      const o = j * 12;
      for (let k = 0; k < 12; k++) {
        const v = w ? this.bufA[o + k] * (1 - w) + this.bufB[o + k] * w : this.bufA[o + k];
        const col = Math.floor(k / 3), row = k % 3;
        m[col * 4 + row] = v;
      }
      out.push(m);
    }
    return out;
  }
}
