// data.js - everything the concept sheets define: reel symbols, upgrade cards,
// rarities, enemies and biomes.

export const RARITY = {
  common:    { label: 'COMMON',    color: '#8b919c', w: 50 },
  uncommon:  { label: 'UNCOMMON',  color: '#3fa04c', w: 30 },
  rare:      { label: 'RARE',      color: '#4c5fe0', w: 14 },
  epic:      { label: 'EPIC',      color: '#a64ce0', w: 5 },
  legendary: { label: 'LEGENDARY', color: '#e03636', w: 1.2 },
};

// Reel symbols. Effects are resolved in game.js.
export const SYMBOLS = {
  sword:        { name: 'Sword',            icon: 'sword',        rarity: 'common',    dmg: 1,                 desc: 'Deal 1 damage.' },
  sword2:       { name: 'Sharpened Sword',  icon: 'sword2',       rarity: 'uncommon',  dmg: 2,                 desc: 'Deal 2 damage.' },
  sword3:       { name: "Hero's Blade",     icon: 'sword3',       rarity: 'rare',      dmg: 3, crit: 0.10,     desc: 'Deal 3 damage. +10% crit chance.' },
  sword4:       { name: 'Blade of Fortune', icon: 'sword4',       rarity: 'legendary', dmg: 3, crit: 0.10, twice: 0.25, desc: 'Deal 3 damage. +10% crit. Chance to trigger twice.' },
  shield:       { name: 'Defend',           icon: 'shield',       rarity: 'common',    armor: 1,               desc: 'Gain 1 Armor.' },
  shield2:      { name: 'Royal Guard',      icon: 'shield2',      rarity: 'uncommon',  armor: 1, guard: 1,     desc: 'Gain 1 Armor. +1 more if a Sword also lands.' },
  potion:       { name: 'Heal',             icon: 'potion',       rarity: 'common',    heal: 1,                desc: 'Restore 1 HP.' },
  potion2:      { name: 'Health Potion',    icon: 'potion2',      rarity: 'uncommon',  heal: 2,                desc: 'Restore 2 HP.' },
  vial:         { name: 'Vampiric Vial',    icon: 'vial',         rarity: 'uncommon',  vamp: 1,                desc: 'Heal 1 HP when dealing damage.' },
  coin:         { name: 'Gold',             icon: 'coin',         rarity: 'common',    gold: 1,                desc: 'Gain 1 gold.' },
  coin_copper:  { name: 'Copper Coin',      icon: 'coin_copper',  rarity: 'common',    gold: 1,                desc: 'Gain 1 gold.' },
  coins:        { name: 'Coin Purse',       icon: 'coins',        rarity: 'common',    gold: 2,                desc: 'Gain 2 gold instead of 1.' },
  coin_silver:  { name: 'Silver Coin',      icon: 'coin_silver',  rarity: 'uncommon',  gold: 2,                desc: 'Gain 2 gold.' },
  coin_gold:    { name: 'Gold Coin',        icon: 'coin_gold',    rarity: 'rare',      gold: 3,                desc: 'Gain 3 gold.' },
  coin_royal:   { name: 'Royal Coin',       icon: 'coin_royal',   rarity: 'legendary', gold: 3, jackpot: 0.25, desc: 'Gain 3 gold. 25% chance for 5 instead.' },
  chest:        { name: 'Treasure',         icon: 'chest',        rarity: 'common',    gold: 2, loot: 1,       desc: 'Bonus loot: 2 gold. Land 2 in a fight for a card.' },
  mimic:        { name: 'Mimic Chest',      icon: 'mimic',        rarity: 'rare',      morph: 1,               desc: 'Turns into a random higher rarity symbol every spin.' },
  skull:        { name: 'Curse',            icon: 'skull',        rarity: 'common',    self: 1, curse: 1,      desc: 'Bad effect: lose 1 HP.' },
  skull_cursed: { name: 'Cursed Skull',     icon: 'skull_cursed', rarity: 'epic',      dmg: 2, self: 1, evolve: 3, desc: 'Deal 2, lose 1 HP. Evolves after 3 triggers.' },
  clover:       { name: 'Luck',             icon: 'clover',       rarity: 'common',    luck: 1,                desc: 'Extra spin / bonus: 35% chance for a free spin.' },
  charm:        { name: 'Lucky Charm',      icon: 'clover4',      rarity: 'rare',      charm: 0.25,            desc: 'Other symbols have a 25% chance to trigger twice.' },
  wild:         { name: 'Wildcard',         icon: 'wild',         rarity: 'epic',      wild: 1,                desc: 'Turns into a random symbol each spin.' },
  dice:         { name: 'Loaded Dice',      icon: 'dice',         rarity: 'rare',      reroll: 1,              desc: 'Reroll one symbol each spin.' },
  bomb:         { name: 'Bomb',             icon: 'bomb',         rarity: 'rare',      dmg: 3, aoe: 1,         desc: 'Deal 3 damage to all enemies.' },
  dagger:       { name: 'Poison Dagger',    icon: 'dagger',       rarity: 'uncommon',  dmg: 1, poison: 1,      desc: 'Deal 1 damage. Apply 1 Poison.' },
};

// Card upgrades (cards sheet). type: add | upgrade | passive
export const CARDS = {
  sword:            { name: 'Sword',            rarity: 'common',    type: 'add',     sym: 'sword' },
  sharpened_sword:  { name: 'Sharpened Sword',  rarity: 'uncommon',  type: 'upgrade', from: ['sword'],            to: 'sword2' },
  heros_blade:      { name: "Hero's Blade",     rarity: 'rare',      type: 'upgrade', from: ['sword2'],           to: 'sword3' },
  blade_of_fortune: { name: 'Blade of Fortune', rarity: 'legendary', type: 'upgrade', from: ['sword3'],           to: 'sword4' },
  coin_purse:       { name: 'Coin Purse',       rarity: 'common',    type: 'upgrade', from: ['coin', 'coin_copper'], to: 'coins' },
  vampiric_vial:    { name: 'Vampiric Vial',    rarity: 'uncommon',  type: 'add',     sym: 'vial' },
  lucky_charm:      { name: 'Lucky Charm',      rarity: 'rare',      type: 'add',     sym: 'charm' },
  mimic_chest:      { name: 'Mimic Chest',      rarity: 'rare',      type: 'upgrade', from: ['chest'],            to: 'mimic' },
  royal_guard:      { name: 'Royal Guard',      rarity: 'uncommon',  type: 'upgrade', from: ['shield'],           to: 'shield2' },
  loaded_dice:      { name: 'Loaded Dice',      rarity: 'rare',      type: 'add',     sym: 'dice' },
  cursed_skull:     { name: 'Cursed Skull',     rarity: 'epic',      type: 'upgrade', from: ['skull'],            to: 'skull_cursed' },
  copper_coin:      { name: 'Copper Coin',      rarity: 'common',    type: 'add',     sym: 'coin_copper' },
  silver_coin:      { name: 'Silver Coin',      rarity: 'uncommon',  type: 'upgrade', from: ['coin', 'coin_copper'], to: 'coin_silver' },
  gold_coin:        { name: 'Gold Coin',        rarity: 'rare',      type: 'upgrade', from: ['coin_silver', 'coins'], to: 'coin_gold' },
  royal_coin:       { name: 'Royal Coin',       rarity: 'legendary', type: 'upgrade', from: ['coin_gold'],        to: 'coin_royal' },
  health_potion:    { name: 'Health Potion',    rarity: 'uncommon',  type: 'upgrade', from: ['potion'],           to: 'potion2' },
  shield:           { name: 'Shield',           rarity: 'common',    type: 'add',     sym: 'shield' },
  poison_dagger:    { name: 'Poison Dagger',    rarity: 'uncommon',  type: 'add',     sym: 'dagger' },
  bomb:             { name: 'Bomb',             rarity: 'rare',      type: 'add',     sym: 'bomb' },
  wild_card:        { name: 'Wild Card',        rarity: 'epic',      type: 'add',     sym: 'wild' },
  four_leaf:        { name: 'Four Leaf',        rarity: 'legendary', type: 'passive', relic: 'four_leaf',
                      desc: 'Increase rare symbol chance by 5%.' },
};

export const CARD_PRICE = { common: 8, uncommon: 14, rare: 22, epic: 34, legendary: 50 };

// The Knight's starting reel bag ("Balanced").
export const KNIGHT_BAG = ['sword', 'sword', 'sword', 'sword', 'shield', 'shield', 'shield', 'potion', 'potion',
  'coin', 'coin', 'coin', 'chest', 'skull', 'skull', 'clover'];

export const ENEMIES = {
  goblin:   { name: 'Goblin',   model: 'goblin',   hp: 7,  atk: 2, gold: [2, 4] },
  skeleton: { name: 'Skeleton', model: 'skeleton', hp: 9,  atk: 2, armor: 1, gold: [2, 5], note: 'Blocks 1 damage each turn.' },
  slime:    { name: 'Slime',    model: 'slime',    hp: 6,  atk: 1, regen: 1, gold: [1, 3], note: 'Regenerates 1 HP.' },
  cultist:  { name: 'Cultist',  model: 'cultist',  hp: 8,  atk: 2, curse: 2, gold: [3, 6], note: 'Curses your reels.' },
  mimic:    { name: 'Mimic',    model: 'mimic',    hp: 12, atk: 3, gold: [8, 12], note: 'It was never a chest.' },
};

export const BIOMES = {
  dungeon: {
    name: 'Dungeon', floors: [1, 2, 3], enemies: ['goblin', 'goblin', 'skeleton', 'slime', 'cultist'],
    fog: [0.03, 0.032, 0.05], fogRange: [3.0, 15.0], ambient: [0.2, 0.22, 0.3],
    torch: [1.55, 1.0, 0.55], torchRadius: 6.2, lanternOnPlayer: [0.42, 0.36, 0.3],
  },
  mines: {
    name: 'Mines', floors: [4, 5, 6], enemies: ['skeleton', 'goblin', 'slime', 'cultist', 'skeleton'],
    fog: [0.05, 0.036, 0.026], fogRange: [3.0, 14.0], ambient: [0.26, 0.21, 0.17],
    torch: [2.0, 1.2, 0.45], torchRadius: 7.0, lanternOnPlayer: [0.42, 0.34, 0.24],
  },
  ruins: {
    name: 'Ruins', floors: [7, 8, 9], enemies: ['cultist', 'skeleton', 'slime', 'goblin', 'cultist'],
    fog: [0.42, 0.5, 0.62], fogRange: [8.0, 46.0], ambient: [0.42, 0.47, 0.54],
    sun: { dir: [0.45, -0.75, 0.35], col: [0.72, 0.74, 0.8] }, sky: true,
    torch: [1.6, 1.2, 0.7], torchRadius: 5.0, lanternOnPlayer: [0.12, 0.12, 0.12],
  },
};

export function biomeForFloor(f) {
  if (f <= 3) return 'dungeon';
  if (f <= 6) return 'mines';
  return 'ruins';
}

export const LAST_FLOOR = 9;
