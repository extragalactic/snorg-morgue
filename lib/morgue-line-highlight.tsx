import type { ReactNode } from "react"

const hl = "text-primary"

function primaryStatsRange(lines: string[]): { start: number; end: number } | null {
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith("Health:")) {
      start = i
      break
    }
  }
  if (start < 0) return null
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes("Spells:")) {
      return { start, end: i }
    }
  }
  return null
}

function isResistanceRow(line: string): boolean {
  const t = line.trim()
  return (
    /^r[A-Za-z]+\s/.test(t) ||
    /^SInv\b/.test(t) ||
    /^Will\b/.test(t) ||
    /^Stlth\b/.test(t) ||
    /^HPRegen\b/.test(t) ||
    /^MPRegen\b/.test(t)
  )
}

function resistanceBlockRange(lines: string[], primaryEnd: number): { from: number; to: number } | null {
  let from = -1
  let to = -1
  for (let i = primaryEnd + 1; i < lines.length; i++) {
    const raw = lines[i]
    const t = raw.trim()
    if (t.startsWith("You ") || t.startsWith("There ")) break
    if (t.length === 0) {
      if (from >= 0) break
      continue
    }
    if (!isResistanceRow(raw)) {
      if (from >= 0) break
      continue
    }
    if (from < 0) from = i
    to = i
  }
  return from >= 0 ? { from, to } : null
}

/** Split "rFire … (50%)    V - +9 …" into left (resists) and right (equipped); gap stays default colour. */
function splitResistanceEquipLine(line: string): ReactNode | null {
  const m = line.match(/(\s{2,})([#A-Za-z]\s-\s.+)$/)
  if (!m || m.index === undefined) return null
  const left = line.slice(0, m.index)
  if (left.trim().length === 0) return null
  return (
    <>
      <span className={hl}>{left}</span>
      {m[1]}
      <span className={hl}>{m[2]}</span>
    </>
  )
}

/** `Turns: 83034, Time: 04:43:19` — highlight numeric turn count and time value only. */
function turnsTimeHighlightedSuffix(s: string): ReactNode {
  const m = s.match(/^(Turns:\s*)(\d+)(\s*,\s*Time:\s*)(.+)$/i)
  if (!m) return s
  return (
    <>
      {m[1]}
      <span className={hl}>{m[2]}</span>
      {m[3]}
      <span className={hl}>{m[4].trim()}</span>
    </>
  )
}

/** Any line ending with `Turns: N, Time: …` (e.g. title with `(level N, HPs)`). */
function highlightTurnsTimeValuesInLine(line: string): ReactNode | null {
  const m = line.match(/^(.*?)(Turns:\s*\d+\s*,\s*Time:\s*.+)$/i)
  if (!m) return null
  return (
    <>
      {m[1]}
      {turnsTimeHighlightedSuffix(m[2])}
    </>
  )
}

/** `Name (Species Background)    Turns:…` — highlight inner parens unless it is `(level N, … HPs)`. */
function highlightTitleLineSpeciesBackground(line: string): ReactNode | null {
  const m = line.match(/^(.+?)(\s+)\(([^)]+)\)(\s+)(Turns:\s*\d+,\s*Time:.+)$/)
  if (!m) return null
  const inner = m[3].trim()
  if (/^level\s+\d+/i.test(inner)) return null
  return (
    <>
      {m[1]}
      {m[2]}(
      <span className={hl}>{inner}</span>){m[4]}
      {turnsTimeHighlightedSuffix(m[5])}
    </>
  )
}

/** `Began as a Gnoll Earth Elementalist on Apr 1, 2024.` — highlight species + background only. */
function highlightBeganAsSpecies(line: string): ReactNode | null {
  const m = line.match(/^(\s*Began as\s+(?:a|an)\s+)(.+?)(\s+on\s+.+)$/i)
  if (!m) return null
  return (
    <>
      {m[1]}
      <span className={hl}>{m[2]}</span>
      {m[3]}
    </>
  )
}

/** `Was the Champion of Ashenzari.` / `Was an Initiate of Gozag.` — highlight title + god phrase. */
function highlightWasGodTitle(line: string): ReactNode | null {
  const m = line.match(/^(\s*Was\s+(?:the|a|an)\s+)(.+?)(\.\s*)$/i)
  if (!m) return null
  return (
    <>
      {m[1]}
      <span className={hl}>{m[2]}</span>
      {m[3]}
    </>
  )
}

/** `... and 3 runes on Apr 27, 2024!` — highlight through runes count, not the date. */
function highlightWinRunesLineWithoutDate(line: string): ReactNode | null {
  const m = line.match(/^(\s*\.\.\.\s+and\s+\d+\s+runes?)(\s+on\s+[^!\n]+)(!?\s*)$/i)
  if (!m) return null
  return (
    <>
      <span className={hl}>{m[1]}</span>
      {m[2]}
      {m[3]}
    </>
  )
}

/** First line: `Dungeon Crawl Stone Soup version 0.34.0 (tiles)...` — highlight version token only. */
function highlightFirstLineVersion(line: string): ReactNode | null {
  const m = line.match(/^(\s*Dungeon Crawl Stone Soup version\s+)(\S+)(.*)$/i)
  if (!m) return null
  return (
    <>
      {m[1]}
      <span className={hl}>{m[2]}</span>
      {m[3]}
    </>
  )
}

/** `1396891 Name the Title (level 26, 224/224 HPs)` — highlight name through parens, not the leading score. */
function highlightScorePrefixNameLevelHp(line: string): ReactNode | null {
  const m = line.match(
    /^(\s*)(\d+)\s+(.+?\(level\s+\d+,\s*\d+\s*\/\s*\d+\s+HPs?\)\s*)$/i,
  )
  if (!m) return null
  return (
    <>
      {m[1]}
      {m[2]}{" "}
      <span className={hl}>{m[3]}</span>
    </>
  )
}

function highlightIntroHeaderPartialLine(line: string): ReactNode | null {
  const title = highlightTitleLineSpeciesBackground(line)
  if (title !== null) return title
  const turnsTime = highlightTurnsTimeValuesInLine(line)
  if (turnsTime !== null) return turnsTime
  const scoreNameHp = highlightScorePrefixNameLevelHp(line)
  if (scoreNameHp !== null) return scoreNameHp
  const began = highlightBeganAsSpecies(line)
  if (began !== null) return began
  const was = highlightWasGodTitle(line)
  if (was !== null) return was
  if (/^\s*Escaped with the Orb\s*!?\s*$/i.test(line)) {
    return <span className={hl}>{line}</span>
  }
  return highlightWinRunesLineWithoutDate(line)
}

function highlightIntroLine(line: string, lineIndex: number, lines: string[]): ReactNode {
  if (lineIndex === 0) {
    const ver = highlightFirstLineVersion(line)
    if (ver !== null) return ver
  }
  const headerPartial = highlightIntroHeaderPartialLine(line)
  if (headerPartial !== null) return headerPartial

  const t = line.trim()
  if (/^\d+:\s*Orb of Zot$/.test(t)) {
    return <span className={hl}>{line}</span>
  }
  if (/^\}:\s*\d+\/\d+\s+runes:/.test(t)) {
    return <span className={hl}>{line}</span>
  }
  const pr = primaryStatsRange(lines)
  if (pr && lineIndex >= pr.start && lineIndex <= pr.end) {
    return <span className={hl}>{line}</span>
  }
  if (!pr) return line
  const rr = resistanceBlockRange(lines, pr.end)
  if (rr && lineIndex >= rr.from && lineIndex <= rr.to && isResistanceRow(line)) {
    const split = splitResistanceEquipLine(line)
    if (split) return split
    return <span className={hl}>{line}</span>
  }
  return line
}

/**
 * Segment ids for Inventory header + subsections (Hand Weapons, …).
 * Must stay in sync with INVENTORY_SUB_SECTIONS + "Inventory:" handling in parseMorgueSections (morgue-browser).
 */
const INVENTORY_CONTENT_SEGMENT_IDS = new Set([
  "morgue-inventory",
  "morgue-hand-weapons",
  "morgue-missiles",
  "morgue-armour",
  "morgue-jewellery",
  "morgue-wands",
  "morgue-scrolls",
  "morgue-potions",
  "morgue-miscellaneous",
])

/** Inventory row: highlight full `a - ...` through end of line. */
function highlightSlotLetterDashLine(line: string): ReactNode {
  const m = line.match(/^(\s*)([#A-Za-z])\s+-\s+(.*)$/)
  if (!m) return line
  return (
    <>
      {m[1]}
      <span className={hl}>
        {m[2]} - {m[3]}
      </span>
    </>
  )
}

/**
 * Memorised spell table row: highlight only slot, dash, and spell name; columns (Type, Power, …) stay default.
 * Names line up with the Type column using two or more spaces in fixed-width morgue output.
 */
function highlightMemorisedSpellNameOnly(line: string): ReactNode {
  const m = line.match(/^(\s*)([#A-Za-z])\s+-\s+(.*)$/)
  if (!m) return line
  const rest = m[3]
  const col = rest.match(/^(.+?)(\s{2,})([\s\S]*)$/)
  if (!col) {
    return (
      <>
        {m[1]}
        <span className={hl}>
          {m[2]} - {rest}
        </span>
      </>
    )
  }
  return (
    <>
      {m[1]}
      <span className={hl}>
        {m[2]} - {col[1]}
      </span>
      {col[2]}
      {col[3]}
    </>
  )
}

/** Skills: list (near top of morgue); not Skill Usage History at bottom. */
function highlightSkillsSegmentLine(line: string): ReactNode {
  const t = line.trim()
  if (!t) return line
  if (/^skills:?\s*$/i.test(t)) return line
  if (/^you (?:had|have) \d+ spell levels left\.?\s*$/i.test(t)) return line
  if (/^you (?:knew|know) the following spells:?\.?\s*$/i.test(t)) return line

  const m = line.match(/^(\s*[+-]\s+Level\s+)([\d.]+)((?:\([^)]+\))?\s+)(.+)$/)
  if (m) {
    return (
      <>
        {m[1]}
        <span className={hl}>{m[2]}</span>
        {m[3]}
        <span className={hl}>{m[4]}</span>
      </>
    )
  }

  return <span className={hl}>{line}</span>
}

/** Inventory item title: one leading slot letter/#, spaces, dash, rest. Sub-headings (e.g. Hand Weapons) do not match. */
function highlightInventoryLine(line: string): ReactNode {
  return highlightSlotLetterDashLine(line)
}

/** First index of "Your spell library ..." line; memorised spells appear above this in the segment. */
function yourSpellLibraryHeadingIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].trim().toLowerCase()
    if (low.startsWith("your spell library")) return i
  }
  return -1
}

function highlightYourSpellsSegmentLine(line: string, lineIndex: number, segmentLines: string[]): ReactNode {
  const lib = yourSpellLibraryHeadingIndex(segmentLines)
  if (lib >= 0 && lineIndex >= lib) return line
  return highlightMemorisedSpellNameOnly(line)
}

/**
 * Rich text for one morgue line in Summary, Skills, Inventory, and Your Spells segments (morgue details modal).
 */
export function morgueLineHighlightContent(
  line: string,
  segmentId: string,
  lineIndex: number,
  segmentLines: string[],
): ReactNode {
  if (segmentId === "morgue-intro") {
    return highlightIntroLine(line, lineIndex, segmentLines)
  }
  if (segmentId === "morgue-skills") {
    return highlightSkillsSegmentLine(line)
  }
  if (INVENTORY_CONTENT_SEGMENT_IDS.has(segmentId)) {
    return highlightInventoryLine(line)
  }
  if (segmentId === "morgue-your-spells") {
    return highlightYourSpellsSegmentLine(line, lineIndex, segmentLines)
  }
  return line
}
