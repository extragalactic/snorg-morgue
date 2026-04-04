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
  statistics: "analysis",
  /** Legacy path; same tab as statistics */
  analytics: "analysis",
  /** Skill / winning analysis tab */
  analysis: "skills",
  /** Legacy path; same tab as analysis */
  skills: "skills",
  achievements: "achievements",
  morgues: "morgues",
  // resources: "extras", // Hidden - uncomment to restore
}

/** Map dashboard tab id -> canonical URL segment */
export const TAB_TO_PAGE: Record<string, string> = {
  analysis: "statistics",
  skills: "analysis",
  achievements: "achievements",
  morgues: "morgues",
  // extras: "resources", // Hidden - uncomment to restore
}

export const VALID_PAGES = Object.keys(PAGE_TO_TAB)
