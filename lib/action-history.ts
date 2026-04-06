/**
 * Parse DCSS morgue "Action" usage table (level bands on X, action rows on Y).
 * Appears after Skill Usage History; header line: Action | 1-3 | 4-6 | ...
 */

export type ActionHistoryRow = {
  name: string
  values: (number | null)[]
  total: number | null
}

export type ActionHistory = {
  levelGroups: string[]
  rows: ActionHistoryRow[]
}

/** Segment id for Skill Usage History block (includes Skill + Action tables). */
export const MORGUE_SKILL_ACTION_SEGMENT_ID = "morgue-skill-usage-history"

/** Scroll target for Skill Usage History table (skill rows only). */
export const MORGUE_SKILL_USAGE_ANCHOR_ID = "morgue-skill-usage-history-skills"

/** Scroll target for Action usage table / chart. */
export const MORGUE_ACTION_HISTORY_ANCHOR_ID = "morgue-skill-usage-history-actions"

export function normalizeActionKey(name: string): string {
  return name.replace(/\s+/g, " ").trim()
}

function normalizeLevelGroup(s: string): string {
  return s.replace(/\s+/g, "").replace(/−/g, "-") // unicode minus
}

/**
 * Parse Action table from full morgue text. Returns null if no Action section.
 */
export function parseActionHistory(rawText: string): ActionHistory | null {
  const lines = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*Action\s+\|/.test(lines[i])) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return null

  const headerParts = lines[headerIdx].split("|").map((s) => s.trim())
  const levelGroups: string[] = []
  for (let p = 1; p < headerParts.length; p++) {
    const part = headerParts[p]
    if (!part || /^total$/i.test(part)) continue
    if (/^\d+\s*[-–]\s*\d+/.test(part)) {
      levelGroups.push(normalizeLevelGroup(part))
    }
  }
  if (levelGroups.length === 0) return null

  const rows: ActionHistoryRow[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    if (!t) break
    if (/^[-+\s|]+$/.test(t)) continue
    // Next morgue section (single-line title ending with colon, no table row)
    if (/^(Skills|Message History|Vanquished Creatures|Notes|Illustrated notes):$/i.test(t)) break

    const m = line.match(/^(.+?)\s+\|/)
    if (!m) continue
    const name = m[1].trim()
    if (/^Action$/i.test(name)) continue

    const pipes = line.split("|")
    const values: (number | null)[] = []
    for (let c = 0; c < levelGroups.length; c++) {
      const cell = (pipes[c + 1] ?? "").trim()
      if (!cell) {
        values.push(null)
        continue
      }
      const n = parseInt(cell.replace(/\s/g, ""), 10)
      values.push(Number.isFinite(n) ? n : null)
    }

    let total: number | null = null
    for (let j = pipes.length - 1; j > levelGroups.length; j--) {
      const cell = (pipes[j] ?? "").trim()
      if (!cell) continue
      const n = parseInt(cell.replace(/\s/g, ""), 10)
      if (Number.isFinite(n)) {
        total = n
        break
      }
    }

    rows.push({ name, values, total })
  }

  return rows.length > 0 ? { levelGroups, rows } : null
}

/** Split Skill Usage History segment text into skill lines and action block (from Action | header). */
export function splitSkillAndActionBlock(segmentText: string): { skillText: string; actionText: string | null } {
  const lines = segmentText.split(/\n/)
  const actionLineIdx = lines.findIndex((line) => /^\s*Action\s+\|/.test(line))
  if (actionLineIdx === -1) {
    return { skillText: segmentText, actionText: null }
  }
  const skillText = lines.slice(0, actionLineIdx).join("\n").trimEnd()
  const actionText = lines.slice(actionLineIdx).join("\n")
  return { skillText, actionText }
}
