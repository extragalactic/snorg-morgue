/**
 * Morgue upload, fetch, and stats recalculation using the Supabase client.
 * Call from client components so RLS uses the authenticated user.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { nanoid } from "nanoid"
import { parseMorgue, getMessageHistorySignature, parseSpeciesBackground, isAbandonedCharacterMorgue } from "./morgue-parser"
import { validateAndSanitizeParsedMorgue } from "./morgue-validation"
import { parseSkillHistory, computeSkillSnapshotsFromHistory } from "./skill-history"
import {
  parsedToRow,
  formatPlayTime,
  formatFastestWin,
  type ParsedMorgueRow,
  type UserStatsRow,
  type StatEntry,
  type MorgueFileRow,
} from "./morgue-db"

export interface GameRecord {
  id: string
  /** Short unique id for public URL (e.g. /username/morgues/abc12XYz90). */
  shortId: string
  /** Set for manually uploaded morgues; null for sync-imported (raw text fetched from morgueUrl). */
  morgueFileId?: string
  /** When set (sync-imported morgues), viewer fetches raw text from this URL. */
  morgueUrl?: string
  character: string
  species: string
  background: string
  xl: number
  place: string
  turns: number
  duration: string
  /** Duration in seconds (for fastest-win lookup). */
  durationSeconds?: number
  date: string
  result: "win" | "death"
  runes: number
  /** Comma-separated rune types collected (e.g. "serpentine, barnacled, slimy"). */
  runesText?: string
  killer?: string
  god?: string
  /** True if player reached Lair:5 in this game. */
  reachedLair5?: boolean
  reachedDungeon7?: boolean
  reachedDepthsMilestone?: boolean
  reachedZotMilestone?: boolean
  /** Short DCSS version for this game (e.g. "0.33", "0.34", "git"). */
  version?: string
}

export interface UploadResult {
  success: number
  failed: { filename: string; error: string }[]
}

/** Record import failure for UI; user message is surfaced via the failed array. No console logging—duplicates and similar cases are expected. */
function logImportFailure(
  _filename: string,
  _userMessage: string,
  _debug?: {
    phase?: "parse" | "duplicate" | "insert_file" | "insert_parsed"
    errorMessage?: string
    stack?: string
    snippet?: string
    dbCode?: string
    dbDetails?: string
  }
) {
  // No-op: user-facing message is surfaced via the failed array in uploadMorgues / refreshMorguesFromRaw.
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
      if (isAbandonedCharacterMorgue(file.text)) {
        const msg =
          "Skipped: file appears to be an abandoned character."
        failed.push({ filename: file.name, error: msg })
        logImportFailure(file.name, msg, { phase: "parse" })
        continue
      }
      const parsed = validateAndSanitizeParsedMorgue(parseMorgue(file.text))
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
            "Duplicate morgue: a file for this character already exists."
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

      const baseRow = parsedToRow(morgueFile.id, userId, parsed)
      const insertPayload = { ...baseRow, message_history_signature: signature, short_id: nanoid(6) }
      let insertParsedErr: { message: string; code?: string; details?: unknown } | null = null
      let insertedRow: { id: string; is_win: boolean } | null = null

      let res = await supabase
        .from("parsed_morgues")
        .insert(insertPayload)
        .select("id, is_win")
        .single()

      insertParsedErr = res.error
      insertedRow = (res.data as { id: string; is_win: boolean } | null) ?? null

      // If short_id column doesn't exist (migration not run), retry without it so import still works.
      if (insertParsedErr && /short_id.*schema cache/i.test(insertParsedErr.message)) {
        const { message_history_signature: _sig, short_id: _sid, ...rowWithoutShort } = insertPayload as typeof insertPayload & {
          short_id?: string
        }
        res = await supabase
          .from("parsed_morgues")
          .insert(rowWithoutShort)
          .select("id, is_win")
          .single()
        insertParsedErr = res.error
        insertedRow = (res.data as { id: string; is_win: boolean } | null) ?? null
      }

      if (insertParsedErr || !insertedRow) {
        await supabase.from("morgue_files").delete().eq("id", morgueFile.id)
        const msg = insertParsedErr?.message ?? "Failed to save parsed morgue."
        failed.push({ filename: file.name, error: msg })
        logImportFailure(file.name, msg, {
          phase: "insert_parsed",
          errorMessage: insertParsedErr?.message,
          dbCode: insertParsedErr?.code,
          dbDetails: insertParsedErr?.details as string | undefined,
        })
        continue
      }

      // For winning games, compute and store skill snapshots from the morgue's skill history.
      if (insertedRow.is_win) {
        const skillHistory = parseSkillHistory(file.text)
        if (skillHistory) {
          const snapshots = computeSkillSnapshotsFromHistory(skillHistory)
          if (snapshots.length > 0) {
            const versionShort = (parsed.version.match(/^(\d+\.\d+)/)?.[1] ?? parsed.version).trim()
            const snapshotRows = snapshots.map((s) => ({
              user_id: userId,
              game_id: insertedRow!.id,
              species: parsed.species,
              background: parsed.background,
              version_short: versionShort,
              skill_group: s.skill_group,
              checkpoint_xl: s.checkpoint_xl,
              level: s.level,
            }))
            await supabase.from("skill_snapshots").insert(snapshotRows)
          }
        }
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

  if (success > 0) {
    await recalcUserStats(supabase, userId)
    await supabase.from("import_events").insert({
      user_id: userId,
      event_type: "manual_upload",
      morgue_count: success,
      server_abbreviation: null,
      dcss_username: null,
    }).then(({ error }) => {
      if (error) console.warn("[snorg-morgue] Failed to log import event:", error.message)
    })
  }
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

  // Order by game play date (from morgue filename or game_completion_date) so best_streak = consecutive wins chronologically.
  const fileIds = [...new Set(list.map((r) => r.morgue_file_id).filter(Boolean))] as string[]
  const filenameByFileId = new Map<string, string>()
  const everIgnisByFileId = new Map<string, boolean>()
  if (fileIds.length > 0) {
    const { data: files } = await supabase
      .from("morgue_files")
      .select("id, filename, raw_text")
      .eq("user_id", userId)
      .in("id", fileIds)
    for (const f of files ?? []) {
      const row = f as { id: string; filename?: string; raw_text?: string }
      filenameByFileId.set(row.id, row.filename ?? "")
      const raw = row.raw_text ?? ""
      // Count Ignis as "ever worshipped" only if the player actually joined Ignis,
      // not if they merely found an Ignis altar. Match: "You worshipped Ignis.",
      // "Became a worshipper of Ignis", or "You abandoned Ignis."
      const everIgnis =
        /\bYou worshipped Ignis\./i.test(raw) ||
        /\bBecame a worshipper of Ignis\b/i.test(raw) ||
        /\bYou abandoned Ignis\./i.test(raw)
      everIgnisByFileId.set(row.id, everIgnis)
    }
  }
  // DCSS filenames: morgue-Name-YYYYMMDD-HHMMSS.txt; use as sort key for chronological order. Sync-imported rows have no file, use game_completion_date or created_at.
  const sortKey = (r: ParsedMorgueRow) => {
    const fileId = r.morgue_file_id
    if (fileId) {
      const filename = filenameByFileId.get(fileId) ?? ""
      const match = filename.match(/-(\d{8})-(\d{6})/)
      if (match) return `${match[1]}${match[2]}`
    }
    return (r.game_completion_date && r.game_completion_date.trim()) || r.created_at
  }
  const listByPlayDate = [...list].sort((a, b) => {
    const ka = sortKey(a)
    const kb = sortKey(b)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })

  // Normalize species/background from stored data (may have been parsed with older logic,
  // e.g. "Naga Hedge" + "Wizard" instead of "Naga" + "Hedge Wizard") so stats use canonical names.
  const normalizedList = list.map((r) => {
    const combined = r.background ? `${r.species} ${r.background}` : r.species
    const { species, background } = parseSpeciesBackground(combined)
    return { ...r, species, background }
  })

  function normalizeGodName(raw: string): string {
    const name = (raw ?? "").trim()
    if (!name) return "(no god)"
    if (name === "(no god)") return "(no god)"
    if (name === "Fedhas Madash" || name === "Fedhas") return "Fedhas"
    if (name.toLowerCase().startsWith("nemelex")) return "Nemelex"
    if (name.toLowerCase().includes("shining one")) return "The Shining One"
    if (name.toLowerCase().startsWith("gozag")) return "Gozag"
    return name
  }

  function buildStatEntries(
    list: ParsedMorgueRow[],
    getName: (r: ParsedMorgueRow) => string
  ): StatEntry[] {
    const map = new Map<string, { wins: number; attempts: number }>()
    for (const r of list) {
      const name = getName(r) || "(none)"
      const entry = map.get(name) ?? { wins: 0, attempts: 0 }
      entry.attempts++
      if (r.is_win) entry.wins++
      map.set(name, entry)
    }
    return Array.from(map.entries())
      .map(([name, { wins, attempts }]) => ({ name, wins, attempts }))
      .sort((a, b) => b.attempts - a.attempts)
  }

  const species_stats = buildStatEntries(normalizedList, (r) => r.species)
  const background_stats = buildStatEntries(normalizedList, (r) => r.background)
  // God stats: normally count by the final god at death/win, except for Ignis.
  // Ignis counts as "attempted" (and "won" if applicable) if the player ever joined Ignis during the game,
  // even if they later switched to another god. Wins/attempts still also count for the final god.
  const ignisName = normalizeGodName("Ignis")
  const godStatsMap = new Map<string, { wins: number; attempts: number }>()
  const bumpGod = (name: string, isWin: boolean) => {
    const key = name || "(none)"
    const entry = godStatsMap.get(key) ?? { wins: 0, attempts: 0 }
    entry.attempts++
    if (isWin) entry.wins++
    godStatsMap.set(key, entry)
  }
  for (const r of normalizedList) {
    const finalGod = normalizeGodName(r.god || "(no god)")
    bumpGod(finalGod, r.is_win)
    const everIgnis = r.morgue_file_id ? everIgnisByFileId.get(r.morgue_file_id) ?? false : false
    if (everIgnis && finalGod !== ignisName) {
      bumpGod(ignisName, r.is_win)
    }
  }
  const god_stats: StatEntry[] = Array.from(godStatsMap.entries())
    .map(([name, { wins, attempts }]) => ({ name, wins, attempts }))
    .sort((a, b) => b.attempts - a.attempts)

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
  for (const r of listByPlayDate) {
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
      species_stats,
      background_stats,
      god_stats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
}

/** DB row shape from parsed_morgues select — shared by client fetch and browse API. */
export function parsedMorgueRowsToGameRecords(data: unknown[] | null | undefined): GameRecord[] {
  return (data ?? []).map((r) => {
    const row = r as {
      id: string
      character_name: string
      species: string
      background: string
      xl: number
      place: string
      turns: number
      duration_formatted: string
      created_at: string
      is_win: boolean
      runes_count: number
      morgue_file_id?: string | null
      game_completion_date?: string | null
      short_id?: string
      morgue_url?: string | null
      version?: string | null
      duration_seconds?: number
      runes_text?: string
      killer?: string | null
      god?: string | null
      reached_lair_5?: boolean
      reached_dungeon_7?: boolean
      reached_depths_milestone?: boolean
      reached_zot_milestone?: boolean
    }
    return {
      id: row.id,
      shortId: row.short_id ?? "",
      morgueFileId: row.morgue_file_id ?? undefined,
      morgueUrl: row.morgue_url?.trim() || undefined,
      character: row.character_name,
      species: row.species,
      background: row.background,
      xl: row.xl,
      place: row.place,
      turns: row.turns,
      duration: row.duration_formatted,
      durationSeconds: row.duration_seconds,
      date: row.game_completion_date?.trim()
        ? row.game_completion_date
        : row.created_at.slice(0, 10),
      result: row.is_win ? ("win" as const) : ("death" as const),
      runes: row.runes_count,
      runesText: row.runes_text ?? undefined,
      killer: row.killer ?? undefined,
      god: row.god ?? undefined,
      reachedLair5: row.reached_lair_5 ?? false,
      reachedDungeon7: row.reached_dungeon_7 ?? false,
      reachedDepthsMilestone: row.reached_depths_milestone ?? false,
      reachedZotMilestone: row.reached_zot_milestone ?? false,
      version: row.version?.trim() || undefined,
    }
  })
}

/**
 * Fetch parsed morgues for the current user as GameRecord[].
 * Tries to include short_id if the column exists; if the column is missing (migration not run), retries without it.
 */
export async function fetchMorgues(
  supabase: SupabaseClient,
  userId: string
): Promise<GameRecord[]> {
  const withShortId =
    "id, short_id, morgue_file_id, morgue_url, character_name, species, background, xl, place, turns, duration_formatted, duration_seconds, created_at, is_win, runes_count, runes_text, killer, god, game_completion_date, reached_lair_5, reached_dungeon_7, reached_depths_milestone, reached_zot_milestone, version"
  const withoutShortId =
    "id, morgue_file_id, morgue_url, character_name, species, background, xl, place, turns, duration_formatted, duration_seconds, created_at, is_win, runes_count, runes_text, killer, god, game_completion_date, reached_lair_5, reached_dungeon_7, reached_depths_milestone, reached_zot_milestone, version"

  let { data, error } = await supabase
    .from("parsed_morgues")
    .select(withShortId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    const fallback = await supabase
      .from("parsed_morgues")
      .select(withoutShortId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
    if (fallback.error) return []
    data = fallback.data
  }

  return parsedMorgueRowsToGameRecords(data as unknown[])
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
 * Fetch global per-level average deaths for the Level at Death chart.
 * Returns { averages: number[27], userCount } or null on error.
 * Backed by the Supabase RPC: level_death_user_averages().
 */
export async function fetchGlobalLevelDeathAverages(
  supabase: SupabaseClient
): Promise<{ averages: number[]; userCount: number } | null> {
  const { data, error } = await supabase.rpc("level_death_user_averages")
  if (error || data == null) return null

  // Support both legacy (numeric[] only) and new JSON shape.
  if (Array.isArray(data)) {
    return { averages: data as number[], userCount: 0 }
  }

  const payload = data as { averages?: number[]; user_count?: number; userCount?: number }
  if (payload.averages && Array.isArray(payload.averages)) {
    return {
      averages: payload.averages,
      userCount:
        typeof payload.user_count === "number"
          ? payload.user_count
          : typeof payload.userCount === "number"
          ? payload.userCount
          : 0,
    }
  }

  return null
}

// -----------------------------
// Global Analysis Stats (aggregated for all users)
// -----------------------------

export interface GlobalAnalysisTotals {
  totalGames: number
  totalWins: number
  totalDeaths: number
  overallWinRate: number
  avgXlAtDeath: number
  avgPlayTimeSeconds: number
  avgRunesPerGame: number
  fastestWinSeconds: number | null
  avgBestStreak: number
  lair5ReachRate: number
  smallestTurncountWin: number | null
}

export interface GlobalLevelDeathStats {
  averages: number[]
  userCount: number
}

export interface GlobalGodAvgXl {
  god: string
  avgXlAtDeath: number
  deathCount: number
}

export interface GlobalAnalysisStats {
  userCount: number
  totals: GlobalAnalysisTotals
  levelDeath: GlobalLevelDeathStats
  avgXlByGod: GlobalGodAvgXl[]
}

/**
 * Fetch global aggregate stats used on the Analysis page.
 * Backed by the Supabase RPC: global_analysis_stats().
 */
export async function fetchGlobalAnalysisStats(
  supabase: SupabaseClient
): Promise<GlobalAnalysisStats | null> {
  const { data, error } = await supabase.rpc("global_analysis_stats")
  if (error || !data) return null

  const payload = data as {
    user_count?: number
    totals?: {
      total_games?: number
      total_wins?: number
      total_deaths?: number
      overall_win_rate?: number
      avg_xl_at_death?: number
      avg_play_time_seconds?: number
      avg_runes_per_game?: number
      fastest_win_seconds?: number | null
      avg_best_streak?: number
      lair5_reach_rate?: number
      smallest_turncount_win?: number | null
    }
    level_death?: {
      averages?: number[]
      user_count?: number
    }
    avg_xl_by_god?: {
      god?: string
      avg_xl_at_death?: number
      death_count?: number
    }[]
  }

  const totals = payload.totals ?? {}
  const level = payload.level_death ?? {}
  const godsRaw = payload.avg_xl_by_god ?? []

  const avgXlByGod: GlobalGodAvgXl[] = godsRaw.map((g) => ({
    god: g.god ?? "(no god)",
    avgXlAtDeath: g.avg_xl_at_death ?? 0,
    deathCount: g.death_count ?? 0,
  }))

  return {
    userCount: payload.user_count ?? 0,
    totals: {
      totalGames: totals.total_games ?? 0,
      totalWins: totals.total_wins ?? 0,
      totalDeaths: totals.total_deaths ?? 0,
      overallWinRate: totals.overall_win_rate ?? 0,
      avgXlAtDeath: totals.avg_xl_at_death ?? 0,
      avgPlayTimeSeconds: totals.avg_play_time_seconds ?? 0,
      avgRunesPerGame: totals.avg_runes_per_game ?? 0,
      fastestWinSeconds: totals.fastest_win_seconds ?? null,
      avgBestStreak: totals.avg_best_streak ?? 0,
      lair5ReachRate: totals.lair5_reach_rate ?? 0,
      smallestTurncountWin: totals.smallest_turncount_win ?? null,
    },
    levelDeath: {
      averages: level.averages ?? [],
      userCount: level.user_count ?? 0,
    },
    avgXlByGod,
  }
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

const PARSED_COLUMNS_NO_SHORT =
  "id, morgue_file_id, morgue_url, character_name, species, background, xl, place, turns, duration_formatted, duration_seconds, created_at, is_win, runes_count, runes_text, killer, god, game_completion_date, reached_lair_5, reached_dungeon_7, reached_depths_milestone, reached_zot_milestone"

/**
 * Fetch a single morgue by id for the current user (RLS). Returns null if not found or not allowed.
 * Use when the viewer is the owner so no service-role API is needed.
 */
export async function fetchMorgueById(
  supabase: SupabaseClient,
  morgueId: string
): Promise<GameRecord | null> {
  const { data: r, error } = await supabase
    .from("parsed_morgues")
    .select(PARSED_COLUMNS_NO_SHORT)
    .eq("id", morgueId.trim())
    .maybeSingle()

  if (error || !r) return null
  const row = r as {
    game_completion_date?: string | null
    created_at: string
    reached_lair_5?: boolean
    reached_dungeon_7?: boolean
    reached_depths_milestone?: boolean
    reached_zot_milestone?: boolean
    morgue_url?: string | null
  }
  return {
    id: r.id,
    shortId: (r as { short_id?: string }).short_id ?? "",
    morgueFileId: (r.morgue_file_id as string | null) ?? undefined,
    morgueUrl: row.morgue_url?.trim() || undefined,
    character: r.character_name,
    species: r.species,
    background: r.background,
    xl: r.xl,
    place: r.place,
    turns: r.turns,
    duration: r.duration_formatted,
    durationSeconds: (r as { duration_seconds?: number }).duration_seconds,
    date: row.game_completion_date?.trim() ? row.game_completion_date : row.created_at.slice(0, 10),
    result: r.is_win ? ("win" as const) : ("death" as const),
    runes: r.runes_count,
    runesText: (r as { runes_text?: string }).runes_text ?? undefined,
    killer: r.killer ?? undefined,
    god: r.god ?? undefined,
    reachedLair5: row.reached_lair_5 ?? false,
    reachedDungeon7: row.reached_dungeon_7 ?? false,
    reachedDepthsMilestone: row.reached_depths_milestone ?? false,
    reachedZotMilestone: row.reached_zot_milestone ?? false,
  }
}

/**
 * Delete a morgue (parsed row + its skill_snapshots; if manually uploaded, also delete the morgue_files row), then recalc user stats.
 */
export async function deleteMorgue(
  supabase: SupabaseClient,
  userId: string,
  game: { id: string; morgueFileId?: string }
): Promise<{ error: string | null }> {
  const { error: parsedErr } = await supabase
    .from("parsed_morgues")
    .delete()
    .eq("id", game.id)
    .eq("user_id", userId)

  if (parsedErr) return { error: parsedErr.message }
  const { error: snapErr } = await supabase
    .from("skill_snapshots")
    .delete()
    .eq("game_id", game.id)
    .eq("user_id", userId)
  if (snapErr) return { error: snapErr.message }
  if (game.morgueFileId) {
    const { error: fileErr } = await supabase
      .from("morgue_files")
      .delete()
      .eq("id", game.morgueFileId)
      .eq("user_id", userId)
    if (fileErr) return { error: fileErr.message }
  }
  await recalcUserStats(supabase, userId)
  return { error: null }
}

/**
 * Delete all morgues for the user (parsed rows + morgue files + skill_snapshots) and clear their stats. For testing / clean re-upload.
 */
export async function deleteAllMorgues(
  supabase: SupabaseClient,
  userId: string
): Promise<{ error: string | null }> {
  const { error: parsedErr } = await supabase
    .from("parsed_morgues")
    .delete()
    .eq("user_id", userId)
  if (parsedErr) return { error: parsedErr.message }
  const { error: fileErr } = await supabase
    .from("morgue_files")
    .delete()
    .eq("user_id", userId)
  if (fileErr) return { error: fileErr.message }
  const { error: snapErr } = await supabase
    .from("skill_snapshots")
    .delete()
    .eq("user_id", userId)
  if (snapErr) return { error: snapErr.message }
  await recalcUserStats(supabase, userId)
  return { error: null }
}

/**
 * Re-parse all stored morgue_files for the user into parsed_morgues and rebuild stats.
 * Only affects manually uploaded morgues (sync-imported rows are left unchanged).
 */
export async function refreshMorguesFromRaw(
  supabase: SupabaseClient,
  userId: string
): Promise<{ error: string | null }> {
  // Delete only parsed rows that have a morgue_file_id (manual uploads); leave sync-imported rows.
  const { data: toDelete } = await supabase
    .from("parsed_morgues")
    .select("id")
    .eq("user_id", userId)
    .not("morgue_file_id", "is", null)
  const ids = (toDelete ?? []).map((r) => r.id)
  if (ids.length > 0) {
    const { error: deleteParsedErr } = await supabase
      .from("parsed_morgues")
      .delete()
      .in("id", ids)
    if (deleteParsedErr) return { error: deleteParsedErr.message }
  }

  // Fetch all raw morgue files for the user.
  const { data: files, error: filesErr } = await supabase
    .from("morgue_files")
    .select("id, filename, raw_text")
    .eq("user_id", userId)

  if (filesErr) return { error: filesErr.message }
  if (!files || files.length === 0) {
    // Nothing to reparse; leave stats empty.
    return { error: null }
  }

  const failed: { filename: string; error: string }[] = []
  let success = 0

  for (const file of files as { id: string; filename: string; raw_text: string }[]) {
    try {
      if (isAbandonedCharacterMorgue(file.raw_text)) {
        const msg = "Skipped: file appears to be an abandoned character."
        failed.push({ filename: file.filename, error: msg })
        logImportFailure(file.filename, msg, { phase: "parse" })
        continue
      }

      const parsed = validateAndSanitizeParsedMorgue(parseMorgue(file.raw_text))
      const signature = getMessageHistorySignature(file.raw_text)
      const row = parsedToRow(file.id, userId, parsed)
      const insertPayload = { ...row, message_history_signature: signature, short_id: nanoid(6) }

      let insertParsedErr: { message: string; code?: string; details?: unknown } | null = null
      let res = await supabase.from("parsed_morgues").insert(insertPayload)
      insertParsedErr = res.error

      // If short_id column doesn't exist (migration not run), retry without it so refresh still works.
      if (insertParsedErr && /short_id.*schema cache/i.test(insertParsedErr.message)) {
        const { message_history_signature: _sig, short_id: _sid, ...rowWithoutShort } =
          insertPayload as typeof insertPayload & { short_id?: string }
        res = await supabase.from("parsed_morgues").insert(rowWithoutShort)
        insertParsedErr = res.error
      }

      if (insertParsedErr) {
        failed.push({ filename: file.filename, error: insertParsedErr.message })
        logImportFailure(file.filename, insertParsedErr.message, {
          phase: "insert_parsed",
          errorMessage: insertParsedErr.message,
          dbCode: insertParsedErr.code,
          dbDetails: insertParsedErr.details as string | undefined,
        })
        continue
      }

      success++
    } catch (e) {
      const userMessage = e instanceof Error ? e.message : "Parse failed."
      failed.push({ filename: file.filename, error: userMessage })
      const snippet =
        file.raw_text.length > 0
          ? file.raw_text.slice(0, 300).replace(/\n/g, " ")
          : "(empty file)"
      logImportFailure(file.filename, userMessage, {
        phase: "parse",
        errorMessage: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        snippet,
      })
    }
  }

  if (success > 0) {
    await recalcUserStats(supabase, userId)
  }

  // If everything failed, surface a generic error; otherwise succeed silently.
  if (success === 0 && failed.length > 0) {
    return { error: "Failed to re-parse all morgue files. See console for details." }
  }

  return { error: null }
}

// Re-export for UI formatting
export { formatPlayTime, formatFastestWin }
