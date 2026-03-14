import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { runOnlineImport } from "@/lib/online-import"
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

  try {
    const importResult = await runOnlineImport(supabase, userId, dcssUsername, {
      maxGamesPerServer: body?.maxGamesPerServer,
      maxNewGamesPerServer: body?.maxNewGamesPerServer,
      serverAbbreviations: body?.serverAbbreviations,
    })

    if (importResult.summary.totalNewGamesImported > 0) {
      // Keep stats in sync after new games arrive.
      await recalcUserStats(supabase, userId)
    }

    return NextResponse.json(importResult)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

