import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { runOnlineImport } from "@/lib/online-import"
import {
  MAX_GAMES_PER_SERVER_PER_RUN,
  MAX_NEW_GAMES_PER_SERVER_PER_RUN,
} from "@/lib/online-import-limits"
import { recalcUserStats } from "@/lib/morgue-api"

export async function POST(request: Request) {
  let supabase
  try {
    supabase = createServerSupabase()
  } catch (e) {
    return NextResponse.json(
      { error: "Online import is not configured. Set SUPABASE_SERVICE_ROLE_KEY in the server environment." },
      { status: 503 },
    )
  }

  const body = await request.json().catch(() => null) as
    | {
        userId?: string
        dcssUsername?: string
        maxGamesPerServer?: number
        maxNewGamesPerServer?: number
        serverAbbreviations?: string[]
      }
    | null

  const userId = body?.userId?.trim()
  const dcssUsername = body?.dcssUsername?.trim()

  if (!userId || !dcssUsername) {
    return NextResponse.json({ error: "Missing userId or dcssUsername" }, { status: 400 })
  }

  const rawNew = body?.maxNewGamesPerServer
  const maxNewGamesPerServer =
    typeof rawNew === "number" && Number.isFinite(rawNew) && rawNew > 0
      ? Math.min(Math.floor(rawNew), MAX_NEW_GAMES_PER_SERVER_PER_RUN)
      : undefined
  const rawScan = body?.maxGamesPerServer
  const maxGamesPerServer =
    typeof rawScan === "number" && Number.isFinite(rawScan) && rawScan > 0
      ? Math.min(Math.floor(rawScan), MAX_GAMES_PER_SERVER_PER_RUN)
      : undefined

  try {
    const importResult = await runOnlineImport(supabase, userId, dcssUsername, {
      maxGamesPerServer: maxGamesPerServer ?? undefined,
      maxNewGamesPerServer: maxNewGamesPerServer ?? undefined,
      serverAbbreviations: body?.serverAbbreviations,
    })

    if (importResult.summary.totalNewGamesImported > 0) {
      // Keep stats in sync after new games arrive.
      await recalcUserStats(supabase, userId)
      // Log one row per server that had new imports (for admin activity summaries).
      for (const server of importResult.servers) {
        if (server.newGamesImported > 0) {
          await supabase.from("import_events").insert({
            user_id: userId,
            event_type: "online_sync",
            morgue_count: server.newGamesImported,
            server_abbreviation: server.serverAbbreviation,
            dcss_username: dcssUsername,
          }).then(({ error }) => {
            if (error) console.warn("[snorg-morgue] Failed to log import event:", error.message)
          })
        }
      }
    }

    return NextResponse.json(importResult)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

