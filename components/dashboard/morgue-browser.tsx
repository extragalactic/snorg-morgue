"use client"

import { useState, useEffect, useMemo } from "react"
import { ArrowLeft, Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { fetchRawMorgue } from "@/lib/morgue-api"
import type { GameRecord } from "@/lib/morgue-api"
import { useTheme } from "@/contexts/theme-context"

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
  /** When true, hide the "Back to Morgues" button (e.g. when used inside a modal that has its own back button). */
  hideBackButton?: boolean
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
}

export function MorgueBrowser({ game, onBack, hideBackButton, showDownloadButton = true, initialRawText, initialFilename, fillHeight, shareUrl, sharePath }: MorgueBrowserProps) {
  const [rawText, setRawText] = useState<string | null>(initialRawText ?? null)
  const [filename, setFilename] = useState<string>(initialFilename ?? "")
  const [loading, setLoading] = useState(!initialRawText)
  const [error, setError] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const { themeStyle } = useTheme()

  const canShare = !!(shareUrl || sharePath)
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
    if (initialRawText !== undefined) {
      setRawText(initialRawText)
      setFilename(initialFilename ?? "")
      setLoading(false)
      return
    }
    let cancelled = false
    async function load() {
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
  }, [game.morgueFileId, initialRawText, initialFilename])

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
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
          {!hideBackButton && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 rounded-none border-2 border-primary/50 hover:border-primary hover:bg-primary/10 hover:text-yellow-400 font-mono text-xs"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Morgues
            </Button>
          )}
          <div>
            <h2 className="font-mono text-lg text-primary">{game.character}</h2>
            <p className="text-sm text-muted-foreground">
              {game.date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              game.result === "win"
                ? "rounded-none bg-green-500/20 text-green-400 border border-green-500/50"
                : "rounded-none bg-red-500/20 text-red-400 border border-red-500/50"
            }
          >
            {game.result === "win" ? "Victory" : "Death"} — XL {game.xl}
          </Badge>
          {canShare && (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 rounded-none border-2 border-primary/50 font-mono text-xs hover:text-yellow-400"
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
          {showDownloadButton && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-none border-2 border-primary/50 font-mono text-xs hover:text-yellow-400"
            onClick={handleDownload}
            disabled={!rawText}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
          )}
        </div>
      </div>

      <Card className={fillHeight ? "flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-primary/30 rounded-none" : "border-2 border-primary/30 rounded-none"}>
        <CardHeader className="flex-shrink-0 border-b-2 border-primary/20 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-lg sm:text-xl text-primary">
                {(() => {
                  const parts = [game.species, game.background].filter(Boolean)
                  const base = parts.join(" ") || "Character"
                  return game.god ? `${base} of ${game.god}` : base
                })()}
              </p>
              <p className="font-mono text-xs sm:text-sm text-muted-foreground tracking-wide">
                {`LEVEL ${game.xl}`}
              </p>
            </div>
            {filename && (
              <p className="text-xs text-muted-foreground">{filename}</p>
            )}
          </div>
          {sectionTitles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-primary/20 mt-2">
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
              <div className="p-8 flex items-center justify-center text-muted-foreground text-sm">
                <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent rounded-full mr-2" />
                Loading…
              </div>
            )}
            {error && (
              <div className="p-8 text-center text-destructive text-sm">{error}</div>
            )}
            {rawText && !loading && segments.length > 0 && (
              <div className="font-mono text-base leading-relaxed">
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
