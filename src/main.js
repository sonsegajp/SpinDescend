// main.js - boot: display canvas + offscreen 2D overlay, asset loading with a
// progress bar, the frame pipeline, then the game loop.
import { initGL } from './gl.js?v=20260925180435';
import { loadAll } from './assets.js?v=20260925180435';
import { Game } from './game.js?v=20260925180435';
import { Input } from './input.js?v=20260925180435';
import { Audio } from './audio.js?v=20260925180435';
import { Pipeline } from './frame.js?v=20260925180435';

const glc = document.getElementById('gl');
const ovc = document.createElement('canvas');           // 2D overlay, composited on the GPU
const VH = 360;
let VW = 640;
let game = null, pipe = null;

function fit() {
  const aspect = innerWidth / innerHeight;
  VW = Math.round(Math.min(860, Math.max(480, VH * aspect)));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  glc.width = Math.round(innerWidth * dpr);
  glc.height = Math.round(innerHeight * dpr);
  glc.style.width = innerWidth + 'px';
  glc.style.height = innerHeight + 'px';
  if (pipe) pipe.resize(VW, VH, glc.width, glc.height);
  if (game) game.resize(VW, VH);
}

const toVirtual = (cx, cy) => {
  const dpr = glc.width / innerWidth;
  return pipe ? pipe.map(cx * dpr, cy * dpr) : [cx / innerWidth * VW, cy / innerHeight * VH];
};

function showError(e) {
  console.error(e);
  const d = document.getElementById('err');
  d.textContent = 'Spin & Descend failed to start:\n' + (e && e.stack || e);
  d.style.display = 'block';
}

async function boot() {
  try {
    fit();
    // loading screen on a temporary 2D context over the page
    const load = document.getElementById('load');
    load.width = VW * 2; load.height = VH * 2;
    const g = load.getContext('2d');
    g.scale(2, 2);
    const progress = (f) => {
      g.fillStyle = '#0c0a12'; g.fillRect(0, 0, VW, VH);
      g.fillStyle = '#e8d8b0'; g.font = 'bold 14px Georgia, serif'; g.textAlign = 'center';
      g.fillText('Shuffling the reels...', VW / 2, VH / 2 - 12);
      g.fillStyle = '#2a1416'; g.fillRect(VW / 2 - 100, VH / 2, 200, 8);
      g.fillStyle = '#c82a30'; g.fillRect(VW / 2 - 100, VH / 2, 200 * f, 8);
    };
    progress(0);
    initGL(glc);
    const assets = await loadAll(progress);
    load.style.display = 'none';
    pipe = new Pipeline();
    try { pipe.crt = localStorage.getItem('sd_crt') !== '0'; } catch (e) { /* storage blocked: keep default */ }
    const input = new Input(glc, toVirtual);
    const audio = new Audio();
    game = new Game(assets, input, audio, ovc, pipe);
    window.SD = game;
    fit();
    const q = new URLSearchParams(location.search);
    if (q.get('crt') === '0') pipe.crt = false;
    if (q.has('diag')) {
      const miss = [];
      for (const kind of ['textures', 'cards', 'icons', 'icons48', 'ui'])
        for (const [k, v] of Object.entries(assets[kind])) if (!v) miss.push(kind + '/' + k);
      const d = document.getElementById('err');
      d.textContent = 'DIAG missing=' + JSON.stringify(miss);
      d.style.display = 'block';
    }
    let tSim = performance.now() / 1000;
    if (q.size) {
      game.debug(q);
      // ?warp=N simulates N seconds instantly (headless screenshots)
      const warp = parseFloat(q.get('warp') || '0');
      const draw = q.has('warpdraw');                  // ?warpdraw: also render every simulated frame (catches draw bugs)
      for (let i = 0; i < warp * 60; i++) { tSim += 1 / 60; game.update(1 / 60, tSim); if (draw) game.render(tSim); }
    }
    if (q.has('autospin')) {                          // dump the fight log into the page (read with --dump-dom)
      const d = document.createElement('pre');
      d.id = 'fightlog';
      d.textContent = (window.__log || []).join('\n');
      document.body.appendChild(d);
    }
    const offset = tSim - performance.now() / 1000;
    const hold = q.has('hold');                          // ?hold freezes the game right after the warp
    let last = performance.now();
    const frame = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      try {
        if (!hold) game.update(dt, t / 1000 + offset);
        game.render(hold ? tSim : t / 1000 + offset);
      } catch (e) { showError(e); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  } catch (e) { showError(e); }
}

addEventListener('resize', fit);
boot();
