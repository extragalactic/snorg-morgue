import { NextResponse } from "next/server"
import { DCSS_SERVERS } from "@/lib/dcss-public-sources"

/** Allowed morgue URL prefixes (from known DCSS servers). Used to avoid SSRF. */
const ALLOWED_MORGUE_PREFIXES = DCSS_SERVERS.filter((s) => s.morgueUrl).map(
  (s) => s.morgueUrl!.toLowerCase().replace(/\/$/, "")
)

function isAllowedUrl(href: string): boolean {
  try {
    const url = new URL(href)
    const origin = `${url.protocol}//${url.host}`.toLowerCase()
    const path = url.pathname || "/"
    const full = (origin + path).toLowerCase().replace(/\/$/, "")
    return ALLOWED_MORGUE_PREFIXES.some(
      (prefix) => full === prefix || full.startsWith(prefix + "/")
    )
  } catch {
    return false
  }
}

/**
 * Proxy fetch for raw morgue text from DCSS servers. Used when the viewer has
 * "Fetch morgue from DCSS server" enabled to avoid CORS blocking direct fetch.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get("url")?.trim()
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }
  if (!isAllowedUrl(url)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 })
  }
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: res.status === 404 ? 404 : 502 }
      )
    }
    const text = await res.text()
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
