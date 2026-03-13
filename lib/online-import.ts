import crypto from "crypto"

import { DCSS_SERVERS } from "./dcss-public-sources"
import type { SupabaseClient } from "@supabase/supabase-js"
import { nanoid } from "nanoid"
import { parseMorgue } from "./morgue-parser"
import { parsedToRow } from "./morgue-db"

// Only support a single server in Stage 1 to keep the implementation focused.
const PRIMARY_SERVER_ABBR = "CDI"

export type OnlineImportServerStatus = "ok" | "skipped" | "error"

export interface OnlineImportScanServerResult {
  serverAbbreviation: string
  status: OnlineImportServerStatus
  totalGamesFound: number
  totalGamesImported: number
  newGames: number
  lastScanAt: string | null
  lastImportAt: string | null
  errorMessage: string | null
}

export interface OnlineImportScanResult {
  dcssUsername: string
  servers: OnlineImportScanServerResult[]
}

export interface OnlineImportRunServerResult {
  serverAbbreviation: string
  status: OnlineImportServerStatus
  newGamesImported: number
  duplicatesSkipped: number
  errors: string[]
}

export interface OnlineImportRunResult {
  dcssUsername: string
  summary: {
    totalNewGamesImported: number
    totalDuplicatesSkipped: number
  }
  servers: OnlineImportRunServerResult[]
}

type ParsedXlog = Record<string, string>

function getPrimaryServerConfig() {
  const server = DCSS_SERVERS.find((s) => s.abbreviation === PRIMARY_SERVER_ABBR)
  if (!server) {
    throw new Error(`Primary server with abbreviation ${PRIMARY_SERVER_ABBR} not found in DCSS_SERVERS`)
  }
  return server
}

function parseXlogLine(line: string): ParsedXlog | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) return null
  const out: ParsedXlog = {}
  for (const part of trimmed.split(":")) {
    const eq = part.indexOf("=")
    if (eq <= 0) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key) out[key] = value
  }
  return Object.keys(out).length > 0 ? out : null
}

function computeGameSignature(serverAbbr: string, name: string, end: string, version: string, score: string) {
  const raw = `${serverAbbr}|${name}|${end}|${version}|${score}`
  // Use a short hash to keep indexes compact. The raw string is still available if needed.
  return crypto.createHash("sha1").update(raw).digest("hex")
}

// CDI morgue URL pattern:
// base: https://crawl.dcss.io/crawl/morgue
// path: /<Name>/morgue-Name-YYYYMMDD-HHMMSS.txt
// The xlog "end" field sometimes contains trailing non-digit characters (e.g. timezone markers);
// we strip everything but the first 14 digits (YYYYMMDDHHMMSS) before formatting.
function buildCdiMorgueUrl(name: string, end: string) {
  const server = getPrimaryServerConfig()
  const base = server.morgueUrl ?? `${server.baseUrl}/crawl/morgue`
  const cleanName = name.trim()
  // Keep only digits from the end timestamp and use the first 14 (YYYYMMDDHHMMSS).
  const digits = end.replace(/\D/g, "")
  const ts14 = digits.length >= 14 ? digits.slice(0, 14) : digits
  const date = ts14.slice(0, 8)
  const time = ts14.slice(8, 14)
  const formatted = date && time.length === 6 ? `${date}-${time}` : ts14
  return `${base}/${encodeURIComponent(cleanName)}/morgue-${encodeURIComponent(cleanName)}-${formatted}.txt`
}

// Fallback helper for CDI: if the naive URL 404s, look at the user's morgue directory and
// try to find a file whose HHMMSS segment matches the xlog "end" time.
async function findCdiMorgueUrlByTime(name: string, end: string) {
  const server = getPrimaryServerConfig()
  const base = server.morgueUrl ?? `${server.baseUrl}/crawl/morgue`
  const cleanName = name.trim()
  const digits = end.replace(/\D/g, "")
  const time = digits.slice(-6)
  if (!time) return null

  const indexUrl = `${base}/${encodeURIComponent(cleanName)}/`
  const res = await fetch(indexUrl, { cache: "no-store" })
  if (!res.ok) {
    return null
  }
  const html = await res.text()
  const regex = new RegExp(`morgue-${cleanName}-\\d{8}-${time}\\.txt`, "g")
  const match = regex.exec(html)
  if (!match || !match[0]) return null
  return `${base}/${encodeURIComponent(cleanName)}/${match[0]}`
}

function shortVersionFromFull(v: string | undefined): string | null {
  if (!v) return null
  const m = v.match(/^(\d+\.\d+)/)
  return m ? m[1] : null
}

async function collectMatchesForUsername(
  server: ReturnType<typeof getPrimaryServerConfig>,
  dcssUsername: string,
  maxMatches: number,
): Promise<ParsedXlog[]> {
  const nameLower = dcssUsername.toLowerCase()
  const matches: ParsedXlog[] = []

  // Stage 1: only ingest games whose short version is 0.33 or 0.34, even if they come from
  // a "trunk"/git logfile. This allows us to include trunk builds that correspond to those versions.
  const allowedShortVersions = new Set(["0.33", "0.34"])

  // Prefer newer logfiles first by iterating in reverse order.
  const logfiles = [...server.logfiles].reverse()

  for (const logfileCfg of logfiles) {
    if (matches.length >= maxMatches) break
    const logfileUrl = logfileCfg.path.startsWith("http")
      ? logfileCfg.path
      : `${server.baseUrl}${logfileCfg.path}`

    let text: string
    try {
      const res = await fetch(logfileUrl, { cache: "no-store" })
      if (!res.ok) {
        continue
      }
      text = await res.text()
    } catch {
      continue
    }

    const allLines = text.split("\n")
    for (const line of allLines) {
      const parsed = parseXlogLine(line)
      if (!parsed) continue
      const name = (parsed.name ?? "").trim()
      if (!name) continue
      if (name.toLowerCase() !== nameLower) continue
      const v = (parsed.v ?? parsed.version) as string | undefined
      const short = shortVersionFromFull(v)
      if (!short || !allowedShortVersions.has(short)) continue
      matches.push(parsed)
      if (matches.length >= maxMatches) break
    }
  }

  return matches
}

interface ScanOptions {
  /** Maximum number of matching games to consider per server. Default: large enough to act as "all" for typical users. */
  maxGamesPerServer?: number
}

// Stage 1: we infer "new" games by comparing game_signature values that already exist for this user + server.
export async function scanOnlineGames(
  supabase: SupabaseClient,
  userId: string,
  dcssUsername: string,
  options: ScanOptions = {},
): Promise<OnlineImportScanResult> {
  // For scans, default to a high cap so counts represent "all" games for typical users.
  const maxGamesPerServer = options.maxGamesPerServer ?? 1000
  const results: OnlineImportScanServerResult[] = []
  const server = getPrimaryServerConfig()

  let status: OnlineImportServerStatus = "ok"
  let errorMessage: string | null = null
  let totalGamesFound = 0
  let totalGamesImported = 0
  let newGames = 0

  try {
    const matches = await collectMatchesForUsername(server, dcssUsername, maxGamesPerServer)

    totalGamesFound = matches.length

    // Fetch existing game_signatures for this user + server so we can compute "new" locally.
    const { data: existingRows } = await supabase
      .from("parsed_morgues")
      .select("game_signature")
      .eq("user_id", userId)
      .eq("server_abbreviation", server.abbreviation)
      .eq("dcss_username", dcssUsername)
      .eq("source", "online_sync")

    const existingSet = new Set((existingRows ?? []).map((r) => (r.game_signature as string | null) ?? "").filter(Boolean))
    let newCount = 0

    for (const row of matches) {
      const version = (row.v ?? row.version ?? "").trim()
      const end = (row.end ?? "").trim()
      const score = (row.sc ?? "").trim()
      const name = (row.name ?? "").trim()
      if (!name || !end) continue
      const signature = computeGameSignature(server.abbreviation, name, end, version, score)
      if (!existingSet.has(signature)) {
        newCount++
      } else {
        totalGamesImported++
      }
    }

    newGames = newCount
  } catch (err) {
    status = "error"
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  results.push({
    serverAbbreviation: server.abbreviation,
    status,
    totalGamesFound,
    totalGamesImported,
    newGames,
    lastScanAt: new Date().toISOString(),
    lastImportAt: null,
    errorMessage,
  })

  return { dcssUsername, servers: results }
}

interface ImportOptions extends ScanOptions {
  /** Maximum number of new games to import per server in a single run. Default: 10. */
  maxNewGamesPerServer?: number
}

export async function runOnlineImport(
  supabase: SupabaseClient,
  userId: string,
  dcssUsername: string,
  options: ImportOptions = {},
): Promise<OnlineImportRunResult> {
  const requestedNew = options.maxNewGamesPerServer ?? 3
  const maxNewGamesPerServer = requestedNew
  // Allow ourselves to examine more candidate games than we plan to import so that
  // duplicates and failures do not consume the "new games" quota.
  const maxGamesPerServer = options.maxGamesPerServer ?? requestedNew * 10
  const server = getPrimaryServerConfig()

  let status: OnlineImportServerStatus = "ok"
  const errors: string[] = []
  let newGamesImported = 0
  let duplicatesSkipped = 0

  try {
    const matches = await collectMatchesForUsername(server, dcssUsername, maxGamesPerServer)

    const { data: existingRows } = await supabase
      .from("parsed_morgues")
      .select("game_signature")
      .eq("user_id", userId)
      .eq("server_abbreviation", server.abbreviation)
      .eq("dcss_username", dcssUsername)
      .eq("source", "online_sync")

    const existingSet = new Set((existingRows ?? []).map((r) => (r.game_signature as string | null) ?? "").filter(Boolean))

    for (const row of matches) {
      if (newGamesImported >= maxNewGamesPerServer) break
      const version = (row.v ?? row.version ?? "").trim()
      const end = (row.end ?? "").trim()
      const score = (row.sc ?? "").trim()
      const name = (row.name ?? "").trim()
      if (!name || !end) continue

      const signature = computeGameSignature(server.abbreviation, name, end, version, score)
      if (existingSet.has(signature)) {
        duplicatesSkipped++
        continue
      }

      const morgueUrl = buildCdiMorgueUrl(name, end)
      let rawMorgue: string
      try {
        let url = morgueUrl
        let morgueRes = await fetch(url, { cache: "no-store" })
        if (!morgueRes.ok) {
          // Try a best-effort fallback by scanning the user's morgue directory.
          const altUrl = await findCdiMorgueUrlByTime(name, end)
          if (!altUrl) {
            throw new Error(`Failed to fetch morgue from ${url}: ${morgueRes.status} ${morgueRes.statusText}`)
          }
          url = altUrl
          morgueRes = await fetch(url, { cache: "no-store" })
          if (!morgueRes.ok) {
            throw new Error(`Failed to fetch morgue from ${url}: ${morgueRes.status} ${morgueRes.statusText}`)
          }
        }
        rawMorgue = await morgueRes.text()
      } catch (e) {
        errors.push(
          `Failed to fetch morgue for ${name} (${server.abbreviation}): ${
            e instanceof Error ? e.message : String(e)
          }`,
        )
        continue
      }

      try {
        const parsed = parseMorgue(rawMorgue)
        // Save raw morgue so existing features (browser, download, refresh) work unchanged.
        const { data: morgueFile, error: insertFileErr } = await supabase
          .from("morgue_files")
          .insert({
            user_id: userId,
            filename: `online-${server.abbreviation}-${name}-${end}.txt`,
            raw_text: rawMorgue,
          })
          .select("id")
          .single()

        if (insertFileErr || !morgueFile) {
          errors.push(
            `Failed to insert morgue_files row for ${name} (${server.abbreviation}): ${
              insertFileErr?.message ?? "unknown error"
            }`,
          )
          continue
        }

        const rowForDb = parsedToRow(morgueFile.id, userId, parsed)
        const insertPayload = {
          ...rowForDb,
          source: "online_sync" as const,
          server_abbreviation: server.abbreviation,
          dcss_username: dcssUsername,
          game_signature: signature,
          short_id: nanoid(6),
        }

        const { error: insertParsedErr } = await supabase.from("parsed_morgues").insert(insertPayload)
        if (insertParsedErr) {
          errors.push(
            `Failed to insert parsed_morgues row for ${name} (${server.abbreviation}): ${insertParsedErr.message}`,
          )
          // Best-effort cleanup of the orphaned morgue_files row.
          await supabase.from("morgue_files").delete().eq("id", morgueFile.id)
          continue
        }

        existingSet.add(signature)
        newGamesImported++
      } catch (e) {
        errors.push(
          `Failed to parse/store morgue for ${name} (${server.abbreviation}): ${
            e instanceof Error ? e.message : String(e)
          }`,
        )
      }
    }
  } catch (e) {
    status = "error"
    errors.push(e instanceof Error ? e.message : String(e))
  }

  return {
    dcssUsername,
    summary: {
      totalNewGamesImported: newGamesImported,
      totalDuplicatesSkipped: duplicatesSkipped,
    },
    servers: [
      {
        serverAbbreviation: server.abbreviation,
        status: errors.length > 0 && newGamesImported === 0 ? "error" : status,
        newGamesImported,
        duplicatesSkipped,
        errors,
      },
    ],
  }
}

