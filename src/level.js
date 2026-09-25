// level.js - procedural floors for the six biomes (the concept's dungeon / mines /
// ruins plus the crypt, the frozen caverns and the magma forge).
//
// Grid: cell (x, y) is centred at world (x*CELL, 0, y*CELL); y grows toward +Z.
// Directions: 0 = north (-Z), 1 = east (+X), 2 = south (+Z), 3 = west (-X).
import { rng, trs } from './math.js?v=20260925194320';
import { Batcher } from './gl.js?v=20260925194320';
import { BIOMES, ELITES, biomeForFloor, LAST_FLOOR } from './data.js?v=20260925194320';

export const CELL = 2.0;
export const WALL_H = 2.6;
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

// ------------------------------------------------------------------ generation
// Branching corridor mazes: every decision happens at a junction, where the
// player is prompted Left / Forward / Right / Back (Doom RPG style).
export function generate(floor, seed) {
  const R = rng(seed);
  const biome = biomeForFloor(floor);
  const tier = (floor - 1) % 2 + (floor > 6 ? 1 : 0);      // floors grow as you descend
  const W = 15 + tier * 2, H = W;                       // odd sizes: nodes sit on odd coordinates
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

  // elite guarding the stairs on the last floor of each biome
  if (floor >= LAST_FLOOR || biomeForFloor(floor + 1) !== biome) {
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
  const nChests = Math.min(deadEnds.length, 1 + (R.chance(0.6) ? 1 : 0) + (floor >= 4 && R.chance(0.4) ? 1 : 0));
  for (let i = 0; i < nChests; i++) {
    const [x, y] = deadEnds.splice(Math.floor(R() * deadEnds.length), 1)[0];
    occupied.add(key(x, y));
    entities.push({ type: 'chest', x, y, face: faceOpen(x, y), mimic: floor > 1 && R.chance(0.25) });
  }
  // enemies block corridors
  const nEnemies = Math.min(3 + floor, 9);
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
  return { floor, biome, W, H, grid: g, at, exits, start, stairs, entities, dist, occupied, seed };
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
  const put = (name, x, y, z, ry = 0, s = 1) => bat.add(models[name], trs(x, y, z, ry, 0, 0, s));
  const blocked = new Set(level.entities.map(e => `${e.x},${e.y}`));

  // weighted variant lists (plain pieces most often, the painted set-pieces now and then)
  const KIT = {
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
  }[biome];
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
  // stairs
  {
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
  // ruins skyline
  if (biome === 'ruins') {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + R() * 0.3;
      const r = Math.max(W, H) * CELL * 0.5 + 10 + R() * 14;
      const cx = (W - 1) * CELL / 2 + Math.cos(a) * r, cz = (H - 1) * CELL / 2 + Math.sin(a) * r;
      put(R.pick(['ruin_tower0', 'ruin_tower1']), cx, -0.5, cz, R() * 6, 1 + R() * 0.8);
    }
  }
  return { batches: bat.build(), lights };
}
