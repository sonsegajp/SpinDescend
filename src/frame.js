// frame.js - the frame pipeline:
//   1. world  -> 360p target (chunky pixel-art 3D)
//   2. hud    -> 720p target: world upscaled 2x nearest, then the slot machine and
//                the 3D cards drawn sharp on top
//   3. present: hud + 2D overlay canvas (720p) composited, then the optional CRT
//      filter (curvature, scanlines, phosphor mask, fringing, bloom, vignette)
//      into a letterboxed viewport on the display canvas.
import { gl, program } from './gl.js?v=20260925234300';

const FULL_VS = `#version 300 es
out vec2 vUV;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const BLIT_FS = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 frag;
uniform sampler2D uTex;
void main() { frag = vec4(texture(uTex, vUV).rgb, 1.0); }`;

const PRESENT_FS = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 frag;
uniform sampler2D uHud, uUI;
uniform vec2 uOut;
uniform float uTime, uCRT, uLines;
vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 off = abs(uv.yx) / vec2(5.2, 4.2);
  uv += uv * off * off;
  return uv * 0.5 + 0.5;
}
vec3 samp(vec2 uv) {
  vec4 u = texture(uUI, vec2(uv.x, 1.0 - uv.y));
  return mix(texture(uHud, uv).rgb, u.rgb, u.a);
}
void main() {
  vec2 uv = vUV;
  if (uCRT < 0.5) { frag = vec4(samp(uv), 1.0); return; }
  uv = curve(uv);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { frag = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // slight RGB convergence error toward the edges
  vec2 ca = (uv - 0.5) * 0.0032;
  vec3 col = vec3(samp(uv + ca).r, samp(uv).g, samp(uv - ca).b);
  // cheap bloom on the bright parts (torches, gold, glowing blades)
  vec2 px = 2.5 / uOut;
  vec3 b = samp(uv + vec2(px.x, 0.0)) + samp(uv - vec2(px.x, 0.0)) + samp(uv + vec2(0.0, px.y)) + samp(uv - vec2(0.0, px.y))
         + samp(uv + px * 2.0) + samp(uv - px * 2.0) + samp(uv + vec2(px.x, -px.y) * 2.0) + samp(uv + vec2(-px.x, px.y) * 2.0);
  col += max(b / 8.0 - 0.5, 0.0) * 0.6;
  // scanlines at the game's native line count
  float s = sin(uv.y * uLines * 3.14159265);
  col *= 0.7 + 0.3 * s * s + 0.06;
  // aperture-grille phosphor mask
  float m = mod(gl_FragCoord.x, 3.0);
  col *= m < 1.0 ? vec3(1.14, 0.9, 0.9) : (m < 2.0 ? vec3(0.9, 1.14, 0.9) : vec3(0.9, 0.9, 1.14));
  // vignette + a whisper of flicker
  vec2 v = uv * (1.0 - uv.yx);
  col *= pow(clamp(v.x * v.y * 20.0, 0.0, 1.0), 0.24);
  col *= 1.16 + 0.012 * sin(uTime * 120.0);
  frag = vec4(col, 1.0);
}`;

function target(w, h, nearest) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const f = nearest ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const rb = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, rb, fb, w, h };
}

function free(t) {
  if (!t) return;
  gl.deleteTexture(t.tex); gl.deleteRenderbuffer(t.rb); gl.deleteFramebuffer(t.fb);
}

export class Pipeline {
  constructor() {
    this.blit = program(FULL_VS, BLIT_FS);
    this.present = program(FULL_VS, PRESENT_FS);
    this.vao = gl.createVertexArray();
    this.uiTex = gl.createTexture();
    this.crt = true;
    this.HUD = 2;
  }

  resize(VW, VH, dispW, dispH) {
    this.VW = VW; this.VH = VH; this.dispW = dispW; this.dispH = dispH;
    free(this.world); free(this.hud);
    this.world = target(VW, VH, true);
    this.hud = target(VW * this.HUD, VH * this.HUD, false);
    const s = Math.min(dispW / VW, dispH / VH);
    this.box = { w: Math.round(VW * s), h: Math.round(VH * s) };
    this.box.x = Math.floor((dispW - this.box.w) / 2);
    this.box.y = Math.floor((dispH - this.box.h) / 2);
  }

  beginWorld(clear) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.world.fb);
    gl.viewport(0, 0, this.VW, this.VH);
    gl.clearColor(clear[0], clear[1], clear[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  beginHud() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hud.fb);
    gl.viewport(0, 0, this.hud.w, this.hud.h);
    gl.disable(gl.DEPTH_TEST);
    this.blit.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.world.tex);
    gl.uniform1i(this.blit.u('uTex'), 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
  }

  finish(uiCanvas, time) {
    gl.bindTexture(gl.TEXTURE_2D, this.uiTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, uiCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.crt ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, this.hud.tex);
    const f = this.crt ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.dispW, this.dispH);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(this.box.x, this.box.y, this.box.w, this.box.h);
    gl.disable(gl.DEPTH_TEST);
    const p = this.present.use();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.hud.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.uiTex);
    gl.uniform1i(p.u('uHud'), 0);
    gl.uniform1i(p.u('uUI'), 1);
    gl.uniform2f(p.u('uOut'), this.box.w, this.box.h);
    gl.uniform1f(p.u('uTime'), time);
    gl.uniform1f(p.u('uCRT'), this.crt ? 1 : 0);
    gl.uniform1f(p.u('uLines'), this.VH);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);
  }

  // display pixel -> virtual (VW x VH) coordinates, through the CRT curvature
  map(px, py) {
    const b = this.box;
    let u = (px - b.x) / b.w, v = 1 - (py - b.y) / b.h;
    if (this.crt) {
      let x = u * 2 - 1, y = v * 2 - 1;
      const ox = Math.abs(y) / 5.2, oy = Math.abs(x) / 4.2;
      x += x * ox * ox; y += y * oy * oy;
      u = x * 0.5 + 0.5; v = y * 0.5 + 0.5;
    }
    return [u * this.VW, (1 - v) * this.VH];
  }
}
