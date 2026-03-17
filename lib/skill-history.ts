import { NON_SPELL_SKILLS, WEAPON_SKILLS, RANGED_WEAPON_SKILLS, SPELL_SCHOOLS } from "./dcss-skills"

export type SkillHistorySeries = {
  skill: string
  samples: { xl: number; level: number }[]
}

export type SkillHistory = Record<string, SkillHistorySeries>

const CHECKPOINTS = [5, 10, 15, 20, 25]
const RANK_CHECKPOINT = 25

/**
 * Parse the \"Skill Usage History\" section from a morgue into per-skill XL/level samples.
 *
 * DCSS uses a pipe-delimited table. The block between the first two pipes is aligned:
 * one column per XL (1, 2, ... 25 or 27). We derive column boundaries from the start
 * position of each number in the header. Empty cells are blank and mean "same as previous
 * column" (carry-forward). A cell may contain multiple numbers (e.g. "4 6" = level went
 * from 4 to 6 during that XL); we use the last number. We forward-fill: for each XL column,
 * the value is the number in that cell, or if blank the value from the previous column.
 * So "value at XL N" = forward-filled value at column N. We emit one sample per XL column
 * after fill so levelAtCheckpoint(samples, N) gives that value.
 *
 *   Skill      XL: |  1  2  3  4  5 ...
 *   Fighting       |   1  3  5  7  8 11 ...
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
  const headerParts = headerLine.split("|")
  const headerDataPart = headerParts[1] ?? ""
  if (!headerDataPart) return null
  const headerLen = headerDataPart.length

  const xlCols: number[] = []
  const tokens = headerDataPart.trim().split(/\s+/).filter(Boolean)
  let searchStart = 0
  for (const t of tokens) {
    const n = parseInt(t, 10)
    if (!Number.isFinite(n)) continue
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const re = new RegExp("(?:^|\\s)(" + escaped + ")(?=\\s|$)", "g")
    re.lastIndex = searchStart
    const match = re.exec(headerDataPart)
    if (!match) break
    xlCols.push(n)
    searchStart = match.index + (match[0].length ?? 0)
  }
  if (xlCols.length === 0) return null

  // Use fixed-width columns for data rows (game aligns numbers within equal-width columns).
  const colWidth = Math.floor(headerLen / xlCols.length)

  const history: SkillHistory = {}

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const rawLine = lines[i]
    if (!rawLine.trim()) break
    if (/^[A-Z][A-Za-z ]+:$/.test(rawLine.trim())) break
    if (/^[-+\s|]+$/.test(rawLine.trim())) continue

    const pipeParts = rawLine.split("|")
    let dataPart = pipeParts[1] ?? ""
    if (!dataPart) continue
    if (dataPart.length < headerLen) {
      dataPart = dataPart + " ".repeat(headerLen - dataPart.length)
    } else if (dataPart.length > headerLen) {
      dataPart = dataPart.slice(0, headerLen)
    }

    // Skill name: everything before the first pipe, allowing 1+ spaces before it.
    // Some rows (e.g. "Translocations |") only have a single space before the pipe.
    const m = rawLine.match(/^(.+?)\s+\|/)
    const rawName = m ? m[1].trim() : ""
    const name = normalizeSkillName(rawName)
    if (!name) continue

    // Raw cell values: last number in cell, or NaN if blank (fixed-width columns)
    const rawByColumn: number[] = []
    for (let idx = 0; idx < xlCols.length; idx++) {
      const start = idx * colWidth
      const end = idx < xlCols.length - 1 ? start + colWidth : headerLen
      const cell = dataPart.slice(start, end).trim()
      const numbers = cell.split(/\s+/).map((t) => parseFloat(t)).filter((n) => Number.isFinite(n))
      const val = numbers.length > 0 ? numbers[numbers.length - 1]! : NaN
      rawByColumn.push(val)
    }
    // Forward-fill: blank cell = previous column's value
    const filled: number[] = []
    for (let idx = 0; idx < rawByColumn.length; idx++) {
      const val = rawByColumn[idx]
      if (Number.isFinite(val)) {
        filled.push(val)
      } else {
        const prev = idx > 0 ? filled[idx - 1] : undefined
        if (prev !== undefined) filled.push(prev)
        else filled.push(NaN)
      }
    }
    // Emit one sample per XL column (only where we have a defined value after fill)
    const samples: { xl: number; level: number }[] = []
    for (let idx = 0; idx < xlCols.length; idx++) {
      const level = filled[idx]
      if (!Number.isFinite(level)) continue
      samples.push({ xl: xlCols[idx], level })
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

const WEAPON_SKILL_NAMES = new Set([...WEAPON_SKILLS, ...RANGED_WEAPON_SKILLS])

/**
 * Compute snapshot levels at XL checkpoints.
 *
 * - Non-spell skills: store Fighting, Spellcasting, Armour, etc. (we do not store individual
 *   weapon skills; only Primary Weapon is stored).
 * - Primary Weapon: the weapon skill that is highest at XL 25; we store that skill's level at each checkpoint.
 * - Spell School 1–5: ranked by level at XL 25 only; we store each ranked school's level at each checkpoint.
 */
export function computeSkillSnapshotsFromHistory(
  history: SkillHistory,
  checkpoints: number[] = CHECKPOINTS,
): Snapshot[] {
  const snapshots: Snapshot[] = []

  // Non-spell skills except individual weapon schools (we only show Primary Weapon).
  for (const skill of NON_SPELL_SKILLS) {
    if (WEAPON_SKILL_NAMES.has(skill as (typeof WEAPON_SKILLS)[number])) continue
    const series = history[skill]
    if (!series) continue
    for (const cp of checkpoints) {
      const level = levelAtCheckpoint(series.samples, cp)
      if (level == null) continue
      snapshots.push({ skill_group: skill, checkpoint_xl: cp, level })
    }
  }

  // Primary Weapon: highest weapon skill at XL 25; store that skill's level at each checkpoint.
  let primaryWeaponSkill: string | null = null
  let primaryMaxAt25 = 0
  for (const weaponSkill of [...WEAPON_SKILLS, ...RANGED_WEAPON_SKILLS]) {
    const series = history[weaponSkill]
    if (!series) continue
    const lvl = levelAtCheckpoint(series.samples, RANK_CHECKPOINT)
    if (lvl == null) continue
    if (lvl > primaryMaxAt25) {
      primaryMaxAt25 = lvl
      primaryWeaponSkill = weaponSkill
    }
  }
  if (primaryWeaponSkill) {
    const series = history[primaryWeaponSkill]
    if (series) {
      for (const cp of checkpoints) {
        const level = levelAtCheckpoint(series.samples, cp)
        if (level == null) continue
        snapshots.push({ skill_group: "Weapon", checkpoint_xl: cp, level })
      }
    }
  }

  // Spell School 1–5: rank schools by level at XL 25 only; then store each ranked school's level at each checkpoint.
  const schoolLevelsAt25: { school: string; level: number }[] = []
  for (const school of SPELL_SCHOOLS) {
    const series = history[school]
    if (!series) continue
    const lvl = levelAtCheckpoint(series.samples, RANK_CHECKPOINT)
    if (lvl == null) continue
    schoolLevelsAt25.push({ school, level: lvl })
  }
  schoolLevelsAt25.sort((a, b) => b.level - a.level)
  const top = schoolLevelsAt25.slice(0, 5)
  const rankedLabels = [
    "Spell School 1",
    "Spell School 2",
    "Spell School 3",
    "Spell School 4",
    "Spell School 5",
  ] as const
  for (let i = 0; i < top.length; i++) {
    const series = history[top[i].school]
    if (!series) continue
    for (const cp of checkpoints) {
      const level = levelAtCheckpoint(series.samples, cp)
      if (level == null) continue
      snapshots.push({ skill_group: rankedLabels[i], checkpoint_xl: cp, level })
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

