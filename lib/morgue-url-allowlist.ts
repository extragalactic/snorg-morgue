import { DCSS_SERVERS } from "@/lib/dcss-public-sources"

/** Allowed morgue URL prefixes (from known DCSS servers). Used to avoid SSRF. */
const ALLOWED_MORGUE_PREFIXES = DCSS_SERVERS.filter((s) => s.morgueUrl).map((s) =>
  s.morgueUrl!.toLowerCase().replace(/\/$/, ""),
)

/**
 * Returns true if the URL is an allowed DCSS server morgue URL (safe for proxy fetch).
 */
export function isAllowedMorgueUrl(href: string): boolean {
  try {
    const url = new URL(href)
    const origin = `${url.protocol}//${url.host}`.toLowerCase()
    const path = url.pathname || "/"
    const full = (origin + path).toLowerCase().replace(/\/$/, "")
    return ALLOWED_MORGUE_PREFIXES.some(
      (prefix) => full === prefix || full.startsWith(prefix + "/"),
    )
  } catch {
    return false
  }
}
