import { NON_SPELL_SKILLS, WEAPON_SKILLS, RANGED_WEAPON_SKILLS, SPELL_SCHOOLS } from "./dcss-skills"

export type SkillHistorySeries = {
  skill: string
  samples: { xl: number; level: number }[]
}

export type SkillHistory = Record<string, SkillHistorySeries>

const CHECKPOINTS = [5, 10, 15, 20, 27]

/**
 * Parse the \"Skill Usage History\" section from a morgue into per-skill XL/level samples.
 *
 * We rely on the DCSS table format:
 *
 *   Skill        XL:  1  2  3 ...
 *   Fighting          1  2  3 ...
 *
 * We:
 * - find the header line starting with \"Skill\" and containing \"XL:\"
 * - parse the XL columns from that header
 * - for each subsequent non-empty line, split into name + numeric columns and map them to (xl, level) pairs
 */
export function parseSkillHistory(rawText: string): SkillHistory | null {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines = text.split("\n")
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd()
    if (/^Skill\s+XL:/.test(line)) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return null

  const headerLine = lines[headerIdx]
  const headerMatch = headerLine.match(/^Skill\s+XL:\s*(.*)$/)
  if (!headerMatch) return null
  const xlCols = headerMatch[1]
    .trim()
    .split(/\s+/)
    .map((t) => parseInt(t, 10))
    .filter((n) => Number.isFinite(n)) as number[]
  if (xlCols.length === 0) return null

  const history: SkillHistory = {}

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const rawLine = lines[i]
    if (!rawLine.trim()) break
    // Stop if we hit a new section header (heuristic: no leading space and ends with ':')
    if (/^[A-Z][A-Za-z ]+:$/.test(rawLine.trim())) break

    const m = rawLine.match(/^(.+?)\s{2,}(.+)$/)
    if (!m) continue
    const rawName = m[1].trim()
    const name = normalizeSkillName(rawName)
    if (!name) continue

    const cols = m[2]
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0)
    const samples: { xl: number; level: number }[] = []
    for (let idx = 0; idx < Math.min(cols.length, xlCols.length); idx++) {
      const val = parseFloat(cols[idx])
      if (!Number.isFinite(val)) continue
      const xl = xlCols[idx]
      samples.push({ xl, level: val })
    }
    if (samples.length === 0) continue
    history[name] = { skill: name, samples }
  }

  return Object.keys(history).length > 0 ? history : null
}

function normalizeSkillName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ""
  // The morgue uses canonical skill names already; just normalize spacing.
  return trimmed.replace(/\s+/g, " ")
}

type Snapshot = {
  skill_group: string
  checkpoint_xl: number
  level: number
}

/**
 * Compute snapshot levels at XL checkpoints for non-spell skills and the aggregated Weapon group.
 *
 * For each checkpoint, we:
 * - skip games that never reached that XL (no samples at or before xl)
 * - use the last sample where xl <= checkpoint for that skill
 * - for Weapon, take max across all weapon skills (including Unarmed Combat)
 */
export function computeSkillSnapshotsFromHistory(
  history: SkillHistory,
  checkpoints: number[] = CHECKPOINTS,
): Snapshot[] {
  const snapshots: Snapshot[] = []

  // Individual non-spell skills (including Spellcasting, weapons, etc.).
  // We also store per-weapon and ranged-weapon skills here so we have full
  // per-skill data available for future analysis, even though the UI currently
  // uses the aggregated Primary Weapon row for display.
  for (const skill of NON_SPELL_SKILLS) {
    const series = history[skill]
    if (!series) continue
    for (const cp of checkpoints) {
      const level = levelAtCheckpoint(series.samples, cp)
      if (level == null) continue
      snapshots.push({ skill_group: skill, checkpoint_xl: cp, level })
    }
  }

  // Individual spell schools.
  for (const school of SPELL_SCHOOLS) {
    const series = history[school]
    if (!series) continue
    for (const cp of checkpoints) {
      const level = levelAtCheckpoint(series.samples, cp)
      if (level == null) continue
      snapshots.push({ skill_group: school, checkpoint_xl: cp, level })
    }
  }

  // Aggregated Weapon skill (max of melee + ranged weapon skills + Unarmed)
  for (const cp of checkpoints) {
    let maxLevel = 0
    let hasSample = false
    // Melee + Unarmed
    for (const weaponSkill of WEAPON_SKILLS) {
      const series = history[weaponSkill]
      if (!series) continue
      const lvl = levelAtCheckpoint(series.samples, cp)
      if (lvl == null) continue
      if (!hasSample || lvl > maxLevel) {
        maxLevel = lvl
        hasSample = true
      }
    }
    // Ranged weapons (bows/crossbows/slings)
    for (const rangedSkill of RANGED_WEAPON_SKILLS) {
      const series = history[rangedSkill]
      if (!series) continue
      const lvl = levelAtCheckpoint(series.samples, cp)
      if (lvl == null) continue
      if (!hasSample || lvl > maxLevel) {
        maxLevel = lvl
        hasSample = true
      }
    }
    if (hasSample) {
      snapshots.push({ skill_group: "Weapon", checkpoint_xl: cp, level: maxLevel })
    }
  }

  // Ranked spell schools: 1st/2nd/3rd highest per game at each checkpoint.
  for (const cp of checkpoints) {
    const levels: number[] = []
    for (const school of SPELL_SCHOOLS) {
      const series = history[school]
      if (!series) continue
      const lvl = levelAtCheckpoint(series.samples, cp)
      if (lvl == null) continue
      levels.push(lvl)
    }
    if (levels.length === 0) continue
    levels.sort((a, b) => b - a)

    if (levels.length >= 1) {
      snapshots.push({ skill_group: "Spell School 1", checkpoint_xl: cp, level: levels[0] })
    }
    if (levels.length >= 2) {
      snapshots.push({ skill_group: "Spell School 2", checkpoint_xl: cp, level: levels[1] })
    }
    if (levels.length >= 3) {
      snapshots.push({ skill_group: "Spell School 3", checkpoint_xl: cp, level: levels[2] })
    }
  }

  return snapshots
}

function levelAtCheckpoint(samples: { xl: number; level: number }[], checkpoint: number): number | null {
  // Assume samples are in ascending xl order.
  let last: { xl: number; level: number } | null = null
  for (const s of samples) {
    if (s.xl > checkpoint) break
    last = s
  }
  return last ? last.level : null
}

