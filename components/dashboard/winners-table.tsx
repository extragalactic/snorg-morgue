"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import type { GameRecord } from "@/lib/morgue-api"
import { MorgueViewerModal } from "./morgue-viewer-modal"

const STICKY_TABLE_HEAD =
  "sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--primary)/0.2)]"

/** One step larger than the Morgue Files table (`text-sm`). */
const WINNERS_TABLE_TEXT = "font-mono text-base"
const INITIAL_VISIBLE = 30
const LOAD_MORE = 20

type SortField = "order" | "character" | "species" | "background" | "god" | "runes" | "defense"
type SortDirection = "asc" | "desc"

function dateCompareNewestFirst(a: GameRecord, b: GameRecord): number {
  return b.date.localeCompare(a.date) || b.xl - a.xl || a.id.localeCompare(b.id)
}

function splitCharacterName(character: string): { name: string; title: string | null } {
  const trimmed = character.trim()
  const title = formatCharacterEpithetDisplay(trimmed)
  if (!title) return { name: trimmed, title: null }
  const base = trimmed.replace(/\s+the\s+.+$/i, "").trim()
  return { name: base || trimmed, title }
}

function defenseTotal(game: GameRecord): number {
  return (game.ac ?? 0) + (game.ev ?? 0) + (game.sh ?? 0)
}

function compareWinners(
  a: GameRecord,
  b: GameRecord,
  field: SortField,
  direction: SortDirection,
  orderById: Map<string, number>,
): number {
  let comparison = 0
  switch (field) {
    case "order":
      comparison = (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0)
      break
    case "character":
      comparison = a.character.localeCompare(b.character, undefined, { sensitivity: "base" })
      break
    case "species":
      comparison = (a.species ?? "").localeCompare(b.species ?? "", undefined, { sensitivity: "base" })
      break
    case "background":
      comparison = (a.background ?? "").localeCompare(b.background ?? "", undefined, {
        sensitivity: "base",
      })
      break
    case "god": {
      const godA = (a.god ?? "").trim() || "—"
      const godB = (b.god ?? "").trim() || "—"
      comparison = godA.localeCompare(godB, undefined, { sensitivity: "base" })
      break
    }
    case "runes":
      comparison = (a.runes ?? 0) - (b.runes ?? 0)
      break
    case "defense":
      comparison = defenseTotal(a) - defenseTotal(b)
      break
  }
  if (comparison === 0 && field !== "order") {
    comparison = dateCompareNewestFirst(a, b)
  }
  return direction === "asc" ? comparison : -comparison
}

function WinnerRow({
  game,
  order,
  onView,
}: {
  game: GameRecord
  order: number
  onView: (game: GameRecord) => void
}) {
  const { name, title } = splitCharacterName(game.character)
  return (
    <TableRow
      className="border-b border-primary/10 hover:bg-primary/5 cursor-pointer"
      onClick={() => onView(game)}
    >
      <TableCell className={cn(WINNERS_TABLE_TEXT, "text-muted-foreground tabular-nums w-14")}>
        {order}
      </TableCell>
      <TableCell className={WINNERS_TABLE_TEXT}>
        <div className="text-primary">{name}</div>
        {title && <div className={cn(WINNERS_TABLE_TEXT, "text-muted-foreground")}>{title}</div>}
      </TableCell>
      <TableCell className={cn(WINNERS_TABLE_TEXT, "text-foreground")}>{game.species}</TableCell>
      <TableCell className={cn(WINNERS_TABLE_TEXT, "text-foreground")}>{game.background}</TableCell>
      <TableCell className={cn(WINNERS_TABLE_TEXT, "text-foreground")}>
        {(game.god ?? "").trim() || "—"}
      </TableCell>
      <TableCell className={cn(WINNERS_TABLE_TEXT, "text-foreground tabular-nums")}>
        {game.runes ?? 0}
      </TableCell>
      <TableCell className={cn(WINNERS_TABLE_TEXT, "text-foreground tabular-nums")}>
        {defenseTotal(game)}
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
  const [sortField, setSortField] = useState<SortField>("order")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const scrollRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLTableRowElement>(null)

  /** Date-based rank: 1 = most recent win (default Order sort shows 1, 2, 3… top to bottom). */
  const orderById = useMemo(() => {
    const byDate = morgues
      .filter((m) => m.result === "win")
      .sort(dateCompareNewestFirst)
    const map = new Map<string, number>()
    byDate.forEach((g, i) => map.set(g.id, i + 1))
    return map
  }, [morgues])

  const winners = useMemo(() => {
    const wins = morgues.filter((m) => m.result === "win")
    return [...wins].sort((a, b) => compareWinners(a, b, sortField, sortDirection, orderById))
  }, [morgues, sortField, sortDirection, orderById])

  const winnerKey = useMemo(() => winners.map((w) => w.id).join(","), [winners])
  const sortKey = `${sortField}:${sortDirection}`

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [winnerKey, sortKey])

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
  }, [hasMore, winners.length, visibleCount, winnerKey, sortKey])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      // Order defaults to ascending (1 = newest at top); other columns start ascending A→Z / low→high.
      setSortDirection("asc")
    }
  }

  const SortableHeader = ({
    field,
    children,
  }: {
    field: SortField
    children: React.ReactNode
  }) => (
    <TableHead
      className={cn(
        STICKY_TABLE_HEAD,
        WINNERS_TABLE_TEXT,
        "cursor-pointer select-none text-primary hover:bg-background",
      )}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field &&
          (sortDirection === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ))}
      </div>
    </TableHead>
  )

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
                <SortableHeader field="order">Order</SortableHeader>
                <SortableHeader field="character">Name &amp; title</SortableHeader>
                <SortableHeader field="species">Species</SortableHeader>
                <SortableHeader field="background">Background</SortableHeader>
                <SortableHeader field="god">God</SortableHeader>
                <SortableHeader field="runes">Runes</SortableHeader>
                <SortableHeader field="defense">Defense</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleWinners.map((game) => (
                <WinnerRow
                  key={game.id}
                  game={game}
                  order={orderById.get(game.id) ?? 0}
                  onView={setViewingMorgue}
                />
              ))}
              {hasMore && (
                <TableRow ref={loadMoreRef} className="border-0 hover:bg-transparent">
                  <TableCell colSpan={7} className={cn("py-3 text-center", typography.bodyMuted, WINNERS_TABLE_TEXT)}>
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
