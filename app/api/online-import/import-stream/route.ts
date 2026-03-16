import { createServerSupabase } from "@/lib/supabase-server"
import { runOnlineImport } from "@/lib/online-import"
import {
  MAX_GAMES_PER_SERVER_PER_RUN,
  MAX_NEW_GAMES_PER_SERVER_PER_RUN,
} from "@/lib/online-import-limits"
import { recalcUserStats } from "@/lib/morgue-api"

/**
 * Streaming import: returns NDJSON stream with progress events and final result.
 * Each line: {"type":"progress","imported":N} or {"type":"done","result":{...}} or {"type":"error","error":"..."}
 */
export async function POST(request: Request) {
  let supabase
  try {
    supabase = createServerSupabase()
  } catch (e) {
    return new Response(
      JSON.stringify({
        error:
          "Online import is not configured. Set SUPABASE_SERVICE_ROLE_KEY in the server environment.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
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
    return new Response(
      JSON.stringify({ error: "Missing userId or dcssUsername" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  const rawNew = body?.maxNewGamesPerServer
  const maxNewGamesPerServer =
    typeof rawNew === "number" && Number.isFinite(rawNew) && rawNew > 0
      ? Math.min(Math.floor(rawNew), MAX_NEW_GAMES_PER_SERVER_PER_RUN)
      : typeof rawNew === "string"
        ? (() => {
            const n = Number.parseInt(rawNew, 10)
            return Number.isFinite(n) && n > 0
              ? Math.min(Math.max(1, n), MAX_NEW_GAMES_PER_SERVER_PER_RUN)
              : undefined
          })()
        : undefined
  const rawScan = body?.maxGamesPerServer
  const maxGamesPerServer =
    typeof rawScan === "number" && Number.isFinite(rawScan) && rawScan > 0
      ? Math.min(Math.floor(rawScan), MAX_GAMES_PER_SERVER_PER_RUN)
      : undefined
  const rawAbbrevs = body?.serverAbbreviations
  const serverAbbreviations =
    Array.isArray(rawAbbrevs) && rawAbbrevs.length > 0
      ? (rawAbbrevs.filter((a): a is string => typeof a === "string" && a.length > 0) as string[])
      : undefined

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const importResult = await runOnlineImport(
          supabase,
          userId,
          dcssUsername,
          {
            maxGamesPerServer: maxGamesPerServer ?? undefined,
            maxNewGamesPerServer: maxNewGamesPerServer ?? undefined,
            serverAbbreviations,
            onProgress(importedSoFar) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ type: "progress", imported: importedSoFar }) + "\n",
                ),
              )
            },
          },
        )

        if (importResult.summary.totalNewGamesImported > 0) {
          await recalcUserStats(supabase, userId)
          for (const server of importResult.servers) {
            if (server.newGamesImported > 0) {
              await supabase
                .from("import_events")
                .insert({
                  user_id: userId,
                  event_type: "online_sync",
                  morgue_count: server.newGamesImported,
                  server_abbreviation: server.serverAbbreviation,
                  dcss_username: dcssUsername,
                })
                .then(({ error }) => {
                  if (error)
                    console.warn(
                      "[snorg-morgue] Failed to log import event:",
                      error.message,
                    )
                })
            }
          }
        }

        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "done", result: importResult }) + "\n",
          ),
        )
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: "error", error: message }) + "\n"),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  })
}
