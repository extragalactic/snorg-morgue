export type DcssLogfileConfig = {
  /** Path to the logfile relative to the server base URL (or full URL if it starts with http). */
  path: string
  /** Human-readable version label, e.g. "0.34" or "git". */
  version: string
}

export type DcssServerConfig = {
  /** Human-readable server name (for UI/debugging only). */
  name: string
  /** Short code used by DCSS communities (e.g. CDI, CDO, CAO). */
  abbreviation: string
  /** Base URL used when constructing logfile URLs. */
  baseUrl: string
  /** Optional base URL for morgue files (not required for initial ingestion). */
  morgueUrl?: string
  /** Whether this server is currently dormant / archival only. */
  isDormant?: boolean
  /** Logfile definitions per version we ingest. */
  logfiles: DcssLogfileConfig[]
  /** Country or region (e.g. "USA", "Australia") for display in the import UI. */
  country?: string
  /** Total games on server (from dcss-stats or similar); used for sorting and display. */
  gameCount?: number
  /**
   * Unique players (if available). No public API provides this per server; dcss-stats
   * only exposes game counts. When set, the import UI shows "~X players" instead of "~X games".
   */
  userCount?: number
}

/** Primary server (official); always first in the list. */
const PRIMARY_ABBR = "CDI"

/**
 * DCSS public servers and logfiles to ingest.
 * Sorted by popularity: CDI first (official), then by gameCount descending.
 * Paths and versions from dcss-stats.com and the official DCSS infrastructure.
 */
const SERVERS_UNSORTED: DcssServerConfig[] = [
  {
    name: "crawl.dcss.io",
    abbreviation: "CDI",
    baseUrl: "https://crawl.dcss.io",
    morgueUrl: "https://crawl.dcss.io/crawl/morgue",
    country: "USA",
    gameCount: 495_992,
    logfiles: [
      { path: "/crawl/meta/crawl-0.34/logfile", version: "0.34" },
      { path: "/crawl/meta/crawl-git/logfile", version: "git" },
    ],
  },
  {
    name: "Akrasiac",
    abbreviation: "CAO",
    baseUrl: "http://crawl.akrasiac.org",
    morgueUrl: "http://crawl.akrasiac.org/rawdata",
    country: "USA",
    gameCount: 5_500_100,
    logfiles: [
      { path: "/logfile34", version: "0.34" },
      { path: "/logfile-git", version: "git" },
    ],
  },
  {
    name: "Webzook",
    abbreviation: "CWZ",
    baseUrl: "https://webzook.net",
    morgueUrl: "https://webzook.net/soup/morgue",
    country: "Unknown",
    gameCount: 2_407_885,
    logfiles: [
      { path: "/soup/trunk/logfile", version: "git" },
      { path: "/soup/0.34/logfile", version: "0.34" },
      { path: "/soup/0.33/logfile", version: "0.33" },
    ],
  },
  {
    name: "Underhound",
    abbreviation: "CUE",
    baseUrl: "https://underhound.eu",
    morgueUrl: "https://underhound.eu/crawl/morgue",
    country: "Netherlands",
    gameCount: 2_116_099,
    logfiles: [
      { path: "/crawl/meta/git/logfile", version: "git" },
      { path: "/crawl/meta/0.34/logfile", version: "0.34" },
      { path: "/crawl/meta/0.33/logfile", version: "0.33" },
    ],
  },
  {
    name: "Berotato",
    abbreviation: "CBRO",
    baseUrl: "http://crawl.berotato.org",
    morgueUrl: "http://crawl.berotato.org/crawl/morgue",
    country: "USA (Ohio)",
    gameCount: 1_742_240,
    logfiles: [
      { path: "/crawl/meta/git/logfile", version: "git" },
      { path: "/crawl/meta/0.34/logfile", version: "0.34" },
      { path: "/crawl/meta/0.33/logfile", version: "0.33" },
    ],
  },
  {
    name: "Xtahua",
    abbreviation: "CXC",
    baseUrl: "https://crawl.xtahua.com",
    morgueUrl: "https://crawl.xtahua.com/crawl/morgue",
    country: "France",
    gameCount: 1_702_256,
    logfiles: [
      { path: "/crawl/meta/git/logfile", version: "git" },
      { path: "/crawl/meta/0.34/logfile", version: "0.34" },
      { path: "/crawl/meta/0.33/logfile", version: "0.33" },
    ],
  },
  {
    name: "Berotato 2",
    abbreviation: "CBR2",
    baseUrl: "https://cbro.berotato.org",
    morgueUrl: "https://cbro.berotato.org/crawl/morgue",
    country: "USA (Ohio)",
    gameCount: 1_632_822,
    logfiles: [
      { path: "/meta/git/logfile", version: "git" },
      { path: "/meta/0.34/logfile", version: "0.34" },
      { path: "/meta/0.33/logfile", version: "0.33" },
    ],
  },
  {
    name: "Kelbi",
    abbreviation: "CKO",
    baseUrl: "https://crawl.kelbi.org",
    morgueUrl: "https://crawl.kelbi.org/crawl/morgue",
    country: "USA (New York)",
    gameCount: 1_473_634,
    isDormant: true,
    logfiles: [
      { path: "/crawl/meta/git/logfile", version: "git" },
      { path: "/crawl/meta/0.31/logfile", version: "0.31" },
    ],
  },
  {
    name: "crawl.develz.org",
    abbreviation: "CDO",
    baseUrl: "https://crawl.develz.org",
    morgueUrl: "https://crawl.develz.org/morgues",
    country: "USA",
    gameCount: 1_102_994,
    logfiles: [
      { path: "/allgames-svn.txt", version: "git" },
      { path: "/allgames-0.27", version: "0.27" },
    ],
  },
  {
    name: "Project 357",
    abbreviation: "CPO",
    baseUrl: "https://crawl.project357.org",
    morgueUrl: "https://crawl.project357.org/morgue",
    country: "Australia",
    gameCount: 621_048,
    logfiles: [
      { path: "/dcss-logfiles-trunk", version: "git" },
      { path: "/dcss-logfiles-0.34", version: "0.34" },
      { path: "/dcss-logfiles-0.33", version: "0.33" },
    ],
  },
  {
    name: "Nemelex",
    abbreviation: "CNC",
    baseUrl: "https://archive.nemelex.cards",
    morgueUrl: "https://archive.nemelex.cards/morgue",
    country: "Unknown",
    gameCount: 522_811,
    logfiles: [
      { path: "/meta/crawl-0.34/logfile", version: "0.34" },
      { path: "/meta/crawl-git/logfile", version: "git" },
    ],
  },
  {
    name: "Lazy Life",
    abbreviation: "LLD",
    baseUrl: "http://lazy-life.ddo.jp",
    morgueUrl: "http://lazy-life.ddo.jp/crawl/morgue",
    country: "Japan",
    gameCount: 165_332,
    logfiles: [
      { path: "/mirror/meta/trunk/logfile", version: "git" },
      { path: "/mirror/meta/0.34/logfile", version: "0.34" },
      { path: "/mirror/meta/0.33/logfile", version: "0.33" },
    ],
  },
]

/** Sorted: CDI first, then by gameCount descending (dormant last). */
export const DCSS_SERVERS: readonly DcssServerConfig[] = (() => {
  const primary = SERVERS_UNSORTED.find((s) => s.abbreviation === PRIMARY_ABBR)
  const rest = SERVERS_UNSORTED.filter((s) => s.abbreviation !== PRIMARY_ABBR)
  rest.sort((a, b) => {
    if (a.isDormant && !b.isDormant) return 1
    if (!a.isDormant && b.isDormant) return -1
    const ga = a.gameCount ?? 0
    const gb = b.gameCount ?? 0
    return gb - ga
  })
  return primary ? [primary, ...rest] : rest
})()
