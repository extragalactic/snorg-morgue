/**
 * Death place impact: sum of character XL for deaths, bucketed by DCSS location.
 * Reusable layout + bucketing for the death-place impact chart.
 */

import type { GameRecord } from "@/lib/morgue-api"
import { parsePlaceBranchDepth } from "@/lib/morgue-parser"

// Ecumenical Temple: excluded from this chart (not in Other, not a listed bar).
const OMIT_CHART = "__omit__"

function isEcumenicalTemplePlace(branch: string): boolean {
  const t = branch.trim().toLowerCase()
  return t === "temple" || t === "ecumenical temple"
}

/** Max depth per branch for listed categories (inclusive). */
const BRANCH_MAX: Record<string, number> = {
  D: 15,
  Lair: 5,
  Orc: 2,
  Crypt: 3,
  Tomb: 3,
  Swamp: 4,
  Shoals: 4,
  Snake: 4,
  Spider: 4,
  Depths: 4,
  Slime: 5,
  Abyss: 5,
  Elf: 3,
  Vaults: 5,
  Zot: 5,
  Bailey: 1,
  "Ice Cave": 1,
  Volcano: 1,
  Sewer: 1,
  Ossuary: 1,
  Gauntlet: 1,
  Lab: 1,
  Necropolis: 1,
}

const BRANCH_ALIASES: Record<string, string> = {
  d: "D",
  dungeon: "D",
  "the dungeon": "D",
  lair: "Lair",
  "lair of beasts": "Lair",
  orc: "Orc",
  "orcish mines": "Orc",
  "elven halls": "Elf",
  elf: "Elf",
  "the crypt": "Crypt",
  crypt: "Crypt",
  "the tomb": "Tomb",
  tomb: "Tomb",
  swamp: "Swamp",
  shoals: "Shoals",
  "snake pit": "Snake",
  snake: "Snake",
  "spider nest": "Spider",
  spider: "Spider",
  "a bailey": "Bailey",
  depths: "Depths",
  vaults: "Vaults",
  "realm of zot": "Zot",
  zot: "Zot",
  "the bailey": "Bailey",
  bailey: "Bailey",
  "ice cave": "Ice Cave",
  volcano: "Volcano",
  sewer: "Sewer",
  ossuary: "Ossuary",
  "the ossuary": "Ossuary",
  gauntlet: "Gauntlet",
  "a gauntlet": "Gauntlet",
  "the gauntlet": "Gauntlet",
  necropolis: "Necropolis",
  "the necropolis": "Necropolis",
  "pits of slime": "Slime",
  slime: "Slime",
  abyss: "Abyss",
  "the abyss": "Abyss",
  lab: "Lab",
  labyrinth: "Lab",
  "the labyrinth": "Lab",
  "a labyrinth": "Lab",
  "a lab": "Lab",
}

/**
 * Map parser / morgue branch strings to canonical keys in BRANCH_MAX.
 */
function canonicalBranchName(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  const k = t.toLowerCase()
  if (BRANCH_ALIASES[k]) return BRANCH_ALIASES[k]
  return t
}

/**
 * For a single death, returns a bucket id like "D:8", "orb-run", "other", or "__omit__" (Ecumenical Temple, excluded from chart sums).
 */
export function deathPlaceBucketId(
  place: string,
  diedHoldingOrb: boolean | undefined
): string {
  if (diedHoldingOrb) return "orb-run"

  const p = place.trim()
  if (!p || p === "unknown" || p === "Escaped with Orb") return "other"

  const coloned = parsePlaceBranchDepth(p)
  if (coloned) {
    if (isEcumenicalTemplePlace(coloned.branch)) return OMIT_CHART
    const b = canonicalBranchName(coloned.branch)
    if (isEcumenicalTemplePlace(b)) return OMIT_CHART
    const cap = BRANCH_MAX[b]
    if (cap == null) return "other"
    if (coloned.depth < 1 || coloned.depth > cap) return "other"
    return `${b}:${coloned.depth}`
  }

  if (isEcumenicalTemplePlace(p)) return OMIT_CHART
  const b = canonicalBranchName(p)
  if (isEcumenicalTemplePlace(b)) return OMIT_CHART
  const cap = BRANCH_MAX[b]
  if (cap === 1) return `${b}:1`
  return "other"
}

export type DeathPlaceBarRow = { label: string; bucketId: string; value: number }

export type DeathPlaceSection = {
  title: string
  /** Bar rows: multi-level bar chart section. */
  rows: DeathPlaceBarRow[]
}

const LISTED_BRANCH_ORDER: { title: string; branch: string; count: number }[] = [
  { title: "Dungeon", branch: "D", count: 15 },
  { title: "Lair", branch: "Lair", count: 5 },
  { title: "Orc", branch: "Orc", count: 2 },
  { title: "Crypt", branch: "Crypt", count: 3 },
  { title: "Tomb", branch: "Tomb", count: 3 },
  { title: "Swamp", branch: "Swamp", count: 4 },
  { title: "Shoals", branch: "Shoals", count: 4 },
  { title: "Snake", branch: "Snake", count: 4 },
  { title: "Spider", branch: "Spider", count: 4 },
  { title: "Depths", branch: "Depths", count: 4 },
  { title: "Slime", branch: "Slime", count: 5 },
  { title: "Abyss", branch: "Abyss", count: 5 },
  { title: "Elf", branch: "Elf", count: 3 },
  { title: "Vaults", branch: "Vaults", count: 5 },
  { title: "Zot", branch: "Zot", count: 5 },
  { title: "Bailey", branch: "Bailey", count: 1 },
  { title: "Ice Cave", branch: "Ice Cave", count: 1 },
  { title: "Volcano", branch: "Volcano", count: 1 },
  { title: "Sewer", branch: "Sewer", count: 1 },
  { title: "Ossuary", branch: "Ossuary", count: 1 },
  { title: "Gauntlet", branch: "Gauntlet", count: 1 },
  { title: "Lab", branch: "Lab", count: 1 },
  { title: "Necropolis", branch: "Necropolis", count: 1 },
]

/**
 * Sums of XL per bucket id for all deaths. Keys include e.g. "D:1".."D:15", "orb-run", "other".
 */
export function buildDeathPlaceImpactSums(morgues: GameRecord[]): Map<string, number> {
  const sums = new Map<string, number>()
  for (const m of morgues) {
    if (m.result !== "death") continue
    const id = deathPlaceBucketId(m.place, m.diedHoldingOrb)
    if (id === OMIT_CHART) continue
    const xl = Math.min(27, Math.max(1, m.xl))
    sums.set(id, (sums.get(id) ?? 0) + xl)
  }
  return sums
}

/**
 * Pre-ordered layout for the UI (listed branch bars + Other + Orb Run).
 */
export function buildDeathPlaceImpactSections(
  morgues: GameRecord[]
): { sections: DeathPlaceSection[]; otherValue: number; orbRunValue: number; maxValue: number } {
  const sums = buildDeathPlaceImpactSums(morgues)
  const otherValue = sums.get("other") ?? 0
  const orbRunValue = sums.get("orb-run") ?? 0

  const sections: DeathPlaceSection[] = LISTED_BRANCH_ORDER.map(({ title, branch, count }) => ({
    title,
    rows: Array.from({ length: count }, (_, i) => {
      const level = i + 1
      const bucketId = `${branch}:${level}`
      return {
        label: String(level),
        bucketId,
        value: sums.get(bucketId) ?? 0,
      }
    }),
  }))

  let maxValue = 0
  for (const v of sums.values()) {
    if (v > maxValue) maxValue = v
  }

  return { sections, otherValue, orbRunValue, maxValue }
}
