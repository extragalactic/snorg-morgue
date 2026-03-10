/**
 * URL-safe slug from display name (e.g. "Snorg Bane" -> "snorg-bane").
 * Used for /[username]/[page] routes.
 */
export function slugifyUsername(name: string): string {
  if (!name || typeof name !== "string") return ""
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "user"
}

/** Map URL segment -> dashboard tab id */
export const PAGE_TO_TAB: Record<string, string> = {
  analytics: "analysis",
  achievements: "achievements",
  morgues: "morgues",
  resources: "extras",
}

/** Map dashboard tab id -> URL segment */
export const TAB_TO_PAGE: Record<string, string> = {
  analysis: "analytics",
  achievements: "achievements",
  morgues: "morgues",
  extras: "resources",
}

export const VALID_PAGES = Object.keys(PAGE_TO_TAB)
