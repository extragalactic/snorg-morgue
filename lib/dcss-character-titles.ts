import type { GameRecord } from "@/lib/morgue-api"

/**
 * Morgue title lines store names like "Sinorg the Cloud Mage" before "(Species Background)".
 * Returns display text "the Cloud Mage", or null if the line does not match `… the …`.
 */
export function formatCharacterEpithetDisplay(characterName: string): string | null {
  const trimmed = characterName.trim()
  if (!trimmed) return null
  const m = trimmed.match(/^(.+?)\s+the\s+(.+)$/i)
  if (!m) return null
  const rest = m[2].trim()
  if (!rest) return null
  return `the ${rest}`
}

/** Distinct epithets across games, sorted alphabetically; duplicates differ only by case collapse to one label (first seen wins). */
export function collectUniqueFormattedTitles(morgues: GameRecord[]): string[] {
  const byLower = new Map<string, string>()
  for (const m of morgues) {
    const t = formatCharacterEpithetDisplay(m.character)
    if (!t) continue
    const key = t.toLowerCase()
    if (!byLower.has(key)) byLower.set(key, t)
  }
  return [...byLower.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
}

/** Lowercase epithet strings (`the …`) that occur on at least one winning game. */
export function epithetKeysFromWinners(morgues: GameRecord[]): Set<string> {
  const keys = new Set<string>()
  for (const m of morgues) {
    if (m.result !== "win") continue
    const t = formatCharacterEpithetDisplay(m.character)
    if (t) keys.add(t.toLowerCase())
  }
  return keys
}
