import { normalizeActionKey } from "./action-history"
import { DCSS_SPELL_LEVEL_BY_EXACT_NAME } from "./dcss-spell-levels-data"

/** Spell levels 1–9 for 3×3 dashboard grid (order = display order). */
export const DCSS_SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

type SpellLevel = (typeof DCSS_SPELL_LEVELS)[number]

function normalizeSpellLookupKey(name: string): string {
  return normalizeActionKey(name)
    .normalize("NFKC")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .toLowerCase()
}

const exactLevelByNormKey = new Map<string, SpellLevel>()
const exactCanonicalNameByNormKey = new Map<string, string>()
for (const [name, level] of Object.entries(DCSS_SPELL_LEVEL_BY_EXACT_NAME)) {
  const norm = normalizeSpellLookupKey(name)
  exactLevelByNormKey.set(norm, level)
  exactCanonicalNameByNormKey.set(norm, name)
}

/** Longest official name first so truncated morgue strings match the most specific spell. */
const spellsLongestFirst: { norm: string; level: SpellLevel; displayName: string }[] = Object.entries(
  DCSS_SPELL_LEVEL_BY_EXACT_NAME,
).map(([name, level]) => ({
  norm: normalizeSpellLookupKey(name),
  level,
  displayName: name,
}))
spellsLongestFirst.sort((a, b) => b.norm.length - a.norm.length)

/** Minimum morgue key length for prefix match (avoids ambiguous single-token matches). */
const MIN_PREFIX_LOOKUP_LEN = 4

/**
 * Map a spell line from the morgue Action table to DCSS spell level (1–9), or null if unknown.
 */
export function lookupDcssSpellLevel(morgueSpellName: string): SpellLevel | null {
  const key = normalizeSpellLookupKey(morgueSpellName)
  if (!key) return null

  const direct = exactLevelByNormKey.get(key)
  if (direct != null) return direct

  if (key.length < MIN_PREFIX_LOOKUP_LEN) return null

  for (const { norm, level } of spellsLongestFirst) {
    if (norm.startsWith(key)) return level
  }
  return null
}

/**
 * Official spell title for display when the morgue Action table truncates names (same matching
 * rules as {@link lookupDcssSpellLevel}). Returns null if unknown / too short for prefix match.
 */
export function resolveCanonicalDcssSpellName(morgueSpellName: string): string | null {
  const key = normalizeSpellLookupKey(morgueSpellName)
  if (!key) return null

  const direct = exactCanonicalNameByNormKey.get(key)
  if (direct != null) return direct

  if (key.length < MIN_PREFIX_LOOKUP_LEN) return null

  for (const { norm, displayName } of spellsLongestFirst) {
    if (norm.startsWith(key)) return displayName
  }
  return null
}
