"use client"

import { useState, useEffect, useMemo } from "react"
import { ArrowLeft, Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { fetchRawMorgue } from "@/lib/morgue-api"
import type { GameRecord } from "@/lib/morgue-api"
import { useTheme } from "@/contexts/theme-context"
import { typography } from "@/lib/typography"
import { colors } from "@/lib/colors"
import { parseMorgue } from "@/lib/morgue-parser"

/** Section titles as they appear in morgue files (order = typical appearance). Match with line.trim().startsWith(title). */
const MORGUE_SECTION_TITLES = [
  "Inventory:",
  "Hand Weapons",
  "Missiles",
  "Armour",
  "Jewellery",
  "Wands",
  "Scrolls",
  "Potions",
  "Miscellaneous",
  "Skills:",
  "Your Spells",
  "Spells",
  "Dungeon Overview and Level Annotations",
  "Branches:",
  "Altars:",
  "Shops:",
  "Annotations:",
  "Innate Abilities, Weirdness & Mutations",
  "Message History",
  "Vanquished Creatures",
  "Notes",
  "Illustrated notes",
] as const

/** Subsections under Inventory - shown in content but only one "Inventory" nav button. */
const INVENTORY_SUB_SECTIONS = new Set([
  "Hand Weapons",
  "Missiles",
  "Armour",
  "Jewellery",
  "Wands",
  "Scrolls",
  "Potions",
  "Miscellaneous",
])

/** Subsections under Dungeon Overview - shown in content but only one "Dungeon Overview" nav button. */
const DUNGEON_OVERVIEW_SUB_SECTIONS = new Set([
  "Branches:",
  "Altars:",
  "Shops:",
  "Annotations:",
])

function slugForSection(title: string): string {
  return "morgue-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

interface MorgueSegment {
  id: string
  title: string
  text: string
}

/** Find section start line indices, then split raw text into segments (intro + one per section). */
function parseMorgueSections(rawText: string): { segments: MorgueSegment[]; sectionTitles: { id: string; title: string }[] } {
  const lines = rawText.split(/\r?\n/)
  const found: { index: number; title: string }[] = []
  for (const title of MORGUE_SECTION_TITLES) {
    const i = lines.findIndex((line) => line.trim().startsWith(title))
    if (i >= 0) found.push({ index: i, title })
  }
  const skillUsageLineIndex = lines.findIndex((line) => /^Skill\s+XL:/.test(line.trim()))
  if (skillUsageLineIndex >= 0) {
    found.push({ index: skillUsageLineIndex, title: "Skill Usage History" })
  }
  // Sort by line index, dedupe by title (e.g. "Vanquished Creatures" appears 3 times - keep first)
  found.sort((a, b) => a.index - b.index)
  const seen = new Set<string>()
  const starts: { index: number; title: string }[] = []
  for (const { index, title } of found) {
    if (seen.has(title)) continue
    seen.add(title)
    starts.push({ index, title })
  }
  // Build nav buttons: Summary first, then Inventory (single button for Inventory: + subsections), then rest (skip inventory subsections)
  const sectionTitles: { id: string; title: string }[] = []
  sectionTitles.push({ id: "morgue-intro", title: "Summary" })
  for (const { title } of starts) {
    if (INVENTORY_SUB_SECTIONS.has(title)) continue
    if (title === "Inventory:") {
      sectionTitles.push({ id: slugForSection(title), title: "Inventory" })
      continue
    }
    if (DUNGEON_OVERVIEW_SUB_SECTIONS.has(title)) continue
    if (title === "Dungeon Overview and Level Annotations") {
      sectionTitles.push({ id: slugForSection(title), title: "Dungeon Overview" })
      continue
    }
    if (title === "Spells") continue
    if (title === "Your Spells") {
      sectionTitles.push({ id: slugForSection(title), title: "Spells" })
      continue
    }
    if (title === "Illustrated notes") {
      sectionTitles.push({ id: slugForSection(title), title: "Illustrated Notes" })
      continue
    }
    if (title === "Skill Usage History") {
      sectionTitles.push({ id: slugForSection(title), title: "Skill History" })
      continue
    }
    sectionTitles.push({ id: slugForSection(title), title: title.replace(/:$/, "") })
  }

  if (starts.length === 0) {
    return { segments: [{ id: "morgue-intro", title: "", text: rawText }], sectionTitles: [{ id: "morgue-intro", title: "Summary" }] }
  }

  const segments: MorgueSegment[] = []
  if (starts[0].index > 0) {
    segments.push({
      id: "morgue-intro",
      title: "",
      text: lines.slice(0, starts[0].index).join("\n"),
    })
  } else {
    segments.push({ id: "morgue-intro", title: "", text: "" })
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index
    const end = i + 1 < starts.length ? starts[i + 1].index : lines.length
    segments.push({
      id: slugForSection(starts[i].title),
      title: starts[i].title,
      text: lines.slice(start, end).join("\n"),
    })
  }
  return { segments, sectionTitles }
}

interface MorgueBrowserProps {
  game: GameRecord
  onBack: () => void
  /** When true, hide the back button (e.g. when used inside a modal that has its own back button). */
  hideBackButton?: boolean
  /** Label for the back button. Default: "Back to Morgues". */
  backButtonLabel?: string
  /** When false, hide the Download button (e.g. for public non-owner view). Default true. */
  showDownloadButton?: boolean
  /** When provided (e.g. from public API), use this instead of fetching raw morgue. */
  initialRawText?: string | null
  /** When provided with initialRawText, use as filename for download. */
  initialFilename?: string
  /** When true, fill available vertical space (e.g. in modal) instead of fixed height. */
  fillHeight?: boolean
  /** When provided, show Share button that copies this full URL to the clipboard. */
  shareUrl?: string
  /** When provided (and shareUrl not set), show Share button that copies origin + this path. Use so the button appears on first paint. */
  sharePath?: string
  /** When true, hide the win/death badge in the header. */
  hideResultBadge?: boolean
  /** When true, hide the LEVEL N and character/date subtitle row. */
  hideLevelTitle?: boolean
  /** When true, parse raw morgue text when loaded and use species/background/god for the title (for URL viewer). */
  useParsedHeaderFromRaw?: boolean
}

function formatGodName(god: string | null | undefined): string {
  const name = (god ?? "").trim()
  if (!name) return ""
  if (name.includes("the Shining One")) {
    return name.replace("the Shining One", "The Shining One")
  }
  return name
}

export function MorgueBrowser({ game, onBack, hideBackButton, showDownloadButton = true, backButtonLabel = "Back to Morgues", initialRawText, initialFilename, fillHeight, shareUrl, sharePath, hideResultBadge, hideLevelTitle, useParsedHeaderFromRaw }: MorgueBrowserProps) {
  const [rawText, setRawText] = useState<string | null>(initialRawText ?? null)
  const [filename, setFilename] = useState<string>(initialFilename ?? "")
  const [loading, setLoading] = useState(!initialRawText)
  const [error, setError] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const { themeStyle } = useTheme()

  const parsedFromRaw = useMemo(() => {
    if (!useParsedHeaderFromRaw || !rawText) return null
    try {
      return parseMorgue(rawText)
    } catch {
      return null
    }
  }, [useParsedHeaderFromRaw, rawText])

  const headerSpecies = parsedFromRaw?.species ?? game.species
  const headerBackground = parsedFromRaw?.background ?? game.background
  const headerGod = parsedFromRaw?.god ?? game.god
  const headerCharacter = parsedFromRaw?.characterName ?? game.character
  const headerDate = parsedFromRaw?.gameCompletionDate ?? game.date

  const canShare = !!(shareUrl || sharePath)
  /** Sync-imported morgues: fetch from DCSS server. Manual uploads: fetch from DB. */
  const fetchFromServer = !!game.morgueUrl
  const canDownload = showDownloadButton && !!game.morgueFileId
  const getShareUrl = () => {
    const base =
      shareUrl ||
      (typeof window !== "undefined" && sharePath ? window.location.origin + sharePath : "")
    if (!base) return ""
    const styleParam = themeStyle === "ascii" ? "2" : "1"
    try {
      const u = new URL(base)
      u.searchParams.set("s", styleParam)
      return u.toString()
    } catch {
      const sep = base.includes("?") ? "&" : "?"
      return `${base}${sep}s=${encodeURIComponent(styleParam)}`
    }
  }

  useEffect(() => {
    if (initialRawText !== undefined && !fetchFromServer) {
      setRawText(initialRawText)
      setFilename(initialFilename ?? "")
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      if (fetchFromServer && game.morgueUrl) {
        try {
          const proxyUrl = `/api/morgues/fetch-raw?url=${encodeURIComponent(game.morgueUrl)}`
          const res = await fetch(proxyUrl, { cache: "no-store" })
          if (cancelled) return
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            const msg = (body as { error?: string }).error ?? `Server returned ${res.status}`
            setError(msg)
            setLoading(false)
            return
          }
          const text = await res.text()
          if (cancelled) return
          setRawText(text)
          setFilename(game.morgueUrl.split("/").pop() ?? `morgue-${game.character}-${game.date}.txt`)
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Could not fetch morgue from server.")
          }
        }
        setLoading(false)
        return
      }
      if (!game.morgueFileId) {
        setError("Could not load morgue file.")
        setLoading(false)
        return
      }
      const data = await fetchRawMorgue(supabase, game.morgueFileId)
      if (cancelled) return
      if (data) {
        setRawText(data.raw_text)
        setFilename(data.filename)
      } else {
        setError("Could not load morgue file.")
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [game.morgueFileId, game.morgueUrl, game.character, game.date, initialRawText, initialFilename, fetchFromServer])

  const { segments, sectionTitles } = useMemo(() => {
    if (!rawText) return { segments: [] as MorgueSegment[], sectionTitles: [] as { id: string; title: string }[] }
    return parseMorgueSections(rawText)
  }, [rawText])

  const handleDownload = () => {
    if (!rawText) return
    const blob = new Blob([rawText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename || `morgue-${game.character}-${game.date}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const handleShare = async () => {
    const url = getShareUrl()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      setShareCopied(false)
    }
  }

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col" : "flex flex-col"}>
      <Card className={cn(fillHeight && "flex min-h-0 flex-1 flex-col overflow-hidden", "gap-0 border-2 border-primary/30 rounded-none")}>
        <CardHeader className="flex-shrink-0 border-b-2 border-primary/20 px-4 pt-2 pb-2 -mt-[15px]">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-3 min-w-0">
              {!hideBackButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("gap-2 rounded-none font-mono text-xs shrink-0", colors.inputBorder, colors.highlightHover)}
                  onClick={onBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {backButtonLabel}
                </Button>
              )}
              <p className={cn(typography.primaryTitle, "sm:text-xl truncate")}>
                {(() => {
                  const parts = [headerSpecies, headerBackground].filter(Boolean)
                  const base = parts.join(" ") || "Character"
                  const godName = formatGodName(headerGod)
                  return godName ? `${base} of ${godName}` : base
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!hideResultBadge && (
                <Badge
                  className={
                    game.result === "win"
                      ? cn("rounded-none", colors.successBadge)
                      : cn("rounded-none", colors.destructiveBadge)
                  }
                >
                  {game.result === "win" ? "Victory" : "Death"} — XL {game.xl}
                </Badge>
              )}
              {canShare && (
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("gap-2 rounded-none font-mono text-xs", colors.inputBorder, colors.highlightHoverText)}
                    onClick={handleShare}
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                  <span className={`absolute left-1/2 top-full -translate-x-1/2 mt-0.5 text-xs font-mono whitespace-nowrap ${shareCopied ? "text-muted-foreground" : "invisible"}`}>
                    {shareCopied ? "URL copied" : "\u00A0"}
                  </span>
                </div>
              )}
              {canDownload && (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("gap-2 rounded-none font-mono text-xs", colors.inputBorder, colors.highlightHoverText)}
                  onClick={handleDownload}
                  disabled={!rawText}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              )}
            </div>
          </div>
          {!hideLevelTitle && (
            <div className="flex items-center justify-between gap-2 mt-1">
              <div className="flex items-baseline gap-3 min-w-0 flex-wrap">
                <p className={cn(typography.subtitle, "tracking-wide")}>
                  {`LEVEL ${game.xl}`}
                </p>
                <p className={typography.bodyMonoMuted}>
                  {headerCharacter}
                  {headerDate && (
                    <span className="ml-1.5 text-muted-foreground/90">— {headerDate}</span>
                  )}
                </p>
              </div>
              {filename && (
                <p className={cn(typography.caption, "shrink-0 truncate max-w-[40%]")}>{filename}</p>
              )}
            </div>
          )}
          {sectionTitles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-primary/20 mt-1.5">
              {sectionTitles.map(({ id, title }) => (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  className="rounded-none border border-primary/40 bg-transparent font-mono text-xs text-muted-foreground py-1 h-auto hover:border-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => scrollToSection(id)}
                >
                  {title}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          <div
            className={fillHeight ? "min-h-0 flex-1 overflow-y-auto bg-background morgue-modal-scroll" : "h-[550px] overflow-y-auto bg-background"}
          >
            {loading && (
              <div className="p-8 flex items-center justify-center text-muted-foreground text-sm mt-[100px]">
                <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent rounded-full mr-2" />
                Loading…
              </div>
            )}
            {error && (
              <div className="p-8 text-center text-destructive text-sm">{error}</div>
            )}
            {rawText && !loading && segments.length > 0 && (
              <div className={typography.bodyLg}>
                {segments.map((seg) => (
                  <div key={seg.id} id={seg.id} className="p-4">
                    {seg.text.split(/\n/).map((line, i) => (
                      <div
                        key={`${seg.id}-${i}`}
                        className="whitespace-pre-wrap break-words hover:bg-primary/10 transition-colors -mx-4 px-4"
                      >
                        {line || "\u00A0"}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {rawText && !loading && segments.length === 0 && (
              <pre className="p-4 font-mono text-base leading-relaxed whitespace-pre-wrap break-words">
                {rawText}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
