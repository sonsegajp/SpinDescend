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
  // new weapons
  spear:        { name: 'Spear',            icon: 'spear',        rarity: 'common',    dmg: 1, phalanx: 1,     desc: 'Deal 1 damage. +1 for each other Spear on the reels.' },
  axe:          { name: 'Battle Axe',       icon: 'axe',          rarity: 'uncommon',  dmg: 2, pierce: 1,      desc: 'Deal 2 damage. Cleaves through block.' },
  knives:       { name: 'Throwing Knives',  icon: 'knives',       rarity: 'uncommon',  dmg: 1, hits: 2,        desc: 'Deal 1 damage twice.' },
  hammer:       { name: 'War Hammer',       icon: 'hammer',       rarity: 'rare',      dmg: 2, stun: 0.3,      desc: 'Deal 2 damage. 30% chance to stun: the foe skips its attack.' },
  crossbow:     { name: 'Crossbow',         icon: 'crossbow',     rarity: 'rare',      dmg: 2, opener: 1,      desc: 'Deal 2 damage. Double damage to a foe at full HP.' },
  flail:        { name: 'Morning Star',     icon: 'flail',        rarity: 'rare',      dmg: 1, dmgRoll: [1, 5], desc: 'Deal 1 to 5 damage.' },
  flame:        { name: 'Flame Brand',      icon: 'flame',        rarity: 'epic',      dmg: 2, burn: 3,        desc: 'Deal 2 damage. Sets the foe ablaze: 2 damage a turn for 3 turns.' },
  scythe:       { name: "Reaper's Scythe",  icon: 'scythe',       rarity: 'epic',      dmg: 2, execute: 0.25,  desc: 'Deal 2 damage. Reaps any foe left below 25% HP.' },
  spiked:       { name: 'Spiked Shield',    icon: 'spiked',       rarity: 'uncommon',  armor: 1, dmg: 1,       desc: 'Gain 1 Armor and deal 1 damage.' },
  potion3:      { name: 'Greater Potion',   icon: 'potion3',      rarity: 'rare',      heal: 4,                desc: 'Restore 4 HP.' },
  // legendary blades from other worlds
  dawnblade:    { name: 'Dawnblade',        icon: 'dawnblade',    rarity: 'legendary', dmg: 3, beam: 3,        desc: 'Deal 3 damage. At full HP it flares with dawnlight: +3 damage.' },
  slabcleaver:  { name: 'Slab Cleaver',     icon: 'slabcleaver',  rarity: 'epic',      dmg: 4, limit: 4,       desc: 'Deal 4 damage. Every 4th swing Overdrives: triple damage.' },
  wyrmbreaker:  { name: 'Wyrmbreaker',      icon: 'wyrmbreaker',  rarity: 'legendary', dmg: 6, pierce: 1,      desc: 'Deal 6 damage, cleaving through block. Forged around a wyrm\'s tooth.' },
  picklock:     { name: 'Picklock Rapier',  icon: 'picklock',     rarity: 'epic',      dmg: 2, unlock: 1,      desc: 'Deal 2 damage. Picks a Curse on the reels open into Gold.' },
  whisperblade: { name: 'Whisper Blade',    icon: 'whisperblade', rarity: 'legendary', dmg: 2, hits: 3,        desc: 'Deal 2 damage three times, quick as a breath.' },
  powder_saber: { name: 'Powder Saber',     icon: 'powder_saber', rarity: 'rare',      dmg: 3, trigger: 0.35,  desc: 'Deal 3 damage. 35% chance its pistol barrel fires: +3.' },
  bulwark:      { name: 'Bulwark',          icon: 'bulwark',      rarity: 'rare',      armor: 3,               desc: 'Gain 3 Armor.' },
  ember_flask:  { name: 'Ember Flask',      icon: 'ember_flask',  rarity: 'rare',      heal: 5,                desc: 'Restore 5 HP.' },
  // the Mage's spells: they replace every melee weapon on a Mage run, and only a Mage ever finds them.
  // spell: counts as magic (Spellweaver echoes); sure: never misses; chill: the foe hits 1 softer for N turns;
  // freeze: chance the foe loses its attack; leech: heal N; arc: +1 per other spell on the reels
  spark:        { name: 'Arcane Spark',     icon: 'spark',        rarity: 'common',    dmg: 1, spell: 1, sure: 1, desc: 'Deal 1 damage. Spells never miss.' },
  bolt_arcane:  { name: 'Arcane Bolt',      icon: 'bolt_arcane',  rarity: 'uncommon',  dmg: 2, spell: 1, sure: 1, desc: 'Deal 2 damage.' },
  firebolt:     { name: 'Fire Bolt',        icon: 'firebolt',     rarity: 'uncommon',  dmg: 1, burn: 2, spell: 1, sure: 1, desc: 'Deal 1 damage and set the foe ablaze for 2 turns.' },
  frost:        { name: 'Frost Shard',      icon: 'frost',        rarity: 'uncommon',  dmg: 1, chill: 2, spell: 1, sure: 1, desc: 'Deal 1 damage. Chill: the foe hits 1 softer for 2 turns.' },
  toxic:        { name: 'Toxic Cloud',      icon: 'toxic',        rarity: 'uncommon',  dmg: 1, poison: 2, spell: 1, sure: 1, desc: 'Deal 1 damage and apply 2 Poison.' },
  chain:        { name: 'Chain Lightning',  icon: 'chain',        rarity: 'rare',      dmg: 2, arc: 1, spell: 1, sure: 1, desc: 'Deal 2 damage, +1 for every other Spell on the reels.' },
  fireball:     { name: 'Fireball',         icon: 'fireball',     rarity: 'rare',      dmg: 4, burn: 2, spell: 1, sure: 1, desc: 'Deal 4 damage and set the foe ablaze.' },
  missiles:     { name: 'Arcane Missiles',  icon: 'missiles',     rarity: 'rare',      dmg: 1, hits: 3, spell: 1, sure: 1, desc: 'Deal 1 damage three times.' },
  drain:        { name: 'Life Drain',       icon: 'drain',        rarity: 'rare',      dmg: 2, leech: 2, spell: 1, sure: 1, desc: 'Deal 2 damage and heal 2 HP.' },
  icelance:     { name: 'Ice Lance',        icon: 'icelance',     rarity: 'rare',      dmg: 3, chill: 2, freeze: 0.3, spell: 1, sure: 1, desc: 'Deal 3 damage and Chill. 30% chance to Freeze: the foe loses its attack.' },
  meteor:       { name: 'Meteor',           icon: 'meteor',       rarity: 'epic',      dmg: 7, pierce: 1, spell: 1, sure: 1, desc: 'Deal 7 damage that smashes through block.' },
  void:         { name: 'Void Rift',        icon: 'void',         rarity: 'epic',      dmg: 2, execute: 0.3, spell: 1, sure: 1, desc: 'Deal 2 damage. Swallows any foe left below 30% HP.' },
  starfall:     { name: 'Starfall',         icon: 'starfall',     rarity: 'legendary', dmg: 2, hits: 5, spell: 1, sure: 1, desc: 'Five falling stars deal 2 damage each.' },
  prism:        { name: 'Prismatic Ray',    icon: 'prism',        rarity: 'legendary', dmg: 4, beam: 4, spell: 1, sure: 1, desc: 'Deal 4 damage. At full HP the ray splits: +4.' },
};

// Paytable families: upgraded symbols count as their base symbol.
export const FAMILY = {
  sword: 'blade', sword2: 'blade', sword3: 'blade', sword4: 'blade', dagger: 'blade',
  spear: 'blade', axe: 'blade', knives: 'blade', hammer: 'blade', crossbow: 'blade', flail: 'blade', flame: 'blade', scythe: 'blade',
  dawnblade: 'blade', slabcleaver: 'blade', wyrmbreaker: 'blade', picklock: 'blade', whisperblade: 'blade', powder_saber: 'blade',
  shield: 'shield', shield2: 'shield', spiked: 'shield', bulwark: 'shield',
  potion: 'potion', potion2: 'potion', potion3: 'potion', vial: 'potion', ember_flask: 'potion',
  coin: 'coin', coin_copper: 'coin', coins: 'coin', coin_silver: 'coin', coin_gold: 'coin', coin_royal: 'coin',
  chest: 'chest', mimic: 'chest',
  clover: 'clover', charm: 'clover',
  skull: 'skull', skull_cursed: 'skull',
  bomb: 'bomb', dice: 'dice',
  spark: 'spell', bolt_arcane: 'spell', firebolt: 'spell', frost: 'spell', toxic: 'spell', chain: 'spell', fireball: 'spell',
  missiles: 'spell', drain: 'spell', icelance: 'spell', meteor: 'spell', void: 'spell', starfall: 'spell', prism: 'spell',
};
export const FAMILY_NAME = { blade: 'Weapons', shield: 'Shields', potion: 'Potions', coin: 'Coins', chest: 'Treasure',
  clover: 'Clovers', skull: 'Curses', bomb: 'Bombs', dice: 'Dice', wild: 'Wildcards', spell: 'Spells' };
export const FAMILY_ICON = { blade: 'sword', shield: 'shield', potion: 'potion', coin: 'coin', chest: 'chest',
  clover: 'clover', skull: 'skull', bomb: 'bomb', dice: 'dice', wild: 'wild', spell: 'spark' };

// 3 of a family across a row (either payline; Wildcards fill in): a permanent boost for the run.
export const LINE_BONUS = {
  blade:  { name: 'TRIPLE STRIKE',  color: '#ff7a5a', desc: '+1 Might: every hit deals +1 for the rest of the run', short: '+1 Might: every hit +1' },
  spell:  { name: 'ARCANE SURGE',   color: '#c07aff', desc: '+1 Might: every spell deals +1 for the rest of the run', short: '+1 Might: every spell +1' },
  shield: { name: 'FORTRESS',       color: '#8ab0ff', desc: '+1 Guard: start every spin with +1 Armor', short: '+1 Guard: +1 Armor each spin' },
  potion: { name: 'VITALITY',       color: '#6aff8a', desc: '+3 Max HP and heal 5', short: '+3 Max HP, heal 5' },
  coin:   { name: 'JACKPOT',        color: '#ffd24a', desc: 'Gold burst and +1 Fortune: every coin pays +1', short: 'Gold burst, +1 Fortune' },
  chest:  { name: 'TREASURE TROVE', color: '#ffb84a', desc: 'A Rare-or-better card after this fight', short: 'Rare+ card after the fight' },
  clover: { name: 'LUCKY STREAK',   color: '#7aff8a', desc: '+10% Luck and a free spin', short: '+10% Luck, free spin' },
  skull:  { name: 'DOOM',           color: '#c86aff', desc: 'The curse rebounds: 6 damage to the foe', short: '6 damage to the foe', hit: 1 },
  bomb:   { name: 'KABOOM',         color: '#ff9a4a', desc: '10 damage now, and +1 Blast: bombs deal +2 for the rest of the run', short: '10 damage, +1 Blast (bombs +2)', hit: 1 },
  dice:   { name: 'HIGH ROLLER',    color: '#e8e0ff', desc: 'Roll 3 dice for gold, and +10% Luck', short: 'Roll 3 dice for gold, +10% Luck' },
  wild:   { name: 'MEGA JACKPOT',   color: '#ff6ae0', desc: '+1 Might, +1 Guard, +1 Fortune and +10% Luck', short: '+1 Might, Guard, Fortune, +10% Luck' },
};

// 3 of the SAME rare symbol in a row: an extra bonus on top of its family's line.
export const SPECIAL_LINE = {
  dagger:       { name: 'VENOM',        color: '#8aff6a', desc: '5 Poison now, and daggers poison +1 more for the run', short: '5 Poison, daggers +1 Poison' },
  vial:         { name: 'BLOODLUST',    color: '#ff5a7a', desc: '+1 Lifesteal: heal 1 after every spin that hits', short: '+1 Lifesteal: heal on every hit spin' },
  charm:        { name: 'BLESSED',      color: '#7affc8', desc: 'Every symbol this spin triggers twice', short: 'Every symbol triggers twice' },
  mimic:        { name: 'MIMIC HOARD',  color: '#ffb84a', desc: 'An Epic-or-better card after this fight', short: 'Epic+ card after the fight' },
  skull_cursed: { name: "DEATH'S DOOR", color: '#c86aff', desc: '12 damage to the foe', short: '12 damage to the foe', hit: 1 },
  spear:        { name: 'SPEAR WALL',   color: '#d8c090', desc: '+1 Guard and +3 Armor', short: '+1 Guard, +3 Armor' },
  axe:          { name: 'SUNDER',       color: '#ff8a5a', desc: '8 damage that ignores block', short: '8 damage, ignores block', hit: 1 },
  knives:       { name: 'KNIFE STORM',  color: '#c8d0e0', desc: '6 more knives: 1 damage each (+Might)', short: '6 extra hits of 1', hit: 1 },
  hammer:       { name: 'EARTHQUAKE',   color: '#b8a080', desc: 'The foe is stunned for 2 turns', short: 'Stun for 2 turns' },
  crossbow:     { name: 'VOLLEY',       color: '#d8b070', desc: '3 bolts of 3 damage', short: '3 bolts of 3 damage', hit: 1 },
  flail:        { name: 'WRECKING BALL', color: '#a0a8b8', desc: '12 damage', short: '12 damage', hit: 1 },
  flame:        { name: 'INFERNO',      color: '#ff7a2a', desc: 'The foe burns for 6 turns', short: 'Ablaze for 6 turns' },
  scythe:       { name: 'HARVEST',      color: '#b07aff', desc: 'Reap the foe if it is below 50% HP, else 6 damage', short: 'Reap below 50% HP, else 6', hit: 1 },
  spiked:       { name: 'IRON MAIDEN',  color: '#9ab0d0', desc: '+1 Guard and 5 damage', short: '+1 Guard, 5 damage', hit: 1 },
  potion3:      { name: 'PANACEA',      color: '#ff7a9a', desc: 'Heal to full HP', short: 'Full heal' },
  firebolt:     { name: 'FIRESTORM',    color: '#ff7a2a', desc: 'The foe burns for 6 turns', short: 'Ablaze for 6 turns' },
  frost:        { name: 'DEEP FREEZE',  color: '#8ad8ff', desc: 'The foe is frozen solid for 2 turns', short: 'Freeze for 2 turns' },
  toxic:        { name: 'PLAGUE',       color: '#8aff6a', desc: '8 Poison', short: '8 Poison' },
  chain:        { name: 'THUNDERSTORM', color: '#ffe84a', desc: '4 lightning strikes of 3 damage', short: '4 strikes of 3', hit: 1 },
  fireball:     { name: 'INFERNO',      color: '#ff5a1a', desc: '14 damage and the foe burns for 4 turns', short: '14 damage + burn', hit: 1 },
  missiles:     { name: 'ARCANE BARRAGE', color: '#c8a0ff', desc: '8 more missiles: 1 damage each (+Might)', short: '8 extra hits of 1', hit: 1 },
  drain:        { name: 'SOUL FEAST',   color: '#ff5a7a', desc: 'Drain 8: deal 8 and heal 8', short: 'Deal 8, heal 8', hit: 1 },
  icelance:     { name: 'GLACIER',      color: '#a8e8ff', desc: '12 damage and the foe is frozen for a turn', short: '12 damage + freeze', hit: 1 },
  void:         { name: 'OBLIVION',     color: '#b07aff', desc: 'Erase the foe if it is below 50% HP, else 10 damage', short: 'Erase below 50%, else 10', hit: 1 },
};

// 3+ of a family anywhere on the reels in one spin: a bonus roll (Luck adds to the odds).
export const SCATTER_BONUS = {
  chest:  { name: 'BONUS CARD',  chance: 1,    color: '#ffb84a', desc: 'An extra card after this fight' },
  clover: { name: 'LUCKY SPIN',  chance: 1,    color: '#7aff8a', desc: 'A free spin' },
  blade:  { name: 'FRENZY',      chance: 0.35, color: '#ff7a5a', desc: 'Every hit this spin is a critical' },
  spell:  { name: 'SPELLSTORM',  chance: 0.35, color: '#c89aff', desc: 'Every spell this spin is a critical' },
  coin:   { name: 'DOUBLE GOLD', chance: 0.5,  color: '#ffd24a', desc: 'Coins pay double this spin' },
  shield: { name: 'SHIELD WALL', chance: 0.5,  color: '#8ab0ff', desc: '+3 Armor' },
  potion: { name: 'SECOND WIND', chance: 0.5,  color: '#6aff8a', desc: 'Heal 3' },
  bomb:   { name: 'CHAIN REACTION', chance: 0.5, color: '#ff9a4a', desc: 'Bombs deal double this spin' },
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
  // new weapons
  spear:            { name: 'Spear',            rarity: 'common',    type: 'add',     sym: 'spear' },
  battle_axe:       { name: 'Battle Axe',       rarity: 'uncommon',  type: 'add',     sym: 'axe' },
  throwing_knives:  { name: 'Throwing Knives',  rarity: 'uncommon',  type: 'add',     sym: 'knives' },
  war_hammer:       { name: 'War Hammer',       rarity: 'rare',      type: 'add',     sym: 'hammer' },
  crossbow:         { name: 'Crossbow',         rarity: 'rare',      type: 'add',     sym: 'crossbow' },
  morning_star:     { name: 'Morning Star',     rarity: 'rare',      type: 'add',     sym: 'flail' },
  flame_brand:      { name: 'Flame Brand',      rarity: 'epic',      type: 'upgrade', from: ['sword2'],           to: 'flame' },
  reapers_scythe:   { name: "Reaper's Scythe",  rarity: 'epic',      type: 'add',     sym: 'scythe' },
  // new gear + boons
  spiked_shield:    { name: 'Spiked Shield',    rarity: 'uncommon',  type: 'upgrade', from: ['shield'],           to: 'spiked' },
  greater_potion:   { name: 'Greater Potion',   rarity: 'rare',      type: 'upgrade', from: ['potion2'],          to: 'potion3' },
  horseshoe:        { name: 'Horseshoe',        rarity: 'rare',      type: 'passive', relic: 'horseshoe',
                      desc: '+10% Luck for the rest of the run.' },
  heartstone:       { name: 'Heartstone',       rarity: 'uncommon',  type: 'boost',   stat: 'maxHp', amount: 5,
                      desc: '+5 Max HP and heal 5.' },
  whetstone:        { name: 'Whetstone',        rarity: 'rare',      type: 'boost',   stat: 'might', amount: 1,
                      desc: '+1 Might: every hit deals +1.' },
  holy_water:       { name: 'Holy Water',       rarity: 'common',    type: 'purge',
                      desc: 'Remove a Curse from your reels.' },
  // legendary arms and strange relics of the deep
  dawnblade:        { name: 'Dawnblade',        rarity: 'legendary', type: 'add',     sym: 'dawnblade' },
  slabcleaver:      { name: 'Slab Cleaver',     rarity: 'epic',      type: 'add',     sym: 'slabcleaver' },
  wyrmbreaker:      { name: 'Wyrmbreaker',      rarity: 'legendary', type: 'add',     sym: 'wyrmbreaker' },
  picklock:         { name: 'Picklock Rapier',  rarity: 'epic',      type: 'add',     sym: 'picklock' },
  whisperblade:     { name: 'Whisper Blade',    rarity: 'legendary', type: 'add',     sym: 'whisperblade' },
  powder_saber:     { name: 'Powder Saber',     rarity: 'rare',      type: 'add',     sym: 'powder_saber' },
  bulwark:          { name: 'Bulwark',          rarity: 'rare',      type: 'upgrade', from: ['shield', 'shield2'], to: 'bulwark' },
  ember_flask:      { name: 'Ember Flask',      rarity: 'rare',      type: 'upgrade', from: ['potion', 'potion2'], to: 'ember_flask' },
  pixie_jar:        { name: 'Pixie in a Jar',   rarity: 'rare',      type: 'passive', relic: 'pixie_jar',
                      desc: 'When you drop to 5 HP or less, the pixie heals you 10. (Once)' },
  ashen_plume:      { name: 'Ashen Plume',      rarity: 'rare',      type: 'passive', relic: 'ashen_plume',
                      desc: 'If you fall, rise again from the ashes with half your HP. (Once)' },
  trinity_sigil:    { name: 'Trinity Sigil',    rarity: 'legendary', type: 'passive', relic: 'trinity_sigil',
                      desc: 'Strength, Cunning, Resolve: +1 Might, +15% Luck, +1 Guard.' },
  hungry_idol:      { name: 'Hungry Idol',      rarity: 'epic',      type: 'boost',   stat: 'hunger',
                      desc: 'It feeds on you: +3 Might, but -8 Max HP.' },
  blood_pact:       { name: 'Blood Pact',       rarity: 'epic',      type: 'passive', relic: 'blood_pact',
                      desc: 'Every Curse that lands also deals 3 damage to the foe.' },
  heartfruit:       { name: 'Heartfruit',       rarity: 'uncommon',  type: 'boost',   stat: 'heartfruit',
                      desc: '+4 Max HP and heal fully.' },
  ember_core:       { name: 'Ember Core',       rarity: 'rare',      type: 'passive', relic: 'ember_core',
                      desc: 'Bombs, Flame Brands and fire spells deal +2 damage.' },
  // spells (cls: only ever offered on a Mage run)
  arcane_spark:     { name: 'Arcane Spark',     rarity: 'common',    type: 'add',     sym: 'spark', cls: 'mage' },
  arcane_bolt:      { name: 'Arcane Bolt',      rarity: 'uncommon',  type: 'upgrade', from: ['spark'],            to: 'bolt_arcane', cls: 'mage' },
  fire_bolt:        { name: 'Fire Bolt',        rarity: 'uncommon',  type: 'add',     sym: 'firebolt', cls: 'mage' },
  frost_shard:      { name: 'Frost Shard',      rarity: 'uncommon',  type: 'add',     sym: 'frost', cls: 'mage' },
  toxic_cloud:      { name: 'Toxic Cloud',      rarity: 'uncommon',  type: 'add',     sym: 'toxic', cls: 'mage' },
  chain_lightning:  { name: 'Chain Lightning',  rarity: 'rare',      type: 'add',     sym: 'chain', cls: 'mage' },
  fireball:         { name: 'Fireball',         rarity: 'rare',      type: 'upgrade', from: ['firebolt'],         to: 'fireball', cls: 'mage' },
  arcane_missiles:  { name: 'Arcane Missiles',  rarity: 'rare',      type: 'add',     sym: 'missiles', cls: 'mage' },
  life_drain:       { name: 'Life Drain',       rarity: 'rare',      type: 'add',     sym: 'drain', cls: 'mage' },
  ice_lance:        { name: 'Ice Lance',        rarity: 'rare',      type: 'upgrade', from: ['frost'],            to: 'icelance', cls: 'mage' },
  meteor:           { name: 'Meteor',           rarity: 'epic',      type: 'upgrade', from: ['fireball'],         to: 'meteor', cls: 'mage' },
  void_rift:        { name: 'Void Rift',        rarity: 'epic',      type: 'add',     sym: 'void', cls: 'mage' },
  starfall:         { name: 'Starfall',         rarity: 'legendary', type: 'upgrade', from: ['bolt_arcane'],      to: 'starfall', cls: 'mage' },
  prismatic_ray:    { name: 'Prismatic Ray',    rarity: 'legendary', type: 'add',     sym: 'prism', cls: 'mage' },
};

// card-face icon for cards that don't put a symbol on the reels
export const CARD_ICON = { horseshoe: 'horseshoe', heartstone: 'heartstone', whetstone: 'whetstone',
  holy_water: 'holy_water', four_leaf: 'clover4', pixie_jar: 'pixie_jar', ashen_plume: 'ashen_plume',
  trinity_sigil: 'trinity', hungry_idol: 'hungry_idol', blood_pact: 'blood_pact', heartfruit: 'heartfruit',
  ember_core: 'ember_core' };

export const CARD_PRICE = { common: 8, uncommon: 14, rare: 22, epic: 34, legendary: 50 };

// The Knight's starting reel bag ("Balanced").
export const KNIGHT_BAG = ['sword', 'sword', 'sword', 'sword', 'shield', 'shield', 'shield', 'potion', 'potion',
  'coin', 'coin', 'coin', 'chest', 'skull', 'skull', 'clover'];
// The Rogue: knives and daggers, deep pockets, a lucky streak.
export const ROGUE_BAG = ['dagger', 'dagger', 'knives', 'sword', 'sword', 'shield', 'shield', 'potion', 'potion',
  'coin', 'coin', 'coins', 'coin', 'chest', 'skull', 'clover', 'clover'];
// The Mage: sparks instead of swords, a fire bolt, fewer shields.
export const MAGE_BAG = ['spark', 'spark', 'spark', 'spark', 'firebolt', 'shield', 'shield', 'potion', 'potion',
  'coin', 'coin', 'coin', 'chest', 'skull', 'skull', 'clover'];

// Playable classes (title screen). unlock: the deepest floor a run must reach first.
export const CLASSES = {
  knight: { name: 'THE KNIGHT', sub: 'Balanced', model: 'knight', hp: 25, bag: KNIGHT_BAG, guard: 1,
            passive: 'Stalwart: +1 Guard - every spin starts with 1 Armor.' },
  rogue:  { name: 'THE ROGUE', sub: 'Cunning', model: 'rogue', hp: 20, bag: ROGUE_BAG, luck: 0.05, unlock: 3,
            passive: 'Sleight of Hand: 25% of spins (+Luck) she shrinks the machine and summons two forest reels.' },
  mage:   { name: 'THE MAGE', sub: 'Arcane', model: 'mage', hp: 21, bag: MAGE_BAG, unlock: 5,
            passive: 'Spellweaver: casts spells, never steel. Every 4th spell echoes and casts twice.' },
};
export const CLASS_ORDER = ['knight', 'rogue', 'mage'];

export const ENEMIES = {
  goblin:   { name: 'Goblin',   model: 'goblin',   hp: 7,  atk: 2, gold: [2, 4] },
  skeleton: { name: 'Skeleton', model: 'skeleton', hp: 9,  atk: 2, armor: 1, gold: [2, 5], note: 'Blocks 1 damage each turn.' },
  slime:    { name: 'Slime',    model: 'slime',    hp: 6,  atk: 1, regen: 1, gold: [1, 3], note: 'Regenerates 1 HP.' },
  cultist:  { name: 'Cultist',  model: 'cultist',  hp: 8,  atk: 2, curse: 2, gold: [3, 6], note: 'Curses your reels.' },
  mimic:    { name: 'Mimic',    model: 'mimic',    hp: 12, atk: 3, gold: [8, 12], note: 'It was never a chest.' },
  // second wave
  wailer:   { name: 'Wailer',       model: 'wailer',   hp: 11, atk: 2, scream: 4, gold: [4, 7], note: 'Every 4th turn its wail paralyzes you.' },
  tusker:   { name: 'Tusker',       model: 'tusker',   hp: 16, atk: 3, charge: 3, gold: [5, 8], note: 'Charges every third turn.' },
  duskwing: { name: 'Duskwing',     model: 'duskwing', hp: 4,  atk: 1, dodge: 0.3, gold: [1, 3], note: 'Flits out of the way of blows.' },
  warden:   { name: 'Dread Warden', model: 'warden',   hp: 18, atk: 3, armor: 2, gold: [7, 11], note: 'Its hollow armour blocks 2 damage.' },
  wickling: { name: 'Wickling',     model: 'wickling', hp: 12, atk: 1, grudge: 1, gold: [5, 9], note: 'Its flame burns hotter every turn.' },
  murk:     { name: 'Murkling',     model: 'murk',     hp: 7,  atk: 2, dodge: 0.25, gold: [2, 5], note: 'Melts into a puddle to dodge.' },
  jester:   { name: 'Jester Imp',   model: 'jester',   hp: 10, atk: 2, charge: 3, gold: [3, 6], note: 'Spin-kicks for double damage every third turn.' },
};

// stair guards (elites) per biome
export const ELITES = { dungeon: ['goblin', 'skeleton', 'wailer'], mines: ['tusker', 'skeleton', 'wickling'],
  crypt: ['wailer', 'cultist', 'warden'], frozen: ['warden', 'skeleton', 'tusker'], magma: ['tusker', 'warden', 'wickling'],
  ruins: ['warden', 'tusker', 'wailer'] };

export const BIOMES = {
  dungeon: {
    name: 'Dungeon', floors: [1, 2], enemies: ['goblin', 'goblin', 'skeleton', 'slime', 'cultist', 'duskwing', 'duskwing', 'jester', 'murk'],
    fog: [0.03, 0.032, 0.05], fogRange: [3.0, 15.0], ambient: [0.2, 0.22, 0.3],
    torch: [1.55, 1.0, 0.55], torchRadius: 6.2, lanternOnPlayer: [0.42, 0.36, 0.3],
  },
  mines: {
    name: 'Mines', floors: [3, 4], enemies: ['skeleton', 'goblin', 'slime', 'tusker', 'tusker', 'duskwing', 'wickling', 'jester'],
    fog: [0.05, 0.036, 0.026], fogRange: [3.0, 14.0], ambient: [0.26, 0.21, 0.17],
    torch: [2.0, 1.2, 0.45], torchRadius: 7.0, lanternOnPlayer: [0.42, 0.34, 0.24],
  },
  crypt: {
    name: 'Crypt', floors: [5, 6], enemies: ['wailer', 'wailer', 'skeleton', 'skeleton', 'murk', 'cultist', 'duskwing', 'slime'],
    fog: [0.045, 0.035, 0.06], fogRange: [2.5, 13.0], ambient: [0.23, 0.21, 0.3],
    torch: [1.35, 1.2, 0.62], torchRadius: 4.6, lanternOnPlayer: [0.34, 0.34, 0.42],
  },
  frozen: {
    name: 'Frozen Caverns', floors: [7, 8], enemies: ['duskwing', 'skeleton', 'warden', 'murk', 'slime', 'goblin', 'wickling'],
    fog: [0.09, 0.14, 0.21], fogRange: [3.0, 16.0], ambient: [0.2, 0.25, 0.33],
    torch: [0.34, 0.6, 1.1], torchRadius: 4.4, lanternOnPlayer: [0.3, 0.33, 0.38],
  },
  magma: {
    name: 'Magma Forge', floors: [9, 10], enemies: ['tusker', 'tusker', 'goblin', 'warden', 'wickling', 'slime', 'cultist'],
    fog: [0.16, 0.05, 0.02], fogRange: [3.0, 15.0], ambient: [0.34, 0.17, 0.11],
    torch: [2.3, 1.05, 0.36], torchRadius: 6.5, lanternOnPlayer: [0.35, 0.24, 0.18],
  },
  ruins: {
    name: 'Ruins', floors: [11, 12], enemies: ['cultist', 'skeleton', 'warden', 'wailer', 'murk', 'jester', 'jester', 'tusker'],
    fog: [0.42, 0.5, 0.62], fogRange: [8.0, 46.0], ambient: [0.42, 0.47, 0.54],
    sun: { dir: [0.45, -0.75, 0.35], col: [0.72, 0.74, 0.8] }, sky: true,
    torch: [1.6, 1.2, 0.7], torchRadius: 5.0, lanternOnPlayer: [0.12, 0.12, 0.12],
  },
};

const ORDER = ['dungeon', 'mines', 'crypt', 'frozen', 'magma', 'ruins'];
export function biomeForFloor(f) {
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, Math.floor((f - 1) / 2)))];
}

export const LAST_FLOOR = 12;
