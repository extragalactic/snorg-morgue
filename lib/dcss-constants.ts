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
  "Ashenzari", "Beogh", "Cheibriados", "Dithmenos", "Elyvilon", "Fedhas Madash", "Gozag", "Hepliaklqana",
  "Ignis", "Jiyva", "Kikubaaqudgha", "Lugonu", "Makhleb", "Nemelex Xobeh", "Okawaru", "Qazlal", "Ru",
  "Sif Muna", "Trog", "Uskayaw", "Vehumet", "Wu Jian", "Xom", "Yredelemnul", "Zin", "The Shining One",
  "(no god)",
]

/** Gods that count for Polytheist (excludes "no god"). */
export const GOD_NAMES_FOR_CHART = ALL_GOD_NAMES.filter((n) => n !== "(no god)")

/** Total species for Great Player goal. */
export const TOTAL_SPECIES = ALL_SPECIES_NAMES.length

/** Total backgrounds for Greater Player goal. */
export const TOTAL_BACKGROUNDS = ALL_BACKGROUND_NAMES.length

/** Total gods for Polytheist goal. */
export const TOTAL_GODS = GOD_NAMES_FOR_CHART.length
