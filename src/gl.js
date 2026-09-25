// gl.js - WebGL2 plumbing: shaders, textures, the .sdm model format, static batching.
import { ident, mul, translate, rotX, rotY, rotZ, scale } from './math.js?v=20260925194320';

export let gl = null;

export function initGL(canvas) {
  gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  gl.enable(gl.DEPTH_TEST);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  return gl;
}

// ------------------------------------------------------------------ shaders
export function program(vsSrc, fsSrc) {
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const locs = {};
  return {
    p,
    use() { gl.useProgram(p); return this; },
    u(name) { if (!(name in locs)) locs[name] = gl.getUniformLocation(p, name); return locs[name]; },
  };
}

// ------------------------------------------------------------------ textures
export function texFromImage(img, { nearest = true, repeat = true, mips = false } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  setTexParams(nearest, repeat, mips);
  return t;
}

function setTexParams(nearest, repeat, mips) {
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER,
    mips ? (nearest ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR_MIPMAP_LINEAR) : (nearest ? gl.NEAREST : gl.LINEAR));
  const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
}

export function updateTex(t, canvas, { nearest = false, mips = true, repeat = true } = {}) {
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  setTexParams(nearest, repeat, mips);
}

export function solidTex(r, g, b, a = 255) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([r, g, b, a]));
  setTexParams(true, true, false);
  return t;
}

// ------------------------------------------------------------------ .sdm models
// SDM1: 'SDM1' u32 nparts u32 nsections | parts: name[32] i32 parent f32 pivot[3]
// sections: u32 part, tex[32], u32 nverts, u32 nidx, verts (40 bytes each), u32 idx[]
export const STRIDE = 40;
const dec = new TextDecoder();
const cstr = (u8) => { let n = u8.indexOf(0); if (n < 0) n = u8.length; return dec.decode(u8.subarray(0, n)); };

export function parseSDM(buf) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  if (cstr(u8.subarray(0, 4)) !== 'SDM1') throw new Error('bad sdm');
  const np = dv.getUint32(4, true), ns = dv.getUint32(8, true);
  let o = 12;
  const parts = [];
  for (let i = 0; i < np; i++) {
    parts.push({ name: cstr(u8.subarray(o, o + 32)), parent: dv.getInt32(o + 32, true),
      pivot: [dv.getFloat32(o + 36, true), dv.getFloat32(o + 40, true), dv.getFloat32(o + 44, true)] });
    o += 48;
  }
  const sections = [];
  const min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < ns; i++) {
    const part = dv.getUint32(o, true);
    const tex = cstr(u8.subarray(o + 4, o + 36));
    const nv = dv.getUint32(o + 36, true), ni = dv.getUint32(o + 40, true);
    o += 44;
    const verts = buf.slice(o, o + nv * STRIDE);
    o += nv * STRIDE;
    const idx = new Uint32Array(buf.slice(o, o + ni * 4));
    o += ni * 4;
    const f = new Float32Array(verts);
    for (let v = 0; v < nv; v++) {
      for (let k = 0; k < 3; k++) {
        const c = f[v * 10 + k];
        if (c < min[k]) min[k] = c;
        if (c > max[k]) max[k] = c;
      }
    }
    sections.push({ part, tex, nv, verts, idx });
  }
  return { parts, sections, min, max };
}

export function makeVAO(vertsBuf, idx) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, vertsBuf, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE, 24);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, STRIDE, 32);
  gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, STRIDE, 36);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: idx.length, vb, ib };
}

export class Model {
  constructor(name, data) {
    this.name = name;
    this.parts = data.parts;
    this.min = data.min; this.max = data.max;
    this.raw = data.sections;
    this.sections = data.sections.map(s => ({ part: s.part, tex: s.tex, ...makeVAO(s.verts, s.idx) }));
    this.partIndex = {};
    this.parts.forEach((p, i) => { this.partIndex[p.name] = i; });
    this.height = this.max[1] - this.min[1];
  }

  // pose: { partName: { rx, ry, rz, s, tx, ty, tz } } -> per-part matrices (model space)
  partMatrices(pose) {
    const out = new Array(this.parts.length);
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      const q = pose && pose[p.name];
      let local = ident();
      if (q) {
        const [px, py, pz] = p.pivot;
        local = translate(px + (q.tx || 0), py + (q.ty || 0), pz + (q.tz || 0));
        if (q.ry) local = mul(local, rotY(q.ry));
        if (q.rx) local = mul(local, rotX(q.rx));
        if (q.rz) local = mul(local, rotZ(q.rz));
        if (q.s !== undefined && q.s !== 1) local = mul(local, scale(q.s, q.sy ?? q.s, q.s));
        local = mul(local, translate(-px, -py, -pz));
      }
      out[i] = p.parent >= 0 ? mul(out[p.parent], local) : local;
    }
    return out;
  }
}

// ------------------------------------------------------------------ static batching
// Merge many (model, matrix) placements into one vertex/index stream per texture.
export class Batcher {
  constructor() { this.groups = new Map(); }

  add(model, m, skipParts = null) {
    const n3 = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
    for (const s of model.raw) {
      if (skipParts && skipParts.has(model.parts[s.part].name)) continue;
      let g = this.groups.get(s.tex);
      if (!g) { g = { chunks: [], nverts: 0, nidx: 0, idx: [] }; this.groups.set(s.tex, g); }
      const src = new Float32Array(s.verts);
      const dst = new Float32Array(s.verts.slice(0));
      for (let v = 0; v < s.nv; v++) {
        const b = v * 10;
        const x = src[b], y = src[b + 1], z = src[b + 2];
        dst[b] = m[0] * x + m[4] * y + m[8] * z + m[12];
        dst[b + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        dst[b + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        const nx = src[b + 3], ny = src[b + 4], nz = src[b + 5];
        dst[b + 3] = n3[0] * nx + n3[3] * ny + n3[6] * nz;
        dst[b + 4] = n3[1] * nx + n3[4] * ny + n3[7] * nz;
        dst[b + 5] = n3[2] * nx + n3[5] * ny + n3[8] * nz;
      }
      const base = g.nverts;
      const idx = new Uint32Array(s.idx.length);
      for (let i = 0; i < s.idx.length; i++) idx[i] = s.idx[i] + base;
      g.chunks.push(dst.buffer);
      g.idx.push(idx);
      g.nverts += s.nv;
      g.nidx += idx.length;
    }
  }

  build() {
    const out = [];
    for (const [tex, g] of this.groups) {
      const vb = new Uint8Array(g.nverts * STRIDE);
      let o = 0;
      for (const c of g.chunks) { vb.set(new Uint8Array(c), o); o += c.byteLength; }
      const ib = new Uint32Array(g.nidx);
      o = 0;
      for (const c of g.idx) { ib.set(c, o); o += c.length; }
      out.push({ tex, ...makeVAO(vb, ib) });
    }
    return out;
  }
}
