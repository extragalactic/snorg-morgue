/**
 * Morgue DB types and helpers. Supabase client is used from callers with auth.
 */

import type { ParsedMorgue } from "./morgue-parser"

export interface MorgueFileRow {
  id: string
  user_id: string
  filename: string
  raw_text: string
  created_at: string
}

export interface ParsedMorgueRow {
  id: string
  morgue_file_id: string
  user_id: string
  version: string
  game_seed: string
  character_name: string
  species: string
  background: string
  xl: number
  place: string
  turns: number
  duration_seconds: number
  duration_formatted: string
  god: string
  runes_count: number
  runes_max: number
  runes_text: string
  gold_collected: number
  gold_spent: number
  creatures_vanquished: number
  is_win: boolean
  killer: string | null
  message_history_signature: string
  created_at: string
}

/** One entry in species_stats, background_stats, or god_stats on user_stats. */
export interface StatEntry {
  name: string
  wins: number
  attempts: number
}

export interface UserStatsRow {
  user_id: string
  total_wins: number
  total_deaths: number
  total_games: number
  win_rate: number
  total_play_time_seconds: number
  best_streak: number
  avg_xl_at_death: number
  total_runes: number
  fastest_win_seconds: number | null
  species_stats?: StatEntry[]
  background_stats?: StatEntry[]
  god_stats?: StatEntry[]
  updated_at: string
}

export function parsedToRow(
  morgueFileId: string,
  userId: string,
  p: ParsedMorgue
): Omit<ParsedMorgueRow, "id" | "created_at"> {
  return {
    morgue_file_id: morgueFileId,
    user_id: userId,
    version: p.version,
    game_seed: p.gameSeed,
    character_name: p.characterName,
    species: p.species,
    background: p.background,
    xl: p.xl,
    place: p.place,
    turns: p.turns,
    duration_seconds: p.durationSeconds,
    duration_formatted: p.durationFormatted,
    god: p.god,
    runes_count: p.runesCount,
    runes_max: p.runesMax,
    runes_text: p.runesText,
    gold_collected: p.goldCollected,
    gold_spent: p.goldSpent,
    creatures_vanquished: p.creaturesVanquished,
    is_win: p.isWin,
    killer: p.killer,
  }
}

export function formatPlayTime(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0 || d > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(" ")
}

export function formatFastestWin(seconds: number | null): string {
  if (seconds == null) return "—"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (h > 0) parts.push(`${h}:`)
  parts.push(m.toString().padStart(h > 0 ? 2 : 1, "0"))
  parts.push(":" + s.toString().padStart(2, "0"))
  return parts.join("")
}
