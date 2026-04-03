import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireAdminEmail } from "@/lib/admin-auth"

/** Supabase free tier database limit (500 MB). */
const SUPABASE_DB_LIMIT_BYTES = 500 * 1024 * 1024

type ImportEventRow = {
  id: string
  user_id: string
  event_type: string
  morgue_count: number
  server_abbreviation: string | null
  dcss_username: string | null
  created_at: string
}

/** Total rows in auth.users (same pagination as /api/admin/users). */
async function countAuthUsers(supabase: SupabaseClient): Promise<number> {
  let total = 0
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(error.message ?? "Failed to list users")
    }
    const list = data?.users ?? []
    total += list.length
    if (list.length < perPage) break
    page++
  }
  return total
}

async function fetchImportEvents(supabase: SupabaseClient): Promise<ImportEventRow[]> {
  try {
    const { data } = await supabase
      .from("import_events")
      .select("id, user_id, event_type, morgue_count, server_abbreviation, dcss_username, created_at")
      .order("created_at", { ascending: false })
      .limit(80)
    return (data ?? []) as ImportEventRow[]
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  let supabase
  try {
    supabase = createServerSupabase()
  } catch {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 },
    )
  }

  const authResult = await requireAdminEmail(request, () => supabase)
  if (!authResult.ok) {
    return NextResponse.json(authResult.body, { status: authResult.status })
  }

  try {
    const [countsRes, dbSizeRes, totalAuthUsers] = await Promise.all([
      supabase.rpc("admin_counts").maybeSingle(),
      supabase.rpc("admin_db_size").maybeSingle(),
      countAuthUsers(supabase),
    ])

    const events = await fetchImportEvents(supabase)

    const counts = (countsRes.data ?? {}) as {
      users_with_morgues?: number
      total_parsed_morgues?: number
      total_morgue_files?: number
      total_user_stats?: number
    }

    const dbSizeRaw = dbSizeRes.data
    const dbSizeBytes =
      typeof dbSizeRaw === "number"
        ? dbSizeRaw
        : dbSizeRaw != null && typeof (dbSizeRaw as { admin_db_size?: number }).admin_db_size === "number"
          ? (dbSizeRaw as { admin_db_size: number }).admin_db_size
          : null

    const userIds = [...new Set(events.map((e) => e.user_id))]
    const emailByUserId = new Map<string, string>()
    await Promise.all(
      userIds.map(async (uid) => {
        const { data } = await supabase.auth.admin.getUserById(uid)
        if (data?.user?.email) emailByUserId.set(uid, data.user.email)
      }),
    )

    const importEvents = events.map((e) => ({
      id: e.id,
      userId: e.user_id,
      userEmail: emailByUserId.get(e.user_id) ?? null,
      eventType: e.event_type,
      morgueCount: e.morgue_count,
      serverAbbreviation: e.server_abbreviation,
      dcssUsername: e.dcss_username,
      createdAt: e.created_at,
    }))

    return NextResponse.json({
      totalAuthUsers,
      usersWithMorgues: counts.users_with_morgues ?? 0,
      totalParsedMorgues: counts.total_parsed_morgues ?? 0,
      totalMorgueFiles: counts.total_morgue_files ?? 0,
      totalUserStatsRows: counts.total_user_stats ?? 0,
      importEvents,
      database: {
        sizeBytes: dbSizeBytes,
        limitBytes: SUPABASE_DB_LIMIT_BYTES,
        limitMb: 500,
      },
    })
  } catch (e) {
    console.error("[admin/stats]", e)
    return NextResponse.json({ error: "Failed to load admin stats" }, { status: 500 })
  }
}
