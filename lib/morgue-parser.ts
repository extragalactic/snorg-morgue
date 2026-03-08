/**
 * Parser for DCSS morgue files (current format).
 * Throws with a friendly message if the format is unrecognized.
 */

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

function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.trim().split(":")
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const s = parseInt(parts[2], 10)
    if (!Number.isNaN(h) && !Number.isNaN(m) && !Number.isNaN(s)) {
      return h * 3600 + m * 60 + s
    }
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (!Number.isNaN(m) && !Number.isNaN(s)) return m * 60 + s
  }
  const s = parseInt(parts[0], 10)
  return Number.isNaN(s) ? 0 : s
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

  // Title line: "Name the Title (Species Background)               Turns: N, Time: H:MM:SS"
  const titleLine = text.match(
    /^(.+?)\s+\(([^)]+)\)\s+Turns:\s*(\d+),\s*Time:\s*([\d:]+)/m
  )
  if (!titleLine) {
    fail(
      "Could not find the character line with name, species, background, turns and time."
    )
  }

  const characterName = titleLine[1].trim()
  const speciesBackground = titleLine[2].trim()
  const turns = parseInt(titleLine[3], 10)
  const timeStr = titleLine[4].trim()
  if (Number.isNaN(turns)) fail("Could not read turn count.")
  const durationSeconds = parseTimeToSeconds(timeStr)
  const durationFormatted = timeStr.includes(":")
    ? timeStr
    : formatDuration(durationSeconds)

  // Species and background: "Kobold Enchanter" -> species = Kobold, background = Enchanter
  const lastSpace = speciesBackground.lastIndexOf(" ")
  const species =
    lastSpace > 0 ? speciesBackground.slice(0, lastSpace) : speciesBackground
  const background =
    lastSpace > 0 ? speciesBackground.slice(lastSpace + 1) : ""

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

  // Place: "You are on level 4 of the Depths." -> Depths:4
  const placeMatch = text.match(/You are on level (\d+) of (?:the )?(.+?)\./)
  let place = ""
  if (placeMatch) {
    const branch = placeMatch[2].trim()
    place = `${branch}:${placeMatch[1]}`
  }
  if (!place && runesCount >= 3) {
    // Won in Zot; common pattern
    const zotMatch = text.match(/Zot[:\s](\d+)/i)
    if (zotMatch) place = `Zot:${zotMatch[1]}`
  }
  if (!place && isWin) place = "Escaped"
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

  // Killer: "Killed by X" or "X killed you"
  let killer: string | null = null
  const killedByMatch = text.match(/Killed by (.+?)(?:\s+on\s+|\s*$)/i)
  if (killedByMatch) killer = killedByMatch[1].trim()
  else {
    const killedYouMatch = text.match(/(.+?)\s+killed you/i)
    if (killedYouMatch) killer = killedYouMatch[1].trim()
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
