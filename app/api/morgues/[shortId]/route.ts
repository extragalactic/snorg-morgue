import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { slugifyUsername } from "@/lib/slug"
import type { GameRecord } from "@/lib/morgue-api"

const SELECT_COLUMNS =
  "id, short_id, morgue_file_id, morgue_url, user_id, character_name, species, background, xl, place, turns, duration_formatted, duration_seconds, created_at, is_win, runes_count, runes_text, killer, god, game_completion_date, reached_lair_5, reached_dungeon_8, reached_temple, reached_depths_milestone, reached_zot_milestone"
const SELECT_COLUMNS_NO_SHORT_ID =
  "id, morgue_file_id, morgue_url, user_id, character_name, species, background, xl, place, turns, duration_formatted, duration_seconds, created_at, is_win, runes_count, runes_text, killer, god, game_completion_date, reached_lair_5, reached_dungeon_8, reached_temple, reached_depths_milestone, reached_zot_milestone"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shortId: string }> }
) {
  const { shortId: morgueIdParam } = await params
  const id = morgueIdParam?.trim()
  if (!id) {
    return NextResponse.json({ error: "Missing morgue id" }, { status: 400 })
  }

  let supabase
  try {
    supabase = createServerSupabase()
  } catch (e) {
    return NextResponse.json(
      { error: "Public morgue links are not configured. Set SUPABASE_SERVICE_ROLE_KEY in your server environment." },
      { status: 503 }
    )
  }

  let parsed: Record<string, unknown> | null = null

  const isUuid = id.length >= 32 && id.includes("-")

  if (isUuid) {
    const byId = await supabase
      .from("parsed_morgues")
      .select(SELECT_COLUMNS_NO_SHORT_ID)
      .eq("id", id)
      .maybeSingle()
    if (byId.data) parsed = byId.data as Record<string, unknown>
  }

  if (!parsed) {
    const byShortId = await supabase
      .from("parsed_morgues")
      .select(SELECT_COLUMNS)
      .eq("short_id", id)
      .maybeSingle()

    if (byShortId.data) {
      parsed = byShortId.data as Record<string, unknown>
    } else if (byShortId.error && !isUuid) {
      const byIdFallback = await supabase
        .from("parsed_morgues")
        .select(SELECT_COLUMNS_NO_SHORT_ID)
        .eq("id", id)
        .maybeSingle()
      if (byIdFallback.data) parsed = byIdFallback.data as Record<string, unknown>
    }
  }

  if (!parsed && !isUuid) {
    const byId = await supabase
      .from("parsed_morgues")
      .select(SELECT_COLUMNS_NO_SHORT_ID)
      .eq("id", id)
      .maybeSingle()
    if (byId.data) parsed = byId.data as Record<string, unknown>
  }

  if (!parsed) {
    return NextResponse.json({ error: "Morgue not found" }, { status: 404 })
  }

  const { data: userData } = await supabase.auth.admin.getUserById(parsed.user_id as string)
  const name =
    (userData?.user?.user_metadata?.full_name as string) ||
    (userData?.user?.user_metadata?.name as string) ||
    userData?.user?.email?.split("@")[0] ||
    "user"
  const ownerSlug = slugifyUsername(name)

  const row = parsed as {
    game_completion_date?: string | null
    created_at: string
    reached_lair_5?: boolean
    reached_dungeon_8?: boolean
    reached_temple?: boolean
    reached_depths_milestone?: boolean
    reached_zot_milestone?: boolean
    short_id?: string
    morgue_url?: string | null
    morgue_file_id?: string | null
  }
  let rawText: string | null = null
  let filename: string | null = null
  if (row.morgue_file_id) {
    const { data: file, error: fileError } = await supabase
      .from("morgue_files")
      .select("raw_text, filename")
      .eq("id", row.morgue_file_id)
      .single()
    if (fileError || !file) {
      return NextResponse.json({ error: "Morgue file not found" }, { status: 404 })
    }
    rawText = file.raw_text
    filename = file.filename
  }

  const gameRecord: GameRecord = {
    id: parsed.id as string,
    shortId: (row.short_id as string | undefined) ?? "",
    morgueFileId: (parsed.morgue_file_id as string | null) ?? undefined,
    morgueUrl: (row.morgue_url as string | undefined)?.trim() || undefined,
    character: parsed.character_name as string,
    species: parsed.species as string,
    background: parsed.background as string,
    xl: parsed.xl as number,
    place: parsed.place as string,
    turns: parsed.turns as number,
    duration: parsed.duration_formatted as string,
    durationSeconds: parsed.duration_seconds as number,
    date: row.game_completion_date?.trim() ? row.game_completion_date : row.created_at.slice(0, 10),
    result: (parsed.is_win as boolean) ? "win" : "death",
    runes: parsed.runes_count as number,
    runesText: (parsed.runes_text as string) ?? undefined,
    killer: (parsed.killer as string) ?? undefined,
    god: (parsed.god as string) ?? undefined,
    reachedLair5: row.reached_lair_5 ?? false,
    reachedDungeon8: row.reached_dungeon_8 ?? false,
    reachedTemple: row.reached_temple ?? false,
    reachedDepthsMilestone: row.reached_depths_milestone ?? false,
    reachedZotMilestone: row.reached_zot_milestone ?? false,
  }

  return NextResponse.json({
    gameRecord,
    rawText: rawText ?? undefined,
    filename: filename ?? undefined,
    ownerSlug,
  })
}
