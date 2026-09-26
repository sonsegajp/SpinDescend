// render.js - the forward renderer: lit/baked/emissive materials, point lights,
// fog, banded lighting for the pixel-art look, sky, and model/batch drawing.
// PS1 look (world pass only): vertices snap to a coarse screen grid (wobble),
// textures blend toward affine mapping (warp) and colour is dithered to 15 bit.
import { gl, program, texFromImage, solidTex } from './gl.js?v=20260926072615';
import { ident, mul } from './math.js?v=20260926072615';

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
layout(location=3) in vec4 aCol;
layout(location=4) in vec4 aExtra;
uniform mat4 uModel, uView, uProj;
uniform vec2 uSnap;
out vec3 vWorld; out vec3 vNrm; out vec2 vUV; out vec4 vCol; out vec2 vExtra; out vec3 vUVa;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNrm = mat3(uModel) * aNrm;
  vUV = aUV; vCol = aCol; vExtra = aExtra.xy;
  vec4 p = uProj * uView * w;
  if (uSnap.x > 0.0 && p.w > 0.0) {
    vec2 s = uSnap * 0.5;
    p.xy = floor(p.xy / p.w * s + 0.5) / s * p.w;
  }
  vUVa = vec3(aUV * p.w, p.w);
  gl_Position = p;
}`;

const FS = `#version 300 es
precision highp float;
in vec3 vWorld; in vec3 vNrm; in vec2 vUV; in vec4 vCol; in vec2 vExtra; in vec3 vUVa;
uniform sampler2D uTex;
uniform float uAffine, uDither;
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
uniform vec3 uCamPos, uAmbient, uFogColor, uDirDir, uDirCol;
uniform vec2 uFog;
uniform int uNumLights;
uniform vec4 uLightPos[16];
uniform vec4 uLightCol[16];
uniform vec4 uTint;
uniform vec4 uFlash;
uniform float uTime, uBands, uFogOn;
out vec4 frag;
void main() {
  vec2 uv = uAffine > 0.0 ? mix(vUV, vUVa.xy / vUVa.z, uAffine) : vUV;
  vec4 base = texture(uTex, uv) * vCol * vec4(uTint.rgb, 1.0);
  if (base.a < 0.5) discard;
  vec3 n = normalize(vNrm);
  if (!gl_FrontFacing) n = -n;
  vec3 light = uAmbient + uDirCol * max(dot(n, -uDirDir), 0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= uNumLights) break;
    vec3 d = uLightPos[i].xyz - vWorld;
    float dist = length(d);
    float att = clamp(1.0 - dist / uLightPos[i].w, 0.0, 1.0);
    att *= att;
    float nd = max(dot(n, d / max(dist, 1e-4)), 0.0) * 0.72 + 0.28;
    light += uLightCol[i].rgb * att * nd;
  }
  if (uBands > 0.0) light = floor(light * uBands + 0.5) / uBands;
  float unlit = vExtra.y;
  vec3 litc = base.rgb * light;
  float lum = max(dot(light, vec3(0.3333)), 1e-3);
  vec3 bakedc = base.rgb * mix(vec3(1.0), light / lum, 0.3) * clamp(lum * 1.6, 0.66, 1.2);
  vec3 col = mix(litc, bakedc, unlit);
  float emit = vExtra.x;
  float flick = 0.86 + 0.14 * sin(uTime * 13.0 + vWorld.x * 7.1 + vWorld.z * 5.3) * sin(uTime * 7.3 + vWorld.y * 3.0);
  col = mix(col, base.rgb * 1.45 * flick, emit);
  float fd = length(vWorld - uCamPos);
  float f = clamp((fd - uFog.x) / (uFog.y - uFog.x), 0.0, 1.0) * uFogOn;
  col = mix(col, uFogColor, f * (1.0 - emit * 0.5));
  col = mix(col, uFlash.rgb, uFlash.a);
  if (uDither > 0.0) {
    ivec2 q = ivec2(gl_FragCoord.xy) & 3;
    float b = (BAYER[q.y * 4 + q.x] + 0.5) / 16.0 - 0.5;
    col = floor(clamp(col, 0.0, 1.0) * 31.0 + 0.5 + b) / 31.0;
  }
  frag = vec4(col, uTint.a);
}`;

const SKY_VS = `#version 300 es
out vec2 vP;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) * 2.0 - 1.0;
  vP = p;
  gl_Position = vec4(p, 0.999, 1.0);
}`;

const SKY_FS = `#version 300 es
precision highp float;
in vec2 vP;
uniform mat4 uInvVP;
uniform vec3 uTop, uHorizon, uCloud;
uniform float uTime;
out vec4 frag;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.02; a *= 0.5; } return s; }
void main() {
  vec4 w = uInvVP * vec4(vP, 1.0, 1.0);
  vec3 d = normalize(w.xyz / w.w);
  float t = clamp(d.y * 1.6 + 0.12, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, t);
  vec2 cp = d.xz / max(d.y + 0.18, 0.05) * 1.2 + vec2(uTime * 0.012, 0.0);
  float c = fbm(cp);
  float cm = smoothstep(0.52, 0.72, c) * smoothstep(-0.05, 0.25, d.y);
  col = mix(col, uCloud * (0.85 + 0.25 * fbm(cp * 2.3)), cm * 0.85);
  col = floor(col * 24.0 + 0.5) / 24.0;
  frag = vec4(col, 1.0);
}`;

export class Renderer {
  constructor(assets) {
    this.assets = assets;
    this.prog = program(VS, FS);
    this.sky = program(SKY_VS, SKY_FS);
    this.skyVAO = gl.createVertexArray();
    this.white = solidTex(255, 255, 255);
    this.texCache = new Map();
    this.runtime = new Map();                // '@name' -> texture
    this.frame = { lights: [], time: 0 };
  }

  tex(name, override) {
    if (override && override[name]) return override[name];
    if (!name) return this.white;
    if (name[0] === '@') return this.runtime.get(name) || this.white;
    let t = this.texCache.get(name);
    if (!t) {
      const img = this.assets.textures[name];
      t = img ? texFromImage(img, { nearest: true, repeat: !name.startsWith('bake_'), mips: false }) : this.white;
      this.texCache.set(name, t);
    }
    return t;
  }

  // scene: { proj, view, cam, lights:[{pos,col,radius}], ambient, dir:{dir,col}, fogColor, fogRange, fog, bands, time }
  begin(scene) {
    const p = this.prog.use();
    this.scene = scene;
    gl.uniformMatrix4fv(p.u('uProj'), false, scene.proj);
    gl.uniformMatrix4fv(p.u('uView'), false, scene.view);
    gl.uniform3fv(p.u('uCamPos'), scene.cam);
    gl.uniform3fv(p.u('uAmbient'), scene.ambient);
    const dir = scene.dir || { dir: [0, -1, 0], col: [0, 0, 0] };
    gl.uniform3fv(p.u('uDirDir'), norm(dir.dir));
    gl.uniform3fv(p.u('uDirCol'), dir.col);
    gl.uniform3fv(p.u('uFogColor'), scene.fogColor || [0, 0, 0]);
    gl.uniform2fv(p.u('uFog'), scene.fogRange || [100, 200]);
    gl.uniform1f(p.u('uFogOn'), scene.fog === false ? 0 : 1);
    gl.uniform1f(p.u('uTime'), scene.time || 0);
    gl.uniform1f(p.u('uBands'), scene.bands ?? 10);
    const ps1 = scene.ps1 || null;
    gl.uniform2fv(p.u('uSnap'), ps1 ? ps1.snap : [0, 0]);
    gl.uniform1f(p.u('uAffine'), ps1 ? ps1.affine : 0);
    gl.uniform1f(p.u('uDither'), ps1 ? ps1.dither : 0);
    const L = (scene.lights || []).slice(0, 16);
    const pos = new Float32Array(64), col = new Float32Array(64);
    L.forEach((l, i) => {
      pos.set([l.pos[0], l.pos[1], l.pos[2], l.radius], i * 4);
      col.set([l.col[0], l.col[1], l.col[2], 1], i * 4);
    });
    gl.uniform1i(p.u('uNumLights'), L.length);
    gl.uniform4fv(p.u('uLightPos'), pos);
    gl.uniform4fv(p.u('uLightCol'), col);
    gl.uniform1i(p.u('uTex'), 0);
    gl.activeTexture(gl.TEXTURE0);
    this.setTint();
  }

  setTint(tint = [1, 1, 1, 1], flash = [0, 0, 0, 0]) {
    gl.uniform4fv(this.prog.u('uTint'), tint);
    gl.uniform4fv(this.prog.u('uFlash'), flash);
  }

  drawBatches(batches, model = ident()) {
    gl.uniformMatrix4fv(this.prog.u('uModel'), false, model);
    for (const b of batches) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex(b.tex));
      gl.bindVertexArray(b.vao);
      gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_INT, 0);
    }
  }

  // opts: { pose, tint, flash, texOverride, hide:Set(partNames), alpha }
  drawModel(model, matrix, opts = {}) {
    const mats = opts.mats || model.partMatrices(opts.pose);
    const tint = opts.tint || [1, 1, 1];
    const alpha = opts.alpha ?? 1;
    if (alpha < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
    this.setTint([tint[0], tint[1], tint[2], alpha], opts.flash || [0, 0, 0, 0]);
    for (const s of model.sections) {
      const pname = model.parts[s.part].name;
      if (opts.hide && opts.hide.has(pname)) continue;
      gl.uniformMatrix4fv(this.prog.u('uModel'), false, mul(matrix, mats[s.part]));
      gl.bindTexture(gl.TEXTURE_2D, this.tex(s.tex, opts.texOverride));
      gl.bindVertexArray(s.vao);
      gl.drawElements(gl.TRIANGLES, s.count, gl.UNSIGNED_INT, 0);
    }
    if (alpha < 1) gl.disable(gl.BLEND);
    this.setTint();
  }

  drawSky(invVP, top, horizon, cloud, time) {
    const s = this.sky.use();
    gl.uniformMatrix4fv(s.u('uInvVP'), false, invVP);
    gl.uniform3fv(s.u('uTop'), top);
    gl.uniform3fv(s.u('uHorizon'), horizon);
    gl.uniform3fv(s.u('uCloud'), cloud);
    gl.uniform1f(s.u('uTime'), time);
    gl.depthMask(false);
    gl.bindVertexArray(this.skyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    this.prog.use();
  }
}

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function invert(m) {
  const inv = new Float32Array(16);
  inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
  inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
  inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
  inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
  inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
  inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
  inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
  inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
  inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
  inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
  inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
  inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
  inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
  inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
  inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
  inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
  let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
  det = det ? 1 / det : 0;
  for (let i = 0; i < 16; i++) inv[i] *= det;
  return inv;
}
