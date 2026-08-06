"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { typography } from "@/lib/typography"
import { formatCharacterEpithetDisplay } from "@/lib/dcss-character-titles"
import { GOD_SHORT_FORMS } from "@/lib/dcss-constants"
import type { GameRecord } from "@/lib/morgue-api"
import { MorgueViewerModal } from "./morgue-viewer-modal"

const STICKY_TABLE_HEAD =
  "sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--primary)/0.2)]"

/** One step larger than the Morgue Files table (`text-sm`). */
const WINNERS_TABLE_TEXT = "font-mono text-base"
const INITIAL_VISIBLE = 30
const LOAD_MORE = 20

function splitCharacterName(character: string): { name: string; title: string | null } {
  const trimmed = character.trim()
  const title = formatCharacterEpithetDisplay(trimmed)
  if (!title) return { name: trimmed, title: null }
  const base = trimmed.replace(/\s+the\s+.+$/i, "").trim()
  return { name: base || trimmed, title }
}

function godLabel(god: string | undefined): string {
  const g = (god ?? "").trim()
  if (!g) return "—"
  if (g.toLowerCase().includes("shining one")) return "TSO"
  return GOD_SHORT_FORMS[g] ?? g
}

function WinnerRow({
  game,
  onView,
}: {
  game: GameRecord
  onView: (game: GameRecord) => void
}) {
  const { name, title } = splitCharacterName(game.character)
  return (
    <TableRow
      className="border-b border-primary/10 hover:bg-primary/5 cursor-pointer"
      onClick={() => onView(game)}
    >
      <TableCell className={WINNERS_TABLE_TEXT}>
        <div className="text-primary">{name}</div>
        {title && <div className={cn(WINNERS_TABLE_TEXT, "text-muted-foreground")}>{title}</div>}
      </TableCell>
      <TableCell className={cn(WINNERS_TABLE_TEXT, "text-foreground")}>{game.species}</TableCell>
      <TableCell className={cn(WINNERS_TABLE_TEXT, "text-foreground")}>{game.background}</TableCell>
      <TableCell className={cn(WINNERS_TABLE_TEXT, "text-foreground")}>{godLabel(game.god)}</TableCell>
      <TableCell className={cn(WINNERS_TABLE_TEXT, "text-foreground tabular-nums")}>
        {game.runes ?? 0}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-none hover:bg-primary/20"
          onClick={() => onView(game)}
          aria-label="View morgue"
        >
          <Eye className="h-5 w-5" />
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function WinnersTable({
  morgues = [],
  loading,
  usernameSlug,
  actionAveragesUserId,
}: {
  morgues?: GameRecord[]
  loading?: boolean
  usernameSlug?: string
  actionAveragesUserId?: string | null
}) {
  const [viewingMorgue, setViewingMorgue] = useState<GameRecord | null>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const scrollRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLTableRowElement>(null)

  const winners = useMemo(() => {
    return morgues
      .filter((m) => m.result === "win")
      .sort((a, b) => b.date.localeCompare(a.date) || b.xl - a.xl)
  }, [morgues])

  const winnerKey = useMemo(() => winners.map((w) => w.id).join(","), [winners])

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [winnerKey])

  const visibleWinners = winners.slice(0, visibleCount)
  const hasMore = visibleCount < winners.length

  useEffect(() => {
    const root = scrollRef.current
    const sentinel = loadMoreRef.current
    if (!root || !sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + LOAD_MORE, winners.length))
        }
      },
      { root, rootMargin: "120px", threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, winners.length, visibleCount, winnerKey])

  const titleText =
    winners.length === 0
      ? "0 Winners"
      : `${winners.length} ${winners.length === 1 ? "Winner" : "Winners"}`

  const cardClass = "w-full min-w-0 border-2 border-primary/30 rounded-none min-h-0 flex-1 gap-0 py-0 flex flex-col"

  if (loading) {
    return (
      <Card className={cardClass}>
        <CardHeader className="shrink-0 border-b-2 border-primary/20 pb-3 px-4 pt-3">
          <CardTitle>{titleText}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 items-center justify-center pt-4">
          <div className={cn("flex h-40 items-center justify-center", typography.bodyMuted, WINNERS_TABLE_TEXT)}>
            Loading…
          </div>
        </CardContent>
      </Card>
    )
  }

  if (winners.length === 0) {
    return (
      <Card className={cardClass}>
        <CardHeader className="shrink-0 border-b-2 border-primary/20 pb-3 px-4 pt-3">
          <CardTitle>0 Winners</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 items-center justify-center pt-4">
          <p className={cn(typography.bodyMuted, WINNERS_TABLE_TEXT)}>No winning characters yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className={cardClass}>
        <CardHeader className="shrink-0 border-b-2 border-primary/20 pb-3 px-4 pt-3">
          <CardTitle>{titleText}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <Table
            containerRef={scrollRef}
            containerClassName="min-h-0 flex-1 overflow-y-auto overflow-x-auto"
          >
            <TableHeader>
              <TableRow className="border-b-2 border-primary/20 hover:bg-transparent">
                <TableHead className={cn(STICKY_TABLE_HEAD, WINNERS_TABLE_TEXT, "text-primary")}>
                  Name &amp; title
                </TableHead>
                <TableHead className={cn(STICKY_TABLE_HEAD, WINNERS_TABLE_TEXT, "text-primary")}>
                  Species
                </TableHead>
                <TableHead className={cn(STICKY_TABLE_HEAD, WINNERS_TABLE_TEXT, "text-primary")}>
                  Background
                </TableHead>
                <TableHead className={cn(STICKY_TABLE_HEAD, WINNERS_TABLE_TEXT, "text-primary")}>
                  God
                </TableHead>
                <TableHead className={cn(STICKY_TABLE_HEAD, WINNERS_TABLE_TEXT, "text-primary")}>
                  Runes
                </TableHead>
                <TableHead
                  className={cn(STICKY_TABLE_HEAD, WINNERS_TABLE_TEXT, "text-primary text-right w-14")}
                >
                  View
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleWinners.map((game) => (
                <WinnerRow key={game.id} game={game} onView={setViewingMorgue} />
              ))}
              {hasMore && (
                <TableRow ref={loadMoreRef} className="border-0 hover:bg-transparent">
                  <TableCell colSpan={6} className={cn("py-3 text-center", typography.bodyMuted, WINNERS_TABLE_TEXT)}>
                    Loading more…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <MorgueViewerModal
        game={viewingMorgue}
        onClose={() => setViewingMorgue(null)}
        usernameSlug={usernameSlug}
        actionAveragesUserId={actionAveragesUserId}
      />
    </>
  )
}
