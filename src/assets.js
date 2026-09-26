// assets.js - loads every model, texture, card, icon and UI image the game uses.
import { parseSDM, Model } from './gl.js?v=20260925232706';
import { parseSDA } from './anim.js?v=20260925232706';
import { CARDS, SYMBOLS, CARD_ICON } from './data.js?v=20260925232706';

export const BASE = (window.SD_ASSETS || '../assets/');
// local dev: never trust the HTTP cache (assets are re-exported from Blender constantly)
const DEV = ['localhost', '127.0.0.1'].includes(location.hostname);
const V = DEV ? '?v=' + Date.now() : (window.SD_BUILD ? '?v=' + window.SD_BUILD : '');

export const ANIMATED = ['knight', 'goblin', 'skeleton', 'slime', 'cultist', 'mimic',
  'wailer', 'tusker', 'duskwing', 'warden', 'wickling', 'murk', 'jester', 'merchant', 'rogue', 'mage'];

export const MODELS = [
  'knight', 'goblin', 'skeleton', 'slime', 'cultist', 'mimic', 'wailer', 'tusker', 'duskwing', 'warden', 'wickling', 'murk', 'jester', 'merchant', 'rogue', 'mage',
  'slot_machine', 'slot_machine_arcane', 'card', 'reel_pod',
  'dun_wall0', 'dun_wall1', 'dun_wall2', 'dun_wall3', 'dun_floor0', 'dun_floor1', 'dun_floor2', 'dun_ceil', 'dun_pillar',
  'torch', 'banner', 'banner_blue', 'stairs', 'barrel', 'cobweb', 'chains', 'bones',
  'mine_wall0', 'mine_wall1', 'mine_floor0', 'mine_floor1', 'mine_ceil', 'mine_support', 'rails', 'lantern', 'crate', 'crystals',
  'crypt_wall0', 'crypt_wall1', 'crypt_wall2', 'crypt_floor0', 'crypt_floor1', 'crypt_ceil', 'crypt_pillar', 'coffin', 'candles',
  'ice_wall0', 'ice_wall1', 'ice_wall2', 'ice_floor0', 'ice_floor1', 'ice_ceil', 'icicles',
  'magma_wall0', 'magma_wall1', 'magma_wall2', 'magma_floor0', 'magma_floor1', 'magma_ceil', 'brazier',
  'ruin_floor0', 'ruin_floor1', 'ruin_wall0', 'ruin_wall1', 'ruin_wall2', 'ruin_pillar0', 'ruin_pillar1',
  'ruin_pillar_short0', 'ruin_tower0', 'ruin_tower1', 'grass0', 'grass1', 'rubble0',
];

function loadImage(url) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => { console.warn('missing', url); res(null); };
    img.src = url + V;
  });
}

export async function loadAll(onProgress) {
  const assets = { models: {}, anims: {}, textures: {}, cards: {}, icons: {}, icons48: {}, ui: {} };
  let done = 0, total = 0;
  const tick = () => { done++; onProgress && onProgress(done / Math.max(total, 1)); };

  // models first (they tell us which textures exist)
  const raws = {};
  total = MODELS.length;
  await Promise.all(MODELS.map(async (m) => {
    const r = await fetch(BASE + 'models/' + m + '.sdm' + V, { cache: DEV ? 'no-store' : 'default' });
    if (!r.ok) throw new Error('missing model ' + m);
    raws[m] = parseSDM(await r.arrayBuffer());
    tick();
  }));
  await Promise.all(ANIMATED.map(async (m) => {
    const r = await fetch(BASE + 'models/' + m + '.sda' + V, { cache: DEV ? 'no-store' : 'default' });
    if (r.ok) assets.anims[m] = parseSDA(await r.arrayBuffer());
  }));
  const texNames = new Set(['parchment', 'card_back', 'st_ui', 'bake_knight_paladin']);
  for (const m of MODELS) for (const s of raws[m].sections) if (s.tex && s.tex[0] !== '@') texNames.add(s.tex);
  const iconNames = new Set(['heart', 'coins', 'boots', 'fire', 'clover4', ...Object.values(CARD_ICON)]);
  for (const s of Object.values(SYMBOLS)) iconNames.add(s.icon);
  const jobs = [];
  for (const t of texNames) jobs.push(['textures', t, BASE + 'textures/' + t + '.png']);
  for (const c of Object.keys(CARDS)) jobs.push(['cards', c, BASE + 'cards/' + c + '.png']);
  for (const i of iconNames) {
    jobs.push(['icons', i, BASE + 'icons/' + i + '.png']);
    jobs.push(['icons48', i, BASE + 'icons/' + i + '_48.png']);
  }
  jobs.push(['ui', 'logo', BASE + 'ui/logo.png']);
  total += jobs.length;
  await Promise.all(jobs.map(async ([kind, key, url]) => {
    assets[kind][key] = await loadImage(url);
    tick();
  }));
  for (const m of MODELS) assets.models[m] = new Model(m, raws[m]);
  return assets;
}
