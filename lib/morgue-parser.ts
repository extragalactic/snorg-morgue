/**
 * Parser for DCSS morgue files (current format).
 * Throws with a friendly message if the format is unrecognized.
 */

import { ALL_BACKGROUND_NAMES } from "./dcss-constants"

export interface ParsedMorgue {
  version: string
  gameSeed: string
  characterName: string
  species: string
  background: string
  xl: number
  place: string
  turns: number
  durationSeconds: number
  durationFormatted: string
  god: string
  runesCount: number
  runesMax: number
  runesText: string
  goldCollected: number
  goldSpent: number
  creaturesVanquished: number
  isWin: boolean
  killer: string | null
  /** Game completion date (YYYY-MM-DD) from morgue file. */
  gameCompletionDate: string
  /** True if the Branches section shows Lair (5/5), i.e. player reached Lair:5. */
  reachedLair5: boolean
}

const ERR_PREFIX = "This doesn’t look like a valid DCSS morgue file."

function fail(message: string): never {
  throw new Error(`${ERR_PREFIX} ${message}`)
}

function extractMatch(text: string, regex: RegExp, fieldName: string): string {
  const m = text.match(regex)
  if (!m || !m[1]) fail(`Could not find ${fieldName}.`)
  return m[1].trim()
}

const ABANDON_PROMPT = "Are you sure you want to abandon this character and return to the main menu?"
/** Distinctive phrase on the confirm line (avoids relying on exact trailing punctuation, which can vary). */
const ABANDON_CONFIRM_PHRASE = '(Confirm with "quit"'
const DUNGEON_1_15 = "Dungeon (1/15)"

/**
 * Returns true if the raw morgue text is an abandoned-character file that should be skipped on import:
 * - Contains "Dungeon (1/15)" (player never left D:1)
 * - Contains the abandon prompt followed by the confirm line and a blank line.
 */
export function isAbandonedCharacterMorgue(rawText: string): boolean {
  if (!rawText.includes(DUNGEON_1_15)) return false
  const lines = rawText.split(/\r?\n/)
  for (let i = 0; i < lines.length - 2; i++) {
    if (!lines[i].includes(ABANDON_PROMPT)) continue
    const nextLine = lines[i + 1].trim()
    const afterNext = lines[i + 2].trim()
    if (nextLine.includes(ABANDON_CONFIRM_PHRASE) && afterNext === "") return true
  }
  return false
}

function parseTimeToSeconds(timeStr: string): number {
  const s = timeStr.trim()
  // "1 day 08:49:03" or "2 days 12:30:00" -> convert days to hours and parse the time (allow flexible spacing)
  const dayMatch = s.match(/^(\d+)\s+days?\s*[,]?\s*(\d{1,2}):(\d{2}):(\d{2})\s*$/i)
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10)
    const h = parseInt(dayMatch[2], 10)
    const m = parseInt(dayMatch[3], 10)
    const sec = parseInt(dayMatch[4], 10)
    if (!Number.isNaN(days) && !Number.isNaN(h) && !Number.isNaN(m) && !Number.isNaN(sec)) {
      return (days * 24 + h) * 3600 + m * 60 + sec
    }
  }
  const parts = s.split(":")
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const sec = parseInt(parts[2], 10)
    if (!Number.isNaN(h) && !Number.isNaN(m) && !Number.isNaN(sec)) {
      return h * 3600 + m * 60 + sec
    }
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const sec = parseInt(parts[1], 10)
    if (!Number.isNaN(m) && !Number.isNaN(sec)) return m * 60 + sec
  }
  const sec = parseInt(parts[0], 10)
  return Number.isNaN(sec) ? 0 : sec
}

/** Abbreviations sometimes used in morgue title line (Species Background). Expand before splitting.
 * Elementalist backgrounds use double capital letters: FE, EE, AE, IE
 * (Fire, Earth, Air, Ice Elementalist). */
const TITLE_ABBREVIATIONS: Record<string, string> = {
  ReIE: "Revenant Ice Elementalist",
  MDFE: "Mountain Dwarf Fire Elementalist",
  MDIE: "Mountain Dwarf Ice Elementalist",
  MDAE: "Mountain Dwarf Air Elementalist",
  MDEE: "Mountain Dwarf Earth Elementalist",
  DrFE: "Draconian Fire Elementalist",
  DrIE: "Draconian Ice Elementalist",
  DrAE: "Draconian Air Elementalist",
  DrEE: "Draconian Earth Elementalist",
  // Coloured Draconian + Fire Elementalist (same pattern for IE/AE/EE if needed)
  RdDrFE: "Red Draconian Fire Elementalist",
  GnDrFE: "Green Draconian Fire Elementalist",
  WhDrFE: "White Draconian Fire Elementalist",
  BkDrFE: "Black Draconian Fire Elementalist",
  YwDrFE: "Yellow Draconian Fire Elementalist",
  PuDrFE: "Purple Draconian Fire Elementalist",
  GyDrFE: "Grey Draconian Fire Elementalist",
  MoDrFE: "Mottled Draconian Fire Elementalist",
  PlDrFE: "Pale Draconian Fire Elementalist",
  RdDrIE: "Red Draconian Ice Elementalist",
  GnDrIE: "Green Draconian Ice Elementalist",
  WhDrIE: "White Draconian Ice Elementalist",
  BkDrIE: "Black Draconian Ice Elementalist",
  YwDrIE: "Yellow Draconian Ice Elementalist",
  PuDrIE: "Purple Draconian Ice Elementalist",
  GyDrIE: "Grey Draconian Ice Elementalist",
  MoDrIE: "Mottled Draconian Ice Elementalist",
  PlDrIE: "Pale Draconian Ice Elementalist",
  RdDrAE: "Red Draconian Air Elementalist",
  GnDrAE: "Green Draconian Air Elementalist",
  WhDrAE: "White Draconian Air Elementalist",
  BkDrAE: "Black Draconian Air Elementalist",
  YwDrAE: "Yellow Draconian Air Elementalist",
  PuDrAE: "Purple Draconian Air Elementalist",
  GyDrAE: "Grey Draconian Air Elementalist",
  MoDrAE: "Mottled Draconian Air Elementalist",
  PlDrAE: "Pale Draconian Air Elementalist",
  RdDrEE: "Red Draconian Earth Elementalist",
  GnDrEE: "Green Draconian Earth Elementalist",
  WhDrEE: "White Draconian Earth Elementalist",
  BkDrEE: "Black Draconian Earth Elementalist",
  YwDrEE: "Yellow Draconian Earth Elementalist",
  PuDrEE: "Purple Draconian Earth Elementalist",
  GyDrEE: "Grey Draconian Earth Elementalist",
  MoDrEE: "Mottled Draconian Earth Elementalist",
  PlDrEE: "Pale Draconian Earth Elementalist",
}

/**
 * Split "Species Background" string using known background names (longest match at end).
 * Handles multi-word backgrounds e.g. "Naga Hedge Wizard" -> Naga, Hedge Wizard.
 * Exported for use when normalizing stored parsed_morgues data during stats recalc.
 */
export function parseSpeciesBackground(speciesBackground: string): { species: string; background: string } {
  let sb = speciesBackground.trim()
  if (!sb) return { species: "", background: "" }
  const expanded = TITLE_ABBREVIATIONS[sb]
  if (expanded) sb = expanded
  const backgroundsByLength = [...ALL_BACKGROUND_NAMES].sort((a, b) => b.length - a.length)
  for (const bg of backgroundsByLength) {
    if (sb.endsWith(" " + bg)) {
      const species = sb.slice(0, sb.length - bg.length - 1).trim()
      if (species.length > 0) return { species, background: bg }
    }
  }
  const lastSpace = sb.lastIndexOf(" ")
  if (lastSpace > 0) {
    return { species: sb.slice(0, lastSpace), background: sb.slice(lastSpace + 1) }
  }
  return { species: sb, background: "" }
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  return `${m}:${s.toString().padStart(2, "0")}`
}

/**
 * Parse raw morgue file text into structured data.
 * @throws Error with a user-friendly message if parsing fails.
 */
export function parseMorgue(rawText: string): ParsedMorgue {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
  if (!text.length) fail("The file is empty.")

  // Version: first line usually " Dungeon Crawl Stone Soup version X.Y.Z ..."
  const versionMatch = text.match(/Dungeon Crawl Stone Soup version ([^\n]+)/)
  const version = versionMatch ? versionMatch[1].trim() : "unknown"

  // Game seed
  const gameSeed = text.match(/Game seed:\s*(\S+)/)?.[1]?.trim() ?? ""

  // Title line: "Name the Title (Species Background)               Turns: N, Time: H:MM:SS" or "Time: 1 day 08:49:03"
  const titleLine = text.match(
    /^(.+?)\s+\(([^)]+)\)\s+Turns:\s*(\d+),\s*Time:\s*([^\n]+)/m
  )
  if (!titleLine) {
    fail(
      "Could not find the character line with name, species, background, turns and time."
    )
  }

  const characterName = titleLine[1].trim()
  const speciesBackground = titleLine[2].trim()
  const turns = parseInt(titleLine[3], 10)
  let timeStr = titleLine[4].trim()
  if (Number.isNaN(turns)) fail("Could not read turn count.")
  // Prefer "The game lasted 1 day 03:02:26 (N turns)." when present so we get correct duration including days
  const gameLastedMatch = text.match(/The game lasted\s+([^(]+?)\s*\(\d+\s*turns?\)/i)
  if (gameLastedMatch && gameLastedMatch[1]) {
    const lastedTime = gameLastedMatch[1].trim()
    if (lastedTime.length > 0) timeStr = lastedTime
  }
  const durationSeconds = parseTimeToSeconds(timeStr)
  // Always format as total hours (e.g. 32:49:03), never "1 day 08:49:03"
  const durationFormatted = formatDuration(durationSeconds)

  // Species and background: use known backgrounds so "Naga Hedge Wizard" -> Naga, Hedge Wizard.
  // When the title line uses (level N, HPs) instead of (Species Background), get species/background from "Began as a X Y on ...".
  let species = ""
  let background = ""
  const looksLikeLevelStats = /^level\s+\d+/i.test(speciesBackground)
  if (looksLikeLevelStats) {
    const beganMatch = text.match(/Began as\s+(?:a|an)\s+(.+?)\s+on\s+/i)
    if (beganMatch && beganMatch[1]) {
      const { species: s, background: b } = parseSpeciesBackground(beganMatch[1].trim())
      species = s.trim()
      background = b.trim()
    }
  }
  if (!species && !background) {
    const { species: rawSpecies, background: rawBackground } = parseSpeciesBackground(speciesBackground)
    species = rawSpecies.trim()
    background = rawBackground.trim()
  }

  // Fallback: if background is still empty (e.g. title line used an abbreviation like "DsNe"),
  // try to derive species/background from the explicit "Began as a X Y on ..." line.
  if (!background) {
    const beganLineMatch = text.match(/Began as\s+(?:a|an)\s+(.+?)\s+on\s+/i)
    if (beganLineMatch && beganLineMatch[1]) {
      const { species: s2, background: b2 } = parseSpeciesBackground(beganLineMatch[1].trim())
      if (s2.trim()) species = s2.trim()
      if (b2.trim()) background = b2.trim()
    }
  }

  // XL: from stats line "XL:     25"
  const xlMatch = text.match(/\bXL:\s*(\d+)/)
  const xl = xlMatch ? parseInt(xlMatch[1], 10) : 0
  if (!xlMatch || Number.isNaN(xl)) fail("Could not find experience level (XL).")

  // God: "God:    Wu Jian [******]"
  const godMatch = text.match(/God:\s+(.+?)(?:\s+\[|$)/)
  const god = godMatch ? godMatch[1].trim() : ""

  // Runes: "}: 2/15 runes: decaying, gossamer"
  const runesMatch = text.match(/\}:\s*(\d+)\/(\d+)\s+runes:\s*(.+?)(?:\n|$)/)
  const runesCount = runesMatch ? parseInt(runesMatch[1], 10) : 0
  const runesMax = runesMatch ? parseInt(runesMatch[2], 10) : 15
  const runesText = runesMatch ? runesMatch[3].trim() : ""

  // Win: escaped with the Orb (needed for place fallback below)
  const isWin = /escaped with the Orb/i.test(text)

  // Game completion date: from "... and N runes on Month DD, YYYY!" (wins) or "Began as ... on Month DD, YYYY." (fallback)
  const monthNames: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  }
  function parseMorgueDate(s: string): string {
    const m = s.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/)
    if (!m) return ""
    const month = monthNames[m[1]]
    if (!month) return ""
    const day = parseInt(m[2], 10)
    const year = m[3]
    if (Number.isNaN(day) || day < 1 || day > 31) return ""
    return `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
  }
  let gameCompletionDate = ""
  const runesDateMatch = text.match(/\.\.\.\s+and\s+\d+\s+runes?\s+on\s+(\w{3}\s+\d{1,2},\s+\d{4})!/i)
  if (runesDateMatch) {
    gameCompletionDate = parseMorgueDate(runesDateMatch[1].trim())
  }
  if (!gameCompletionDate) {
    const beganMatch = text.match(/Began as\s+.+?\s+on\s+(\w{3}\s+\d{1,2},\s+\d{4})\.?/i)
    if (beganMatch) gameCompletionDate = parseMorgueDate(beganMatch[1].trim())
  }

  // Place: "You are on level 4 of the Depths." -> Depths:4; normalize branch names.
  const PLACE_BRANCH_MAP: Record<string, string> = {
    "spider nest": "Spider",
    "snake pit": "Snake",
    "swamp": "Swamp",
    "shoals": "Shoals",
    "depths": "Depths",
    "vaults": "Vaults",
    "a sewer": "Sewer",
    "sewer": "Sewer",
    "the dungeon": "D",
    "dungeon": "D",
    "pits of slime": "Slime",
    "lair of beasts": "Lair",
    "realm of zot": "Zot",
    "the abyss": "Abyss",
    "abyss": "Abyss",
  }
  function normalizePlaceBranch(raw: string): string {
    const key = raw.trim().toLowerCase()
    return PLACE_BRANCH_MAP[key] ?? raw.trim()
  }
  let placeMatch = text.match(/You are on level (\d+) of (?:the )?(.+?)\./)
  if (!placeMatch) {
    // Fallback: "Level 5 of the Dungeon." or "You died on level 5 of the Dungeon." etc.
    placeMatch = text.match(/level\s+(\d+)\s+of\s+(?:the\s+)?(.+?)\./i)
  }
  let place = ""
  if (placeMatch) {
    const branchRaw = placeMatch[2].replace(/\s+on\s+\w{3}\s+\d{1,2},\s+\d{4}$/i, "").trim()
    const branch = normalizePlaceBranch(branchRaw)
    place = `${branch}:${placeMatch[1]}`
  }
  if (!place && runesCount >= 3) {
    // Won in Zot; common pattern
    const zotMatch = text.match(/Zot[:\s](\d+)/i)
    if (zotMatch) place = `Zot:${zotMatch[1]}`
  }
  if (isWin) place = "Escaped with Orb"
  if (!place) place = "unknown"

  // Gold - support both "You have collected" and "You collected" (0.33+)
  const goldCollectedMatch = text.match(/You (?:have )?collected (\d+) gold pieces/)
  const goldCollected = goldCollectedMatch ? parseInt(goldCollectedMatch[1], 10) : 0
  const goldSpentMatch = text.match(/You (?:have )?spent (\d+) gold pieces/)
  const goldSpent = goldSpentMatch ? parseInt(goldSpentMatch[1], 10) : 0

  // Creatures vanquished - prefer "Grand Total: N creatures vanquished"
  const grandTotalMatch = text.match(/Grand Total:\s*(\d+)\s+creatures vanquished/i)
  const creaturesMatch = text.match(/(\d+)\s+creatures vanquished/i)
  const creaturesVanquished = grandTotalMatch
    ? parseInt(grandTotalMatch[1], 10)
    : creaturesMatch
      ? parseInt(creaturesMatch[1], 10)
      : 0

  // Killer: for deaths only. Line is directly under the God line. Format e.g.:
  // "Slain by a four-headed hydra (10 damage)", "Mangled by a wight", "Killed by psychic fangs"
  // Damage "(N damage)" at the end is optional. Or: "Succumbed to a gnoll's poison" -> creature before "'s".
  let killer: string | null = null
  if (!isWin) {
    const lines = text.split(/\n/)
    const godLineIndex = lines.findIndex((line) => /God:\s+/.test(line))
    const candidateLine =
      godLineIndex >= 0 && godLineIndex < lines.length - 1
        ? lines[godLineIndex + 1].trim()
        : ""

    // Optional " (N damage)" at end; match "by a X" / "from an X" or "by X" (no article)
    const damagePatternWithArticle = /.+(?:by|from) (?:a|an) (.+?)(?:\s*\(\d+\s+damage\))?\s*$/i
    const damagePatternNoArticle = /.+\s+by\s+(.+?)(?:\s*\(\d+\s+damage\))?\s*$/i
    const succumbedPattern = /succumbed to (?:a|an) (.+?)'s/i

    const matchWithArticle = candidateLine.match(damagePatternWithArticle)
    const matchNoArticle = candidateLine.match(damagePatternNoArticle)
    const matchSuccumbed = candidateLine.match(succumbedPattern)
    if (matchWithArticle) {
      killer = matchWithArticle[1].trim()
    } else if (matchSuccumbed) {
      killer = matchSuccumbed[1].trim()
    } else if (matchNoArticle) {
      const name = matchNoArticle[1].trim()
      if (name.length > 0 && !/^(?:a|an)\s+/i.test(name)) killer = name
    }
    if (!killer) {
      for (const line of lines) {
        const trimmed = line.trim()
        const mWith = trimmed.match(damagePatternWithArticle)
        const mSuccumbed = trimmed.match(succumbedPattern)
        const mNoArticle = trimmed.match(damagePatternNoArticle)
        if (mWith) {
          killer = mWith[1].trim()
          break
        }
        if (mSuccumbed) {
          killer = mSuccumbed[1].trim()
          break
        }
        if (mNoArticle) {
          const name = mNoArticle[1].trim()
          if (name.length > 0 && !/^(?:a|an)\s+/i.test(name)) {
            killer = name
            break
          }
        }
      }
    }
  }

  return {
    version,
    gameSeed,
    characterName,
    species,
    background,
    xl,
    place,
    turns,
    durationSeconds,
    durationFormatted,
    god,
    runesCount,
    runesMax,
    runesText,
    goldCollected,
    goldSpent,
    creaturesVanquished,
    isWin,
    killer,
    gameCompletionDate: gameCompletionDate || "",
    reachedLair5: /Lair\s*\(\s*5\s*\/\s*5\s*\)/.test(text),
  }
}

/**
 * Extract the first 5 lines of the Message History section for duplicate detection.
 * Section format: a line containing "Message History" (header), then a line break, then message strings.
 * Returns empty string if the section is not found.
 */
export function getMessageHistorySignature(rawText: string): string {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const re = /(?:^|\n)\s*Message History\s*\n+/i
  const match = normalized.match(re)
  if (!match) return ""

  const contentStart = normalized.indexOf(match[0]) + match[0].length
  const rest = normalized.slice(contentStart)
  const lines = rest.split("\n")
  const contentLines: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length > 0) {
      contentLines.push(trimmed)
      if (contentLines.length >= 5) break
    }
  }
  return contentLines.join("\n")
}
