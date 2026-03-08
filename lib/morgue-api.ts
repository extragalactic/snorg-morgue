/**
 * Morgue upload, fetch, and stats recalculation using the Supabase client.
 * Call from client components so RLS uses the authenticated user.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseMorgue, getMessageHistorySignature } from "./morgue-parser"
import {
  parsedToRow,
  formatPlayTime,
  formatFastestWin,
  type ParsedMorgueRow,
  type UserStatsRow,
  type MorgueFileRow,
} from "./morgue-db"

export interface GameRecord {
  id: string
  morgueFileId: string
  character: string
  species: string
  background: string
  xl: number
  place: string
  turns: number
  duration: string
  date: string
  result: "win" | "death"
  runes: number
  killer?: string
  god?: string
}

export interface UploadResult {
  success: number
  failed: { filename: string; error: string }[]
}

/** Log a single import failure to the console with debugging context. */
function logImportFailure(
  filename: string,
  userMessage: string,
  debug?: {
    phase?: "parse" | "duplicate" | "insert_file" | "insert_parsed"
    errorMessage?: string
    stack?: string
    snippet?: string
    dbCode?: string
    dbDetails?: string
  }
) {
  const payload = {
    type: "morgue_import_failed",
    filename,
    userMessage,
    ...(debug && {
      debug: {
        phase: debug.phase,
        errorMessage: debug.errorMessage,
        stack: debug.stack,
        snippet: debug.snippet,
        dbCode: debug.dbCode,
        dbDetails: debug.dbDetails,
      },
    }),
  }
  console.error("[snorg-morgue] Morgue import failed:", payload)
  if (debug?.stack) console.error(debug.stack)
}

/**
 * Upload one or more morgue files: store raw, parse, insert parsed row, then recalc user stats.
 * Rejects duplicates (same character name + species + background + first 5 lines of Message History).
 */
export async function uploadMorgues(
  supabase: SupabaseClient,
  userId: string,
  files: { name: string; text: string }[]
): Promise<UploadResult> {
  const failed: { filename: string; error: string }[] = []
  let success = 0

  const { data: existingRows } = await supabase
    .from("parsed_morgues")
    .select("character_name, species, background, message_history_signature")
    .eq("user_id", userId)
  const existing = (existingRows ?? []) as {
    character_name: string
    species: string
    background: string
    message_history_signature: string | null
  }[]

  for (const file of files) {
    try {
      const parsed = parseMorgue(file.text)
      const signature = getMessageHistorySignature(file.text)

      const sameCombo = existing.filter(
        (r) =>
          r.character_name === parsed.characterName &&
          r.species === parsed.species &&
          r.background === parsed.background
      )

      if (sameCombo.length > 0) {
        const isDuplicate = sameCombo.some(
          (r) =>
            signature.length > 0 &&
            (r.message_history_signature ?? "") === signature
        )
        if (isDuplicate) {
          const msg =
            "Duplicate morgue: a file for this character (same name, species, background and message history) already exists."
          failed.push({ filename: file.name, error: msg })
          logImportFailure(file.name, msg, { phase: "duplicate" })
          continue
        }
      }

      const { data: morgueFile, error: insertFileErr } = await supabase
        .from("morgue_files")
        .insert({
          user_id: userId,
          filename: file.name,
          raw_text: file.text,
        })
        .select("id")
        .single()

      if (insertFileErr || !morgueFile) {
        const msg = insertFileErr?.message ?? "Failed to save file."
        failed.push({ filename: file.name, error: msg })
        logImportFailure(file.name, msg, {
          phase: "insert_file",
          errorMessage: insertFileErr?.message,
          dbCode: insertFileErr?.code,
          dbDetails: insertFileErr?.details as string | undefined,
        })
        continue
      }

      const row = parsedToRow(morgueFile.id, userId, parsed)
      const { error: insertParsedErr } = await supabase
        .from("parsed_morgues")
        .insert({ ...row, message_history_signature: signature })

      if (insertParsedErr) {
        await supabase.from("morgue_files").delete().eq("id", morgueFile.id)
        failed.push({ filename: file.name, error: insertParsedErr.message })
        logImportFailure(file.name, insertParsedErr.message, {
          phase: "insert_parsed",
          errorMessage: insertParsedErr.message,
          dbCode: insertParsedErr.code,
          dbDetails: insertParsedErr.details as string | undefined,
        })
        continue
      }

      success++
      existing.push({
        character_name: parsed.characterName,
        species: parsed.species,
        background: parsed.background,
        message_history_signature: signature,
      })
    } catch (e) {
      const userMessage = e instanceof Error ? e.message : "Parse failed."
      failed.push({ filename: file.name, error: userMessage })
      const snippet =
        file.text.length > 0
          ? file.text.slice(0, 300).replace(/\n/g, " ")
          : "(empty file)"
      logImportFailure(file.name, userMessage, {
        phase: "parse",
        errorMessage: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        snippet,
      })
    }
  }

  if (success > 0) await recalcUserStats(supabase, userId)
  return { success, failed }
}

/**
 * Recalculate user_stats from all parsed_morgues for the user.
 */
export async function recalcUserStats(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("parsed_morgues")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) return

  const list = (rows ?? []) as ParsedMorgueRow[]
  const totalGames = list.length
  const wins = list.filter((r) => r.is_win)
  const deaths = list.filter((r) => !r.is_win)
  const totalWins = wins.length
  const totalDeaths = deaths.length
  const winRate = totalGames ? (totalWins / totalGames) * 100 : 0
  const totalPlayTimeSeconds = list.reduce((s, r) => s + r.duration_seconds, 0)
  const totalRunes = list.reduce((s, r) => s + r.runes_count, 0)
  const avgXlAtDeath =
    deaths.length > 0
      ? deaths.reduce((s, r) => s + r.xl, 0) / deaths.length
      : 0
  const winDurations = wins.map((r) => r.duration_seconds)
  const fastestWinSeconds =
    winDurations.length > 0 ? Math.min(...winDurations) : null

  let bestStreak = 0
  let current = 0
  for (const r of list) {
    if (r.is_win) {
      current++
      bestStreak = Math.max(bestStreak, current)
    } else {
      current = 0
    }
  }

  await supabase.from("user_stats").upsert(
    {
      user_id: userId,
      total_wins: totalWins,
      total_deaths: totalDeaths,
      total_games: totalGames,
      win_rate: Math.round(winRate * 100) / 100,
      total_play_time_seconds: totalPlayTimeSeconds,
      best_streak: bestStreak,
      avg_xl_at_death: Math.round(avgXlAtDeath * 100) / 100,
      total_runes: totalRunes,
      fastest_win_seconds: fastestWinSeconds,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
}

/**
 * Fetch parsed morgues for the current user as GameRecord[].
 */
export async function fetchMorgues(
  supabase: SupabaseClient,
  userId: string
): Promise<GameRecord[]> {
  const { data, error } = await supabase
    .from("parsed_morgues")
    .select("id, morgue_file_id, character_name, species, background, xl, place, turns, duration_formatted, created_at, is_win, runes_count, killer, god")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) return []

  return (data ?? []).map((r) => ({
    id: r.id,
    morgueFileId: r.morgue_file_id,
    character: r.character_name,
    species: r.species,
    background: r.background,
    xl: r.xl,
    place: r.place,
    turns: r.turns,
    duration: r.duration_formatted,
    date: r.created_at.slice(0, 10),
    result: r.is_win ? ("win" as const) : ("death" as const),
    runes: r.runes_count,
    killer: r.killer ?? undefined,
    god: r.god ?? undefined,
  }))
}

/**
 * Fetch user stats for the Analysis page. Returns null if no row yet.
 */
export async function fetchUserStats(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStatsRow | null> {
  const { data, error } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (error || !data) return null
  return data as UserStatsRow
}

/**
 * Fetch raw morgue text for the MorgueBrowser (by morgue_file_id).
 */
export async function fetchRawMorgue(
  supabase: SupabaseClient,
  morgueFileId: string
): Promise<{ raw_text: string; filename: string } | null> {
  const { data, error } = await supabase
    .from("morgue_files")
    .select("raw_text, filename")
    .eq("id", morgueFileId)
    .single()

  if (error || !data) return null
  return { raw_text: data.raw_text, filename: data.filename }
}

/**
 * Delete a morgue file (and its parsed row via cascade), then recalc user stats.
 */
export async function deleteMorgue(
  supabase: SupabaseClient,
  userId: string,
  morgueFileId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("morgue_files")
    .delete()
    .eq("id", morgueFileId)
    .eq("user_id", userId)

  if (error) return { error: error.message }
  await recalcUserStats(supabase, userId)
  return { error: null }
}

// Re-export for UI formatting
export { formatPlayTime, formatFastestWin }
