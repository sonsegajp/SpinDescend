// assets.js - loads every model, texture, card, icon and UI image the game uses.
import { parseSDM, Model } from './gl.js?v=20260926072430';
import { parseSDA } from './anim.js?v=20260926072430';
import { CARDS, SYMBOLS, CARD_ICON, OMENS, BOSSES, ENEMIES } from './data.js?v=20260926072430';

export const BASE = (window.SD_ASSETS || '../assets/');
// local dev: never trust the HTTP cache (assets are re-exported from Blender constantly)
const DEV = ['localhost', '127.0.0.1'].includes(location.hostname);
const V = DEV ? '?v=' + Date.now() : (window.SD_BUILD ? '?v=' + window.SD_BUILD : '');

export const ANIMATED = ['knight', 'goblin', 'skeleton', 'slime', 'cultist', 'mimic',
  'wailer', 'tusker', 'duskwing', 'warden', 'wickling', 'murk', 'jester', 'merchant', 'rogue', 'mage',
  'slime_monarch', 'boar_demon', 'mimic_colossus', 'gravemaw'];

export const MODELS = [
  'knight', 'goblin', 'skeleton', 'slime', 'cultist', 'mimic', 'wailer', 'tusker', 'duskwing', 'warden', 'wickling', 'murk', 'jester', 'merchant', 'rogue', 'mage',
  'slime_monarch', 'boar_demon', 'mimic_colossus', 'gravemaw', 'crack_wall', 'teleporter', 'secret_altar',
  'library_wall0', 'library_wall1', 'library_wall2', 'library_floor0', 'library_floor1', 'library_ceil', 'book_pile', 'candelabra', 'ink_puddle',
  'foundry_wall0', 'foundry_wall1', 'foundry_wall2', 'foundry_floor0', 'foundry_floor1', 'foundry_ceil', 'gear_stand', 'steam_vent', 'pipe_corner',
  'wishing_well', 'armory_rack', 'cursed_idol',
  'fountain', 'forge', 'blood_altar', 'gambler_table', 'lectern',
  'slot_machine', 'slot_machine_arcane', 'slot_machine_knight', 'slot_machine_forest', 'card', 'reel_pod',
  'dun_wall0', 'dun_wall1', 'dun_wall2', 'dun_wall3', 'dun_floor0', 'dun_floor1', 'dun_floor2', 'dun_ceil', 'dun_pillar',
  'torch', 'banner', 'banner_blue', 'stairs', 'barrel', 'cobweb', 'chains', 'bones',
  'mine_wall0', 'mine_wall1', 'mine_floor0', 'mine_floor1', 'mine_ceil', 'mine_support', 'rails', 'lantern', 'crate', 'crystals',
  'crypt_wall0', 'crypt_wall1', 'crypt_wall2', 'crypt_floor0', 'crypt_floor1', 'crypt_ceil', 'crypt_pillar', 'coffin', 'candles',
  'ice_wall0', 'ice_wall1', 'ice_wall2', 'ice_floor0', 'ice_floor1', 'ice_ceil', 'icicles',
  'magma_wall0', 'magma_wall1', 'magma_wall2', 'magma_floor0', 'magma_floor1', 'magma_ceil', 'brazier',
  'ruin_floor0', 'ruin_floor1', 'ruin_wall0', 'ruin_wall1', 'ruin_wall2', 'ruin_pillar0', 'ruin_pillar1',
  'ruin_pillar_short0', 'ruin_tower0', 'ruin_tower1', 'grass0', 'grass1', 'rubble0',
  'grotto_wall0', 'grotto_wall1', 'grotto_wall2', 'grotto_floor0', 'grotto_floor1', 'grotto_ceil', 'shrooms', 'roots',
  'vault_wall0', 'vault_wall1', 'vault_wall2', 'vault_floor0', 'vault_floor1', 'vault_ceil', 'vault_pillar', 'coin_pile', 'chandelier',
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
  const texNames = new Set(['parchment', 'card_back', 'st_ui', 'bake_knight_paladin', ...[...Object.values(BOSSES), ...Object.values(ENEMIES)].map(b => b.tex).filter(Boolean)]);
  for (const m of MODELS) for (const s of raws[m].sections) if (s.tex && s.tex[0] !== '@') texNames.add(s.tex);
  const iconNames = new Set(['heart', 'coins', 'boots', 'fire', 'clover4', 'trophy', 'heat', ...Object.values(CARD_ICON),
                             ...Object.values(OMENS).map(o => o.icon)]);
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
