import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { scanOnlineGames } from "@/lib/online-import"

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
    | { userId?: string; dcssUsername?: string; maxGamesPerServer?: number }
    | null

  const userId = body?.userId?.trim()
  const dcssUsername = body?.dcssUsername?.trim()

  if (!userId || !dcssUsername) {
    return NextResponse.json({ error: "Missing userId or dcssUsername" }, { status: 400 })
  }

  try {
    const result = await scanOnlineGames(supabase, userId, dcssUsername, {
      maxGamesPerServer: body?.maxGamesPerServer,
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

