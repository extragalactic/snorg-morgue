import crypto from "crypto"

import { DCSS_SERVERS } from "./dcss-public-sources"
import {
  MAX_GAMES_PER_SERVER_PER_RUN,
  MAX_NEW_GAMES_PER_SERVER_PER_RUN,
  MAX_TOTAL_MORGUE_FETCHES_PER_RUN,
} from "./online-import-limits"
import type { DcssServerConfig } from "./dcss-public-sources"
import type { SupabaseClient } from "@supabase/supabase-js"
import { nanoid } from "nanoid"
import { parseMorgue } from "./morgue-parser"
import { parsedToRow } from "./morgue-db"
import { validateAndSanitizeParsedMorgue } from "./morgue-validation"

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

// Generic morgue URL pattern used by the supported servers:
// base: <server.morgueUrl> or a sensible default derived from baseUrl
// path: /<Name>/morgue-Name-YYYYMMDD-HHMMSS.txt
// The xlog "end" field sometimes contains trailing non-digit characters (e.g. timezone markers);
// we strip everything but the first 14 digits (YYYYMMDDHHMMSS) before formatting.
function buildMorgueUrl(server: DcssServerConfig, name: string, end: string) {
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

// Fallback helper: if the naive URL 404s, look at the user's morgue directory and
// try to find a file whose HHMMSS segment matches the xlog "end" time.
async function findMorgueUrlByTime(server: DcssServerConfig, name: string, end: string) {
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
  const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`morgue-${escapedName}-\\d{8}-${time}\\.txt`, "g")
  const match = regex.exec(html)
  if (!match || !match[0]) return null
  return `${base}/${encodeURIComponent(cleanName)}/${match[0]}`
}

function shortVersionFromFull(v: string | undefined): string | null {
  if (!v) return null
  const m = v.match(/^(\d+\.\d+)/)
  return m ? m[1] : null
}

/** Normalize username for matching: lowercase and treat digit 0 as letter o, 1 as l, so "0cean" matches "Ocean". */
function normalizeUsernameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "l")
}

async function collectMatchesForUsername(
  server: DcssServerConfig,
  dcssUsername: string,
  maxMatches: number,
): Promise<ParsedXlog[]> {
  const inputNormalized = normalizeUsernameForMatch(dcssUsername.trim())
  const matches: ParsedXlog[] = []

  // Include 0.32+ so games from older versions (e.g. 0.32) are found when their logfile is fetched.
  const allowedShortVersions = new Set(["0.32", "0.33", "0.34"])

  /** Timeout per logfile fetch so one slow/unreachable server (e.g. over VPN) doesn't hang the whole scan. */
  const LOGFILE_FETCH_MS = 18_000

  // Prefer newer logfiles first by iterating in reverse order.
  const logfiles = [...server.logfiles].reverse()

  for (const logfileCfg of logfiles) {
    if (matches.length >= maxMatches) break
    const logfileUrl = logfileCfg.path.startsWith("http")
      ? logfileCfg.path
      : `${server.baseUrl}${logfileCfg.path}`

    let text: string
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), LOGFILE_FETCH_MS)
      const res = await fetch(logfileUrl, {
        cache: "no-store",
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
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
      if (normalizeUsernameForMatch(name) !== inputNormalized) continue
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
  /** Optional allow-list of server abbreviations to scan. If omitted, all configured servers are scanned. */
  serverAbbreviations?: string[]
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

  const allowlist =
    options.serverAbbreviations && options.serverAbbreviations.length > 0
      ? new Set(options.serverAbbreviations)
      : null

  const serversToScan = DCSS_SERVERS.filter((server) =>
    allowlist ? allowlist.has(server.abbreviation) : true,
  )

  for (const server of serversToScan) {
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

      const existingSet = new Set(
        (existingRows ?? []).map((r) => (r.game_signature as string | null) ?? "").filter(Boolean),
      )
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
  }

  return { dcssUsername, servers: results }
}

interface ImportOptions extends ScanOptions {
  /** Maximum number of new games to import per server in a single run. Default: 3, capped by MAX_NEW_GAMES_PER_SERVER_PER_RUN. */
  maxNewGamesPerServer?: number
}

export async function runOnlineImport(
  supabase: SupabaseClient,
  userId: string,
  dcssUsername: string,
  options: ImportOptions = {},
): Promise<OnlineImportRunResult> {
  const requestedNew = options.maxNewGamesPerServer ?? 3
  const maxNewGamesPerServer = Math.min(
    Math.max(1, Math.floor(requestedNew)),
    MAX_NEW_GAMES_PER_SERVER_PER_RUN,
  )
  const requestedScan = options.maxGamesPerServer ?? maxNewGamesPerServer * 10
  const maxGamesPerServer = Math.min(
    Math.max(maxNewGamesPerServer, Math.floor(requestedScan)),
    MAX_GAMES_PER_SERVER_PER_RUN,
  )
  const allowlist =
    options.serverAbbreviations && options.serverAbbreviations.length > 0
      ? new Set(options.serverAbbreviations)
      : null

  const serversToImport = DCSS_SERVERS.filter((server) =>
    allowlist ? allowlist.has(server.abbreviation) : true,
  )

  const perServerResults: OnlineImportRunServerResult[] = []
  let totalImported = 0
  let totalDuplicates = 0
  let totalFetchedThisRun = 0

  for (const server of serversToImport) {
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

      const existingSet = new Set(
        (existingRows ?? []).map((r) => (r.game_signature as string | null) ?? "").filter(Boolean),
      )

      for (const row of matches) {
        if (newGamesImported >= maxNewGamesPerServer) break
        if (totalFetchedThisRun >= MAX_TOTAL_MORGUE_FETCHES_PER_RUN) break
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

        totalFetchedThisRun++
        const morgueUrl = buildMorgueUrl(server, name, end)
        let rawMorgue: string
        let resolvedMorgueUrl = morgueUrl
        try {
          let url = morgueUrl
          let morgueRes = await fetch(url, { cache: "no-store" })
          if (!morgueRes.ok) {
            // Try a best-effort fallback by scanning the user's morgue directory.
            const altUrl = await findMorgueUrlByTime(server, name, end)
            if (!altUrl) {
              throw new Error(`Failed to fetch morgue from ${url}: ${morgueRes.status} ${morgueRes.statusText}`)
            }
            url = altUrl
            morgueRes = await fetch(url, { cache: "no-store" })
            if (!morgueRes.ok) {
              throw new Error(`Failed to fetch morgue from ${url}: ${morgueRes.status} ${morgueRes.statusText}`)
            }
            resolvedMorgueUrl = altUrl
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
          const parsed = validateAndSanitizeParsedMorgue(parseMorgue(rawMorgue))
          // Sync-imported: store only parsed data and morgue_url; raw text is fetched from server when viewing.
          const rowForDb = parsedToRow(null, userId, parsed)
          const insertPayload = {
            ...rowForDb,
            source: "online_sync" as const,
            server_abbreviation: server.abbreviation,
            dcss_username: dcssUsername,
            game_signature: signature,
            short_id: nanoid(6),
            morgue_url: resolvedMorgueUrl,
          }

          const { error: insertParsedErr } = await supabase.from("parsed_morgues").insert(insertPayload)
          if (insertParsedErr) {
            errors.push(
              `Failed to insert parsed_morgues row for ${name} (${server.abbreviation}): ${insertParsedErr.message}`,
            )
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

    totalImported += newGamesImported
    totalDuplicates += duplicatesSkipped

    perServerResults.push({
      serverAbbreviation: server.abbreviation,
      status: errors.length > 0 && newGamesImported === 0 ? "error" : status,
      newGamesImported,
      duplicatesSkipped,
      errors,
    })
  }

  return {
    dcssUsername,
    summary: {
      totalNewGamesImported: totalImported,
      totalDuplicatesSkipped: totalDuplicates,
    },
    servers: perServerResults,
  }
}

