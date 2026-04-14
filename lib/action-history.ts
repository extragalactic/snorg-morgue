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

/**
 * Crawl RTF morgues prefix table lines with colour controls (e.g. \\cb3) so plain
 * regexes never see `Action |` or `Cast:` at line start. Strip only when a line
 * looks RTF-like so Windows paths like `C:\\games` in notes stay intact.
 */
export function stripRtfFromMorgueLine(line: string): string {
  if (!/\\(?:cb\d|\\'[0-9a-f]{2})/i.test(line)) return line
  return line
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\cb\d+\s*/gi, "")
    .replace(/\\\s*$/g, "")
}

/** Action table row types that start a new category (ends the Cast: spell block). */
const ACTION_HISTORY_CATEGORY =
  /^(Melee|Throw|Cast|Invoke|Ability|Evoke|Use|Stab|Armour|Dodge|Block|Attack|Drink|Read):/i

/**
 * Total uses for an Action row: prefer the morgue "total" column, else sum level bands.
 */
export function actionHistoryRowTotal(row: ActionHistoryRow): number {
  if (row.total != null && Number.isFinite(row.total)) return row.total
  return row.values.reduce<number>((a, v) => a + (v ?? 0), 0)
}

type SpellUseAccumulator = { sums: Map<string, number>; labels: Map<string, string> }

function addSpellUses(
  acc: SpellUseAccumulator,
  displayName: string,
  row: ActionHistoryRow
): void {
  const key = normalizeActionKey(displayName)
  if (!key) return
  const t = actionHistoryRowTotal(row)
  if (t <= 0) return
  acc.sums.set(key, (acc.sums.get(key) ?? 0) + t)
  const prev = acc.labels.get(key) ?? ""
  const label = normalizeActionKey(displayName)
  if (label.length > prev.length) acc.labels.set(key, label)
}

export function walkCastSpellRows(
  ah: ActionHistory,
  onRow: (displayName: string, row: ActionHistoryRow) => void
): void {
  let inCast = false
  for (const row of ah.rows) {
    const raw = row.name.trim()
    if (!raw) continue

    const catMatch = raw.match(ACTION_HISTORY_CATEGORY)
    if (catMatch) {
      const cat = catMatch[1].toLowerCase()
      if (cat === "cast") {
        inCast = true
        const spellPart = raw.replace(/^Cast:\s*/i, "").trim()
        onRow(spellPart, row)
      } else {
        inCast = false
      }
      continue
    }

    if (inCast) {
      onRow(raw, row)
    }
  }
}

/**
 * Sum spell casts from the Action history "Cast:" section (and indented continuation lines).
 * Mutates acc.sums (key = normalized name) and acc.labels (longest display label per key).
 */
export function mergeSpellUsesFromActionHistoryInto(
  ah: ActionHistory,
  acc: SpellUseAccumulator
): void {
  walkCastSpellRows(ah, (displayName, row) => addSpellUses(acc, displayName, row))
}

function normalizeLevelGroup(s: string): string {
  return s.replace(/\s+/g, "").replace(/−/g, "-") // unicode minus
}

/**
 * Parse Action table from full morgue text. Returns null if no Action section.
 */
export function parseActionHistory(rawText: string): ActionHistory | null {
  const lines = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(stripRtfFromMorgueLine)
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
  const lines = segmentText.split(/\n/).map(stripRtfFromMorgueLine)
  const actionLineIdx = lines.findIndex((line) => /^\s*Action\s+\|/.test(line))
  if (actionLineIdx === -1) {
    return { skillText: segmentText, actionText: null }
  }
  const skillText = lines.slice(0, actionLineIdx).join("\n").trimEnd()
  const actionText = lines.slice(actionLineIdx).join("\n")
  return { skillText, actionText }
}
