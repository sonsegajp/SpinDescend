// level.js - procedural floors for the six biomes (the concept's dungeon / mines /
// ruins plus the crypt, the frozen caverns and the magma forge).
//
// Grid: cell (x, y) is centred at world (x*CELL, 0, y*CELL); y grows toward +Z.
// Directions: 0 = north (-Z), 1 = east (+X), 2 = south (+Z), 3 = west (-X).
import { rng, trs } from './math.js?v=20260926072615';
import { Batcher } from './gl.js?v=20260926072615';
import { BIOMES, ELITES, BOSSES, ROOMS, biomeForFloor, levelOf, isBossFloor } from './data.js?v=20260926072615';

export const CELL = 2.0;
export const WALL_H = 2.6;
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

// ------------------------------------------------------------------ generation
// Branching corridor mazes: every decision happens at a junction, where the
// player is prompted Left / Forward / Right / Back (Doom RPG style).
export function generate(floor, seed, opts = {}) {
  const biome = opts.biome || biomeForFloor(floor);
  if (isBossFloor(floor) && opts.bossReady) return generateBossHall(floor, seed, biome);   // once its boss model exists
  const R = rng(seed);
  const lvl = levelOf(floor), act = Math.floor((floor - 1) / 4);
  const tier = lvl - 1 + (act >= 2 ? 1 : 0);             // floors grow through a biome and deeper into the run
  const W = 13 + tier * 2, H = W;                       // odd sizes: nodes sit on odd coordinates
  const g = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : g[y * W + x];
  const set = (x, y, v) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1) g[y * W + x] = v; };

  // ---- recursive-backtracker maze over the odd-coordinate nodes
  const NW = (W - 1) / 2, NH = (H - 1) / 2;
  const seen = new Uint8Array(NW * NH);
  const sx0 = R.int(0, NW - 1), sy0 = R.int(0, NH - 1);
  const stack = [[sx0, sy0, -1]];
  seen[sy0 * NW + sx0] = 1;
  set(sx0 * 2 + 1, sy0 * 2 + 1, 1);
  while (stack.length) {
    const [cx, cy, last] = stack[stack.length - 1];
    const nb = [0, 1, 2, 3].map(d => [cx + DX[d], cy + DY[d], d])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < NW && y < NH && !seen[y * NW + x]);
    if (!nb.length) { stack.pop(); continue; }
    // keep going straight 55% of the time: longer corridors, fewer zig-zags
    const straight = nb.find(n => n[2] === last);
    const [nx, ny, nd] = straight && R.chance(0.55) ? straight : R.pick(nb);
    seen[ny * NW + nx] = 1;
    set(cx * 2 + 1 + (nx - cx), cy * 2 + 1 + (ny - cy), 1);
    set(nx * 2 + 1, ny * 2 + 1, 1);
    stack.push([nx, ny, nd]);
  }
  // ---- loops: knock through some remaining walls between nodes -> real choices
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (at(x, y)) continue;
    const horiz = x % 2 === 0 && y % 2 === 1, vert = x % 2 === 1 && y % 2 === 0;
    if ((horiz || vert) && R.chance(0.11 + tier * 0.02)) set(x, y, 1);
  }
  // ---- prune some dead ends so the walk isn't all backtracking
  const exits = (x, y) => [0, 1, 2, 3].filter(d => at(x + DX[d], y + DY[d]));
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (at(x, y) && exits(x, y).length === 1 && R.chance(0.35)) {
        // open one more wall toward a neighbouring corridor if possible
        const d = R.pick([0, 1, 2, 3].filter(k => !at(x + DX[k], y + DY[k]) && at(x + 2 * DX[k], y + 2 * DY[k])));
        if (d !== undefined) set(x + DX[d], y + DY[d], 1);
      }
    }
  }

  const bfs = (sx, sy) => {
    const d = new Int32Array(W * H).fill(-1);
    const q = [[sx, sy]];
    d[sy * W + sx] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const [x, y] = q[qi];
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k], ny = y + DY[k];
        if (at(nx, ny) && d[ny * W + nx] < 0) { d[ny * W + nx] = d[y * W + x] + 1; q.push([nx, ny]); }
      }
    }
    return d;
  };
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y)) cells.push([x, y]);
  const deadEndsAll = cells.filter(([x, y]) => exits(x, y).length === 1);
  // start in a dead end (so the first choice comes after a short walk), stairs = farthest cell
  const start0 = deadEndsAll.length ? R.pick(deadEndsAll) : R.pick(cells);
  const dist = bfs(start0[0], start0[1]);
  let stairs = cells[0];
  for (const c of cells) if (dist[c[1] * W + c[0]] > dist[stairs[1] * W + stairs[0]]) stairs = c;
  stairs = { x: stairs[0], y: stairs[1] };
  const startDir = exits(start0[0], start0[1])[0] ?? 0;
  const start = { x: start0[0], y: start0[1], dir: startDir };

  const key = (x, y) => `${x},${y}`;
  const occupied = new Set([key(start.x, start.y), key(stairs.x, stairs.y)]);
  const entities = [];
  const B = BIOMES[biome];

  // an elite guards the stairs down to the boss hall (and the last level, while a biome has no boss yet)
  if (lvl >= 3) {
    let guard = null;
    for (const d of exits(stairs.x, stairs.y)) {
      const nx = stairs.x + DX[d], ny = stairs.y + DY[d];
      if (!guard || dist[ny * W + nx] < dist[guard[1] * W + guard[0]]) guard = [nx, ny];
    }
    if (guard) {
      entities.push({ type: 'enemy', kind: R.pick(ELITES[biome]), x: guard[0], y: guard[1], elite: true });
      occupied.add(key(...guard));
    }
  }
  const faceOpen = (x, y) => exits(x, y)[0] ?? 0;

  // ---- merchant: one on EVERY floor, standing at the side of a corridor on the way to the
  // stairs (you walk right past him). Prefer a cell every route to the stairs must cross,
  // about two thirds of the way there.
  {
    const path = [[stairs.x, stairs.y]];
    for (let [cx, cy] = [stairs.x, stairs.y]; dist[cy * W + cx] > 0;) {
      const d = [0, 1, 2, 3].find(k => at(cx + DX[k], cy + DY[k]) && dist[(cy + DY[k]) * W + cx + DX[k]] === dist[cy * W + cx] - 1);
      cx += DX[d]; cy += DY[d];
      path.push([cx, cy]);
    }
    const reachesStairs = (bx, by) => {             // is the stairs still reachable with (bx, by) walled off?
      const seenB = new Uint8Array(W * H), q = [[start.x, start.y]];
      seenB[start.y * W + start.x] = 1;
      for (let qi = 0; qi < q.length; qi++) {
        const [x, y] = q[qi];
        if (x === stairs.x && y === stairs.y) return true;
        for (let k = 0; k < 4; k++) {
          const nx = x + DX[k], ny = y + DY[k];
          if (at(nx, ny) && !(nx === bx && ny === by) && !seenB[ny * W + nx]) { seenB[ny * W + nx] = 1; q.push([nx, ny]); }
        }
      }
      return false;
    };
    let best = null;
    for (let i = 2; i < path.length - 2; i++) {
      const [px, py] = path[i];
      const ex = exits(px, py);
      if (occupied.has(key(px, py)) || ex.length !== 2) continue;
      const score = Math.abs(i - path.length * 0.35) + (reachesStairs(px, py) ? 1000 : 0);
      if (!best || score < best.score) best = { score, px, py, ex };
    }
    if (best) {
      const side = R.pick([0, 1, 2, 3].filter(k => !best.ex.includes(k)));   // the wall he stands against
      occupied.add(key(best.px, best.py));
      entities.push({ type: 'merchant', wayside: true, x: best.px, y: best.py, side, face: (side + 2) % 4 });
    }
  }

  // chests live in dead ends
  const deadEnds = deadEndsAll.filter(([x, y]) => !occupied.has(key(x, y)) && dist[y * W + x] >= 3);
  const nChests = Math.min(deadEnds.length, 1 + (R.chance(0.6) ? 1 : 0) + (floor >= 4 && R.chance(0.4) ? 1 : 0) + (biome === 'vault' ? 1 : 0));
  for (let i = 0; i < nChests; i++) {
    const [x, y] = deadEnds.splice(Math.floor(R() * deadEnds.length), 1)[0];
    occupied.add(key(x, y));
    entities.push({ type: 'chest', x, y, face: faceOpen(x, y), mimic: floor > 1 && R.chance(0.25 * (opts.mimics || 1) * (biome === 'vault' ? 1.6 : 1)) });
  }
  // enemies block corridors
  const nEnemies = Math.min(3 + lvl + act, 9) + (opts.extraFoes || 0);
  const cand = cells.filter(([x, y]) => dist[y * W + x] >= 3 && exits(x, y).length === 2);
  let placed = 0;
  for (let t = 0; t < 400 && placed < nEnemies && cand.length; t++) {
    const [x, y] = R.pick(cand);
    if (occupied.has(key(x, y))) continue;
    if (entities.some(e => e.type === 'enemy' && Math.abs(e.x - x) + Math.abs(e.y - y) < 4)) continue;
    occupied.add(key(x, y));
    entities.push({ type: 'enemy', kind: R.pick(B.enemies), x, y, elite: false });
    placed++;
  }
  // a cracked wall (only when you carry a bomb, or the Demolition Charge): at the end of a free dead end, the
  // solid cell straight ahead hides a rune circle - blow the wall and it leads to a secret room
  // a one-cell spur dug off a corridor (every neighbour but the corridor solid); alcove: the cell beyond it too
  const digSpur = (alcove) => {
    const found = [];
    for (const [x, y] of cells) {
      if (occupied.has(key(x, y)) || dist[y * W + x] < 2) continue;
      for (let d = 0; d < 4; d++) {
        const sx = x + DX[d], sy = y + DY[d], ax = sx + DX[d], ay = sy + DY[d];
        const inside = (u, v) => u >= 1 && v >= 1 && u <= W - 2 && v <= H - 2;
        if (!inside(sx, sy) || at(sx, sy)) continue;
        if (alcove && (!inside(ax, ay) || at(ax, ay))) continue;
        if ([0, 1, 2, 3].some(k => k !== (d + 2) % 4 && at(sx + DX[k], sy + DY[k]))) continue;
        found.push({ x: sx, y: sy, d, ax, ay, from: y * W + x });
      }
    }
    if (!found.length) return null;
    const c = R.pick(found);
    g[c.y * W + c.x] = 1;
    dist[c.y * W + c.x] = dist[c.from] + 1;
    delete c.from;
    return c;
  };
  let secret = null;
  if (opts.secret) {
    const cand = deadEndsAll.filter(([x, y]) => !occupied.has(key(x, y)) && !(x === start.x && y === start.y) &&
                                                !(x === stairs.x && y === stairs.y))
      .map(([x, y]) => { const d = (exits(x, y)[0] + 2) % 4; return { x, y, d, ax: x + DX[d], ay: y + DY[d] }; })
      .filter(s => s.ax > 0 && s.ay > 0 && s.ax < W - 1 && s.ay < H - 1 && !at(s.ax, s.ay));
    if (!cand.length) {             // no free dead end: dig a spur off a corridor and crack its end wall
      const c = digSpur(true);
      if (c) cand.push(c);
    }
    if (cand.length) {
      secret = R.pick(cand);
      secret.kind = R.pick(['vault', 'shop', 'shrine']);
      occupied.add(key(secret.x, secret.y));
    }
  }
  // the special room: a set-piece in a free dead end (or a dug spur)
  if (opts.room) {
    const free = deadEndsAll.filter(([x, y]) => !occupied.has(key(x, y)) && exits(x, y).length === 1 && dist[y * W + x] >= 2 &&
                                                !(x === start.x && y === start.y) && !(x === stairs.x && y === stairs.y));
    let cell = free.length ? R.pick(free) : null;
    if (!cell) { const c = digSpur(false); if (c) cell = [c.x, c.y]; }
    if (cell) {
      occupied.add(key(cell[0], cell[1]));
      entities.push({ type: 'room', kind: R.pick(Object.keys(ROOMS)), x: cell[0], y: cell[1], face: faceOpen(cell[0], cell[1]) });
    }
  }
  return { floor, biome, W, H, grid: g, at, exits, start, stairs, entities, dist, occupied, seed, secret };
}

// A secret room behind a cracked wall: a short hall with the way back (a rune circle) behind you and the
// treasure at its end - a vault of chests, a secret shop, or a shrine whose altar holds the unique relics.
export function generateSecret(kind, floor, seed) {
  const W = 7, H = 9, cx = 3;
  const g = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : g[y * W + x];
  for (let y = 1; y <= 7; y++) g[y * W + cx] = 1;
  if (kind === 'vault') { g[3 * W + cx - 1] = 1; g[3 * W + cx + 1] = 1; }          // two side niches
  const exits = (x, y) => [0, 1, 2, 3].filter(d => at(x + DX[d], y + DY[d]));
  const dist = new Int32Array(W * H).fill(-1);
  for (let y = 1; y <= 7; y++) dist[y * W + cx] = 7 - y;
  const entities = [{ type: 'teleporter', x: cx, y: 7, back: true }];
  if (kind === 'vault') entities.push({ type: 'chest', x: cx - 1, y: 3, face: 1, secret: 'rare' },
                                      { type: 'chest', x: cx + 1, y: 3, face: 3, secret: 'rare' },
                                      { type: 'chest', x: cx, y: 1, face: 2, secret: 'relic' });
  else if (kind === 'shop') entities.push({ type: 'merchant', x: cx, y: 1, secret: true });
  else entities.push({ type: 'altar', x: cx, y: 1 });
  return { floor, biome: { vault: 'vault', shop: 'crypt', shrine: 'grotto' }[kind], W, H, grid: g, at, exits,
           start: { x: cx, y: 6, dir: 0 }, stairs: { x: -9, y: -9 }, entities, dist,
           occupied: new Set(entities.map(e => `${e.x},${e.y}`)), seed, secretRoom: kind };
}

// The boss hall: a corridor opening into a long pillared hall, the boss waiting at its far end with the
// stairs behind it. The hall is built wide, but you walk its centre line straight at the boss (no prompts).
function generateBossHall(floor, seed, biome) {
  const W = 15, H = 17;
  const g = new Uint8Array(W * H), nav = new Uint8Array(W * H);
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : g[y * W + x];
  const navAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : nav[y * W + x];
  const cx = 7;
  for (let y = 12; y <= 15; y++) { g[y * W + cx] = 1; nav[y * W + cx] = 1; }          // the approach
  for (let y = 2; y <= 11; y++) for (let x = cx - 3; x <= cx + 3; x++) g[y * W + x] = 1;   // the hall
  for (let y = 1; y <= 11; y++) nav[y * W + cx] = 1;                                     // its centre aisle
  g[1 * W + cx] = 1;                                                                     // the stairs alcove
  const exits = (x, y) => [0, 1, 2, 3].filter(d => navAt(x + DX[d], y + DY[d]));
  const dist = new Int32Array(W * H).fill(-1);
  for (let y = 1; y <= 15; y++) dist[y * W + cx] = 15 - y;
  const start = { x: cx, y: 15, dir: 0 };
  const stairs = { x: cx, y: 1 };
  const B = BOSSES[biome];
  const entities = [{ type: 'enemy', kind: B.kind, boss: true, x: cx, y: 3 }];
  const occupied = new Set([`${cx},15`, `${cx},1`, `${cx},3`]);
  return { floor, biome, W, H, grid: g, at, exits, start, stairs, entities, dist, occupied, seed, boss: true,
           hall: { x0: cx - 3, x1: cx + 3, y0: 2, y1: 11 } };
}

// ------------------------------------------------------------------ building
const wallRot = d => Math.atan2(-DX[d], -DY[d]);           // front faces back into the cell
const cellPos = (x, y) => [x * CELL, 0, y * CELL];

export function build(level, models) {
  const R = rng(level.seed ^ 0x9e3779b9);
  const { W, H, at, biome } = level;
  const B = BIOMES[biome];
  const bat = new Batcher();
  const lights = [];
  // the cracked wall (and anything hung on it) goes in its own batch, drawn until the wall is blown; the
  // alcove behind it in another, drawn after
  const S = level.secret;
  const sEdge = S ? [S.x * CELL + DX[S.d] * CELL / 2, S.y * CELL + DY[S.d] * CELL / 2] : null;
  const crackBat = new Batcher(), alcoveBat = new Batcher();
  const put = (name, x, y, z, ry = 0, s = 1) => {
    const onCrack = sEdge && Math.abs(x - sEdge[0]) < 0.05 && Math.abs(z - sEdge[1]) < 0.05;
    (onCrack ? crackBat : bat).add(models[name], trs(x, y, z, ry, 0, 0, s));
  };
  const blocked = new Set(level.entities.map(e => `${e.x},${e.y}`));

  // weighted variant lists (plain pieces most often, the painted set-pieces now and then)
  const KITS = {
    dungeon: { walls: ['dun_wall0', 'dun_wall0', 'dun_wall0', 'dun_wall1', 'dun_wall1', 'dun_wall2', 'dun_wall3'],
               floors: ['dun_floor0', 'dun_floor0', 'dun_floor0', 'dun_floor1', 'dun_floor1', 'dun_floor2'], ceil: 'dun_ceil',
               pillar: 'dun_pillar' },
    mines: { walls: ['mine_wall0', 'mine_wall1'], floors: ['mine_floor0', 'mine_floor1'], ceil: 'mine_ceil', spin: true },
    crypt: { walls: ['crypt_wall0', 'crypt_wall0', 'crypt_wall1', 'crypt_wall1', 'crypt_wall2'],
             floors: ['crypt_floor0', 'crypt_floor0', 'crypt_floor0', 'crypt_floor1'], ceil: 'crypt_ceil', pillar: 'crypt_pillar' },
    frozen: { walls: ['ice_wall0', 'ice_wall0', 'ice_wall1', 'ice_wall2', 'ice_wall2'], floors: ['ice_floor0', 'ice_floor0', 'ice_floor1'],
              ceil: 'ice_ceil', spin: true },
    magma: { walls: ['magma_wall0', 'magma_wall0', 'magma_wall1', 'magma_wall2'], floors: ['magma_floor0', 'magma_floor0', 'magma_floor1'],
             ceil: 'magma_ceil', spin: true },
    ruins: { walls: ['ruin_wall0', 'ruin_wall1', 'ruin_wall2'], floors: ['ruin_floor0', 'ruin_floor1'] },
    grotto: { walls: ['grotto_wall0', 'grotto_wall0', 'grotto_wall1', 'grotto_wall2'], floors: ['grotto_floor0', 'grotto_floor0', 'grotto_floor1'],
              ceil: 'grotto_ceil', spin: true },
    vault: { walls: ['vault_wall0', 'vault_wall0', 'vault_wall1', 'vault_wall2', 'vault_wall2'], floors: ['vault_floor0', 'vault_floor0', 'vault_floor1'],
             ceil: 'vault_ceil', pillar: 'vault_pillar' },
    library: { walls: ['library_wall0', 'library_wall0', 'library_wall0', 'library_wall1', 'library_wall2'],
               floors: ['library_floor0', 'library_floor0', 'library_floor1'], ceil: 'library_ceil' },
    foundry: { walls: ['foundry_wall0', 'foundry_wall0', 'foundry_wall1', 'foundry_wall2'], floors: ['foundry_floor0', 'foundry_floor0', 'foundry_floor1'],
               ceil: 'foundry_ceil' },
  };
  // a biome whose kit pieces haven't shipped borrows the dungeon's
  const kitOk = K => K && [...K.walls, ...K.floors, ...(K.ceil ? [K.ceil] : []), ...(K.pillar ? [K.pillar] : [])].every(m => models[m]);
  const KIT = kitOk(KITS[biome]) ? KITS[biome] : KITS.dungeon;
  const walls = KIT.walls, floors = KIT.floors;
  // corner props: the model's corner is its origin with the room toward model +x/+y
  const cornerRot = (ix, iz) => (ix > 0 ? (iz < 0 ? 0 : 3 * Math.PI / 2) : (iz < 0 ? Math.PI / 2 : Math.PI));

  // ---- floors, ceilings, walls
  const margin = biome === 'ruins' ? 5 : 0;
  for (let y = -margin; y < H + margin; y++) {
    for (let x = -margin; x < W + margin; x++) {
      const [cx, , cz] = cellPos(x, y);
      const open = at(x, y);
      if (open) {
        if (!(x === level.stairs.x && y === level.stairs.y)) put(R.pick(floors), cx, 0, cz, R.int(0, 3) * Math.PI / 2);
        if (KIT.ceil) put(KIT.ceil, cx, 0, cz, KIT.spin ? R.int(0, 3) * Math.PI / 2 : 0);
        for (let d = 0; d < 4; d++) {
          if (at(x + DX[d], y + DY[d])) continue;
          const ex = cx + DX[d] * CELL / 2, ez = cz + DY[d] * CELL / 2;
          put(R.pick(walls), ex, 0, ez, wallRot(d));
        }
      } else if (biome === 'ruins') {
        put(R.pick(floors), cx, -0.02, cz, R.int(0, 3) * Math.PI / 2);
        if (R.chance(0.12)) put('rubble0', cx + R() - 0.5, 0, cz + R() - 0.5, R() * 6);
        if (R.chance(0.06)) put('ruin_pillar_short0', cx, 0, cz, R.int(0, 3) * Math.PI / 2);
      }
    }
  }
  // stairs (a secret room has none)
  if (level.stairs.x >= 0) {
    const [sx, , sz] = cellPos(level.stairs.x, level.stairs.y);
    put('stairs', sx, 0, sz, R.int(0, 3) * Math.PI / 2);
    lights.push({ pos: [sx, 0.4, sz], col: [0.25, 0.35, 0.6], radius: 3.5, flicker: 0 });
  }

  // ---- corners: pillars where a wall end is exposed (3 floor cells or a diagonal pair)
  for (let j = 0; j <= H; j++) {
    for (let i = 0; i <= W; i++) {
      const a = at(i - 1, j - 1), b = at(i, j - 1), c = at(i - 1, j), d = at(i, j);
      const n = a + b + c + d;
      const diag = (n === 2 && a === d);
      const px = i * CELL - CELL / 2, pz = j * CELL - CELL / 2;
      if (KIT.pillar && (n === 3 || diag || (n === 1 && R.chance(0.35)))) put(KIT.pillar, px, 0, pz);
      if (biome === 'ruins' && (n === 3 || diag || (n >= 1 && n <= 2 && R.chance(0.3))))
        put(R.chance(0.6) ? R.pick(['ruin_pillar0', 'ruin_pillar1']) : 'ruin_pillar_short0', px, 0, pz, R.int(0, 3) * Math.PI / 2);
    }
  }

  // ---- biome dressing
  let sinceTorch = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!at(x, y)) continue;
      const [cx, , cz] = cellPos(x, y);
      const busy = blocked.has(`${x},${y}`) || (x === level.stairs.x && y === level.stairs.y);
      const wallDirs = [0, 1, 2, 3].filter(d => !at(x + DX[d], y + DY[d]));
      const corridorNS = !at(x + 1, y) && !at(x - 1, y) && at(x, y - 1) + at(x, y + 1) > 0;
      const corridorEW = !at(x, y - 1) && !at(x, y + 1) && at(x - 1, y) + at(x + 1, y) > 0;
      if (biome === 'dungeon' || biome === 'ruins') {
        // torches on walls, spaced out
        sinceTorch++;
        if (wallDirs.length && ((x * 7 + y * 13) % 5 === 0) && sinceTorch > 1) {
          const d = R.pick(wallDirs);
          if (biome === 'dungeon' || R.chance(0.35)) {
            const ex = cx + DX[d] * CELL / 2, ez = cz + DY[d] * CELL / 2;
            put('torch', ex, 0, ez, wallRot(d));
            lights.push({ pos: [ex - DX[d] * 0.3, 1.95, ez - DY[d] * 0.3], col: B.torch, radius: B.torchRadius, flicker: R() * 10 });
            sinceTorch = 0;
            const others = wallDirs.filter(k => k !== d);
            if (biome === 'dungeon' && others.length && R.chance(0.35)) {
              const d2 = R.pick(others);
              put(R.chance(0.7) ? 'banner' : 'banner_blue', cx + DX[d2] * CELL / 2, 0, cz + DY[d2] * CELL / 2, wallRot(d2));
            }
          }
        } else if (biome === 'dungeon' && wallDirs.length && R.chance(0.07)) {
          const d2 = R.pick(wallDirs);
          put(R.chance(0.7) ? 'banner' : 'banner_blue', cx + DX[d2] * CELL / 2, 0, cz + DY[d2] * CELL / 2, wallRot(d2));
        }
        if (biome === 'ruins' && !busy) {
          for (let k = 0; k < 2; k++) if (R.chance(0.5)) put(R.pick(['grass0', 'grass1']), cx + (R() - 0.5) * 1.6, 0, cz + (R() - 0.5) * 1.6, R() * 6);
          if (R.chance(0.1)) put('rubble0', cx + (R() - 0.5) * 1.2, 0, cz + (R() - 0.5) * 1.2, R() * 6);
        }
      }
      if (biome === 'mines') {
        if ((corridorNS || corridorEW) && (x + y) % 2 === 0) {
          const ry = corridorNS ? 0 : Math.PI / 2;
          put('mine_support', cx, 0, cz, ry);
          if ((x + y) % 4 === 0) {
            const ox = corridorNS ? 0.55 : 0, oz = corridorNS ? 0 : 0.55;
            put('lantern', cx + ox, -0.12, cz + oz);
            lights.push({ pos: [cx + ox, 2.0, cz + oz], col: B.torch, radius: B.torchRadius, flicker: R() * 10 });
          }
        }
        if ((corridorNS || corridorEW) && !busy) put('rails', cx, 0, cz, corridorNS ? 0 : Math.PI / 2);
        if (!corridorNS && !corridorEW && wallDirs.length >= 2 && !busy && R.chance(0.35)) {
          const d1 = wallDirs[0], d2 = wallDirs[1];
          put('crate', cx + (DX[d1] + DX[d2]) * 0.58, 0, cz + (DY[d1] + DY[d2]) * 0.58, R() * 0.5);
        }
        if (!busy && wallDirs.length && R.chance(0.1)) {              // glowing crystal clusters
          const d = R.pick(wallDirs);
          const px = cx + DX[d] * 0.72, pz = cz + DY[d] * 0.72;
          put('crystals', px, 0, pz, wallRot(d));
          lights.push({ pos: [px - DX[d] * 0.3, 0.5, pz - DY[d] * 0.3], col: [0.25, 0.55, 1.0], radius: 3.0, flicker: 0 });
        }
        if (!corridorNS && !corridorEW && wallDirs.length && R.chance(0.12)) {
          const d = R.pick(wallDirs);
          const ex = cx + DX[d] * CELL / 2, ez = cz + DY[d] * CELL / 2;
          put('lantern', ex - DX[d] * 0.4, -0.3, ez - DY[d] * 0.4);
          lights.push({ pos: [ex - DX[d] * 0.4, 1.8, ez - DY[d] * 0.4], col: B.torch, radius: B.torchRadius, flicker: R() * 10 });
        }
      }
      if (biome === 'dungeon') {
        // wall corners: cobwebs up high, barrels / crates on the floor
        const corners = [];
        for (let i = 0; i < wallDirs.length; i++) for (let j = i + 1; j < wallDirs.length; j++)
          if ((wallDirs[i] + wallDirs[j]) % 2 === 1) corners.push([wallDirs[i], wallDirs[j]]);
        for (const [d1, d2] of corners) {
          const kx = DX[d1] + DX[d2], kz = DY[d1] + DY[d2];
          if (R.chance(0.35)) put('cobweb', cx + kx * (CELL / 2 - 0.02), 0, cz + kz * (CELL / 2 - 0.02), cornerRot(-kx, -kz));
          if (!busy && R.chance(0.14)) put(R.chance(0.6) ? 'barrel' : 'crate', cx + kx * 0.6, 0, cz + kz * 0.6, R() * 6);
        }
        if (!busy && R.chance(0.08)) put('bones', cx + (R() - 0.5) * 0.9, 0, cz + (R() - 0.5) * 0.9, R() * 6);
        if (wallDirs.length && R.chance(0.06)) {
          const d = R.pick(wallDirs);
          put('chains', cx + DX[d] * 0.62, 0, cz + DY[d] * 0.62, R() * 6);
        }
      }
    }
  }
  // ---- the deeper biomes
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!at(x, y) || (biome !== 'crypt' && biome !== 'frozen' && biome !== 'magma')) continue;
      const [cx, , cz] = cellPos(x, y);
      const busy = blocked.has(`${x},${y}`) || (x === level.stairs.x && y === level.stairs.y);
      const wallDirs = [0, 1, 2, 3].filter(d => !at(x + DX[d], y + DY[d]));
      const corners = [];
      for (let i = 0; i < wallDirs.length; i++) for (let j = i + 1; j < wallDirs.length; j++)
        if ((wallDirs[i] + wallDirs[j]) % 2 === 1) corners.push([wallDirs[i], wallDirs[j]]);
      const lit = (x * 7 + y * 13) % 4 === 0;
      if (biome === 'crypt') {
        if (wallDirs.length && lit) {                                  // candle clusters at the foot of the walls
          const d = R.pick(wallDirs);
          const px = cx + DX[d] * 0.7, pz = cz + DY[d] * 0.7;
          put('candles', px, 0, pz, R() * 6);
          lights.push({ pos: [px - DX[d] * 0.2, 0.6, pz - DY[d] * 0.2], col: B.torch, radius: B.torchRadius, flicker: R() * 10 });
        }
        for (const [d1, d2] of corners) {
          const kx = DX[d1] + DX[d2], kz = DY[d1] + DY[d2];
          if (R.chance(0.45)) put('cobweb', cx + kx * (CELL / 2 - 0.02), 0, cz + kz * (CELL / 2 - 0.02), cornerRot(-kx, -kz));
        }
        if (!busy && wallDirs.length && R.chance(0.16)) {                // coffins laid along a wall
          const d = R.pick(wallDirs);
          put('coffin', cx + DX[d] * 0.55, 0, cz + DY[d] * 0.55, wallRot(d) + Math.PI / 2);
        }
        if (!busy && R.chance(0.14)) put('bones', cx + (R() - 0.5) * 0.9, 0, cz + (R() - 0.5) * 0.9, R() * 6);
        if (wallDirs.length && R.chance(0.08)) {
          const d = R.pick(wallDirs);
          put('chains', cx + DX[d] * 0.62, 0, cz + DY[d] * 0.62, R() * 6);
        }
      }
      if (biome === 'frozen') {
        if (!busy && wallDirs.length && lit) {                          // glowing ice crystals light the caves
          const d = R.pick(wallDirs);
          const px = cx + DX[d] * 0.72, pz = cz + DY[d] * 0.72;
          put('crystals', px, 0, pz, wallRot(d));
          lights.push({ pos: [px - DX[d] * 0.3, 0.6, pz - DY[d] * 0.3], col: B.torch, radius: B.torchRadius, flicker: 0 });
        }
        if (R.chance(0.45)) put('icicles', cx + (R() - 0.5) * 1.1, 0, cz + (R() - 0.5) * 1.1, R() * 6);
      }
      if (biome === 'magma') {
        if (!busy && lit && (corners.length || wallDirs.length)) {       // braziers
          let px, pz;
          if (corners.length) {
            const [d1, d2] = R.pick(corners);
            px = cx + (DX[d1] + DX[d2]) * 0.6; pz = cz + (DY[d1] + DY[d2]) * 0.6;
          } else {
            const d = R.pick(wallDirs);
            px = cx + DX[d] * 0.7; pz = cz + DY[d] * 0.7;
          }
          put('brazier', px, 0, pz, R() * 6);
          lights.push({ pos: [px, 1.1, pz], col: B.torch, radius: B.torchRadius, flicker: R() * 10 });
        }
        if (wallDirs.length && R.chance(0.07)) {
          const d = R.pick(wallDirs);
          put('chains', cx + DX[d] * 0.62, 0, cz + DY[d] * 0.62, R() * 6);
        }
        if (!busy && R.chance(0.05)) put('bones', cx + (R() - 0.5) * 0.9, 0, cz + (R() - 0.5) * 0.9, R() * 6);
      }
    }
  }
  // ---- the grotto's glowing mushrooms and roots, the vault's gold and chandeliers, the library's candles and
  // books, the foundry's gears and vents
  const spinners = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!at(x, y) || !['grotto', 'vault', 'library', 'foundry'].includes(biome) || KIT !== KITS[biome]) continue;
      const [cx, , cz] = cellPos(x, y);
      const busy = blocked.has(`${x},${y}`) || (x === level.stairs.x && y === level.stairs.y);
      const wallDirs = [0, 1, 2, 3].filter(d => !at(x + DX[d], y + DY[d]));
      const corners = [];
      for (let i = 0; i < wallDirs.length; i++) for (let j = i + 1; j < wallDirs.length; j++)
        if ((wallDirs[i] + wallDirs[j]) % 2 === 1) corners.push([wallDirs[i], wallDirs[j]]);
      const lit = (x * 7 + y * 13) % 4 === 0;
      if (biome === 'grotto') {
        if (!busy && (corners.length || wallDirs.length) && (lit || R.chance(0.18))) {
          let px, pz;
          if (corners.length) { const [d1, d2] = R.pick(corners); px = cx + (DX[d1] + DX[d2]) * 0.58; pz = cz + (DY[d1] + DY[d2]) * 0.58; }
          else { const d = R.pick(wallDirs); px = cx + DX[d] * 0.7; pz = cz + DY[d] * 0.7; }
          put('shrooms', px, 0, pz, R() * 6, 0.5 + R() * 0.35);
          if (lit) lights.push({ pos: [px, 0.7, pz], col: R.chance(0.5) ? [0.3, 1.1, 0.95] : [0.8, 0.45, 1.2], radius: 4.4, flicker: 0 });
        }
        if (R.chance(0.22)) put('roots', cx + (R() - 0.5) * 0.6, 0, cz + (R() - 0.5) * 0.6, R() * 6);
      }
      if (biome === 'library') {
        if (!busy && lit && wallDirs.length && models.candelabra) {                  // candles stand against a shelf
          const d = R.pick(wallDirs);
          const px = cx + DX[d] * 0.62, pz = cz + DY[d] * 0.62;
          put('candelabra', px, 0, pz, R() * 6);
          lights.push({ pos: [px, 1.5, pz], col: [1.5, 1.05, 0.55], radius: 4.8, flicker: R() * 10 });
        }
        if (!busy && corners.length && models.book_pile && R.chance(0.35)) {
          const [d1, d2] = R.pick(corners);
          put('book_pile', cx + (DX[d1] + DX[d2]) * 0.55, 0, cz + (DY[d1] + DY[d2]) * 0.55, R() * 6, 0.8 + R() * 0.3);
        }
        if (models.ink_puddle && R.chance(0.08)) put('ink_puddle', cx + (R() - 0.5) * 0.8, 0.005, cz + (R() - 0.5) * 0.8, R() * 6);
      }
      if (biome === 'foundry') {
        if (!busy && wallDirs.length === 3 && models.gear_stand) {                 // a dead end holds a turning gear
          const back = [0, 1, 2, 3].find(k => at(x + DX[k], y + DY[k]));
          const w = (back + 2) % 4;
          spinners.push({ model: 'gear_stand', x: cx + DX[w] * 0.5, z: cz + DY[w] * 0.5, ry: wallRot(w) });
        }
        if (!busy && models.steam_vent && R.chance(0.07)) put('steam_vent', cx, 0, cz, R.int(0, 3) * Math.PI / 2);
        for (const [d1, d2] of corners) {                                           // pipes run up the inside corners
          const kx = DX[d1] + DX[d2], kz = DY[d1] + DY[d2];
          if (models.pipe_corner && R.chance(0.3)) put('pipe_corner', cx + kx * (CELL / 2 - 0.02), 0, cz + kz * (CELL / 2 - 0.02), cornerRot(-kx, -kz));
        }
        if (lit) lights.push({ pos: [cx, 0.35, cz], col: [1.5, 0.7, 0.25], radius: 4.0, flicker: R() * 10 });   // furnace light from below the grates
      }
      if (biome === 'vault') {
        if (!busy && corners.length && R.chance(0.3)) {
          const [d1, d2] = R.pick(corners);
          put('coin_pile', cx + (DX[d1] + DX[d2]) * 0.55, 0, cz + (DY[d1] + DY[d2]) * 0.55, R() * 6, 0.8 + R() * 0.4);
        }
        if (lit && !busy) {
          put('chandelier', cx, 0, cz, R() * 6);
          lights.push({ pos: [cx, 2.1, cz], col: B.torch, radius: B.torchRadius, flicker: R() * 10 });
        }
      }
    }
  }
  // ---- the boss hall: braziers down both sides, the stairs lit behind the boss
  if (level.hall) {
    const { x0, x1, y0, y1 } = level.hall;
    for (let y = y0 + 1; y <= y1 - 1; y += 3) {
      for (const x of [x0, x1]) {
        const [px, , pz] = cellPos(x, y);
        const ox = (x === x0 ? -1 : 1) * 0.55;
        put('brazier', px + ox, 0, pz, R() * 6);
        lights.push({ pos: [px + ox, 1.1, pz], col: [2.0, 1.1, 0.5], radius: 6.5, flicker: R() * 10 });
      }
    }
  }
  // ruins skyline
  if (biome === 'ruins') {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + R() * 0.3;
      const r = Math.max(W, H) * CELL * 0.5 + 10 + R() * 14;
      const cx = (W - 1) * CELL / 2 + Math.cos(a) * r, cz = (H - 1) * CELL / 2 + Math.sin(a) * r;
      put(R.pick(['ruin_tower0', 'ruin_tower1']), cx, -0.5, cz, R() * 6, 1 + R() * 0.8);
    }
  }
  for (const e of level.entities) {
    if (e.type === 'room') lights.push({ pos: [e.x * CELL, 1.3, e.y * CELL], col: ROOMS[e.kind].light, radius: 3.8, flicker: e.kind === 'forge' ? 3 : 0 });
  }
  if (S) {
    crackBat.add(models.crack_wall, trs(sEdge[0], 0, sEdge[1], wallRot(S.d), 0, 0, 1));
    for (const l of lights) if (Math.hypot(l.pos[0] - sEdge[0], l.pos[2] - sEdge[1]) < 0.9) l.secretWall = true;   // a torch on it
    const [ax, , az] = cellPos(S.ax, S.ay);
    alcoveBat.add(models[R.pick(floors)], trs(ax, 0, az, 0, 0, 0, 1));
    if (KIT.ceil) alcoveBat.add(models[KIT.ceil], trs(ax, 0, az, 0, 0, 0, 1));
    for (let d = 0; d < 4; d++) {
      if (d !== (S.d + 2) % 4) alcoveBat.add(models[R.pick(walls)], trs(ax + DX[d] * CELL / 2, 0, az + DY[d] * CELL / 2, wallRot(d), 0, 0, 1));
    }
  }
  return { batches: bat.build(), lights, crack: crackBat.build(), alcove: alcoveBat.build(), spinners };
}
