/**
 * Map morgue `place` strings into fixed progression buckets for the Death Significance Profile chart.
 * Baseline = all deaths for the user (all species); comparison = deaths for one species.
 *
 * Per-death significance uses sqrt(hours) × zoneWeight² so that:
 * - sqrt(hours) grows sublinearly with time (20h matters more than 1h, but not 20×).
 * - squaring zoneWeight makes branch depth the dominant factor vs raw death counts.
 * - This beats raw counts or raw hours alone, which over-rank early throwaway deaths.
 */

import type { GameRecord } from "@/lib/morgue-api"

/** Row payload for `DeathImpactProfileChart` (built from morgues or supplied as mock). */
export type DeathImpactRowData = {
  level: string
  /** Baseline summed significance (all species, same user). */
  globalImpact: number
  /** Summed significance for selected species. */
  selectedImpact: number
  section: string
  /** Deaths in this zone (selected species — tooltip). */
  deathCount: number
  /** Mean wall-clock hours at death in this zone (selected species). */
  avgHoursAtDeath: number
  /** Zone significance total for selected species (= selectedImpact in live data). */
  weightedImpactScore: number
}

/** Depth weights by chart row label (progression); unknown rows use "Other". */
const ZONE_SIGNIFICANCE_WEIGHT: Record<string, number> = {
  "Dungeon 1-5": 0.15,
  "Dungeon 6-10": 0.35,
  "Dungeon 11-15": 0.7,
  "Lair 1-5": 1.0,
  "Orc 1-2": 0.9,
  "Swamp 1-4": 1.6,
  "Shoals 1-4": 1.6,
  "Spider 1-4": 1.6,
  "Snake 1-4": 1.6,
  "Vaults 1-4": 2.4,
  "Vaults 5": 4.0,
  "Slime 1-4": 2.2,
  "Crypt 1-3": 1.8,
  Abyss: 2.0,
  "Depths 1-4": 3.0,
  "Zot 1-4": 4.2,
  "Zot 5": 6.0,
  "Orb run": 7.0,
  Other: 1.0,
}

/**
 * One death’s significance: soft time scaling × squared depth weight.
 * - sqrt(hours): sublinear time so long runs matter without dominating linearly.
 * - weight²: progression depth dominates vs stacking many early deaths.
 * - Min 0.1h avoids sqrt(0) / invalid durations collapsing the score.
 */
export function computeDeathImpact(hoursAtDeath: number, level: string): number {
  const safeHours = Math.max(hoursAtDeath || 0, 0.1)
  const weight = ZONE_SIGNIFICANCE_WEIGHT[level] ?? ZONE_SIGNIFICANCE_WEIGHT["Other"]
  return Math.sqrt(safeHours) * Math.pow(weight, 2)
}

/** Internal bucket keys — stable ids for aggregation (order comes from ORDERED_ZONES). */
export type DeathImpactZoneId =
  | "dungeon_1_5"
  | "dungeon_6_10"
  | "dungeon_11_15"
  | "lair"
  | "orc"
  | "swamp"
  | "shoals"
  | "spider"
  | "snake"
  | "vaults_1_4"
  | "vaults_5"
  | "slime"
  | "crypt"
  | "abyss"
  | "depths"
  | "zot_1_4"
  | "zot_5"
  | "orb_run"
  | "other"

type ZoneDef = { id: DeathImpactZoneId; label: string; section: string }

/**
 * Exact display order for chart rows — never sort by value elsewhere.
 */
export const DEATH_IMPACT_ZONE_ORDER: ZoneDef[] = [
  { id: "dungeon_1_5", label: "Dungeon 1-5", section: "Dungeon" },
  { id: "dungeon_6_10", label: "Dungeon 6-10", section: "Dungeon" },
  { id: "dungeon_11_15", label: "Dungeon 11-15", section: "Dungeon" },
  { id: "lair", label: "Lair 1-5", section: "Branches" },
  { id: "orc", label: "Orc 1-2", section: "Branches" },
  { id: "swamp", label: "Swamp 1-4", section: "Branches" },
  { id: "shoals", label: "Shoals 1-4", section: "Branches" },
  { id: "spider", label: "Spider 1-4", section: "Branches" },
  { id: "snake", label: "Snake 1-4", section: "Branches" },
  { id: "vaults_1_4", label: "Vaults 1-4", section: "Late Game" },
  { id: "vaults_5", label: "Vaults 5", section: "Late Game" },
  { id: "slime", label: "Slime 1-4", section: "Late Game" },
  { id: "crypt", label: "Crypt 1-3", section: "Late Game" },
  { id: "abyss", label: "Abyss", section: "Late Game" },
  { id: "depths", label: "Depths 1-4", section: "Endgame" },
  { id: "zot_1_4", label: "Zot 1-4", section: "Endgame" },
  { id: "zot_5", label: "Zot 5", section: "Endgame" },
  { id: "orb_run", label: "Orb run", section: "Endgame" },
  { id: "other", label: "Other", section: "Other" },
]

const ZONE_ID_TO_LABEL = Object.fromEntries(
  DEATH_IMPACT_ZONE_ORDER.map((z) => [z.id, z.label]),
) as Record<DeathImpactZoneId, string>

function normBranch(raw: string): string {
  const b = raw.trim()
  if (!b) return ""
  const lower = b.toLowerCase()
  if (lower === "d" || lower === "dungeon" || lower === "the dungeon") return "dungeon"
  return lower
}

function parsePlace(place: string): { branch: string; level: number | null } {
  const p = (place ?? "").trim()
  if (!p || p === "unknown") return { branch: "", level: null }
  const colon = p.indexOf(":")
  if (colon < 0) {
    return { branch: normBranch(p), level: null }
  }
  const branchPart = p.slice(0, colon)
  const levStr = p.slice(colon + 1).trim()
  const level = parseInt(levStr, 10)
  return {
    branch: normBranch(branchPart),
    level: Number.isFinite(level) ? level : null,
  }
}

/**
 * Classify one game record into exactly one zone. Wins are ignored by callers (deaths only).
 */
export function classifyDeathToZone(game: GameRecord): DeathImpactZoneId {
  const { branch, level } = parsePlace(game.place)

  if (!branch) return "other"

  if (branch === "dungeon") {
    if (level == null) return "other"
    if (level <= 5) return "dungeon_1_5"
    if (level <= 10) return "dungeon_6_10"
    if (level <= 15) return "dungeon_11_15"
    return "other"
  }

  if (branch === "lair") return "lair"

  if (branch === "orc" || branch === "elf") return "orc"

  if (branch === "swamp") return "swamp"
  if (branch === "shoals") return "shoals"
  if (branch === "spider") return "spider"
  if (branch === "snake") return "snake"

  if (branch === "vaults") {
    if (level === 5) return "vaults_5"
    return "vaults_1_4"
  }

  if (branch === "slime") return "slime"

  if (branch === "crypt") return "crypt"

  if (branch === "abyss") return "abyss"

  if (branch === "depths") return "depths"

  if (branch === "zot") {
    if (level === 5) return "zot_5"
    return "zot_1_4"
  }

  return "other"
}

function hoursAtDeathFromRecord(m: GameRecord): number {
  const sec = m.durationSeconds
  if (typeof sec === "number" && Number.isFinite(sec) && sec >= 0) return sec / 3600
  return 0
}

type Agg = {
  significanceAll: number
  significanceSpecies: number
  deathsSpecies: number
  hoursSumSpecies: number
}

function emptyAgg(): Agg {
  return { significanceAll: 0, significanceSpecies: 0, deathsSpecies: 0, hoursSumSpecies: 0 }
}

/**
 * Unique species with at least one death, sorted by death count (desc) then name.
 */
export function speciesWithDeathsForImpact(morgues: GameRecord[]): string[] {
  const deaths = morgues.filter((m) => m.result === "death")
  const counts = new Map<string, number>()
  for (const m of deaths) {
    const s = (m.species ?? "").trim()
    if (!s) continue
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([s]) => s)
}

/**
 * Build one row per ordered zone: sum per-death significance in each bucket.
 * Tooltip fields (death count, avg hours, weighted score) are for the selected species only.
 */
export function buildDeathImpactProfileFromMorgues(
  morgues: GameRecord[],
  selectedSpecies: string,
): DeathImpactRowData[] {
  const speciesKey = selectedSpecies.trim()
  const deaths = morgues.filter((m) => m.result === "death")

  const byZone: Record<DeathImpactZoneId, Agg> = {} as Record<DeathImpactZoneId, Agg>
  for (const z of DEATH_IMPACT_ZONE_ORDER) {
    byZone[z.id] = emptyAgg()
  }

  for (const m of deaths) {
    const zoneId = classifyDeathToZone(m)
    const levelLabel = ZONE_ID_TO_LABEL[zoneId] ?? "Other"
    const hoursRaw = hoursAtDeathFromRecord(m)
    const significance = computeDeathImpact(hoursRaw, levelLabel)

    const a = byZone[zoneId]
    if (!a) continue

    a.significanceAll += significance

    const sp = (m.species ?? "").trim()
    if (speciesKey && sp === speciesKey) {
      a.significanceSpecies += significance
      a.deathsSpecies += 1
      a.hoursSumSpecies += hoursRaw
    }
  }

  return DEATH_IMPACT_ZONE_ORDER.map((def) => {
    const a = byZone[def.id]
    const globalImpact = Math.round(a.significanceAll * 100) / 100
    const selectedImpact = Math.round(a.significanceSpecies * 100) / 100
    const deathCount = a.deathsSpecies
    const avgHoursAtDeath =
      deathCount > 0 ? Math.round((a.hoursSumSpecies / deathCount) * 100) / 100 : 0
    const weightedImpactScore = selectedImpact

    return {
      level: def.label,
      globalImpact,
      selectedImpact,
      section: def.section,
      deathCount,
      avgHoursAtDeath,
      weightedImpactScore,
    }
  })
}
