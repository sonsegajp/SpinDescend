// game.js - Spin & Descend: a slot-machine roguelike. Spin. Fight. Loot.
// Upgrade. Die. Spin again.
import { gl } from './gl.js?v=20260925234504';
import { perspective, lookAt, mul, trs, xform, clamp, lerp, angleLerp, easeOut, rng } from './math.js?v=20260925234504';
import { Renderer, invert } from './render.js?v=20260925234504';
import { SlotMachine } from './slot.js?v=20260925234504';
import { CardView } from './cards.js?v=20260925234504';
import { UI, SERIF } from './ui.js?v=20260925234504';
import { Animator } from './anim.js?v=20260925234504';
import { FX, RECIPES, EVENTS } from './fx.js?v=20260925234504';
import { is } from './input.js?v=20260925234504';
import { generate, build, CELL, DX, DY } from './level.js?v=20260925234504';
import { SYMBOLS, CARDS, RARITY, CARD_PRICE, ENEMIES, BIOMES, biomeForFloor, LAST_FLOOR, CLASSES, CLASS_ORDER, OMENS,
         FAMILY, FAMILY_NAME, FAMILY_ICON, LINE_BONUS, SPECIAL_LINE, SCATTER_BONUS, CARD_ICON } from './data.js?v=20260925234504';

// run progress kept in the browser: the deepest floor ever reached unlocks classes
function loadProgress() {
  try { return Object.assign({ best: 1 }, JSON.parse(localStorage.getItem('sd_progress') || '{}')); } catch (e) { return { best: 1 }; }
}
function saveProgress(p) { try { localStorage.setItem('sd_progress', JSON.stringify(p)); } catch (e) { /* storage blocked */ } }

const EYE = 0.84, BACK = 0.8, PITCH = -0.19, FOV = 58 * Math.PI / 180;
const SHOP_YAW = 0.34;                                            // shop: camera turns so the merchant stands right of the cards
const ENEMY_SCALE = 1.18;
const dirYaw = d => Math.atan2(DX[d], DY[d]);

export class Game {
  constructor(assets, input, audio, overlay, pipe) {
    this.a = assets;
    this.pipe = pipe;
    this.input = input;
    this.audio = audio;
    this.R = new Renderer(assets);
    this.slot = new SlotMachine(this.R, assets);
    this.cards = new CardView(this.R, assets);
    this.ui = new UI(overlay);
    this.fx = new FX();
    this.time = 0;
    this.skin = 'classic';
    this.paladinTex = null;
    this.progress = loadProgress();
    this.cls = 'knight';
    try { const c = localStorage.getItem('sd_class'); if (CLASSES[c] && this.unlocked(c)) this.cls = c; } catch (e) { /* storage blocked */ }
    this.toTitle();
  }

  resize(W, H) {
    this.W = W; this.H = H;
    this.ui.resize(W, H, this.pipe.HUD);
    this.slot.layout(W, H);
    if (this.state === 'shop') this.cards.layout(W, H, this.slot, [0.28, 0.86], 0.78);
    else this.cards.layout(W, H, this.slot);
    this.proj = perspective(FOV, W / H, 0.05, 90);
  }

  // test hooks: ?start, ?floor=N, ?face=0-3, ?combat, ?reward, ?shop, ?skin=paladin, ?map
  debug(q) {
    if (q.has('autospin')) {                  // ?autospin: play fights by itself and log them (headless balance checks)
      this.autoSpin = true;
      window.__log = [];
      const toast = this.ui.toast.bind(this.ui);
      this.ui.toast = (str, ...r) => {
        window.__log.push(`[t${this.combat ? this.combat.turn : '-'} hp${this.player ? this.player.hp : '-'}] ${str}`);
        return toast(str, ...r);
      };
    }
    if (q.get('skin') === 'paladin') this.skin = 'paladin';
    if (q.get('unlock') === 'all') this.progress.best = 99;                              // ?unlock=all: every class
    if (CLASSES[q.get('class')]) { this.cls = q.get('class'); this.titleKnight = null; }  // ?class=rogue|mage
    if (q.has('pods')) this.forcePods = true;
    if (OMENS[q.get('omen')]) this.forceOmen = q.get('omen');                            // ?omen=greed: skip the choice                                            // ?pods: the Rogue summons every spin
    if (q.get('model') && this.a.models[q.get('model')]) {             // ?title&model=name&yaw=deg: show any model on the plinth
      this.viewModel = q.get('model');
      this.viewYaw = parseFloat(q.get('yaw') || '0') * Math.PI / 180;
      if (this.a.anims[this.viewModel]) this.titleKnight = this.makeAnimator(this.viewModel);
    }
    if (q.get('seed')) this.fixedSeed = parseInt(q.get('seed'), 10);
    if (q.has('title')) return;
    this.newRun();
    this.fade = null;
    if (this.state === 'omen' && !q.has('omens')) { this.omenOffer = null; this.state = 'explore'; }   // ?omens: show the choice
    const f = parseInt(q.get('floor') || '1', 10);
    if (f > 1) {
      this.loadFloor(f, this.runSeed + f * 7919);
      this.ui.toasts = [];
      this.ui.toast(`Floor ${f} - The ${BIOMES[biomeForFloor(f)].name}`, this.time, '#e8c878', 2.6);
    }
    if (q.get('face')) { this.dir = parseInt(q.get('face'), 10) & 3; this.cam.yaw = dirYaw(this.dir); }
    if (q.has('map')) this.showMap = true;
    if (q.get('relics')) for (const r of q.get('relics').split(',')) if (CARDS[r]) this.applyCard(r);   // ?relics=war_drum,hourglass
    if (q.get('reels')) { const b = q.get('reels').split(',').filter(id => SYMBOLS[id]); if (b.length) this.player.bag = b; }  // ?reels=sword,mirror
    if (q.has('combat')) {
      const e = this.entities.find(x => x.type === 'enemy' && (!q.get('combat') || x.kind === q.get('combat'))) ||
                this.entities.find(x => x.type === 'enemy');
      const want = q.get('combat');
      if (e && want && e.kind !== want && ENEMIES[want]) {          // force the kind (viewer for any enemy)
        const hp = Math.round(e.hp / e.def.hp * ENEMIES[want].hp);
        Object.assign(e, { kind: want, def: ENEMIES[want], hp, maxHp: hp, atk: ENEMIES[want].atk,
                          animator: this.makeAnimator(ENEMIES[want].model) });
      }
      if (e) this.teleportNextTo(e);
      if (e) this.startCombat(e);
      if (q.get('grid')) this.forceGrid = q.get('grid').split(',');
      if (q.has('spin')) this.later(0.6, () => this.spinReels());
    }
    if (q.has('reward')) this.offerCards(3, 'chest');
    if (q.get('pick')) this.later(1.0, () => this.pickReward(parseInt(q.get('pick'), 10)));      // ?reward&pick=i
    if (q.has('fxtest')) this.later(0.9, () => {                                                // ?fxtest: every primitive
      this.fx.glow(120, 120, 40, 5, '#ff8a3a');
      this.fx.ring(260, 120, 20, 30, 5, '#8ad8ff', 3);
      EVENTS.card(this.fx, 400, 130, this.fxCtx(null), '#4c5fe0', 2);
      this.fx.burst(540, 120, { n: 20, life: [4, 5], speed: [5, 20], shape: 'star', col: '#ffe84a', add: true });
      this.fx.flash('#ff0000', 5, 0.3);
    });
    if (q.has('bag')) { this.bagReturn = this.state; this.state = 'bag'; this.bagPage = q.get('bag') || 'reels'; }
    if (q.has('merchant')) {
      const m = this.entities.find(e => e.wayside);
      const d = m && this.level.exits(m.x, m.y)[0];
      if (m) {
        this.px = m.x + DX[d]; this.py = m.y + DY[d]; this.dir = (d + 2) % 4;
        this.cam = { x: this.px * CELL, z: this.py * CELL, yaw: dirYaw(this.dir), bob: 0 };
        this.reveal();
        this.step(this.dir);
        // ?trade: open his shop, then walk on
        const trade = () => {
          if (!this.prompt || this.move) { this.later(0.2, trade); return; }
          this.choose('use');
          if (!q.has('stay')) this.later(1.0, () => this.leaveShop());      // ?merchant&trade&stay: stay in the shop
        };
        if (q.has('trade')) this.later(0.5, trade);
      }
    }
    if (q.has('shop')) this.openShop({ x: 0, y: 0 });
  }

  teleportNextTo(e) {
    for (let d = 0; d < 4; d++) {
      const x = e.x - DX[d], y = e.y - DY[d];
      if (this.level.at(x, y) && !this.entityAt(x, y)) {
        this.px = x; this.py = y; this.dir = d;
        this.cam = { x: x * CELL, z: y * CELL, yaw: dirYaw(d), bob: 0 };
        this.reveal();
        return;
      }
    }
  }

  // =============================================================== run setup
  unlocked(c) { return !CLASSES[c].unlock || this.progress.best >= CLASSES[c].unlock; }

  // a symbol this class can ever hold: only a Mage wields magic, and a Mage never swings steel
  symOk(id) {
    const f = FAMILY[id];
    return (this.player && this.player.cls === 'mage') ? f !== 'blade' : f !== 'spell';
  }

  reachFloor(f) {
    if (f <= this.progress.best) return;
    const before = CLASS_ORDER.filter(c => this.unlocked(c));
    this.progress.best = f;
    saveProgress(this.progress);
    for (const c of CLASS_ORDER) {
      if (!before.includes(c) && this.unlocked(c)) {
        this.later(1.2, () => { this.ui.toast(`${CLASSES[c].name} is unlocked!`, this.time, '#ffd878', 3.4); this.audio.play('jackpot'); });
      }
    }
  }

  setClass(c) {
    if (c === this.cls) return;
    this.cls = c;
    this.titleKnight = null;
    try { if (this.unlocked(c)) localStorage.setItem('sd_class', c); } catch (e) { /* storage blocked */ }
  }

  toTitle() {
    this.state = 'title';
    this.titleKnight = this.viewModel ? this.titleKnight : null;
    this.menuFocus = 0;
    this.loadFloor(1, 1234567, true);
    this.slot.state.spinEnabled = false;
    this.slot.state.spinLabel = 'SPIN';
    this.slot.setStatic([['sword', 'shield', 'potion'], ['coin', 'skull', 'chest']]);
  }

  newRun() {
    if (!this.unlocked(this.cls)) this.cls = 'knight';
    const K = CLASSES[this.cls];
    this.player = { cls: this.cls, hp: K.hp, maxHp: K.hp, gold: 0, bag: [...K.bag], relics: new Set(), armor: 0, evolve: {},
                    kills: 0, cards: 0, might: 0, guard: K.guard || 0, fortune: 0, luck: K.luck || 0, blast: 0, venom: 0,
                    lifesteal: 0, casts: 0 };
    this.runSeed = this.fixedSeed ?? ((Math.random() * 1e9) | 0);
    this.slot.state.hp = K.hp; this.slot.state.maxHp = K.hp; this.slot.state.gold = 0;
    this.slot.summonPods(false);
    this.slot.setTheme({ mage: 'arcane', knight: 'knight', rogue: 'forest' }[this.cls] || 'classic');
    this.slot.setStatic([[K.bag[0], 'shield', 'potion'], ['coin', 'skull', 'chest']]);
    this.loadFloor(1, this.runSeed + 1);
    this.fadeIn();
    // an omen before the first step: three offered, take one or refuse
    const keys = Object.keys(OMENS).sort(() => Math.random() - 0.5).slice(0, 3);
    if (this.forceOmen) { this.applyOmen(this.forceOmen); this.enterFloorOne(); return; }
    this.omenOffer = keys;
    this.omenFocus = -1;
    this.state = 'omen';
  }

  enterFloorOne() {
    this.state = 'explore';
    this.ui.toast('Floor 1 - The Dungeon', this.time, '#e8c878', 2.6);
    this.ui.toast('A goblin merchant trades on the way to the stairs', this.time, '#ffd24a', 3.2);
  }

  applyOmen(k) {
    const P = this.player;
    P.omen = k;
    if (!k) return;
    const O = { greed: 0, glass: 0, fortune: 0, hoard: 0, iron: 0, swarm: 0, frailty: 0, wild: 0 };
    if (k === 'glass') { P.might += 2; P.maxHp = Math.max(8, Math.round(P.maxHp * 0.7)); P.hp = P.maxHp; }
    if (k === 'fortune') P.luck = Math.round((P.luck + 0.15) * 100) / 100;
    if (k === 'iron') { P.guard += 2; P.maxHp -= 5; P.hp = P.maxHp; }
    if (k === 'frailty') P.bag.push('skull', 'skull');
    if (k === 'wild') P.bag.push('wild');
    this.slot.state.hp = P.hp; this.slot.state.maxHp = P.maxHp;
    // the floor was generated before the choice: the Swarm and the Hoard reshape it now
    if (k === 'swarm' || k === 'hoard') this.loadFloor(1, this.runSeed + 1);
    for (const e of this.entities) if (e.type === 'enemy') this.omenFoe(e);
    return O;
  }

  // Greed thickens foes, the Wild sharpens them
  omenFoe(e) {
    const k = this.player && this.player.omen;
    if (e.omened) return;
    e.omened = true;
    if (k === 'greed') { e.hp = e.maxHp = Math.round(e.maxHp * 1.25); }
    if (k === 'wild') e.atk += 1;
  }

  updateOmen(keys, clicks) {
    const pick = (i) => {
      const k = i < 0 ? null : this.omenOffer[i];
      if (i >= 0 && !k) return;
      this.applyOmen(k);
      this.audio.play(k ? 'jackpot' : 'click');
      if (k) this.ui.toast(`${OMENS[k].name}: ${OMENS[k].desc}`, this.time, '#e8c070', 3.4);
      this.omenOffer = null;
      this.enterFloorOne();
    };
    for (const k of keys) {
      if (is(k, 'n1')) pick(0);
      else if (is(k, 'n2')) pick(1);
      else if (is(k, 'n3')) pick(2);
      else if (is(k, 'cancel')) pick(-1);
      else if (is(k, 'turnL')) this.omenFocus = Math.max(0, this.omenFocus - 1);
      else if (is(k, 'turnR')) this.omenFocus = Math.min(2, this.omenFocus + 1);
      else if (is(k, 'confirm') && this.omenFocus >= 0) pick(this.omenFocus);
      if (this.state !== 'omen') return;
    }
    for (const c of clicks) {
      const id = this.ui.hit(c);
      if (id === 'omen:none') { pick(-1); return; }
      if (id && id.startsWith('omen:')) { pick(parseInt(id.slice(5), 10)); return; }
    }
  }

  loadFloor(floor, seed, title = false) {
    this.floor = floor;
    const om = this.player && this.player.omen;
    this.level = generate(floor, seed, { mimics: om === 'hoard' ? 2 : 1, extraFoes: om === 'swarm' ? 2 : 0 });
    this.biome = BIOMES[this.level.biome];
    const built = build(this.level, this.a.models);
    this.static = built.batches;
    this.lights = built.lights;
    this.entities = this.level.entities.map(e => this.spawn(e));
    for (const e of this.entities) if (e.type === 'enemy') this.omenFoe(e);
    if (this.player && this.player.relics.has('treasure_map'))
      for (const e of this.entities) if (e.type === 'chest') this.explored.add(`${e.x},${e.y}`);
    this.px = this.level.start.x; this.py = this.level.start.y; this.dir = this.level.start.dir;
    this.cam = { x: this.px * CELL, z: this.py * CELL, yaw: dirYaw(this.dir), bob: 0 };
    this.move = null;
    this.explored = new Set();
    this.reveal();
    this.combat = null;
    this.state = title ? 'title' : 'explore';
    this.audio.ambience(this.level.biome);
    this.slot.state.spinEnabled = false;
  }

  spawn(e) {
    if (e.type === 'enemy') {
      const def = ENEMIES[e.kind];
      const mult = 1 + (this.floor - 1) * 0.125;           // 12 floors: peaks where the old 9-floor run did
      const hp = Math.round(def.hp * mult * (e.elite ? 1.7 : 1));
      const ent = { ...e, def, hp, maxHp: hp, atk: def.atk + Math.floor((this.floor - 1) / 4) + (e.elite ? 1 : 0),
               poison: 0, burn: 0, stunTurns: 0, alive: true, flash: 0, advance: 0, turn: 0, fadeOut: 0,
               phase: Math.random() * 6, scale: ENEMY_SCALE * (e.elite ? 1.3 : 1) };
      ent.animator = this.makeAnimator(def.model);
      return ent;
    }
    const ent = { ...e, open: 0, opened: false };
    if (e.type === 'merchant') ent.animator = this.makeAnimator('merchant');
    return ent;
  }

  makeAnimator(model) {
    const an = this.a.anims[model];
    if (!an) return null;
    const A = new Animator(this.a.models[model], an);
    A.play('idle', { fade: 0, at: Math.random() * 3 });
    return A;
  }

  anim(e, name, opts) { if (e && e.animator && e.animator.has(name)) e.animator.play(name, opts); }

  // things that block a corridor (a wayside merchant stands aside and lets you pass)
  entityAt(x, y) { return this.entities.find(e => e.x === x && e.y === y && e.alive !== false && !e.gone && !e.wayside); }
  waysideAt(x, y) { return this.entities.find(e => e.wayside && e.x === x && e.y === y); }

  reveal() {
    const L = this.level;
    const mark = (x, y) => this.explored.add(`${x},${y}`);
    mark(this.px, this.py);
    for (let d = 0; d < 4; d++) {
      let x = this.px, y = this.py;
      for (let k = 0; k < 6; k++) {
        x += DX[d]; y += DY[d];
        mark(x, y);
        if (!L.at(x, y)) break;
      }
    }
  }

  // =============================================================== frame
  later(delay, fn) { (this.timers || (this.timers = [])).push({ at: this.time + delay, fn }); }

  update(dt, now) {
    if (this.autoSpin && this.combat && this.combat.phase === 'ready' && this.slot.state.spinEnabled && this.player.hp > 0) {
      this.autoSpinAt = this.autoSpinAt || now + 0.4;
      if (now >= this.autoSpinAt) { this.autoSpinAt = 0; window.__log.push(`-- spin (turn ${this.combat.turn + 1})`); this.spinReels(); }
    }
    this.time = now;
    if (this.autoSpin && this.combat && this.combat.phase !== this.lastPhase) {        // fight log: phase changes
      this.lastPhase = this.combat.phase;
      window.__log.push(`   ${now.toFixed(2)} ${this.lastPhase}${this.combat.queue ? ' q' + this.combat.queue.length : ''}`);
    }
    this.fx.update(dt);
    const dropTo = this.state === 'shop' || (this.prompt && (this.prompt.kind === 'merchant' || this.prompt.kind === 'wayside')) ? 1 : 0;
    this.slot.drop += (dropTo - this.slot.drop) * Math.min(1, dt * 5);
    if (Math.abs(dropTo - this.slot.drop) < 0.002) this.slot.drop = dropTo;
    const lookTo = this.state === 'shop' ? 1 : 0;                   // turn to put the merchant on the right
    this.shopLook = (this.shopLook || 0) + (lookTo - (this.shopLook || 0)) * Math.min(1, dt * 4);
    if (this.timers && this.timers.length) {
      const due = this.timers.filter(t => t.at <= now);
      this.timers = this.timers.filter(t => t.at > now);
      due.forEach(t => t.fn());
    }
    const { keys, clicks } = this.input.take();
    if (keys.length || clicks.length) this.audio.unlock();
    for (const k of keys) if (is(k, 'mute')) this.ui.toast(this.audio.toggleMute() ? 'Sound off' : 'Sound on', now);
    for (const k of keys) if (is(k, 'map') && this.state !== 'title') this.showMap = !this.showMap;
    for (const k of keys) if (is(k, 'crt')) this.toggleCRT();

    this.slot.update(dt, now, (i) => this.onReelStop(i));
    const pointer = this.input.pointer;
    this.cardHover = this.cards.active ? this.cards.update(now, pointer) : -1;
    this.slot.state.spinHover = !!(pointer && this.inRect(pointer, this.slot.spinRect()));

    const song = this.state === 'title' ? 'title' : this.state === 'shop' ? 'shop' : this.level.biome;
    if (song !== this.songNow) { this.songNow = song; this.audio.song(song); }
    this.audio.intensity(this.combat ? 'combat' : 'explore');
    const wasBag = this.state === 'bag';
    switch (this.state) {
      case 'title': this.updateTitle(keys, clicks); break;
      case 'explore': this.updateExplore(dt, keys, clicks); break;
      case 'combat': this.updateCombat(dt, keys, clicks); break;
      case 'reward': this.updateReward(keys, clicks); break;
      case 'shop': this.updateShop(keys, clicks); break;
      case 'stairs': this.updateStairs(keys, clicks); break;
      case 'omen': this.updateOmen(keys, clicks); break;
      case 'bag':
        for (const k of keys) {
          if (is(k, 'bag') && this.bagPage !== 'pay') this.bagPage = 'pay';
          else if (is(k, 'bag') || is(k, 'cancel') || is(k, 'confirm')) this.state = this.bagReturn;
        }
        for (const c of clicks) {
          const id = this.ui.hit(c);
          if (id === 'close') this.state = this.bagReturn;
          if (id && id.startsWith('page:')) this.bagPage = id.slice(5);
        }
        break;
      case 'dead': case 'won': this.updateEnd(keys, clicks); break;
    }
    if (!wasBag && ['explore', 'combat', 'shop', 'reward', 'stairs'].includes(this.state)) {
      for (const k of keys) if (is(k, 'bag')) { this.bagReturn = this.state; this.state = 'bag'; this.bagPage = 'reels'; }
    }
    this.animateCamera(dt);
    this.animateEntities(dt, now);
    this.computeView(now);
    if (this.fade) this.fade.t += dt;
  }

  inRect(p, r) { return p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h; }

  // =============================================================== title
  updateTitle(keys, clicks) {
    // the chosen class on the pedestal: heroic idle, then a rotating set of showpieces
    if (!this.titleKnight) {
      this.titleKnight = this.makeAnimator(this.viewModel || CLASSES[this.cls].model);
      this.titleNext = this.time + 1.6;
      this.titleShow = 0;
    }
    const A = this.titleKnight;
    if (A && this.time > this.titleNext && A.name === 'idle') {
      const shows = ['victory', 'flourish', 'bash', 'attack'];
      A.play(shows[this.titleShow++ % shows.length], { fade: 0.15 });
      this.titleNext = this.time + 4.2;
    }
    const menu = this.titleMenu();
    this.menuFocus = Math.min(this.menuFocus, menu.length - 1);
    for (const k of keys) {
      if (is(k, 'confirm')) this.titleAction(menu[this.menuFocus]);
      if (is(k, 'back')) this.menuFocus = Math.min(menu.length - 1, this.menuFocus + 1);
      if (is(k, 'forward')) this.menuFocus = Math.max(0, this.menuFocus - 1);
      if (is(k, 'turnL')) this.titleAction('cls:prev');
      if (is(k, 'turnR')) this.titleAction('cls:next');
    }
    for (const c of clicks) { const id = this.ui.hit(c); if (id) this.titleAction(id); }
  }

  toggleCRT() {
    this.pipe.crt = !this.pipe.crt;
    try { localStorage.setItem('sd_crt', this.pipe.crt ? '1' : '0'); } catch (e) { /* storage blocked */ }
    this.ui.toast(this.pipe.crt ? 'CRT filter on' : 'CRT filter off', this.time);
  }

  titleMenu() { return this.cls === 'knight' ? ['start', 'skin', 'crt'] : ['start', 'crt']; }

  titleAction(id) {
    this.audio.play('click');
    if (id === 'crt') this.toggleCRT();
    if (id === 'cls:prev' || id === 'cls:next') {
      const i = CLASS_ORDER.indexOf(this.cls), n = CLASS_ORDER.length;
      this.setClass(CLASS_ORDER[(i + (id === 'cls:next' ? 1 : n - 1)) % n]);
      this.audio.play('card');
    }
    if (id === 'start') {
      if (!this.unlocked(this.cls)) {
        this.audio.play('deny');
        this.ui.toast(`Reach Floor ${CLASSES[this.cls].unlock} to unlock ${CLASSES[this.cls].name}`, this.time, '#ff8a6a');
        return;
      }
      this.newRun();
    }
    if (id === 'skin') {
      this.skin = this.skin === 'classic' ? 'paladin' : 'classic';
      this.audio.play('card');
    }
  }

  // =============================================================== exploring
  // Doom RPG style: the party walks on its own, one cell at a time. It stops and
  // asks at every junction (Left / Forward / Right / Back), at dead ends, and in
  // front of chests, merchants and stairs. Enemies block the way -> combat.
  exitsHere() {
    return this.level.exits(this.px, this.py);
  }

  // relative choices for the current cell: [{ d, rel: 'left'|'forward'|'right'|'back', what }]
  choices() {
    const out = [];
    for (const d of this.exitsHere()) {
      const rel = ['forward', 'right', 'back', 'left'][(d - this.dir + 4) % 4];
      const e = this.entityAt(this.px + DX[d], this.py + DY[d]);
      let what = '';
      if (e && e.type === 'enemy') what = e.def.name;
      else if (e && e.type === 'chest' && !e.opened) what = 'Chest';
      else if (e && e.type === 'merchant') what = 'Merchant';
      else if (this.px + DX[d] === this.level.stairs.x && this.py + DY[d] === this.level.stairs.y) what = 'Stairs';
      out.push({ d, rel, what });
    }
    return out;
  }

  updateExplore(dt, keys, clicks) {
    if (this.move) return;
    if (this.prompt) { this.updatePrompt(keys, clicks); return; }
    if (this.time < (this.autoAt || 0)) return;
    this.autoStep();
  }

  autoStep() {
    const ahead = this.entityAt(this.px + DX[this.dir], this.py + DY[this.dir]);
    const aheadOpen = this.level.at(this.px + DX[this.dir], this.py + DY[this.dir]);
    if (ahead && aheadOpen) {
      if (ahead.type === 'enemy') { this.startCombat(ahead); return; }
      if (ahead.type === 'chest' && !ahead.opened) { this.ask('chest', ahead); return; }
      if (ahead.type === 'merchant') { this.ask('merchant', ahead); return; }
    }
    const back = (this.dir + 2) % 4;
    const opts = this.choices().filter(c => {
      if (c.d === back) return false;
      const e = this.entityAt(this.px + DX[c.d], this.py + DY[c.d]);
      return !(e && e.type === 'chest' && e.opened);
    });
    if (opts.length === 0) { this.ask('deadend'); return; }
    if (opts.length === 1 && !opts[0].what) {
      const d = opts[0].d;
      if (d !== this.dir) { this.dir = d; this.startTurn(0.2); this.pendingStep = d; return; }   // bend: follow it
      this.step(d);
      return;
    }
    this.ask('junction');
  }

  ask(kind, ent = null) {
    this.prompt = { kind, ent, t0: this.time };
  }

  startTurn(dur = 0.18) {
    this.move = { t: 0, dur, kind: 'turn' };
  }

  step(d) {
    this.px += DX[d]; this.py += DY[d];
    this.move = { t: 0, dur: 0.26, kind: 'step' };
    this.audio.play('step');
    this.reveal();
  }

  choose(rel) {
    const P = this.prompt;
    if (!P) return;
    if (P.kind === 'wayside') {
      if (rel === 'use') { this.prompt = null; this.openShop(P.ent); }
      if (rel === 'back') { this.prompt = null; this.audio.play('click'); this.moveOn(); }
      return;
    }
    if (P.kind === 'chest' || P.kind === 'merchant') {
      if (rel === 'use') { this.prompt = null; this.interact(P.ent); return; }
      if (rel === 'back') {
        this.prompt = null;
        this.dir = (this.dir + 2) % 4;
        this.startTurn(0.3);
        this.pendingStep = this.dir;
      }
      return;
    }
    const opt = this.choices().find(c => c.rel === rel);
    if (!opt) { this.audio.play('deny'); return; }
    this.prompt = null;
    this.audio.play('click');
    if (opt.d !== this.dir) {
      this.dir = opt.d;
      this.startTurn(rel === 'back' ? 0.3 : 0.2);
      this.pendingStep = opt.d;                   // step once the turn finishes
    } else if (this.entityAt(this.px + DX[opt.d], this.py + DY[opt.d])) {
      this.autoAt = this.time;                    // an enemy/chest is right there: let autoStep handle it
    } else this.step(opt.d);
  }

  updatePrompt(keys, clicks) {
    const P = this.prompt;
    if (this.time - P.t0 < 0.12) return;
    const use = P.kind === 'chest' || P.kind === 'merchant' || P.kind === 'wayside';
    for (const k of keys) {
      if (is(k, 'turnL') || is(k, 'strafeL')) this.choose('left');
      else if (is(k, 'turnR') || is(k, 'strafeR')) this.choose('right');
      else if (is(k, 'forward')) this.choose(use ? 'use' : 'forward');
      else if (is(k, 'back')) this.choose('back');
      else if (is(k, 'confirm')) this.choose(use ? 'use' : (this.choices().some(c => c.rel === 'forward') ? 'forward' : 'back'));
      if (!this.prompt) return;
    }
    for (const c of clicks) {
      const id = this.ui.hit(c);
      if (id && id.startsWith('go:')) { this.choose(id.slice(3)); return; }
    }
  }

  arrive() {
    const onStairs = this.px === this.level.stairs.x && this.py === this.level.stairs.y;
    if (onStairs && !this.stairsDeclined) {
      this.state = 'stairs';
      this.stairFocus = 0;
      return;
    }
    if (!onStairs) this.stairsDeclined = false;
    const m = this.waysideAt(this.px, this.py);
    if (m) {
      this.resumeDir = this.dir;
      if (this.dir !== m.side) { this.dir = m.side; this.startTurn(0.25); }
      this.ask('wayside', m);
      return;
    }
    this.autoAt = this.time + 0.06;
  }

  // done with the wayside merchant: face the way you were walking and carry on
  moveOn() {
    if (this.resumeDir !== undefined && this.resumeDir !== this.dir) { this.dir = this.resumeDir; this.startTurn(0.25); }
    this.resumeDir = undefined;
    this.autoAt = this.time + 0.3;
  }

  interact(ent) {
    if (ent.type === 'enemy') this.startCombat(ent);
    else if (ent.type === 'chest' && !ent.opened) this.openChest(ent);
    else if (ent.type === 'merchant') this.openShop(ent);
  }

  // =============================================================== chests / mimics
  openChest(ch) {
    ch.opened = true;
    ch.openT = this.time;
    if (ch.mimic) {
      this.audio.play('chomp');
      this.ui.toast('It\'s a Mimic!', this.time, '#ff6a5a');
      const e = this.spawn({ type: 'enemy', kind: 'mimic', x: ch.x, y: ch.y, elite: false });
      e.face = ch.face;
      ch.gone = true;
      this.entities.push(e);
      this.startCombat(e);
      return;
    }
    this.audio.play('chest');
    const gold = 4 + this.floor * 2 + Math.floor(Math.random() * 4) + (this.player.relics.has('treasure_map') ? 6 : 0);
    this.state = 'opening';
    this.later(0.65, () => {
      this.gainGold(gold, this.W / 2, this.H * 0.35);
      if (this.player.omen === 'hoard') this.rewardQueue = [{ n: 3, source: 'chest' }];
      this.offerCards(3, 'chest');
    });
  }

  gainGold(n, x, y) {
    if (this.player.omen === 'greed') n = Math.round(n * 1.5);
    this.player.gold += n;
    this.slot.state.gold = this.player.gold;
    this.ui.float(`+${n}`, x, y, '#ffd24a', this.time, { size: 18 });
    this.audio.play('coin');
  }

  // =============================================================== combat
  startCombat(e) {
    e.engaged = true;
    this.anim(e, 'walk', { then: null });
    this.later(0.55, () => { if (e.alive && e.animator && e.animator.name === 'walk') this.anim(e, 'idle', { fade: 0.2 }); });
    this.combat = { e, phase: 'intro', t0: this.time, loot: 0, freeSpin: false, tempBag: [], turn: 0, rewards: [] };
    this.state = 'combat';
    const def = e.def;
    this.ui.toast(`${e.elite ? 'Elite ' : ''}${def.name} attacks!`, this.time, '#ff8a6a');
    this.audio.voice(e.kind, 'intro');
    if (def.note) this.later(0.9, () => this.ui.toast(def.note, this.time, '#c8b8a8'));
    this.player.armor = 0;
    this.slot.state.spinEnabled = true;
    this.slot.state.spinLabel = 'SPIN';
  }

  updateCombat(dt, keys, clicks) {
    const C = this.combat;
    if (!C) return;
    if (C.phase === 'intro' && this.time - C.t0 > 0.45) C.phase = 'ready';
    if (C.phase === 'ready') {
      let go = keys.some(k => is(k, 'confirm'));
      for (const c of clicks) if (this.inRect(c, this.slot.spinRect())) go = true;
      if (go) this.spinReels();
    }
    if (C.phase === 'resolving' && this.time >= C.nextAt) this.resolveNext();
    if (C.phase === 'enemy' && this.time >= C.nextAt) this.enemyStrike();
    if (C.phase === 'enemyEnd' && this.time >= C.nextAt) this.endEnemyTurn();
    if (C.phase === 'won' && this.time >= C.nextAt) this.afterVictory();
  }

  drawSymbol() {
    const bag = this.player.bag.concat(this.combat ? this.combat.tempBag : []);
    if (this.player.relics.has('four_leaf') && Math.random() < 0.05) {
      const rare = bag.filter(s => SYMBOLS[s].rarity !== 'common');
      if (rare.length) return rare[Math.floor(Math.random() * rare.length)];
    }
    return bag[Math.floor(Math.random() * bag.length)];
  }

  spinReels() {
    const C = this.combat;
    C.phase = 'spinning';
    C.turn++;
    const P = this.player;
    P.armor = P.guard;
    if (P.guard) {
      const [hx, hy] = this.slot.hpAnchor();
      this.ui.float(`+${P.guard} Guard`, hx, hy - 22, '#9ab8ff', this.time, { size: 12 });
    }
    C.grid = [[this.drawSymbol(), this.drawSymbol(), this.drawSymbol()],
              [this.drawSymbol(), this.drawSymbol(), this.drawSymbol()]];
    if (this.forceGrid) {
      const f = this.forceGrid.filter(id => SYMBOLS[id]);
      if (f.length === 6) C.grid = [f.slice(0, 3), f.slice(3, 6)];
      this.forceGrid = null;
    }
    // Sleight of Hand: the Rogue shrinks the machine and summons two forest reels (columns 3 and 4)
    C.pods = P.cls === 'rogue' && (this.forcePods || Math.random() < 0.25 + P.luck * 0.5);
    if (C.pods) {
      for (const row of C.grid) row.push(this.drawSymbol(), this.drawSymbol());
      this.slot.summonPods(true);
      this.banner('SLEIGHT OF HAND!', 'Two forest reels join the spin', '#8ae05a', 1.3);
      this.audio.play('summon');
      this.later(0.12, () => { for (const p of [3, 4]) this.fxEvent('summon', ...this.slot.reelAnchor(p, 0)); });
    }
    this.slot.spin(C.grid, () => this.drawSymbol(), this.time);
    this.slot.state.spinEnabled = false;
    this.audio.play('spin');
    C.stopped = 0;
  }

  onReelStop(i) {
    this.audio.play('stop');
    const C = this.combat;
    if (!C || C.phase !== 'spinning') return;
    C.stopped++;
    if (C.stopped >= C.grid[0].length) this.beginResolve();
  }

  beginResolve() {
    const C = this.combat;
    C.phase = 'resolving';
    C.queue = [];
    C.dealt = 0; C.swords = 0; C.vials = 0; C.charm = false; C.frenzy = false; C.doubleGold = false;
    C.blessed = false; C.chain = false; C.stun = false;
    const flat = C.grid.flat();
    C.charm = flat.includes('charm');
    C.swordsLanded = flat.some(s => FAMILY[s] === 'blade' || FAMILY[s] === 'spell');
    // Loaded Dice: reroll the worst symbol before anything resolves
    if (flat.includes('dice')) {
      let worst = null;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) if (C.grid[r][c] === 'skull') { worst = [r, c]; break; }
      if (worst) {
        const n = this.drawSymbol();
        C.grid[worst[0]][worst[1]] = n;
        this.slot.setStatic(C.grid);
        const [x, y] = this.slot.reelAnchor(worst[1], worst[0]);
        this.ui.float('Reroll!', x, y - 8, '#e8e0ff', this.time);
        this.audio.play('luck');
      }
    }
    const hits = b => ((b.line && LINE_BONUS[b.line].hit) || (b.special && SPECIAL_LINE[b.special].hit) ? 1 : 0);
    let keys = flat.filter(id => SYMBOLS[id].unlock).length;
    for (let r = 0; r < 2 && keys; r++) for (let c = 0; c < 3 && keys; c++) {
      if (C.grid[r][c] !== 'skull') continue;
      C.grid[r][c] = 'coin';
      keys--;
      this.slot.setStatic(C.grid);
      const [x, y] = this.slot.reelAnchor(c, r);
      this.ui.float('Picked!', x, y - 8, '#ffe070', this.time, { size: 13 });
      this.audio.play('luck');
    }
    for (const b of this.findBonuses(C.grid).sort((a, b) => hits(a) - hits(b))) C.queue.push(b);
    for (let row = 0; row < 2; row++) for (let reel = 0; reel < C.grid[row].length; reel++) C.queue.push([row, reel]);
    C.nextAt = this.time + (C.queue.length > 6 ? 0.35 : 0.15);
  }

  // Paylines = the two visible rows. 3 of a family across a row (Wildcards fill in) is a LINE;
  // 3+ of a family anywhere that didn't already make a line is a SCATTER.
  findBonuses(grid) {
    const fam = id => (SYMBOLS[id].wild ? 'wild' : FAMILY[id] || null);
    const out = [], lined = new Set();
    for (let row = 0; row < 2; row++) {
      const fs = grid[row].slice(0, 3).map(fam);
      const real = fs.filter(f => f !== 'wild');
      if (real.includes(null)) continue;
      const f = real.length ? real[0] : 'wild';
      const line = [[row, 0], [row, 1], [row, 2]];
      if (real.every(x => x === f) && LINE_BONUS[f]) {
        const pods = grid[row].length > 3 ? [fam(grid[row][3]), fam(grid[row][4])] : null;
        const grand = pods && pods.every(p => p === f || p === 'wild');
        out.push({ line: f, cells: grand ? [[row, 3], ...line, [row, 4]] : line, grand });
        lined.add(f);
      }
      // the same rare symbol three times: its own bonus on top
      const ids = grid[row].slice(0, 3).filter(id => !SYMBOLS[id].wild);
      if (ids.length && ids.every(id => id === ids[0]) && SPECIAL_LINE[ids[0]]) out.push({ special: ids[0], cells: line });
    }
    const cells = {};
    for (let row = 0; row < 2; row++) for (let reel = 0; reel < grid[row].length; reel++) {
      const f = fam(grid[row][reel]);
      if (f && f !== 'wild') (cells[f] = cells[f] || []).push([row, reel]);
    }
    for (const [f, cs] of Object.entries(cells)) {
      if (cs.length >= 3 && SCATTER_BONUS[f] && !lined.has(f)) out.push({ scatter: f, cells: cs });
    }
    return out;
  }

  banner(title, sub, color, dur = 1.5) {
    this.bannerMsg = { title, sub, color, t0: this.time, dur };
  }

  applyLine(b) {
    const C = this.combat, P = this.player, L = LINE_BONUS[b.line];
    this.slot.highlightCells(b.cells);
    EVENTS.line(this.fx, b.cells.map(([r, c]) => this.slot.reelAnchor(c, r)), '#ffe84a', this.fxCtx(null));
    let desc = L.desc;
    const roll = b.line === 'dice' ? [1, 2, 3].map(() => 1 + Math.floor(Math.random() * 6)) : null;
    if (roll) desc = `rolled ${roll.join(' + ')} = ${roll[0] + roll[1] + roll[2]} gold, and +10% Luck`;
    if (b.grand) this.banner(`GRAND ${L.name}!`, `5 ${FAMILY_NAME[b.line]} across the forest reels: the bonus pays twice`, '#8aff6a', 1.8);
    else this.banner(`${L.name}!`, `3 ${FAMILY_NAME[b.line]} in a row: ${desc}`, L.color);
    this.audio.play('jackpot');
    this.slot.shake = b.grand ? 1 : 0.6;
    const [hx, hy] = this.slot.hpAnchor();
    for (let rep = 0; rep < (b.grand ? 2 : 1); rep++) switch (b.line) {
      case 'blade': case 'spell': P.might++; break;
      case 'shield': P.guard++; P.armor += 1; this.ui.float('+1 Armor', hx, hy - 22, '#9ab8ff', this.time, { size: 13 }); break;
      case 'potion':
        P.maxHp += 3; this.slot.state.maxHp = P.maxHp;
        this.heal(5, 0, 0); break;
      case 'coin': {
        P.fortune++;
        const [gx, gy] = this.slot.goldAnchor();
        this.gainGold(8 + this.floor * 2, gx, gy - 14);
        break;
      }
      case 'chest': C.rewards.push({ n: 3, source: 'trove', min: 'rare' }); break;
      case 'clover': P.luck = Math.round((P.luck + 0.1) * 100) / 100; C.freeSpin = true; break;
      case 'skull': if (C.e.alive) this.damageEnemy(6, true); break;
      case 'bomb': P.blast++; this.audio.play('crit'); if (C.e.alive) this.damageEnemy(10, true); break;
      case 'dice': {
        const [gx, gy] = this.slot.goldAnchor();
        this.gainGold(roll[0] + roll[1] + roll[2], gx, gy - 14);
        P.luck = Math.round((P.luck + 0.1) * 100) / 100;
        break;
      }
      case 'wild':
        P.might++; P.guard++; P.armor += 1; P.fortune++;
        P.luck = Math.round((P.luck + 0.1) * 100) / 100;
        break;
    }
    if (C.phase === 'resolving') C.nextAt = this.time + 1.25;
  }

  applySpecial(b) {
    const C = this.combat, P = this.player, S = SPECIAL_LINE[b.special], e = C.e;
    this.slot.highlightCells(b.cells);
    EVENTS.line(this.fx, b.cells.map(([r, c]) => this.slot.reelAnchor(c, r)), '#ffe84a', this.fxCtx(null));
    this.banner(`${S.name}!`, `3 ${SYMBOLS[b.special].name}s in a row: ${S.desc}`, S.color);
    this.audio.play('jackpot');
    this.slot.shake = 0.8;
    switch (b.special) {
      case 'dagger':
        P.venom++;
        if (e.alive) { e.poison += 5; this.ui.float(`Poison ${e.poison}`, ...this.enemyScreen(0.7), '#8aff6a', this.time, { size: 14 }); }
        break;
      case 'vial': P.lifesteal++; break;
      case 'charm': C.blessed = true; break;
      case 'mimic': C.rewards.push({ n: 3, source: 'hoard', min: 'epic' }); break;
      case 'skull_cursed': if (e.alive) this.damageEnemy(12, true); break;
      case 'spear': {
        P.guard++; P.armor += 3;
        const [hx, hy] = this.slot.hpAnchor();
        this.ui.float('+3 Armor', hx, hy - 22, '#9ab8ff', this.time, { size: 13 });
        this.audio.play('block');
        break;
      }
      case 'axe': if (e.alive) this.damageEnemy(8, true); break;
      case 'knives':
        for (let k = 0; k < 6; k++) this.later(k * 0.12, () => { if (e.alive) this.damageEnemy(1 + P.might, false); });
        break;
      case 'hammer': C.stun = true; e.stunTurns = 1; this.ui.float('Stunned!', ...this.enemyScreen(1.05), '#ffe070', this.time, { size: 15 }); break;
      case 'crossbow':
        for (let k = 0; k < 3; k++) this.later(k * 0.18, () => { if (e.alive) this.damageEnemy(3, true); });
        break;
      case 'flail': if (e.alive) this.damageEnemy(12, true); break;
      case 'flame': e.burn = Math.max(e.burn || 0, 6); this.ui.float('Ablaze!', ...this.enemyScreen(0.8), '#ff8a3a', this.time, { size: 15 }); break;
      case 'scythe':
        if (e.alive && e.hp <= e.maxHp * 0.5) { this.ui.float('Reaped!', ...this.enemyScreen(1.05), '#c8a0ff', this.time, { size: 16 }); this.damageEnemy(e.hp, true); }
        else if (e.alive) this.damageEnemy(6, true);
        break;
      case 'spiked': P.guard++; if (e.alive) this.damageEnemy(5, true); break;
      case 'potion3': this.heal(P.maxHp, 0, 0); break;
      case 'mirror': C.blessed = true; break;
      case 'lodestone': { const [gx, gy] = this.slot.goldAnchor(); this.gainGold(20, gx, gy - 14); break; }
      case 'thorn': P.guard++; C.thorns = (C.thorns || 0) + 6; break;
      case 'warhorn': P.might++; this.audio.play('horn'); break;
      case 'apple': P.maxHp += 5; this.slot.state.maxHp = P.maxHp; this.heal(P.maxHp, 0, 0); break;
      case 'firebolt': e.burn = Math.max(e.burn || 0, 6); this.ui.float('Ablaze!', ...this.enemyScreen(0.8), '#ff8a3a', this.time, { size: 15 }); break;
      case 'frost':
        C.stun = true; e.stunTurns = 1; e.chill = Math.max(e.chill || 0, 3);
        this.ui.float('Frozen solid!', ...this.enemyScreen(1.05), '#a8e8ff', this.time, { size: 15 });
        this.fxEvent('chill', ...this.enemyScreen(0.6));
        break;
      case 'toxic': if (e.alive) { e.poison += 8; this.ui.float(`Poison ${e.poison}`, ...this.enemyScreen(0.7), '#8aff6a', this.time, { size: 14 }); } break;
      case 'chain':
        for (let k = 0; k < 4; k++) this.later(k * 0.16, () => { if (e.alive) { this.damageEnemy(3, true); this.fxEvent('chainStrike', ...this.enemyScreen(0.55)); } });
        break;
      case 'fireball': if (e.alive) { this.damageEnemy(14, true); e.burn = Math.max(e.burn || 0, 4); } break;
      case 'missiles':
        for (let k = 0; k < 8; k++) this.later(k * 0.09, () => { if (e.alive) this.damageEnemy(1 + P.might, false); });
        break;
      case 'drain': if (e.alive) this.damageEnemy(8, true); this.heal(8, 0, 0); break;
      case 'icelance':
        if (e.alive) this.damageEnemy(12, true);
        if (e.alive) { C.stun = true; e.chill = Math.max(e.chill || 0, 2); this.ui.float('Frozen!', ...this.enemyScreen(1.05), '#a8e8ff', this.time, { size: 15 }); }
        break;
      case 'void':
        if (e.alive && e.hp <= e.maxHp * 0.5) { this.ui.float('Erased!', ...this.enemyScreen(1.05), '#c8a0ff', this.time, { size: 16 }); this.damageEnemy(e.hp, true); }
        else if (e.alive) this.damageEnemy(10, true);
        break;
    }
    if (C.phase === 'resolving') C.nextAt = this.time + 1.25;
  }

  applyScatter(b) {
    const C = this.combat, P = this.player, S = SCATTER_BONUS[b.scatter];
    this.slot.highlightCells(b.cells);
    EVENTS.line(this.fx, b.cells.map(([r, c]) => this.slot.reelAnchor(c, r)), '#ffe84a', this.fxCtx(null));
    const chance = Math.min(1, S.chance + P.luck);
    const what = `${b.cells.length} ${FAMILY_NAME[b.scatter]}`;
    if (Math.random() >= chance) {
      this.banner(`${S.name}?`, `${what}: ${Math.round(chance * 100)}% bonus roll... missed`, '#a8a0b0', 1.0);
      this.audio.play('deny');
      C.nextAt = this.time + 0.9;
      return;
    }
    this.banner(`${S.name}!`, `${what}: ${S.desc}`, S.color);
    this.audio.play('luck');
    const [hx, hy] = this.slot.hpAnchor();
    switch (b.scatter) {
      case 'chest': C.rewards.push({ n: 3, source: 'bonus' }); break;
      case 'clover': C.freeSpin = true; break;
      case 'blade': case 'spell': C.frenzy = true; break;
      case 'coin': C.doubleGold = true; break;
      case 'shield': P.armor += 3; this.ui.float('+3 Armor', hx, hy - 22, '#9ab8ff', this.time, { size: 13 }); this.audio.play('block'); break;
      case 'potion': this.heal(3, 0, 0); break;
      case 'bomb': C.chain = true; break;
    }
    C.nextAt = this.time + 1.1;
  }

  resolveNext() {
    const C = this.combat;
    if (!C.queue.length) { this.finishResolve(); return; }
    const item = C.queue.shift();
    if (item.line) { this.applyLine(item); return; }
    if (item.special) { this.applySpecial(item); return; }
    if (item.scatter) { this.applyScatter(item); return; }
    const [row, reel] = item;
    let id = C.grid[row][reel];
    const [ax, ay] = this.slot.reelAnchor(reel, row);
    this.slot.highlight(row, reel);
    if (SYMBOLS[id].mirror) {                                   // the Mirror Shard reflects the symbol beside it
      const nb = reel >= 3 ? (reel === 3 ? 0 : 2) : reel > 0 ? reel - 1 : 1;
      const other = C.grid[row][nb];
      this.fxEvent('mirror', ax, ay);
      if (!other || SYMBOLS[other].mirror) { this.ui.float('Nothing to reflect', ax, ay - 16, '#d8ecff', this.time, { size: 11 }); C.nextAt = this.time + 0.5; return; }
      id = other;
      this.ui.float(`Mirror > ${SYMBOLS[id].name}`, ax, ay - 16, '#d8ecff', this.time, { size: 12 });
    }
    // transforming symbols
    if (SYMBOLS[id].wild) {
      const pool = this.player.bag.filter(s => !SYMBOLS[s].wild);
      id = pool[Math.floor(Math.random() * pool.length)] || 'sword';
      this.ui.float(`? > ${SYMBOLS[id].name}`, ax, ay - 16, '#e8e0ff', this.time, { size: 12 });
    }
    if (SYMBOLS[id].morph) {
      const pool = Object.keys(SYMBOLS).filter(s => SYMBOLS[s].rarity !== 'common' && !SYMBOLS[s].morph && !SYMBOLS[s].self && this.symOk(s));
      id = pool[Math.floor(Math.random() * pool.length)];
      this.ui.float(`Mimic > ${SYMBOLS[id].name}`, ax, ay - 16, '#ffd24a', this.time, { size: 12 });
    }
    const s = SYMBOLS[id];
    let times = 1;
    if (s.twice && Math.random() < s.twice) times++;
    if (C.charm && !s.charm && Math.random() < 0.25) times++;
    if (C.blessed) times++;
    // Spellweaver: every 4th spell the Mage casts echoes
    if (this.player.relics.has('war_drum') && C.turn === 1) {                 // War Drum: the first spin doubles
      times++;
      if (!C.drummed) { C.drummed = true; this.ui.toast('The War Drum thunders: every symbol twice!', this.time, '#ff9a5a'); this.audio.play('drum'); }
    }
    if (s.spell && this.player.cls === 'mage' && ++this.player.casts % 4 === 0) {
      times++;
      this.ui.float('Echo!', ax - 20, ay - 26, '#d8b0ff', this.time, { size: 14 });
      this.later(0.05, () => this.fxEvent('echo', ax, ay));
    }
    if (times > 1) this.ui.float('x2!', ax + 22, ay - 20, '#7aff8a', this.time, { size: 14 });
    const travel = RECIPES[id] ? RECIPES[id].travel : 0;
    for (let t = 0; t < times; t++) {
      const go = () => { if (this.combat === C) this.launchSymbol(id, ax, ay); };
      if (t === 0) go(); else this.later(t * 0.2, go);
      this.later(t * 0.2 + travel, () => { if (this.combat === C && this.player.hp > 0) this.applySymbol(id, s, ax, ay, t); });
    }
    const pace = C.grid[0].length > 3 ? 0.7 : 1;                   // ten reels to resolve: quicker beats
    C.nextAt = this.time + (travel + (times - 1) * 0.2 + (times > 1 ? 0.5 : 0.34)) * pace;
  }

  // ---- card / symbol effects: a symbol's icon flies to its target and lands with its own burst + sound
  fxCtx(id) {
    const sym = SYMBOLS[id];
    return {
      play: n => this.audio.play(n),
      icon: sym ? this.a.icons48[sym.icon] : null,
      shake: k => { this.slot.shake = Math.max(this.slot.shake || 0, k); this.camShake = Math.max(this.camShake || 0, k); },
    };
  }

  fxTarget(t, ax, ay) {
    return t === 'enemy' ? this.enemyScreen(0.55) : t === 'hp' ? this.slot.hpAnchor() : t === 'gold' ? this.slot.goldAnchor() : [ax, ay];
  }

  launchSymbol(id, ax, ay) {
    const rec = RECIPES[id];
    if (rec) rec.launch(this.fx, [ax, ay], this.fxTarget(rec.target, ax, ay), this.fxCtx(id));
  }

  fxEvent(name, x, y) { EVENTS[name](this.fx, x, y, this.fxCtx(null)); }

  cardFx(i, id) {
    const r = CARDS[id].rarity;
    const tier = ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(r);
    const [fx, fy] = this.cards.screenFrac(i);
    EVENTS.card(this.fx, fx * this.W, fy * this.H, this.fxCtx(null), RARITY[r].color, Math.max(0, tier));
  }

  sfx(name) { if (!this.quietSfx) this.audio.play(name); }

  applySymbol(id, s, ax, ay, rep) {
    const rec = RECIPES[id];
    this.quietSfx = !!rec;                    // the recipe plays this symbol's own sounds instead
    const I = { dmg: 0, pierce: !!s.pierce, chain: this.combat.chain, enemy: this.enemyScreen(0.55), hp: this.slot.hpAnchor() };
    this.applySymbolInner(id, s, ax, ay, rep, I);
    this.quietSfx = false;
    if (!rec || !this.combat) return;
    if (I.miss) { this.fxEvent('miss', ...I.enemy); return; }
    const [tx, ty] = this.fxTarget(rec.target, ax, ay);
    rec.impact(this.fx, tx, ty, this.fxCtx(id), I);
    if (I.crit && rec.target === 'enemy') this.fxEvent('crit', tx, ty);
    if (I.stun && id !== 'hammer') this.fxEvent('stun', ...this.enemyScreen(1.0));
  }

  applySymbolInner(id, s, ax, ay, rep, I) {
    const C = this.combat, P = this.player, e = C.e;
    const oy = rep * -14;
    if (s.dmg && e.alive && e.def.dodge && !s.sure && Math.random() < e.def.dodge) {
      this.ui.float('Miss!', ...this.enemyScreen(0.8), '#c8c8d8', this.time, { size: 14 });
      this.sfx('bump');
      I.miss = true;
    } else if (s.dmg && e.alive) {
      let dmg = (s.dmgRoll ? s.dmgRoll[0] + Math.floor(Math.random() * (s.dmgRoll[1] - s.dmgRoll[0] + 1)) : s.dmg) + P.might + (C.rally || 0);
      if (s.phalanx) dmg += C.grid.flat().filter(x => x === id).length - 1;
      if (s.arc) dmg += C.grid.flat().filter(x => FAMILY[x] === 'spell').length - 1;
      if (s.beam && P.hp >= P.maxHp) { dmg += s.beam; I.beam = true; this.ui.float('Dawnlight!', ax, ay - 30, '#a8e8ff', this.time, { size: 13 }); }
      if (s.trigger && Math.random() < s.trigger) { dmg += 3; I.trigger = true; this.ui.float('BANG!', ax, ay - 30, '#ffd24a', this.time, { size: 13 }); }
      if ((s.aoe || s.burn) && P.relics.has('ember_core')) dmg += 2;
      let limit = false;
      if (s.limit) { P.limitCount = (P.limitCount || 0) + 1; limit = P.limitCount % s.limit === 0; }
      if (limit) { dmg *= 3; I.limit = true; this.ui.float('OVERDRIVE!', ax, ay - 34, '#ff7a3a', this.time, { size: 15 }); }
      if (s.aoe) { dmg += 2 * P.blast; if (C.chain) dmg *= 2; }
      let crit = false;
      if (C.frenzy || (s.crit && Math.random() < s.crit) || (s.opener && e.hp >= e.maxHp)) { dmg *= 2; crit = true; }
      if (e.def.armor && !C.enemyBlocked && !s.pierce) {
        C.enemyBlocked = true;
        dmg = Math.max(0, dmg - e.def.armor);
        this.ui.float('Block', ...this.enemyScreen(0.5), '#b8c8ff', this.time, { size: 12, dy: -18 });
        this.fxEvent('block', ...this.enemyScreen(0.5));
      }
      if (s.pierce && e.def.armor) this.ui.float('Cleave!', ...this.enemyScreen(0.5), '#ffb08a', this.time, { size: 12, dy: -18 });
      I.crit = crit; I.dmg = dmg;
      for (let h = 0; h < (s.hits || 1) && e.alive; h++) this.damageEnemy(dmg, crit);
      if (dmg > 0) C.dealt++;
      if (s.burn && e.alive) {
        e.burn = Math.max(e.burn || 0, s.burn);
        this.ui.float('Ablaze!', ...this.enemyScreen(0.8), '#ff8a3a', this.time, { size: 13 });
      }
      if (s.stun && e.alive && Math.random() < s.stun) {
        C.stun = true;
        I.stun = true;
        this.ui.float('Stunned!', ...this.enemyScreen(1.05), '#ffe070', this.time, { size: 14 });
      }
      if (s.execute && e.alive && e.hp <= e.maxHp * s.execute) {
        I.execute = true;
        this.ui.float('Reaped!', ...this.enemyScreen(1.05), '#c8a0ff', this.time, { size: 16 });
        this.damageEnemy(e.hp, true);
      }
      if (s.poison) { e.poison += s.poison + P.venom; this.ui.float(`Poison ${e.poison}`, ...this.enemyScreen(0.7), '#8aff6a', this.time, { size: 12 }); }
      if (s.chill && e.alive) {
        e.chill = Math.max(e.chill || 0, s.chill);
        this.ui.float('Chilled!', ...this.enemyScreen(0.95), '#a8e8ff', this.time, { size: 13 });
        this.fxEvent('chill', ...this.enemyScreen(0.6));
      }
      if (s.freeze && e.alive && Math.random() < s.freeze) {
        C.stun = true;
        I.stun = true;
        this.ui.float('Frozen!', ...this.enemyScreen(1.05), '#a8e8ff', this.time, { size: 14 });
      }
      if (s.leech) this.heal(s.leech, ax, ay);
    }
    if (s.armor) {
      let a = s.armor + (s.guard && C.swordsLanded ? s.guard : 0);
      P.armor += a;
      this.ui.float(`+${a} Armor`, ax, ay - 10 + oy, '#9ab8ff', this.time, { size: 13 });
      this.sfx('block');
    }
    if (s.vigor) { P.maxHp += s.vigor; this.slot.state.maxHp = P.maxHp; this.ui.float(`+${s.vigor} Max HP`, ax, ay - 30 + oy, '#ffd060', this.time, { size: 12 }); }
    if (s.heal) this.heal(s.heal, ax, ay + oy);
    if (s.thorns) {
      C.thorns = (C.thorns || 0) + s.thorns;
      this.ui.float(`Thorns ${C.thorns}`, ax, ay - 26 + oy, '#8ad85a', this.time, { size: 12 });
    }
    if (s.rally) {
      C.rally = (C.rally || 0) + s.rally;
      this.ui.float(`+${s.rally} Might (this fight)`, ax, ay - 26 + oy, '#ff9a5a', this.time, { size: 12 });
    }
    if (s.vamp) C.vials += s.vamp;
    if (s.gold) {
      let g = s.gold;
      if (s.jackpot && Math.random() < s.jackpot) { g = 5; I.jackpot = true; }
      if (s.magnet) g += C.grid.flat().filter(x => FAMILY[x] === 'coin').length;
      if (FAMILY[id] === 'coin') g += P.fortune;
      if (FAMILY[id] === 'coin' && P.relics.has('lucky_cat') && Math.random() < 0.2) {
        g *= 3; I.jackpot = true;
        this.ui.float('Lucky Cat!', ax, ay - 30 + oy, '#ffe070', this.time, { size: 13 });
      }
      if (C.doubleGold) g *= 2;
      if (P.omen === 'greed') g = Math.round(g * 1.5);
      const [gx, gy] = this.slot.goldAnchor();
      this.player.gold += g;
      this.slot.state.gold = P.gold;
      this.ui.float(`+${g}`, gx, gy - 14 + oy, '#ffd24a', this.time, { size: 16 });
      this.sfx('coin');
    }
    if (s.loot) {
      C.loot++;
      this.ui.float(C.loot >= 2 ? 'Loot!' : 'Treasure', ax, ay - 24 + oy, '#ffd24a', this.time, { size: 12 });
    }
    if (s.self && P.relics.has('blood_pact') && e.alive) {
      const [x, y] = this.enemyScreen(0.8);
      this.ui.float('Blood Pact!', x, y - 20, '#ff3a3a', this.time, { size: 13 });
      this.damageEnemy(3, false);
    }
    if (s.self) {
      P.hp -= s.self;
      this.slot.state.hp = P.hp;
      const [hx, hy] = this.slot.hpAnchor();
      this.ui.float(`-${s.self}`, hx, hy + oy, '#ff5a5a', this.time, { size: 16 });
      this.sfx('curse');
      this.hurtFlash = this.time;
      this.rescue();
    }
    if (s.evolve) {
      P.evolve[id] = (P.evolve[id] || 0) + 1;
      if (P.evolve[id] >= s.evolve) {
        P.evolve[id] = 0;
        const i = P.bag.indexOf(id);
        if (i >= 0) { P.bag[i] = 'sword4'; this.ui.toast('The Cursed Skull evolved into the Blade of Fortune!', this.time, '#ff7a6a', 3); }
      }
    }
    if (s.luck) {
      if (Math.random() < 0.35 + P.luck) {
        C.freeSpin = true;
        I.lucky = true;
        this.ui.float('Lucky! Free spin', ax, ay - 20 + oy, '#7aff8a', this.time, { size: 12 });
        this.sfx('luck');
      } else this.ui.float('Luck', ax, ay - 12 + oy, '#9ad89a', this.time, { size: 11 });
    }
    if (P.hp <= 0 && !this.rescue()) this.playerDies();
  }

  // Pixie in a Jar / Ashen Plume: one-shot saves (return true if the player lives on)
  rescue() {
    const P = this.player;
    if (P.hp <= 5 && P.relics.has('pixie_jar')) {
      P.relics.delete('pixie_jar');
      P.hp = Math.min(P.maxHp, Math.max(P.hp, 0) + 10);
      this.slot.state.hp = P.hp;
      this.ui.toast('The pixie bursts out of the jar! +10 HP', this.time, '#ffb0f0', 2.6);
      this.fxEvent('pixie', ...this.slot.hpAnchor());
      return true;
    }
    if (P.hp <= 0 && P.relics.has('ashen_plume')) {
      P.relics.delete('ashen_plume');
      P.hp = Math.ceil(P.maxHp / 2);
      this.slot.state.hp = P.hp;
      this.ui.toast('The Ashen Plume flares - you rise from the ashes!', this.time, '#ffb060', 2.6);
      this.fxEvent('rebirth', ...this.slot.hpAnchor());
      return true;
    }
    return P.hp > 0;
  }

  enemyScreen(frac = 1) {
    const e = this.combat ? this.combat.e : null;
    if (!e) return [this.W / 2, this.H / 3];
    const [x, y, z] = this.enemyWorld(e);
    const h = this.a.models[e.def.model].max[1] * e.scale * frac;          // top of the model (flyers hover)
    const p = this.project(x, y + h, z);
    return [p[0], p[1]];
  }

  damageEnemy(dmg, crit) {
    const e = this.combat.e;
    e.hp -= dmg;
    e.flash = 1;
    if (e.hp > 0) this.anim(e, 'hit', { fade: 0.05 });
    if (e.hp > 0 && this.time - (e.hurtVoiceT || 0) > 0.6) { e.hurtVoiceT = this.time; this.audio.voice(e.kind, 'hurt'); }
    const [x, y] = this.enemyScreen(0.85);
    this.ui.float(dmg > 0 ? `-${dmg}${crit ? '!' : ''}` : '0', x + (Math.random() - 0.5) * 20, y, crit ? '#ffea4a' : '#ff4a4a',
      this.time, { size: crit ? 24 : 19 });
    this.sfx(crit ? 'crit' : 'hit');
    if (e.hp <= 0 && e.alive) this.killEnemy();
  }

  heal(n, ax, ay) {
    const P = this.player;
    const before = P.hp;
    P.hp = Math.min(P.maxHp, P.hp + n);
    this.slot.state.hp = P.hp;
    const [hx, hy] = this.slot.hpAnchor();
    this.ui.float(`+${P.hp - before || 0}`, hx, hy, '#6aff7a', this.time, { size: 16 });
    this.sfx('heal');
  }

  finishResolve() {
    const C = this.combat, e = C.e;
    this.slot.highlight(-1, -1);
    this.slot.summonPods(false);
    if (C.vials && C.dealt) this.heal(Math.min(3, C.vials * C.dealt), 0, 0);
    if (this.player.lifesteal && C.dealt) this.heal(this.player.lifesteal, 0, 0);
    if (!e.alive) return;
    if (e.poison > 0) {
      e.hp -= e.poison;
      e.flash = 0.7;
      const [x, y] = this.enemyScreen(0.6);
      this.ui.float(`-${e.poison} poison`, x, y, '#8aff6a', this.time, { size: 13 });
      this.fxEvent('poisonTick', ...this.enemyScreen(0.55));
      if (e.hp <= 0) { this.killEnemy(); return; }
    }
    if (e.burn > 0) {
      e.hp -= 2; e.burn--;
      e.flash = 0.7;
      const [x, y] = this.enemyScreen(0.7);
      this.ui.float('-2 burn', x + 14, y, '#ff8a3a', this.time, { size: 13 });
      this.fxEvent('burnTick', ...this.enemyScreen(0.55));
      if (e.hp <= 0) { this.killEnemy(); return; }
    }
    C.enemyBlocked = false;
    if (this.player.relics.has('hourglass') && C.turn % 5 === 0 && !C.freeSpin) {
      C.freeSpin = true;
      this.ui.toast('Sands of Time: the hourglass turns - a free spin!', this.time, '#f0c040');
    }
    if (C.freeSpin) {
      C.freeSpin = false;
      C.phase = 'ready';
      this.slot.state.spinEnabled = true;
      this.ui.toast('Free spin!', this.time, '#7aff8a');
      return;
    }
    if (C.stun || e.stunTurns > 0) {
      if (!C.stun) e.stunTurns--;
      C.stun = false;
      this.ui.toast(`The ${e.def.name} is stunned and can't attack!`, this.time, '#ffe070');
      this.anim(e, 'hit', { fade: 0.05 });
      C.phase = 'ready';
      this.slot.state.spinEnabled = true;
      return;
    }
    C.phase = 'enemy';
    C.nextAt = this.time + 0.5;
    this.anim(e, 'attack');
  }

  enemyStrike() {
    const C = this.combat, e = C.e, P = this.player;
    C.phase = 'enemyEnd';
    C.nextAt = this.time + 0.45;
    const bonus = C.bonusStrike;              // the free hit on a paralyzed player: no specials (they'd re-trigger
    C.bonusStrike = false;                    // on the same turn number - a scream would chain forever)
    let dmg = bonus ? Math.ceil(e.atk / 2) : e.atk;     // the paralysis hit is a lesser blow
    this.audio.voice(e.kind, 'attack');
    if (!bonus && e.def.charge && C.turn % e.def.charge === 0) {
      dmg *= 2;
      this.ui.toast(`The ${e.def.name} charges!`, this.time, '#ff8a6a');
    }
    if (e.chill > 0 && !bonus) {
      dmg = Math.max(0, dmg - 1);
      e.chill--;
      const [x, y] = this.enemyScreen(0.9);
      this.ui.float('Chilled -1', x, y, '#a8e8ff', this.time, { size: 12 });
    }
    const absorbed = Math.min(P.armor, dmg);
    dmg -= absorbed;
    const [hx, hy] = this.slot.hpAnchor();
    if (absorbed) this.ui.float(`Blocked ${absorbed}`, hx, hy - 22, '#9ab8ff', this.time, { size: 13 });
    if (dmg > 0) {
      P.hp -= dmg;
      this.slot.state.hp = P.hp;
      this.ui.float(`-${dmg}`, hx, hy, '#ff4a4a', this.time, { size: 22 });
      this.audio.play('hurt');
      this.hurtFlash = this.time;
      this.slot.shake = 1;
      this.camShake = 1;
    } else this.audio.play('block');
    if (P.hp <= 5) this.rescue();
    if (P.hp <= 0) { this.playerDies(); return; }
    if (C.thorns && e.alive) {
      this.later(0.22, () => {
        if (this.combat !== C || !e.alive) return;
        this.ui.float('Thorns!', ...this.enemyScreen(0.9), '#8ad85a', this.time, { size: 13 });
        this.fxEvent('thorns', ...this.enemyScreen(0.55));
        this.damageEnemy(C.thorns, false);
      });
    }
    if (bonus) return;
    // specials
    if (e.def.curse && C.turn % e.def.curse === 0) {
      C.tempBag.push('skull');
      this.later(0.3, () => { if (e.alive) this.anim(e, 'cast'); });
      this.ui.toast('The Cultist curses your reels! (+1 Curse this fight)', this.time, '#c86aff');
      this.audio.play('curse');
    }
    if (e.def.grudge) {
      e.atk += e.def.grudge;
      const [x, y] = this.enemyScreen(0.9);
      this.ui.float(`Grudge +${e.def.grudge}`, x, y, '#ffd24a', this.time, { size: 12 });
    }
    if (e.def.scream && C.turn % e.def.scream === 0) {
      C.paralyzed = true;
      this.later(0.3, () => { if (e.alive) this.anim(e, 'scream'); });
      this.ui.toast(`The ${e.def.name} screams! You're paralyzed!`, this.time, '#e8c8ff');
      this.audio.play('curse');
      this.hurtFlash = this.time;
    }
    if (e.def.regen && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.def.regen);
      const [x, y] = this.enemyScreen(0.6);
      this.ui.float(`+${e.def.regen}`, x, y, '#6aff7a', this.time, { size: 13 });
    }
  }

  endEnemyTurn() {
    const C = this.combat;
    if (C.paralyzed) {                                       // frozen by a scream: the foe acts again
      C.paralyzed = false;
      C.bonusStrike = true;
      this.ui.toast('Paralyzed - you can\'t spin!', this.time, '#e8c8ff');
      C.phase = 'enemy';
      C.nextAt = this.time + 1.1;
      this.later(0.6, () => { if (C.e.alive) this.anim(C.e, 'attack'); });
      return;
    }
    C.phase = 'ready';
    this.slot.state.spinEnabled = true;
  }

  killEnemy() {
    const C = this.combat, e = C.e;
    e.alive = false;
    e.deathT = this.time;
    this.anim(e, 'death', { fade: 0.06, then: null });
    this.audio.play('enemydie');
    this.audio.voice(e.kind, 'die');
    this.audio.play('kill');
    this.fxEvent('kill', ...this.enemyScreen(0.55));
    this.player.kills++;
    C.phase = 'won';
    C.nextAt = this.time + 1.9;
    this.slot.state.spinEnabled = false;
    this.later(0.8, () => this.slot.summonPods(false));
  }

  afterVictory() {
    const C = this.combat, e = C.e;
    const [lo, hi] = e.def.gold;
    const g = lo + Math.floor(Math.random() * (hi - lo + 1)) + Math.floor(this.floor / 2) + (e.elite ? 6 : 0) +
      (this.player.omen === 'swarm' ? 3 : 0);
    const [x, y] = this.enemyScreen(0.5);
    this.gainGold(this.player.relics.has('midas_glove') ? Math.round(g * 1.5) : g, x, y);
    e.gone = true;
    this.combat = null;
    this.player.armor = 0;
    this.rewardQueue = [];
    if (C.loot >= 2 || e.elite || e.kind === 'mimic') this.rewardQueue.push({ n: 3, source: e.elite ? 'boss' : 'loot' });
    this.rewardQueue.push(...C.rewards);
    if (this.rewardQueue.length) this.nextReward();
    else {
      this.state = 'explore';
      this.arrive();
    }
  }

  nextReward() {
    const r = this.rewardQueue.shift();
    this.offerCards(r.n, r.source, r.min);
  }

  playerDies() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.deadT = this.time;
    this.combat = null;
    this.slot.state.spinEnabled = false;
    this.slot.state.hp = 0;
    this.audio.play('die');
  }

  // =============================================================== cards
  eligibleCards() {
    const bag = this.player.bag;
    const mage = this.player.cls === 'mage';
    return Object.entries(CARDS).filter(([id, c]) => {
      if (c.cls && c.cls !== this.player.cls) return false;                       // spells are the Mage's alone
      const makes = c.type === 'add' ? c.sym : c.type === 'upgrade' ? c.to : null;
      if (makes && !this.symOk(makes)) return false;                              // ... and she never takes up steel
      if (c.type === 'upgrade') return c.from.some(f => bag.includes(f));
      if (c.type === 'passive') return !this.player.relics.has(c.relic);
      if (c.type === 'purge') return bag.includes('skull');
      return true;
    }).map(([id]) => id);
  }

  rollCards(n, bonus = 0, min = null) {
    let pool = this.eligibleCards();
    if (min) {
      const order = Object.keys(RARITY);
      const better = pool.filter(id => order.indexOf(CARDS[id].rarity) >= order.indexOf(min));
      if (better.length) pool = better;
    }
    const out = [];
    const w = id => {
      const r = CARDS[id].rarity;
      const base = RARITY[r].w;
      return r === 'common' ? base : base * (1 + this.floor * 0.12 + bonus);
    };
    while (out.length < n && pool.length) {
      const total = pool.reduce((s, id) => s + w(id), 0);
      let t = Math.random() * total;
      let pick = pool[0];
      for (const id of pool) { t -= w(id); if (t <= 0) { pick = id; break; } }
      out.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return out;
  }

  offerCards(n, source, min) {
    const ids = this.rollCards(n, (source === 'boss' ? 1.5 : 0) + (this.player.omen === 'frailty' ? 1.2 : 0), min);
    this.reward = { ids, source };
    this.cards.show(ids.map(id => ({ id })), this.time);
    this.cards.keyFocus = -1;
    this.state = 'reward';
    this.audio.play('card');
  }

  applyCard(id) {
    const c = CARDS[id], P = this.player;
    P.cards++;
    if (c.type === 'add') P.bag.push(c.sym);
    else if (c.type === 'upgrade') {
      const i = P.bag.findIndex(s => c.from.includes(s));
      if (i >= 0) P.bag[i] = c.to;
    } else if (c.type === 'passive') {
      P.relics.add(c.relic);
      if (c.relic === 'horseshoe') P.luck = Math.round((P.luck + 0.1) * 100) / 100;
      if (c.relic === 'trinity_sigil') { P.might++; P.guard++; P.luck = Math.round((P.luck + 0.15) * 100) / 100; }
    } else if (c.type === 'boost') {
      if (c.stat === 'maxHp') { P.maxHp += c.amount; this.slot.state.maxHp = P.maxHp; this.heal(c.amount, 0, 0); }
      else if (c.stat === 'hunger') {
        P.might += 3; P.maxHp = Math.max(5, P.maxHp - 8); P.hp = Math.min(P.hp, P.maxHp);
        this.slot.state.maxHp = P.maxHp; this.slot.state.hp = P.hp;
      } else if (c.stat === 'heartfruit') { P.maxHp += 4; this.slot.state.maxHp = P.maxHp; this.heal(P.maxHp, 0, 0); }
      else P[c.stat] += c.amount;
    } else if (c.type === 'purge') {
      const i = P.bag.indexOf('skull');
      if (i >= 0) P.bag.splice(i, 1);
    }
  }

  cardDesc(id) {
    const c = CARDS[id];
    if (c.desc) return c.desc;
    const sym = SYMBOLS[c.type === 'add' ? c.sym : c.to];
    const how = c.type === 'add' ? 'Add to reels: ' : `Upgrade a ${SYMBOLS[c.from.find(f => this.player.bag.includes(f)) || c.from[0]].name}: `;
    return how + sym.desc;
  }

  updateReward(keys, clicks) {
    const n = this.cards.cards.length;
    if (this.rewardPicked) {
      if (this.cards.cards.every(c => c.gone || !c.picked) && this.time - this.rewardPicked > 0.7) {
        this.rewardPicked = 0;
        this.cards.hide();
        this.leaveReward();
      }
      return;
    }
    for (const k of keys) {
      if (is(k, 'turnL')) this.cards.keyFocus = Math.max(0, (this.cards.keyFocus < 0 ? 1 : this.cards.keyFocus) - 1);
      if (is(k, 'turnR')) this.cards.keyFocus = Math.min(n - 1, this.cards.keyFocus + 1);
      if (is(k, 'n1')) this.pickReward(0);
      if (is(k, 'n2')) this.pickReward(1);
      if (is(k, 'n3')) this.pickReward(2);
      if (is(k, 'confirm') && this.cards.keyFocus >= 0) this.pickReward(this.cards.keyFocus);
      if (is(k, 'cancel')) this.skipReward();
    }
    for (const c of clicks) {
      const id = this.ui.hit(c);
      if (id === 'skip') { this.skipReward(); return; }
      if (this.cardHover >= 0) this.pickReward(this.cardHover);
    }
  }

  pickReward(i) {
    const id = this.reward.ids[i];
    if (!id) return;
    this.cards.pick(i, this.time);
    this.applyCard(id);
    this.cardFx(i, id);
    const kind = CARDS[id].type;
    this.ui.toast(kind === 'add' || kind === 'upgrade' ? `${CARDS[id].name} added to your reels` : `${CARDS[id].name}!`,
      this.time, RARITY[CARDS[id].rarity].color);
    this.rewardPicked = this.time;
  }

  skipReward() {
    this.cards.hide();
    this.leaveReward();
  }

  leaveReward() {
    if (this.rewardQueue && this.rewardQueue.length) { this.nextReward(); return; }
    this.state = 'explore';
    const ahead = this.entityAt(this.px + DX[this.dir], this.py + DY[this.dir]);
    if (ahead && ahead.type === 'chest') {                 // looted a dead-end chest: walk back out
      this.dir = (this.dir + 2) % 4;
      this.startTurn(0.3);
      this.pendingStep = this.dir;
    } else this.arrive();
  }

  // =============================================================== merchant
  openShop(m) {
    const mark = this.player.omen === 'fortune' ? 1.3 : 1;
    if (!m.stock) m.stock = this.rollCards(3, 0.4).map(id => ({ id, price: Math.round((CARD_PRICE[CARDS[id].rarity] + Math.floor(this.floor / 2) * 2) * mark), sold: false }));
    this.shop = { m, items: m.stock.filter(it => !it.sold) };
    this.cards.layout(this.W, this.H, this.slot, [0.28, 0.86], 0.78);
    this.cards.show(this.shop.items.map(it => ({ id: it.id, price: it.price })), this.time, 'below', -1);
    this.cards.keyFocus = -1;
    this.state = 'shop';
    this.audio.play('card');
  }

  leaveShop() {
    this.cards.hide(); this.state = 'explore'; this.audio.play('click');
    this.cards.layout(this.W, this.H, this.slot);
    if (this.shop.m.wayside) this.moveOn();
    else { this.dir = (this.dir + 2) % 4; this.startTurn(0.3); this.pendingStep = this.dir; }
  }

  updateShop(keys, clicks) {
    const buy = (i) => {
      const it = this.shop.items[i];
      if (!it || it.sold) return;
      if (this.player.gold < it.price) { this.audio.play('deny'); this.ui.toast('Not enough gold', this.time, '#ff8a6a'); return; }
      this.player.gold -= it.price;
      this.slot.state.gold = this.player.gold;
      it.sold = true;
      this.cards.pick(i, this.time);
      this.applyCard(it.id);
      this.audio.play('coin');
      this.cardFx(i, it.id);
      this.ui.toast(`Bought ${CARDS[it.id].name}`, this.time, RARITY[CARDS[it.id].rarity].color);
    };
    const act = (id) => {
      if (id === 'leave') this.leaveShop();
      if (id === 'heal') {
        if (this.player.gold < 6 || this.player.hp >= this.player.maxHp) { this.audio.play('deny'); return; }
        this.player.gold -= 6; this.slot.state.gold = this.player.gold;
        this.heal(6, 0, 0);
      }
      if (id === 'purge') {
        const i = this.player.bag.indexOf('skull');
        if (this.player.gold < 10 || i < 0) { this.audio.play('deny'); return; }
        this.player.gold -= 10; this.slot.state.gold = this.player.gold;
        this.player.bag.splice(i, 1);
        this.audio.play('buy');
        this.ui.toast('A Curse was removed from your reels', this.time, '#c8b8ff');
      }
    };
    for (const k of keys) {
      if (is(k, 'n1')) buy(0);
      if (is(k, 'n2')) buy(1);
      if (is(k, 'n3')) buy(2);
      if (is(k, 'cancel')) act('leave');
      if (is(k, 'turnL')) this.cards.keyFocus = Math.max(0, (this.cards.keyFocus < 0 ? 1 : this.cards.keyFocus) - 1);
      if (is(k, 'turnR')) this.cards.keyFocus = Math.min(2, this.cards.keyFocus + 1);
      if (is(k, 'confirm') && this.cards.keyFocus >= 0) buy(this.cards.keyFocus);
    }
    for (const c of clicks) {
      const id = this.ui.hit(c);
      if (id) act(id);
      else if (this.cardHover >= 0) buy(this.cardHover);
    }
  }

  // =============================================================== stairs / end
  updateStairs(keys, clicks) {
    const last = this.floor >= LAST_FLOOR;
    const act = (id) => {
      if (id === 'descend') this.descend();
      if (id === 'cashout') this.endRun('cashout');
      if (id === 'stay') { this.state = 'explore'; this.stairsDeclined = true; this.autoAt = this.time + 0.2; this.audio.play('click'); }
    };
    for (const k of keys) {
      if (is(k, 'confirm')) act(last ? 'descend' : ['descend', 'cashout', 'stay'][this.stairFocus]);
      if (is(k, 'cashout')) act('cashout');
      if (is(k, 'cancel') || is(k, 'back')) act('stay');
      if (is(k, 'turnL')) this.stairFocus = Math.max(0, this.stairFocus - 1);
      if (is(k, 'turnR')) this.stairFocus = Math.min(2, this.stairFocus + 1);
    }
    for (const c of clicks) { const id = this.ui.hit(c); if (id) act(id); }
  }

  descend() {
    if (this.floor >= LAST_FLOOR) { this.endRun('won'); return; }
    this.audio.play('descend');
    this.fade = { t: 0, out: true, then: () => {
      const f = this.floor + 1;
      this.reachFloor(f);
      this.loadFloor(f, this.runSeed + f * 7919);
      const b = BIOMES[biomeForFloor(f)];
      this.ui.toast(`Floor ${f} - The ${b.name}`, this.time, '#e8c878', 2.6);
      if (this.entities.some(e => e.type === 'merchant')) this.ui.toast('A goblin merchant trades on the way to the stairs', this.time, '#ffd24a', 3.2);
      this.fadeIn();
    } };
    this.state = 'transition';
  }

  fadeIn() { this.fade = { t: 0, out: false }; }

  endRun(kind) {
    this.state = 'won';
    this.cashedOut = kind === 'cashout';
    this.deadT = this.time;
    this.slot.state.spinEnabled = false;
    this.audio.play('win');
  }

  updateEnd(keys, clicks) {
    if (this.time - this.deadT < 1.0) return;
    for (const k of keys) if (is(k, 'confirm')) this.newRun();
    for (const c of clicks) {
      const id = this.ui.hit(c);
      if (id === 'again') this.newRun();
      if (id === 'title') this.toTitle();
    }
  }

  // =============================================================== animation
  animateCamera(dt) {
    const m = this.move;
    const tx = this.px * CELL, tz = this.py * CELL, tyaw = dirYaw(this.dir);
    if (m) {
      m.t += dt;
      const k = clamp(m.t / m.dur, 0, 1);
      if (m.kind === 'step') {
        this.cam.x = lerp(this.cam.x, tx, clamp(dt * 14, 0, 1));
        this.cam.z = lerp(this.cam.z, tz, clamp(dt * 14, 0, 1));
        this.cam.bob = Math.sin(k * Math.PI) * 0.03;
      }
      if (m.kind === 'bump') {
        const s = Math.sin(k * Math.PI) * 0.12;
        this.cam.x = tx + DX[m.d] * s; this.cam.z = tz + DY[m.d] * s;
      }
      this.cam.yaw = angleLerp(this.cam.yaw, tyaw, clamp(dt * 16, 0, 1));
      if (k >= 1) {
        this.move = null;
        this.cam.x = tx; this.cam.z = tz; this.cam.yaw = tyaw; this.cam.bob = 0;
        if (m.kind === 'step' && this.state === 'explore') this.arrive();
        if (m.kind === 'turn' && this.pendingStep !== undefined && this.state === 'explore') {
          const d = this.pendingStep;
          this.pendingStep = undefined;
          if (this.entityAt(this.px + DX[d], this.py + DY[d])) this.autoAt = this.time;
          else this.step(d);
        }
      }
    } else {
      this.cam.x = tx; this.cam.z = tz;
      this.cam.yaw = angleLerp(this.cam.yaw, tyaw, clamp(dt * 16, 0, 1));
    }
    this.camShake = Math.max(0, (this.camShake || 0) - dt * 3);
  }

  enemyWorld(e) {
    let x = e.x * CELL, z = e.y * CELL;
    if (e.engaged) {
      // engaged enemies step up toward the player
      const dx = this.px * CELL - x, dz = this.py * CELL - z, l = Math.hypot(dx, dz) || 1;
      e.advance = lerp(e.advance, 0.2, 0.1);
      x += dx / l * e.advance; z += dz / l * e.advance;
    }
    return [x, 0, z];
  }

  animateEntities(dt) {
    for (const e of this.entities) {
      if (e.flash) e.flash = Math.max(0, e.flash - dt * 5);
      if (e.animator) e.animator.update(dt);
    }
    if (this.titleKnight) this.titleKnight.update(dt);
  }

  // =============================================================== rendering
  project(x, y, z) {
    const p = xform(mul(this.proj, this.view), x, y, z);
    return [(p[0] * 0.5 + 0.5) * this.W, (1 - (p[1] * 0.5 + 0.5)) * this.H, p[3]];
  }

  computeView(now) {
    const yawV = this.cam.yaw + (this.shopLook || 0) * SHOP_YAW;
    const fx = Math.sin(yawV), fz = Math.cos(yawV);
    let ex = this.cam.x - fx * BACK, ez = this.cam.z - fz * BACK, ey = EYE + this.cam.bob;
    let pitch = PITCH;
    if (this.state === 'title') {
      ex = this.cam.x - fx * 0.5; ez = this.cam.z - fz * 0.5; ey = 0.86; pitch = -0.07;
    }
    if (this.camShake) { ex += Math.sin(now * 60) * 0.02 * this.camShake; ey += Math.cos(now * 53) * 0.015 * this.camShake; }
    this.view = lookAt([ex, ey, ez], [ex + fx, ey + Math.tan(pitch), ez + fz]);
    this.eye = [ex, ey, ez];
  }

  render(now) {
    const B = this.biome;
    this.pipe.beginWorld(B.fog);

    // ---- camera
    this.computeView(now);
    const fx = Math.sin(this.cam.yaw), fz = Math.cos(this.cam.yaw);
    const [ex, ey, ez] = this.eye;

    // ---- sky (ruins)
    if (B.sky) {
      const inv = invert(mul(this.proj, this.view));
      this.R.drawSky(inv, [0.3, 0.42, 0.66], [0.62, 0.68, 0.76], [0.86, 0.88, 0.92], now);
    }

    // ---- lights: nearest static lights + a faint lantern carried by the player
    const lights = this.lights.map(l => ({ ...l, d: (l.pos[0] - ex) ** 2 + (l.pos[2] - ez) ** 2 }))
      .sort((a, b) => a.d - b.d).slice(0, 14)
      .map(l => {
        const f = l.flicker ? 0.86 + 0.1 * Math.sin(now * 9 + l.flicker) + 0.06 * Math.sin(now * 23 + l.flicker * 3) : 1;
        return { pos: l.pos, col: l.col.map(c => c * f), radius: l.radius };
      });
    lights.push({ pos: [ex + fx * 0.3, ey + 0.1, ez + fz * 0.3], col: B.lanternOnPlayer, radius: 5.5 });
    if (this.state === 'title') {
      const tx = this.cam.x + fx * 1.4 - fz * 0.6, tz = this.cam.z + fz * 1.4 + fx * 0.6;
      lights.push({ pos: [tx, 1.7, tz], col: [1.5, 1.05, 0.62], radius: 4.2 });
    }
    this.R.begin({
      proj: this.proj, view: this.view, cam: [ex, ey, ez], ambient: B.ambient, dir: B.sun ? { dir: B.sun.dir, col: B.sun.col } : null,
      fogColor: B.fog, fogRange: B.fogRange, lights, time: now, bands: 10,
      ps1: { snap: [320, 180], affine: 0.55, dither: 1 },          // the PS1 look: vertex wobble, affine warp, 15-bit dither
    });
    this.R.drawBatches(this.static);

    // ---- entities
    for (const e of this.entities) {
      if (e.gone) continue;
      if (e.type === 'enemy') this.drawEnemy(e, now);
      else if (e.type === 'chest') this.drawChest(e, now);
      else if (e.type === 'merchant') this.drawMerchant(e, now);
    }
    if (this.state === 'title') this.drawTitleKnight(now);

    // ---- HUD (720p): slot machine + cards over the upscaled 360p world
    this.pipe.beginHud();
    if (this.state !== 'title') {
      this.slot.draw(now);
      this.cards.draw(now);
    }
    this.drawOverlay(now);
    this.pipe.finish(this.ui.c, now);
  }

  drawEnemy(e, now) {
    const model = this.a.models[e.def.model];
    const [x, y, z] = this.enemyWorld(e);
    const yaw = Math.atan2(this.cam.x - x, this.cam.z - z);
    const m = trs(x, y, z, yaw, 0, 0, e.scale);
    const flash = e.flash ? [1, 1, 1, e.flash * 0.7] : [0, 0, 0, 0];
    const tint = e.elite ? [1.15, 0.92, 0.85] : [1, 1, 1];
    // the body lies there a moment after the death clip, then fades away
    const alpha = e.alive ? 1 : 1 - clamp((now - e.deathT - 1.45) / 0.45, 0, 1);
    const mats = e.animator ? e.animator.matrices() : null;
    this.R.drawModel(model, m, { mats, pose: mats ? null : undefined, flash, alpha, tint });
  }

  drawChest(c, now) {
    const model = this.a.models.mimic;
    const yaw = Math.atan2(DX[c.face], DY[c.face]);
    const open = c.opened ? clamp((now - c.openT) / 0.5, 0, 1) : 0;
    const lid = 0.454 - open * 1.1;
    const m = trs(c.x * CELL, 0, c.y * CELL, yaw, 0, 0, 1.0);
    // closed chests hide their teeth behind the lid; opened (real) chests glow
    this.R.drawModel(model, m, { pose: { lid: { rx: lid } }, tint: c.opened ? [1.2, 1.1, 0.9] : [1, 1, 1] });
  }

  // the merchant's pipe: smoke puffs, the odd ember and a smoke ring, emitted in WORLD space at the 'smoke'
  // socket bone (the pipe bowl, through the same animated part matrix the renderer uses) - so the smoke
  // stays in the scene when the camera turns or bobs
  merchantSmoke(m, mats, now) {
    const mdl = this.a.models.merchant, i = mdl.partIndex.smoke;
    if (i === undefined) return;
    const [px, py, pz] = xform(mats ? mul(m, mats[i]) : m, ...mdl.parts[i].pivot);
    const R = (a, b) => a + Math.random() * (b - a);
    if (now - (this.smokeT || 0) > 0.11) {
      this.smokeT = now;
      this.fx.wpart(px, py, pz, { vx: R(-0.02, 0.02), vy: R(0.1, 0.16), vz: R(-0.02, 0.02), lift: 0.03, drag: 0.35,
                                  life: R(1.6, 2.4), size: R(0.012, 0.018), grow: 3.2, col: ['#d8d4d8', '#c4c0c8', '#e8e4e8'][R(0, 3) | 0],
                                  alpha: 0.55 });
      if (Math.random() < 0.2) {
        this.fx.wpart(px, py, pz, { vx: R(-0.03, 0.03), vy: R(0.18, 0.3), vz: R(-0.03, 0.03), life: R(0.4, 0.8), size: 0.005,
                                    shape: 'px', col: Math.random() < 0.5 ? '#ffb040' : '#ff7a20', add: true });
      }
    }
    if (now - (this.ringT || 0) > 2.6) {
      this.ringT = now;
      this.fx.wpart(px, py + 0.02, pz, { vy: 0.12, drag: 0.3, life: 1.8, size: 0.012, grow: 3.4, shape: 'ring', col: '#e0dce4',
                                         w: 1.2, alpha: 0.7 });
    }
  }

  drawMerchant(mc, now) {
    const gob = this.a.models.merchant;
    const yaw = Math.atan2(this.cam.x - mc.x * CELL, this.cam.z - mc.y * CELL);
    const mats = mc.animator ? mc.animator.matrices() : null;
    if (mc.wayside) {
      const bx = mc.x * CELL + DX[mc.side] * 0.6, bz = mc.y * CELL + DY[mc.side] * 0.6;
      const ax = DX[(mc.side + 1) % 4], az = DY[(mc.side + 1) % 4];         // along the wall
      const gy = Math.atan2(this.cam.x - bx, this.cam.z - bz);
      const m = trs(bx, 0, bz, gy, 0, 0, ENEMY_SCALE * 0.95);
      this.R.drawModel(gob, m, { mats, hide: new Set(['weapon']) });
      this.merchantSmoke(m, mats, now);
      const cx = bx + ax * 0.62 + DX[mc.side] * 0.08, cz = bz + az * 0.62 + DY[mc.side] * 0.08;
      this.R.drawModel(this.a.models.crate, trs(cx, 0, cz, gy, 0, 0, 0.8));
      this.R.drawModel(this.a.models.lantern, trs(cx, -1.62, cz, 0, 0, 0, 1));
      return;
    }
    const m = trs(mc.x * CELL, 0, mc.y * CELL, yaw, 0, 0, ENEMY_SCALE * 0.95);
    this.R.drawModel(gob, m, { mats, hide: new Set(['weapon']) });
    this.merchantSmoke(m, mats, now);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    this.R.drawModel(this.a.models.crate, trs(mc.x * CELL + fx * 0.62 - fz * 0.35, 0, mc.y * CELL + fz * 0.62 + fx * 0.35, yaw, 0, 0, 0.8));
    this.R.drawModel(this.a.models.lantern, trs(mc.x * CELL + fx * 0.62 - fz * 0.35, -1.62, mc.y * CELL + fz * 0.62 + fx * 0.35, 0, 0, 0, 1));
  }

  drawTitleKnight(now) {
    const k = this.a.models[this.viewModel || CLASSES[this.cls].model];
    const fx = Math.sin(this.cam.yaw), fz = Math.cos(this.cam.yaw);
    const rx = -fz, rz = fx;                                                    // camera right (lookAt x axis)
    const x = this.cam.x + fx * 2.0 + rx * 0.6, z = this.cam.z + fz * 2.0 + rz * 0.6;
    const yaw = this.cam.yaw + Math.PI + (this.viewModel ? this.viewYaw : Math.sin(now * 0.35) * 0.35);
    const A = this.titleKnight;
    const mats = A ? A.matrices() : null;
    const tex = this.skin === 'paladin' && this.cls === 'knight' && !this.viewModel ? this.paladin() : null;
    const locked = !this.viewModel && !this.unlocked(this.cls);                   // a locked class stands in silhouette
    this.R.drawModel(this.a.models.dun_pillar, mul(trs(x, -2.32, z, 0), [1.4, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1.4, 0, 0, 0, 0, 1]));
    this.R.drawModel(k, trs(x, 0.28, z, yaw, 0, 0, 0.9), { mats, texOverride: tex ? { bake_knight: tex } : null,
                                                     hide: this.viewModel ? new Set(['weapon']) : undefined,
                                                     tint: locked ? [0.05, 0.04, 0.07] : undefined });
    this.titleKnightPos = [x, 1.35, z];
  }

  paladin() {
    if (this.paladinTex === null) {
      const img = this.a.textures.bake_knight_paladin;
      this.paladinTex = img ? this.R.tex('bake_knight_paladin') : false;
    }
    return this.paladinTex || null;
  }

  // =============================================================== overlay
  drawOverlay(now) {
    const U = this.ui, W = this.W, H = this.H;
    U.clear();
    const g = U.g;
    const ptr = this.input.pointer;
    if (this.state === 'title') { this.drawTitle(now, ptr); U.drawFloats(now); this.drawFade(); return; }

    // floor label (top right) + status icons (top left)
    U.text(`FLOOR ${this.floor}`, W - 10, 20, { size: 15, align: 'right', spacing: 1 });
    let ix = 8;
    const P = this.player;
    U.icon(this.a.icons48.heart, ix, 6, 20);
    U.text(`${Math.max(0, P.hp)}`, ix + 23, 21, { size: 13 });
    ix += 50;
    if (P.armor) { U.icon(this.a.icons48.shield, ix, 6, 20); U.text(`${P.armor}`, ix + 23, 21, { size: 13, color: '#b8c8ff' }); ix += 46; }
    if (P.omen) { U.icon(this.a.icons48[OMENS[P.omen].icon], ix, 6, 20); ix += 24; }
    for (const r of P.relics) {
      const img = this.a.icons48[CARD_ICON[r] || r];
      if (img) { U.icon(img, ix, 6, 20); ix += 24; }
    }
    U.icon(this.a.icons48.coins, ix, 6, 20);
    U.text(`${P.bag.length}`, ix + 23, 21, { size: 12, color: '#d8c8a8' });
    // run stats from paylines: Might / Guard / Fortune / Luck
    let sx = 8;
    for (const [v, icon, label, col] of [[P.might, 'sword2', `+${P.might}`, '#ff9a7a'], [P.guard, 'shield2', `+${P.guard}`, '#9ab8ff'],
      [P.fortune, 'coin_gold', `+${P.fortune}`, '#ffd24a'], [P.luck, 'clover', `+${Math.round(P.luck * 100)}%`, '#7aff8a'],
      [P.blast, 'bomb', `+${P.blast}`, '#ff9a4a'], [P.venom, 'dagger', `+${P.venom}`, '#8aff6a'], [P.lifesteal, 'vial', `+${P.lifesteal}`, '#ff6a8a']]) {
      if (!v) continue;
      U.icon(this.a.icons48[icon], sx, 29, 16);
      U.text(label, sx + 18, 41, { size: 10, color: col });
      sx += 24 + label.length * 6;
    }
    // payline / scatter banner
    const B = this.bannerMsg;
    if (B && now - B.t0 < B.dur) {
      const t = (now - B.t0) / B.dur;
      const a = t < 0.1 ? t / 0.1 : t > 0.8 ? (1 - t) / 0.2 : 1;
      const pop = t < 0.12 ? 1 + (0.12 - t) * 4 : 1;
      const by = Math.round(this.slot.screenTop - 34);
      g.globalAlpha = 0.82 * a;
      g.fillStyle = '#0c0a10'; g.fillRect(0, by - 20, W, 36);
      g.fillStyle = B.color; g.fillRect(0, by - 20, W, 1); g.fillRect(0, by + 15, W, 1);
      g.globalAlpha = 1;
      U.text(B.title, W / 2, by + 1, { size: Math.round(20 * pop), align: 'center', color: B.color, spacing: 2, alpha: a });
      U.text(B.sub, W / 2, by + 12, { size: 9, align: 'center', color: '#f2ead8', bold: false, alpha: a });
    }

    // hurt flash vignette
    if (this.hurtFlash && now - this.hurtFlash < 0.35) {
      const a = 1 - (now - this.hurtFlash) / 0.35;
      const grd = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
      grd.addColorStop(0, 'rgba(200,0,0,0)'); grd.addColorStop(1, `rgba(200,20,20,${0.55 * a})`);
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
    }

    // enemy nameplate + HP bar above its head (concept: red bar over the goblin)
    if (this.combat && this.combat.e.alive) {
      const e = this.combat.e;
      const [x, y] = this.enemyScreen(1.08);
      const bw = 70;
      U.bar(x - bw / 2, y - 10, bw, 6, e.hp / e.maxHp);
      U.text(`${e.elite ? 'Elite ' : ''}${e.def.name}`, x, y - 15, { size: 11, align: 'center' });
      U.icon(this.a.icons48.sword, x + bw / 2 + 3, y - 15, 14);
      U.text(`${e.atk}`, x + bw / 2 + 19, y - 4, { size: 11, color: '#ffb0a0' });
      if (e.poison) { U.icon(this.a.icons48.dagger, x - bw / 2 - 17, y - 15, 14); U.text(`${e.poison}`, x - bw / 2 - 20, y - 4, { size: 10, align: 'right', color: '#8aff6a' }); }
      if (e.burn) { U.icon(this.a.icons48.fire, x - bw / 2 - 17, y - 1, 14); U.text(`${e.burn}`, x - bw / 2 - 20, y + 10, { size: 10, align: 'right', color: '#ff8a3a' }); }
      if (e.chill) { U.icon(this.a.icons48.frost, x + bw / 2 + 3, y - 1, 14); U.text(`${e.chill}`, x + bw / 2 + 19, y + 10, { size: 10, color: '#a8e8ff' }); }
      if (e.stunTurns > 0 || (this.combat.stun)) U.text('STUNNED', x, y - 22, { size: 9, align: 'center', color: '#ffe070' });
      U.text(`${Math.max(0, e.hp)}/${e.maxHp}`, x, y + 8, { size: 9, align: 'center', color: '#e8d8d0' });
      if (this.combat.phase === 'ready') {
        const r = this.slot.spinRect();
        const pulse = 0.5 + 0.5 * Math.sin(now * 5);
        g.strokeStyle = `rgba(255,220,120,${0.35 + 0.4 * pulse})`; g.lineWidth = 2;
        g.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
        U.text('SPACE / CLICK', r.x + r.w / 2, r.y - 8, { size: 9, align: 'center', color: '#e8d8b0', alpha: 0.8 });
      }
    }

    // path prompts (Doom RPG style)
    if (this.state === 'explore' && this.prompt && !this.move) this.drawPrompt(now, ptr);
    if (this.state === 'reward') this.drawRewardUI(now, ptr);
    if (this.state === 'shop') this.drawShopUI(now, ptr);
    if (this.state === 'stairs') this.drawStairsUI(now, ptr);
    if (this.state === 'omen') this.drawOmens(now, ptr);
    if (this.state === 'bag') this.drawBag(now, ptr);
    if (this.showMap && this.state !== 'bag') this.drawMap();
    if (this.state !== 'bag') {
      const tanH = Math.tan(FOV / 2);
      this.fx.draw(g, W, H, (x, y, z) => {
        const [sx, sy, w] = this.project(x, y, z);
        return w > 0.05 ? [sx, sy, H / 2 / (w * tanH)] : null;
      });
      U.drawFloats(now);
    }
    if (this.state === 'dead' || this.state === 'won') this.drawEnd(now, ptr);
    if (this.state === 'combat' && this.floor === 1 && this.player && this.player.kills === 0)
      U.text('3 in a row = a permanent bonus   3 anywhere = a bonus roll   TAB: reels + paytable', W / 2, 12, { size: 8, align: 'center', color: '#cfc2a8', alpha: 0.8, bold: false });
    if (this.state === 'explore' && this.floor === 1 && this.player && this.player.kills === 0)
      U.text('Arrows / WASD or click: choose a path   SPACE confirm   TAB reels   M map   N sound   V crt', W / 2, 12, { size: 8, align: 'center', color: '#cfc2a8', alpha: 0.8, bold: false });
    this.drawFade();
  }

  drawPrompt(now, ptr) {
    const U = this.ui, W = this.W, g = U.g;
    const P = this.prompt;
    const top = this.slot.screenTop;
    const pop = clamp((now - P.t0) / 0.18, 0, 1);
    if (P.kind === 'chest' || P.kind === 'merchant' || P.kind === 'wayside') {
      const t = P.kind === 'chest' ? 'A chest blocks the way.' : 'A goblin merchant waves you over.';
      U.text(t, W / 2, top * 0.2, { size: 14, align: 'center', color: '#ffd878', alpha: pop });
      if (P.kind === 'wayside') U.text(`You have ${this.player.gold} gold`, W / 2, top * 0.2 + 14, { size: 10, align: 'center', color: '#ffd24a', alpha: pop, bold: false });
      const bw = 150, by = P.kind === 'wayside' ? top * 0.2 + 22 : top - 34;     // keep the merchant's face clear
      U.button('go:use', P.kind === 'chest' ? 'Open it  [W]' : 'Trade  [W]', W / 2 - bw - 6, by, bw, 22, ptr,
        { size: 12, fill: '#6a1c22', hotFill: '#8a262e' });
      U.button('go:back', P.kind === 'wayside' ? 'Keep going  [S]' : 'Turn back  [S]', W / 2 + 6, by, bw, 22, ptr, { size: 12 });
      return;
    }
    const opts = this.choices();
    U.text(P.kind === 'deadend' ? 'Dead end.' : 'Which way?', W / 2, top * 0.16, { size: 15, align: 'center', color: '#ffd878', alpha: pop, spacing: 1 });
    const pos = {
      left: [W * 0.09, top * 0.5], right: [W * 0.91, top * 0.5], forward: [W * 0.5, top * 0.36], back: [W * 0.5, top - 20],
    };
    const keyName = { left: 'A', right: 'D', forward: 'W', back: 'S' };
    for (const o of opts) {
      const [cx, cy] = pos[o.rel];
      const hot = this.chevron(o.rel, cx, cy, ptr, now, pop, o.what);
      const label = `${o.rel[0].toUpperCase() + o.rel.slice(1)} [${keyName[o.rel]}]`;
      const ly = o.rel === 'forward' ? cy + 26 : o.rel === 'back' ? cy - 18 : cy + 28;
      U.text(label, cx, ly, { size: 11, align: 'center', color: hot ? '#ffe8a0' : '#f2ead8', alpha: pop });
      if (o.what) U.text(o.what, cx, ly + 12, { size: 10, align: 'center', color: o.what === 'Stairs' ? '#8ab8ff' : o.what === 'Chest' || o.what === 'Merchant' ? '#ffd24a' : '#ff8a6a', alpha: pop });
    }
  }

  // big pixel chevron button (points left/right/up/down); returns hover state
  chevron(rel, cx, cy, ptr, now, alpha, what) {
    const U = this.ui, g = U.g;
    const s = 15;
    const r = { x: cx - s - 6, y: cy - s - 6, w: 2 * s + 12, h: 2 * s + 12 };
    const hot = ptr && this.inRect(ptr, r);
    const bob = Math.sin(now * 5) * 2;
    const dir = { left: [-1, 0], right: [1, 0], forward: [0, -1], back: [0, 1] }[rel];
    const ox = dir[0] * bob, oy = dir[1] * bob;
    const pts = rel === 'left' ? [[s, -s], [-s, 0], [s, s], [s * 0.35, 0]]
      : rel === 'right' ? [[-s, -s], [s, 0], [-s, s], [-s * 0.35, 0]]
      : rel === 'forward' ? [[-s, s], [0, -s], [s, s], [0, s * 0.35]]
      : [[-s, -s], [0, s], [s, -s], [0, -s * 0.35]];
    g.save();
    g.globalAlpha = alpha;
    const path = (grow) => {
      g.beginPath();
      pts.forEach(([x, y], i) => {
        const px = Math.round(cx + ox + x * grow), py = Math.round(cy + oy + y * grow);
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      });
      g.closePath();
    };
    path(1.25); g.fillStyle = '#0c0810'; g.fill();
    path(1.0); g.fillStyle = hot ? '#ffd24a' : (what && what !== 'Stairs' ? '#e0703a' : '#d8c8a0'); g.fill();
    path(0.55); g.fillStyle = hot ? '#fff0b0' : 'rgba(255,255,255,0.35)'; g.fill();
    g.restore();
    U.buttons.push({ id: 'go:' + rel, ...r });
    return hot;
  }

  drawFade() {
    const f = this.fade;
    if (!f) return;
    const dur = 0.6;
    let a = f.out ? clamp(f.t / dur, 0, 1) : 1 - clamp(f.t / dur, 0, 1);
    if (f.out && f.t >= dur) { const then = f.then; this.fade = null; then && then(); a = 1; }
    else if (!f.out && f.t >= dur) { this.fade = null; return; }
    this.ui.g.fillStyle = `rgba(0,0,0,${a})`;
    this.ui.g.fillRect(0, 0, this.W, this.H);
  }

  drawTitle(now, ptr) {
    const U = this.ui, W = this.W, H = this.H, g = U.g;
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, 'rgba(8,8,16,0.55)'); grd.addColorStop(0.45, 'rgba(8,8,16,0.05)'); grd.addColorStop(1, 'rgba(8,8,16,0.75)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const logo = this.a.ui.logo;
    if (logo) {
      const s = Math.min(1, (H * 0.5) / logo.height, (W * 0.52) / logo.width);
      const lw = Math.round(logo.width * s), lh = Math.round(logo.height * s);
      g.imageSmoothingEnabled = s < 1;
      g.drawImage(logo, Math.round(W * 0.27 - lw / 2), Math.round(H * 0.06), lw, lh);
      g.imageSmoothingEnabled = false;
    }
    const bx = Math.round(W * 0.27 - 70);
    let y = Math.round(H * 0.64);
    const menu = this.titleMenu();
    const K = CLASSES[this.cls], open = this.unlocked(this.cls);
    U.button('start', open ? 'DESCEND' : 'LOCKED', bx, y, 140, 24, ptr, { size: 14, focus: this.menuFocus === 0, fill: open ? '#6a1c22' : '#2a2430', hotFill: open ? '#8a262e' : '#3a3440' });
    y += 32;
    if (menu.includes('skin')) {
      U.button('skin', `Skin: ${this.skin === 'classic' ? 'Knight' : 'Paladin'}`, bx, y, 140, 20, ptr, { size: 11, focus: this.menuFocus === menu.indexOf('skin') });
      y += 26;
    }
    U.button('crt', `CRT filter: ${this.pipe.crt ? 'On' : 'Off'}  [V]`, bx, y, 140, 20, ptr, { size: 11, focus: this.menuFocus === menu.indexOf('crt') });
    // character plate: < THE ROGUE >, her passive, and what unlocks her
    const px = Math.round(W * 0.66), py = Math.round(H * 0.74);
    U.text(open ? K.name : '? ? ?', px, py, { size: 15, align: 'center', spacing: 1, color: open ? '#f2ead8' : '#8a8290' });
    U.button('cls:prev', '<', px - 96, py - 14, 20, 18, ptr, { size: 12 });
    U.button('cls:next', '>', px + 76, py - 14, 20, 18, ptr, { size: 12 });
    U.text(open ? `${K.sub}  -  ${K.hp} HP` : K.sub, px, py + 13, { size: 10, align: 'center', color: '#c8bca8', bold: false });
    if (open) U.wrap(K.passive, 230, 9).forEach((l, i) => U.text(l, px, py + 27 + i * 10, { size: 9, align: 'center', color: '#e8c070', bold: false }));
    else U.text(`Reach Floor ${K.unlock} to unlock`, px, py + 28, { size: 10, align: 'center', color: '#ff9a7a' });
    U.text('A / D: choose class', px, py + 58, { size: 8, align: 'center', color: '#8a8290', bold: false });
    U.text('Spin. Fight. Loot. Upgrade. Die. Spin again.', W / 2, H - 8, { size: 9, align: 'center', color: '#a898a0', bold: false });
  }

  drawOmens(now, ptr) {
    const U = this.ui, W = this.W, H = this.H, g = U.g;
    g.fillStyle = 'rgba(6,4,12,0.62)'; g.fillRect(0, 0, W, H);
    U.text('CHOOSE AN OMEN', W / 2, 40, { size: 20, align: 'center', color: '#e8c070', spacing: 2 });
    U.text('Each omen gives and takes. Refuse and walk on unmarked.', W / 2, 55, { size: 10, align: 'center', color: '#c8bca8', bold: false });
    const n = this.omenOffer.length, tw = 150, th = 180, gap = 14;
    const x0 = W / 2 - (n * tw + (n - 1) * gap) / 2, y0 = 70;
    this.omenOffer.forEach((k, i) => {
      const O = OMENS[k], x = x0 + i * (tw + gap);
      const r = { x, y: y0, w: tw, h: th };
      const hot = (ptr && this.inRect(ptr, r)) || this.omenFocus === i;
      const lift = hot ? -4 : 0;
      U.panel(x, y0 + lift, tw, th, { alpha: 0.95, border: hot ? '#e8c070' : '#4c4f5a', hi: hot ? '#ffe8a0' : '#6a6e7a' });
      const bob = Math.sin(now * 2 + i) * 2;
      U.icon(this.a.icons48[O.icon], x + tw / 2 - 32, y0 + 12 + lift + bob, 64);
      U.text(O.name, x + tw / 2, y0 + 96 + lift, { size: 11, align: 'center', color: '#e8c070' });
      U.wrap(O.desc, tw - 18, 9).forEach((l, j) => U.text(l, x + tw / 2, y0 + 112 + lift + j * 11, { size: 9, align: 'center', bold: false }));
      U.text(`[${i + 1}]`, x + tw / 2, y0 + th - 8 + lift, { size: 9, align: 'center', color: '#8a8290' });
      U.buttons.push({ id: 'omen:' + i, ...r });
    });
    U.button('omen:none', 'Refuse  [ESC]', W / 2 - 50, y0 + th + 12, 100, 18, ptr, { size: 11 });
  }

  drawRewardUI(now, ptr) {
    const U = this.ui, W = this.W;
    const title = { chest: 'TREASURE!', loot: 'LOOT!', boss: 'VICTORY SPOILS', trove: 'TREASURE TROVE!', bonus: 'BONUS CARD!', hoard: 'MIMIC HOARD!' }[this.reward.source] || 'CHOOSE A CARD';
    U.text(title, W / 2, 34, { size: 18, align: 'center', color: '#ffd878', spacing: 2 });
    const more = this.rewardQueue ? this.rewardQueue.length : 0;
    U.text(more ? `Choose a card to add to your reels  (+${more} more after this)` : 'Choose a card to add to your reels',
      W / 2, 48, { size: 10, align: 'center', color: more ? '#ffd878' : '#d8ccb8', bold: false });
    this.drawCardInfo(this.cardHover >= 0 ? this.cardHover : this.cards.keyFocus, now);
    if (!this.rewardPicked) U.button('skip', 'Skip  [ESC]', W - 96, this.slot.screenTop - 30, 84, 18, ptr, { size: 11 });
  }

  drawCardInfo(i, now, price) {
    const U = this.ui, W = this.W;
    const cs = this.cards.cards;
    for (const [k, c] of cs.entries()) {
      if (!c.rect || c.picked) continue;
      if (c.price !== undefined) {
        const it = this.shop && this.shop.items[k];
        const afford = this.player.gold >= c.price;
        U.icon(this.a.icons48.coin, c.sx - 18, c.rect.y + c.rect.h + 3, 14);
        U.text(it && it.sold ? 'SOLD' : `${c.price}`, c.sx + 2, c.rect.y + c.rect.h + 14, { size: 12, color: afford ? '#ffd24a' : '#a06a5a' });
      }
      U.text(`${k + 1}`, c.rect.x + 4, c.rect.y + 12, { size: 10, color: '#e8dcc0', alpha: 0.7 });
    }
    if (i === undefined || i < 0 || !cs[i] || cs[i].picked) return;
    const id = cs[i].id, c = CARDS[id];
    const lines = U.wrap(this.cardDesc(id), 300, 10);
    const y = this.H - 24 - lines.length * 11;                 // info plate over the reels
    U.panel(W / 2 - 160, y - 4, 320, 18 + lines.length * 11, { alpha: 0.94 });
    U.text(`${c.name}  -  ${RARITY[c.rarity].label}`, W / 2, y + 8, { size: 11, align: 'center', color: RARITY[c.rarity].color });
    lines.forEach((l, n) => U.text(l, W / 2, y + 20 + n * 11, { size: 10, align: 'center', bold: false, color: '#e8e0d0' }));
  }

  drawShopUI(now, ptr) {
    const U = this.ui, W = this.W;
    U.text('THE MERCHANT', W * 0.26, 70, { size: 18, align: 'center', color: '#b8e878', spacing: 2 });
    U.text('"Cards for coin, traveler."', W * 0.26, 84, { size: 10, align: 'center', color: '#d8ccb8', bold: false });
    this.drawCardInfo(this.cardHover >= 0 ? this.cardHover : this.cards.keyFocus, now);
    const hasCurse = this.player.bag.includes('skull');
    const bx = 12, by = this.H - 30;
    U.button('heal', 'Heal 6 HP (6g)', bx, by, 104, 18, ptr, { size: 10, disabled: this.player.gold < 6 || this.player.hp >= this.player.maxHp });
    U.button('purge', 'Purge a Curse (10g)', bx + 110, by, 116, 18, ptr, { size: 10, disabled: this.player.gold < 10 || !hasCurse });
    U.button('leave', 'Leave  [ESC]', bx + 232, by, 84, 18, ptr, { size: 11 });
  }

  drawStairsUI(now, ptr) {
    const U = this.ui, W = this.W, H = this.H;
    const last = this.floor >= LAST_FLOOR;
    const y = this.slot.screenTop * 0.42;
    U.panel(W / 2 - 150, y - 26, 300, 88, { alpha: 0.94 });
    if (last) {
      U.text('The way out of the Ruins', W / 2, y - 8, { size: 14, align: 'center', color: '#ffd878' });
      U.button('descend', 'ESCAPE WITH THE LOOT', W / 2 - 90, y + 8, 180, 22, ptr, { size: 12, fill: '#2c5a2a', hotFill: '#3c7a38', focus: true });
      U.button('stay', 'Not yet', W / 2 - 40, y + 36, 80, 16, ptr, { size: 10 });
      return;
    }
    const next = BIOMES[biomeForFloor(this.floor + 1)].name;
    U.text('Stairs lead deeper...', W / 2, y - 8, { size: 14, align: 'center', color: '#ffd878' });
    U.text(`Floor ${this.floor + 1}: The ${next}. Keep going... or cash out?`, W / 2, y + 5, { size: 10, align: 'center', bold: false });
    U.button('descend', 'DESCEND', W / 2 - 140, y + 16, 90, 22, ptr, { size: 12, fill: '#6a1c22', hotFill: '#8a262e', focus: this.stairFocus === 0 });
    U.button('cashout', `CASH OUT (${this.player.gold}g)`, W / 2 - 44, y + 16, 110, 22, ptr, { size: 11, focus: this.stairFocus === 1 });
    U.button('stay', 'Stay', W / 2 + 72, y + 16, 68, 22, ptr, { size: 11, focus: this.stairFocus === 2 });
  }

  drawBag(now, ptr) {
    const U = this.ui, W = this.W, H = this.H, P = this.player;
    const pw = Math.min(W - 16, 620), ph = H - 16, x0 = (W - pw) / 2, y0 = 8;
    U.g.fillStyle = 'rgba(0,0,0,0.55)'; U.g.fillRect(0, 0, W, H);
    U.panel(x0, y0, pw, ph);
    const pay = this.bagPage === 'pay';
    U.button('page:reels', `YOUR REELS (${P.bag.length})`, W / 2 - 134, y0 + 7, 130, 18, ptr, { size: 10, focus: !pay });
    U.button('page:pay', 'PAYTABLE', W / 2 + 4, y0 + 7, 130, 18, ptr, { size: 10, focus: pay });
    if (pay) this.drawPaytable(x0, y0 + 32, pw); else this.drawReelList(x0, y0 + 32, pw);
    const stats = [];
    if (P.might) stats.push(`Might +${P.might}`);
    if (P.guard) stats.push(`Guard +${P.guard}`);
    if (P.fortune) stats.push(`Fortune +${P.fortune}`);
    if (P.luck) stats.push(`Luck +${Math.round(P.luck * 100)}%`);
    if (P.blast) stats.push(`Blast +${P.blast}`);
    if (P.venom) stats.push(`Venom +${P.venom}`);
    if (P.lifesteal) stats.push(`Lifesteal +${P.lifesteal}`);
    if (P.relics.size) stats.push(`Relics: ${[...P.relics].map(r => CARDS[r].name).join(', ')}`);
    if (P.omen) stats.push(OMENS[P.omen].name);
    if (stats.length) U.text(stats.join('   '), W / 2, y0 + ph - 24, { size: 9, align: 'center', color: '#e8c070' });
    U.text(pay ? 'TAB / ESC: close' : 'TAB: paytable   ESC: close', x0 + pw - 10, y0 + ph - 7, { size: 8, align: 'right', color: '#8a8290', bold: false });
    U.button('close', 'Close', W / 2 - 30, y0 + ph - 17, 60, 13, ptr, { size: 9 });
  }

  drawReelList(x0, y0, pw) {
    const U = this.ui, P = this.player;
    const counts = {};
    for (const s of P.bag) counts[s] = (counts[s] || 0) + 1;
    const ids = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const cols = 3, rowH = 28;
    ids.forEach((id, i) => {
      const cx = x0 + 12 + (i % cols) * (pw / cols), cy = y0 + 4 + Math.floor(i / cols) * rowH;
      const s = SYMBOLS[id];
      U.icon(this.a.icons48[s.icon], cx, cy, 22);
      U.text(`${counts[id]}x ${s.name}`, cx + 26, cy + 9, { size: 10, color: RARITY[s.rarity].color === '#8b919c' ? '#f2ead8' : RARITY[s.rarity].color });
      U.text(s.desc, cx + 26, cy + 19, { size: 7, bold: false, color: '#cfc4b0' });
    });
  }

  drawPaytable(x0, y0, pw) {
    const U = this.ui, P = this.player;
    const colW = (pw - 24) / 2, xl = x0 + 12, xr = x0 + 12 + colW + 12;
    const row = (x, y, icon, name, color, desc, pct) => {
      U.icon(this.a.icons48[icon], x, y - 8, 10);
      U.text(name, x + 13, y, { size: 8, color });
      if (pct !== undefined) {
        U.text(`${pct}%`, x + 104, y, { size: 8, color: '#f2ead8' });
        U.text(desc, x + 130, y, { size: 8, bold: false, color: '#cfc4b0' });
      } else U.text(desc, x + 104, y, { size: 8, bold: false, color: '#cfc4b0' });
    };
    const RH = 12.5;
    let y = y0 + 8;
    const hide = P.cls === 'mage' ? 'blade' : 'spell';
    const lines = Object.entries(LINE_BONUS).filter(([f]) => f !== hide);
    const scat = Object.entries(SCATTER_BONUS).filter(([f]) => f !== hide);
    const spec = Object.entries(SPECIAL_LINE).filter(([id]) => this.symOk(id)).slice(0, 18);
    U.text('3 IN A ROW  (permanent, Wildcards fill in)', xl, y, { size: 9, color: '#ffd878' });
    lines.forEach(([f, L], i) => row(xl, y + 14 + i * RH, FAMILY_ICON[f], L.name, L.color, L.short));
    y += 14 + lines.length * RH + 8;
    U.text(`3 ANYWHERE  (bonus roll, +${Math.round(P.luck * 100)}% Luck)`, xl, y, { size: 9, color: '#ffd878' });
    scat.forEach(([f, S], i) =>
      row(xl, y + 14 + i * RH, FAMILY_ICON[f], S.name, S.color, S.desc, Math.round(Math.min(1, S.chance + P.luck) * 100)));
    U.text('SAME RARE SYMBOL x3 IN A ROW  (extra bonus)', xr, y0 + 8, { size: 9, color: '#ffd878' });
    spec.forEach(([id, S], i) => row(xr, y0 + 22 + i * RH, SYMBOLS[id].icon, S.name, S.color, S.short));
  }

  drawMap() {
    const U = this.ui, L = this.level;
    const cs = Math.max(2, Math.min(4, Math.floor(66 / L.W)));
    const w = L.W * cs, h = L.H * cs, x0 = this.W - w - 10, y0 = 30;
    const g = U.g;
    g.fillStyle = 'rgba(8,8,14,0.7)'; g.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
    for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
      if (!this.explored.has(`${x},${y}`) || !L.at(x, y)) continue;
      g.fillStyle = '#6a6470'; g.fillRect(x0 + x * cs, y0 + y * cs, cs, cs);
    }
    if (this.explored.has(`${L.stairs.x},${L.stairs.y}`)) { g.fillStyle = '#5a9aff'; g.fillRect(x0 + L.stairs.x * cs, y0 + L.stairs.y * cs, cs, cs); }
    for (const e of this.entities) {
      if (e.gone || e.alive === false || (!e.wayside && !this.explored.has(`${e.x},${e.y}`))) continue;   // the merchant is always marked
      g.fillStyle = e.type === 'enemy' ? '#e04040' : e.type === 'chest' ? '#e0b040' : '#60e060';
      g.fillRect(x0 + e.x * cs + 1, y0 + e.y * cs + 1, cs - 2, cs - 2);
    }
    g.fillStyle = '#ffffff';
    g.fillRect(x0 + this.px * cs + 1, y0 + this.py * cs + 1, cs - 2, cs - 2);
    g.fillStyle = '#ffd24a';
    g.fillRect(x0 + this.px * cs + cs / 2 - 1 + DX[this.dir] * cs / 2, y0 + this.py * cs + cs / 2 - 1 + DY[this.dir] * cs / 2, 2, 2);
  }

  drawEnd(now, ptr) {
    const U = this.ui, W = this.W, H = this.H, g = U.g;
    const a = clamp((now - this.deadT) / 1.0, 0, 1);
    g.fillStyle = `rgba(6,4,10,${0.75 * a})`; g.fillRect(0, 0, W, H);
    if (a < 0.6) return;
    const won = this.state === 'won';
    const title = won ? (this.cashedOut ? 'CASHED OUT' : 'YOU ESCAPED!') : 'YOU DIED';
    U.text(title, W / 2, H * 0.3, { size: 30, align: 'center', color: won ? '#ffd878' : '#e04a4a', spacing: 3 });
    const P = this.player;
    const lines = [`Floor reached: ${this.floor}`, `Gold: ${P.gold}`, `Foes defeated: ${P.kills}`, `Cards collected: ${P.cards}`];
    lines.forEach((l, i) => U.text(l, W / 2, H * 0.3 + 26 + i * 15, { size: 12, align: 'center', bold: false }));
    U.text(won ? 'Fortune favors the brave.' : 'Every spin is a risk. Every risk takes you deeper.', W / 2, H * 0.3 + 96, { size: 10, align: 'center', color: '#b8a8c0', bold: false });
    if (now - this.deadT > 1.0) {
      U.button('again', 'SPIN AGAIN', W / 2 - 120, H * 0.3 + 108, 110, 22, ptr, { size: 12, fill: '#6a1c22', hotFill: '#8a262e', focus: true });
      U.button('title', 'Title', W / 2 + 10, H * 0.3 + 108, 110, 22, ptr, { size: 12 });
    }
  }
}
