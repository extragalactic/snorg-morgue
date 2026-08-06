/**
 * Species skill aptitudes from DCSS trunk docs:
 * https://crawl.develz.org/docs/aptitudes.txt
 *
 * Layout / abbreviations match the in-game aptitudes legend.
 */

/** Aptitude number, or null when the species cannot train the skill (`--`). */
export type AptitudeValue = number | null

export type AptitudeSkillKey =
  | "Arm"
  | "Ddg"
  | "Sth"
  | "Shd"
  | "Shp"
  | "Inv"
  | "Evo"
  | "Thr"
  | "HP"
  | "MP"
  | "Exp"
  | "WL"
  | "Fgt"
  | "M&F"
  | "Axs"
  | "Pla"
  | "Stv"
  | "UC"
  | "SBl"
  | "LBl"
  | "Rng"
  | "Spc"
  | "Coj"
  | "Hex"
  | "Sum"
  | "Nec"
  | "Frg"
  | "Trl"
  | "Fir"
  | "Ice"
  | "Air"
  | "Ear"
  | "Alc"

export type SpeciesAptitudes = Record<AptitudeSkillKey, AptitudeValue>

export type AptitudeSkillDef = {
  key: AptitudeSkillKey
  abbr: string
  name: string
  /** HP is shown as a percent modifier; others use the standard aptitude scale. */
  kind?: "hp" | "default"
}

export type AptitudeColumn = {
  title: string
  groups: readonly (readonly AptitudeSkillDef[])[]
}

/** Three-column legend layout (matches aptitudes.txt / in-game help). */
export const APTITUDE_COLUMNS: readonly AptitudeColumn[] = [
  {
    title: "General skills, Experience",
    groups: [
      [
        { key: "Arm", abbr: "Arm", name: "Armour" },
        { key: "Ddg", abbr: "Ddg", name: "Dodging" },
        { key: "Sth", abbr: "Sth", name: "Stealth" },
        { key: "Shd", abbr: "Shd", name: "Shields" },
        { key: "Shp", abbr: "Shp", name: "Shapeshifting" },
      ],
      [
        { key: "Inv", abbr: "Inv", name: "Invocations" },
        { key: "Evo", abbr: "Evo", name: "Evocations" },
        { key: "Thr", abbr: "Thr", name: "Throwing" },
      ],
      [
        { key: "HP", abbr: "HP", name: "hit points", kind: "hp" },
        { key: "MP", abbr: "MP", name: "magic points" },
        { key: "Exp", abbr: "Exp", name: "experience" },
        { key: "WL", abbr: "WL", name: "willpower" },
      ],
    ],
  },
  {
    title: "Melee and Ranged Combat",
    groups: [
      [{ key: "Fgt", abbr: "Fgt", name: "Fighting" }],
      [
        { key: "M&F", abbr: "M&F", name: "Maces & Flails" },
        { key: "Axs", abbr: "Axs", name: "Axes" },
        { key: "Pla", abbr: "Pla", name: "Polearms" },
        { key: "Stv", abbr: "Stv", name: "Staves" },
        { key: "UC", abbr: "UC", name: "Unarmed Combat" },
      ],
      [
        { key: "SBl", abbr: "SBl", name: "Short Blades" },
        { key: "LBl", abbr: "LBl", name: "Long Blades" },
        { key: "Rng", abbr: "Rng", name: "Ranged Weapons" },
      ],
    ],
  },
  {
    title: "Spellcasting and Magic",
    groups: [
      [
        { key: "Spc", abbr: "Spc", name: "Spellcasting" },
        { key: "Coj", abbr: "Coj", name: "Conjurations" },
        { key: "Hex", abbr: "Hex", name: "Hexes" },
        { key: "Sum", abbr: "Sum", name: "Summonings" },
        { key: "Nec", abbr: "Nec", name: "Necromancy" },
        { key: "Frg", abbr: "Frg", name: "Forgecraft" },
        { key: "Trl", abbr: "Trl", name: "Translocations" },
      ],
      [
        { key: "Fir", abbr: "Fir", name: "Fire Magic" },
        { key: "Ice", abbr: "Ice", name: "Ice Magic" },
        { key: "Air", abbr: "Air", name: "Air Magic" },
        { key: "Ear", abbr: "Ear", name: "Earth Magic" },
        { key: "Alc", abbr: "Alc", name: "Alchemy" },
      ],
    ],
  },
]

function a(
  Arm: AptitudeValue,
  Ddg: AptitudeValue,
  Sth: AptitudeValue,
  Shd: AptitudeValue,
  Shp: AptitudeValue,
  Inv: AptitudeValue,
  Evo: AptitudeValue,
  Thr: AptitudeValue,
  HP: AptitudeValue,
  MP: AptitudeValue,
  Exp: AptitudeValue,
  WL: AptitudeValue,
  Fgt: AptitudeValue,
  MF: AptitudeValue,
  Axs: AptitudeValue,
  Pla: AptitudeValue,
  Stv: AptitudeValue,
  UC: AptitudeValue,
  SBl: AptitudeValue,
  LBl: AptitudeValue,
  Rng: AptitudeValue,
  Spc: AptitudeValue,
  Coj: AptitudeValue,
  Hex: AptitudeValue,
  Sum: AptitudeValue,
  Nec: AptitudeValue,
  Trl: AptitudeValue,
  Frg: AptitudeValue,
  Fir: AptitudeValue,
  Ice: AptitudeValue,
  Air: AptitudeValue,
  Ear: AptitudeValue,
  Alc: AptitudeValue,
): SpeciesAptitudes {
  return {
    Arm,
    Ddg,
    Sth,
    Shd,
    Shp,
    Inv,
    Evo,
    Thr,
    HP,
    MP,
    Exp,
    WL,
    Fgt,
    "M&F": MF,
    Axs,
    Pla,
    Stv,
    UC,
    SBl,
    LBl,
    Rng,
    Spc,
    Coj,
    Hex,
    Sum,
    Nec,
    Trl,
    Frg,
    Fir,
    Ice,
    Air,
    Ear,
    Alc,
  }
}

/**
 * Aptitudes keyed by canonical chargen species name.
 * Coloured Draconians use the base Draconian row (chargen collapses colours).
 */
export const SPECIES_APTITUDES: Record<string, SpeciesAptitudes> = {
  //        Arm Ddg Sth Shd Shp  Inv Evo Thr   HP  MP Exp WL   Fgt  MF Axs Pla Stv UC  SBl LBl Rng  Spc Coj Hex Sum Nec Trl Frg  Fir Ice Air Ear Alc
  Human: a(0, 0, 1, 0, -1, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  Armataur: a(3, -3, 2, 1, -2, 0, 0, -1, 10, 0, -1, 3, -1, -1, -2, -2, -1, -1, -1, -1, -3, -2, -1, -1, -2, -2, 0, -2, -1, -1, -1, -1, -1),
  Barachi: a(2, 1, 0, 1, 0, -1, 1, 0, 0, 0, 0, 3, 2, 1, 1, 0, 1, 1, 1, 2, 0, 0, 1, 1, 2, -1, 1, 1, 1, 2, 1, 0, 1),
  Coglin: a(-1, -1, -1, -3, -2, -2, 3, -1, 0, 0, 0, 5, 0, -1, 0, -1, -1, -1, -1, 0, -1, -2, -1, -1, 0, 0, 0, 2, -1, -1, -1, -1, 1),
  Demigod: a(-1, -1, 0, -1, -2, null, -1, -1, 10, 2, -2, 4, -1, -1, -1, -1, -1, -1, -1, -1, -1, -2, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1),
  Demonspawn: a(-1, -1, 0, -1, -2, 3, 0, -1, 0, 0, -1, 3, 0, -1, -1, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 1, -1, -1, -1, -1, -1, -1, 0),
  Djinni: a(0, 1, -1, 0, -2, 0, 0, -2, -10, 0, 1, 4, 0, -2, -2, -2, -1, 0, -1, -1, -2, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11),
  Draconian: a(null, -1, 0, 0, -1, 1, 0, -1, 10, 0, -1, 3, 1, 0, 0, 0, 0, 0, 0, 0, -1, -1, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  "Mountain Dwarf": a(1, -3, -2, 1, -2, 3, 1, -2, 10, 0, -1, 4, 1, 2, 2, 0, 1, 0, -2, -1, -2, -2, -1, 0, -2, 1, -2, 2, 2, -1, -3, 1, -2),
  "Deep Elf": a(-2, 2, 3, -2, 0, 1, 1, 0, -20, 2, -1, 4, -2, -3, -2, -3, 0, -2, 0, -1, 3, 3, 1, 3, 1, 2, 1, 1, 1, 1, 1, 1, 1),
  Felid: a(null, 3, 4, null, -2, 0, 1, null, -30, 1, -1, 6, 0, null, null, null, null, 0, null, null, null, -1, -1, 4, 0, 0, 4, -1, -1, -1, -1, -1, -1),
  Formicid: a(1, -1, 3, 3, 0, 2, 1, 0, 0, 0, 1, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 2, 0, 0, 2, 0, 0, 0, -2, 2, 3),
  Gargoyle: a(1, -2, 2, 1, -3, 1, -1, -1, -20, 0, 0, 3, 1, 0, -1, -1, 0, 0, -1, -1, 0, -1, 1, -1, -1, -2, -1, -1, 0, 0, -2, 2, -2),
  Gnoll: a(8, 8, 8, 8, 7, 9, 8, 8, 0, 0, 0, 3, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6),
  Kobold: a(-2, 2, 4, -2, -1, 1, 2, 1, -20, 0, 1, 3, 1, -1, -2, -2, -1, 0, 3, -2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  Merfolk: a(-3, 3, 2, 0, 2, 1, 0, 0, 0, 0, 0, 3, 1, -2, -2, 4, -2, 1, 2, 1, -2, -1, -2, 0, 0, -2, -2, 0, -3, 1, -2, -2, 3),
  Minotaur: a(2, 1, -1, 2, -3, 0, -1, 0, 10, -1, -1, 3, 2, 2, 2, 2, 2, 1, 1, 2, 1, -4, -3, -4, -3, -3, -3, -2, -3, -3, -3, -2, -3),
  Mummy: a(-2, -2, -1, -2, null, -1, -2, -2, 0, 0, -1, 5, 0, -2, -2, -2, -2, -2, -2, -2, -2, 2, -2, -1, -2, 0, -2, -2, -2, -2, -2, -2, -2),
  Naga: a(-1, -2, 5, -1, -1, 1, 0, -1, 20, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2),
  Octopode: a(null, 0, 4, 0, -1, 1, 1, 0, -10, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1),
  Oni: a(-1, -1, -2, -1, -1, 2, -2, 0, 30, 0, 0, 4, 3, 0, 0, 0, 0, -1, -1, -1, -3, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1),
  Poltergeist: a(null, 1, 5, -1, null, -1, -1, 2, -10, 0, 0, 4, -1, -2, -1, -1, -2, -3, 1, 0, -2, -1, -3, 4, 0, 1, 0, -1, -1, 1, 1, -1, 1),
  Revenant: a(-1, -1, 2, -1, null, 1, -2, -1, 10, 1, -1, 3, 1, -1, -1, -1, -2, 1, -1, -1, -3, -1, -1, -2, -1, 0, -1, -2, -2, 1, -2, 1, -1),
  Spriggan: a(-3, 3, 5, -3, 2, 0, 3, 0, -30, 1, -1, 7, -2, -3, -2, -3, -3, -2, 1, -2, 0, 2, -3, 2, -2, -1, 4, -2, -2, -2, -1, -1, 1),
  Tengu: a(1, 1, 1, 0, -2, -1, 0, 0, -20, 1, 0, 3, 0, 1, 1, 1, 1, 1, 1, 1, 1, -1, 3, -3, 2, 1, -2, -2, 1, -1, 3, -3, -1),
  Troll: a(-2, -2, -5, -1, -1, -1, -3, -1, 30, -1, -1, 3, -2, -1, -2, -2, -2, 0, -2, -2, -4, -5, -3, -4, -3, -2, -3, -3, -3, -3, -4, -1, -3),
  "Vine Stalker": a(-2, -2, 3, -1, -1, 0, -1, -1, -30, 1, 0, 5, -1, -1, -1, -1, -1, 0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
}

export function getSpeciesAptitudes(species: string): SpeciesAptitudes | null {
  const key = species.trim()
  return SPECIES_APTITUDES[key] ?? null
}

/** Format a single aptitude cell for display. */
export function formatAptitudeValue(
  value: AptitudeValue,
  kind: AptitudeSkillDef["kind"] = "default",
): string {
  if (value === null) return "--"
  if (kind === "hp") {
    const sign = value >= 0 ? "+" : ""
    return `${sign}${value}%`
  }
  if (value === 0) return "0"
  return value > 0 ? `+${value}` : `${value}`
}

/** Colour cue for aptitude quality (positive / negative / unavailable). */
export function aptitudeToneClass(value: AptitudeValue): string {
  if (value === null) return "text-neutral-500"
  if (value > 0) return "text-emerald-400"
  if (value < 0) return "text-red-400"
  return "text-neutral-200"
}
