export const NON_SPELL_SKILLS = [
  "Fighting",
  "Spellcasting",
  "Short Blades",
  "Long Blades",
  "Axes",
  "Maces & Flails",
  "Polearms",
  "Staves",
  "Bows",
  "Crossbows",
  "Slings",
  "Unarmed Combat",
  "Throwing",
  "Armour",
  "Dodging",
  "Stealth",
  "Shapeshifting",
  "Shields",
  "Invocations",
  "Evocations",
] as const

export const WEAPON_SKILLS = [
  "Short Blades",
  "Long Blades",
  "Axes",
  "Maces & Flails",
  "Polearms",
  "Staves",
  "Unarmed Combat",
] as const

export const RANGED_WEAPON_SKILLS = [
  "Bows",
  "Crossbows",
  "Slings",
] as const

export const SPELL_SCHOOLS = [
  "Conjurations",
  "Hexes",
  "Summonings",
  "Necromancy",
  "Translocations",
  "Transmutations",
  "Fire Magic",
  "Ice Magic",
  "Air Magic",
  "Earth Magic",
] as const

export type NonSpellSkill = (typeof NON_SPELL_SKILLS)[number]
export type SpellSchool = (typeof SPELL_SCHOOLS)[number]

