import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireAuthenticatedUser, isUuid } from "@/lib/browse-auth"
import { parsedMorgueRowsToGameRecords, type UserFavouriteSpellRow } from "@/lib/morgue-api"
import type { UserStatsRow } from "@/lib/morgue-db"

/**
 * Returns another user's morgues + user_stats for authenticated viewers (browse mode).
 * Uses service role to read target rows; caller must present a valid session JWT.
 */
export async function GET(request: Request) {
  let supabase: ReturnType<typeof createServerSupabase>
  try {
    supabase = createServerSupabase()
  } catch {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 })
  }

  const authResult = await requireAuthenticatedUser(request, () => supabase)
  if (!authResult.ok) {
    return NextResponse.json(authResult.body, { status: authResult.status })
  }

  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get("userId")?.trim() ?? ""
  if (!targetUserId || !isUuid(targetUserId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 })
  }

  const { data: targetAuth, error: targetErr } =
    await supabase.auth.admin.getUserById(targetUserId)
  if (targetErr || !targetAuth?.user?.id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const withShortId =
    "id, short_id, morgue_file_id, morgue_url, character_name, species, background, xl, place, turns, duration_formatted, duration_seconds, created_at, is_win, runes_count, runes_text, killer, god, game_completion_date, reached_lair_5, reached_dungeon_8, reached_temple, reached_depths_milestone, reached_zot_milestone, version"
  const withoutShortId =
    "id, morgue_file_id, morgue_url, character_name, species, background, xl, place, turns, duration_formatted, duration_seconds, created_at, is_win, runes_count, runes_text, killer, god, game_completion_date, reached_lair_5, reached_dungeon_8, reached_temple, reached_depths_milestone, reached_zot_milestone, version"

  const primary = await supabase
    .from("parsed_morgues")
    .select(withShortId)
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false })

  let morgueRows: unknown[] = (primary.data ?? []) as unknown[]
  if (primary.error) {
    const fallback = await supabase
      .from("parsed_morgues")
      .select(withoutShortId)
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
    if (fallback.error) {
      return NextResponse.json({ error: "Failed to load morgues" }, { status: 500 })
    }
    morgueRows = (fallback.data ?? []) as unknown[]
  }

  const { data: statsRow } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", targetUserId)
    .maybeSingle()

  const { data: favouriteSpellRows } = await supabase
    .from("user_favourite_spells")
    .select("level_group, rank, spell_key, spell_name, total_uses, morgue_count")
    .eq("user_id", targetUserId)
    .order("level_group", { ascending: true })
    .order("rank", { ascending: true })

  return NextResponse.json({
    morgues: parsedMorgueRowsToGameRecords(morgueRows),
    stats: (statsRow as UserStatsRow | null) ?? null,
    favouriteSpells: (favouriteSpellRows ?? []) as UserFavouriteSpellRow[],
  })
}
