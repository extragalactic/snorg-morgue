/**
 * Validation and sanitization for parsed morgue data before DB insert.
 * Enforces reasonable min/max limits to prevent cheating, broken files, or abuse.
 */

import type { ParsedMorgue } from "./morgue-parser"

/** XL must be 1–27 (DCSS max level). Values outside are rejected. */
export const XL_MIN = 1
export const XL_MAX = 27

/** Runes: 0–15. Clamped to range. */
export const RUNES_MIN = 0
export const RUNES_MAX = 15

/** Turns: 0 to 50M. Clamped. */
export const TURNS_MIN = 0
export const TURNS_MAX = 50_000_000

/** Duration in seconds: 0 to 72 hours. Clamped. */
export const DURATION_SECONDS_MIN = 0
export const DURATION_SECONDS_MAX = 72 * 3600

/** Gold: non‑negative, cap at 100K. Clamped. */
export const GOLD_MIN = 0
export const GOLD_MAX = 100_000

/** Creatures vanquished: 0 to 10K. Clamped. */
export const CREATURES_VANQUISHED_MIN = 0
export const CREATURES_VANQUISHED_MAX = 10_000

/** Max string lengths for DB and display sanity. Truncate if longer. */
export const MAX_LENGTH_VERSION = 50
export const MAX_LENGTH_GAME_SEED = 100
export const MAX_LENGTH_CHARACTER_NAME = 200
export const MAX_LENGTH_SPECIES = 100
export const MAX_LENGTH_BACKGROUND = 100
export const MAX_LENGTH_PLACE = 200
export const MAX_LENGTH_GOD = 100
export const MAX_LENGTH_KILLER = 200
export const MAX_LENGTH_GAME_COMPLETION_DATE = 10
export const MAX_LENGTH_RUNES_TEXT = 200
export const MAX_LENGTH_DURATION_FORMATTED = 80

/** Valid game_completion_date format: YYYY-MM-DD or empty. */
const GAME_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function truncate(s: string, maxLen: number): string {
  if (typeof s !== "string") return ""
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen)
}

/**
 * Validates and sanitizes a parsed morgue before insert.
 * - Clamps all numeric fields (including XL) to allowed ranges so we never throw and break import.
 * - Truncates strings to max lengths.
 * - Normalizes game_completion_date (empty or YYYY-MM-DD).
 * Returns a new object; does not mutate input.
 */
export function validateAndSanitizeParsedMorgue(p: ParsedMorgue): ParsedMorgue {
  const xl = clamp(
    typeof p.xl === "number" && Number.isFinite(p.xl) ? Math.floor(p.xl) : 1,
    XL_MIN,
    XL_MAX,
  )

  const runesCount = clamp(
    typeof p.runesCount === "number" && Number.isFinite(p.runesCount)
      ? Math.floor(p.runesCount)
      : 0,
    RUNES_MIN,
    RUNES_MAX
  )
  const runesMax = clamp(
    typeof p.runesMax === "number" && Number.isFinite(p.runesMax)
      ? Math.floor(p.runesMax)
      : 15,
    RUNES_MIN,
    RUNES_MAX
  )
  const turns = clamp(
    typeof p.turns === "number" && Number.isFinite(p.turns)
      ? Math.floor(p.turns)
      : 0,
    TURNS_MIN,
    TURNS_MAX
  )
  const durationSeconds = clamp(
    typeof p.durationSeconds === "number" && Number.isFinite(p.durationSeconds)
      ? Math.floor(p.durationSeconds)
      : 0,
    DURATION_SECONDS_MIN,
    DURATION_SECONDS_MAX
  )
  const goldCollected = clamp(
    typeof p.goldCollected === "number" && Number.isFinite(p.goldCollected)
      ? Math.floor(p.goldCollected)
      : 0,
    GOLD_MIN,
    GOLD_MAX
  )
  const goldSpent = clamp(
    typeof p.goldSpent === "number" && Number.isFinite(p.goldSpent)
      ? Math.floor(p.goldSpent)
      : 0,
    GOLD_MIN,
    GOLD_MAX
  )
  const creaturesVanquished = clamp(
    typeof p.creaturesVanquished === "number" &&
      Number.isFinite(p.creaturesVanquished)
      ? Math.floor(p.creaturesVanquished)
      : 0,
    CREATURES_VANQUISHED_MIN,
    CREATURES_VANQUISHED_MAX
  )

  let gameCompletionDate =
    typeof p.gameCompletionDate === "string" ? p.gameCompletionDate.trim() : ""
  if (gameCompletionDate && !GAME_DATE_REGEX.test(gameCompletionDate)) {
    gameCompletionDate = ""
  }
  gameCompletionDate = truncate(
    gameCompletionDate,
    MAX_LENGTH_GAME_COMPLETION_DATE
  )

  return {
    version: truncate(String(p.version ?? ""), MAX_LENGTH_VERSION),
    gameSeed: truncate(String(p.gameSeed ?? ""), MAX_LENGTH_GAME_SEED),
    characterName: truncate(
      String(p.characterName ?? ""),
      MAX_LENGTH_CHARACTER_NAME
    ),
    species: truncate(String(p.species ?? ""), MAX_LENGTH_SPECIES),
    background: truncate(String(p.background ?? ""), MAX_LENGTH_BACKGROUND),
    xl,
    place: truncate(String(p.place ?? ""), MAX_LENGTH_PLACE),
    turns,
    durationSeconds,
    durationFormatted: truncate(
      String(p.durationFormatted ?? ""),
      MAX_LENGTH_DURATION_FORMATTED
    ),
    god: truncate(String(p.god ?? ""), MAX_LENGTH_GOD),
    runesCount,
    runesMax,
    runesText: truncate(String(p.runesText ?? ""), MAX_LENGTH_RUNES_TEXT),
    goldCollected,
    goldSpent,
    creaturesVanquished,
    isWin: Boolean(p.isWin),
    killer:
      p.killer != null && p.killer !== ""
        ? truncate(String(p.killer), MAX_LENGTH_KILLER)
        : null,
    gameCompletionDate,
    reachedLair5: Boolean(p.reachedLair5),
  }
}
