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
}

/**
 * Minimal set of DCSS public servers and logfiles to ingest.
 *
 * This intentionally starts small (a few servers and versions) so we can
 * validate the ingestion pipeline before expanding coverage.
 *
 * The paths and versions are adapted from the public DCSS infrastructure and
 * the open source dcss-stats project.
 */
export const DCSS_SERVERS: readonly DcssServerConfig[] = [
  {
    name: "crawl.dcss.io",
    abbreviation: "CDI",
    baseUrl: "https://crawl.dcss.io",
    morgueUrl: "https://crawl.dcss.io/crawl/morgue",
    logfiles: [
      // Latest stable (0.34 at time of writing)
      {
        path: "/crawl/meta/crawl-0.34/logfile",
        version: "0.34",
      },
      // Trunk / git games
      {
        path: "/crawl/meta/crawl-git/logfile",
        version: "git",
      },
    ],
  },
  {
    name: "Nemelex",
    abbreviation: "CNC",
    baseUrl: "https://archive.nemelex.cards",
    morgueUrl: "https://archive.nemelex.cards/morgue",
    logfiles: [
      {
        path: "/meta/crawl-0.34/logfile",
        version: "0.34",
      },
      {
        path: "/meta/crawl-git/logfile",
        version: "git",
      },
    ],
  },
  {
    name: "crawl.develz.org",
    abbreviation: "CDO",
    baseUrl: "https://crawl.develz.org",
    morgueUrl: "https://crawl.develz.org/morgues",
    logfiles: [
      // Historical stable version still widely used in stats sites.
      {
        path: "/allgames-0.27",
        version: "0.27",
      },
      // Current combined logfile for trunk games on CDO.
      {
        path: "/allgames-svn.txt",
        version: "git",
      },
    ],
  },
  {
    name: "Akrasiac",
    abbreviation: "CAO",
    baseUrl: "http://crawl.akrasiac.org",
    morgueUrl: "http://crawl.akrasiac.org/rawdata",
    logfiles: [
      {
        path: "/logfile34",
        version: "0.34",
      },
      {
        path: "/logfile-git",
        version: "git",
      },
    ],
  },
] as const

