/**
 * Canonical DCSS playable species, backgrounds, and gods.
 * Used for charts (zero-data entries) and Analysis goal totals.
 */

export const ALL_SPECIES_NAMES = [
  "Gnoll", "Minotaur", "Merfolk", "Gargoyle", "Mountain Dwarf", "Draconian", "Troll", "Deep Elf", "Armataur",
  "Human", "Kobold", "Revenant", "Demonspawn", "Djinni", "Spriggan", "Tengu", "Oni", "Barachi",
  "Coglin", "Vine Stalker", "Poltergeist", "Demigod", "Formicid", "Naga", "Octopode", "Felid", "Mummy",
]

export const DRACONIAN_COLOUR_NAMES = [
  "Red Draconian", "Green Draconian", "White Draconian", "Black Draconian", "Yellow Draconian",
  "Purple Draconian", "Grey Draconian", "Mottled Draconian", "Pale Draconian",
]

export const ALL_BACKGROUND_NAMES = [
  "Fighter", "Gladiator", "Monk", "Hunter", "Brigand",
  "Berserker", "Cinder Acolyte", "Chaos Knight",
  "Artificer", "Shapeshifter", "Wanderer", "Delver",
  "Warper", "Hexslinger", "Enchanter", "Reaver",
  "Hedge Wizard", "Conjurer", "Summoner", "Necromancer", "Forgewright",
  "Fire Elementalist", "Ice Elementalist", "Air Elementalist", "Earth Elementalist", "Alchemist",
]

export const ALL_GOD_NAMES = [
  "Ashenzari", "Beogh", "Cheibriados", "Dithmenos", "Elyvilon", "Fedhas", "Gozag", "Hepliaklqana",
  "Ignis", "Jiyva", "Kikubaaqudgha", "Lugonu", "Makhleb", "Nemelex", "Okawaru", "Qazlal", "Ru",
  "Sif Muna", "Trog", "Uskayaw", "Vehumet", "Wu Jian", "Xom", "Yredelemnul", "Zin", "The Shining One",
  "(no god)",
]

/** Gods that count for Polytheist (excludes "no god"). */
export const GOD_NAMES_FOR_CHART = ALL_GOD_NAMES.filter((n) => n !== "(no god)")

/** Polytheist gods sorted A–Z (chargen grid, Devoted Species tooltip layout). */
export const GOD_NAMES_ALPHABETICAL = [...GOD_NAMES_FOR_CHART].sort((a, b) =>
  a.localeCompare(b),
) as readonly string[]

/** Split a sorted god list into `columnCount` sequential chunks (col 0 = first chunk, read top-to-bottom). */
export function godsIntoChargenColumns(
  sortedGods: readonly string[],
  columnCount: number,
): string[][] {
  const n = sortedGods.length
  const base = Math.floor(n / columnCount)
  const rem = n % columnCount
  const cols: string[][] = []
  let start = 0
  for (let c = 0; c < columnCount; c++) {
    const size = base + (c < rem ? 1 : 0)
    cols.push([...sortedGods.slice(start, start + size)])
    start += size
  }
  return cols
}

/** Row-major cell order for CSS `grid-cols-3` matching {@link godsIntoChargenColumns}. */
export function godsChargenRowMajorOrder(sortedGods: readonly string[], columnCount = 3): string[] {
  const cols = godsIntoChargenColumns(sortedGods, columnCount)
  const maxRows = cols.reduce((m, c) => Math.max(m, c.length), 0)
  const out: string[] = []
  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < cols.length; c++) {
      if (r < cols[c].length) out.push(cols[c][r])
    }
  }
  return out
}

/** God short forms for display (e.g. Fastest Win subtitle). */
export const GOD_SHORT_FORMS: Record<string, string> = {
  "Ashenzari": "Ash",
  "Beogh": "Beo",
  "Cheibriados": "Chei",
  "Dithmenos": "Dith",
  "Elyvilon": "Ely",
  "Fedhas Madash": "Fed",
  "Fedhas": "Fed",
  "Gozag": "Goz",
  "Hepliaklqana": "Hep",
  "Ignis": "Ign",
  "Jiyva": "Jiy",
  "Kikubaaqudgha": "Kiku",
  "Lugonu": "Lug",
  "Makhleb": "Mak",
  "Nemelex Xobeh": "Nem",
  "Nemelex": "Nem",
  "Okawaru": "Oka",
  "Qazlal": "Qaz",
  "Ru": "Ru",
  "Sif Muna": "Sif",
  "Trog": "Trog",
  "Uskayaw": "Usk",
  "Vehumet": "Veh",
  "Wu Jian": "Wu",
  "Xom": "Xom",
  "Yredelemnul": "Yred",
  "Zin": "Zin",
  "The Shining One": "TSO",
  "Shining One": "TSO",
  "(no god)": "—",
}

/** Total species for Great Player goal. */
export const TOTAL_SPECIES = ALL_SPECIES_NAMES.length

/** Total backgrounds for Grand Player goal. */
export const TOTAL_BACKGROUNDS = ALL_BACKGROUND_NAMES.length

/** Total gods for Polytheist goal. */
export const TOTAL_GODS = GOD_NAMES_FOR_CHART.length

/** Total draconian colours for Tiamat goal. */
export const TOTAL_DRACONIAN_COLOURS = DRACONIAN_COLOUR_NAMES.length
