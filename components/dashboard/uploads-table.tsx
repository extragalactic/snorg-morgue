"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, ChevronLeft, ChevronRight, Skull, Trophy, ChevronUp, ChevronDown, Trash2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilterToggleButton } from "@/components/ui/filter-toggle-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { colors } from "@/lib/colors"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { MorgueViewerModal } from "./morgue-viewer-modal"
import { supabase } from "@/lib/supabase"
import { deleteMorgue } from "@/lib/morgue-api"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"
import { DRACONIAN_COLOUR_NAMES, GOD_SHORT_FORMS, ALL_SPECIES_NAMES, ALL_BACKGROUND_NAMES, ALL_GOD_NAMES } from "@/lib/dcss-constants"
import type { GameRecord } from "@/lib/morgue-api"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { defaultMorguesTableSettings, useSettings } from "@/contexts/settings-context"

type ResultFilter = "all" | "win" | "death"
type SpeciesFilter = "all" | string
type BackgroundFilter = "all" | string
type GodFilter = "all" | string
type SortField = "character" | "combo" | "god" | "xl" | "place" | "duration" | "date" | "result"
type SortDirection = "asc" | "desc"

const DEFAULT_PAGE_SIZE = 15
const INITIAL_VISIBLE = 30
const LOAD_MORE = 20
const STICKY_TABLE_HEAD =
  "sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--primary)/0.2)]"

interface UploadsTableProps {
  morgues: GameRecord[]
  loading?: boolean
  onRefresh?: () => void
  /** When set, row click navigates to /usernameSlug/morgues/shortId for shareable URL. */
  usernameSlug?: string
  /** Grow with the parent flex column and use infinite scroll within available height. */
  fillViewportHeight?: boolean
  /** When true, hide delete and other mutations (e.g. viewing another user's morgues). */
  readOnly?: boolean
  /** Morgue owner UUID for Action History chart averages (browse mode vs own uploads). */
  actionAveragesUserId?: string | null
}

export function UploadsTable({
  morgues,
  loading,
  onRefresh,
  usernameSlug,
  fillViewportHeight,
  readOnly,
  actionAveragesUserId,
}: UploadsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userId } = useAuth()
  const { settings, setSettings } = useSettings()
  const [currentPage, setCurrentPage] = useState(1)
  const [viewingMorgue, setViewingMorgue] = useState<GameRecord | null>(null)
  const viewId = searchParams.get("view")

  useEffect(() => {
    if (!viewId || morgues.length === 0) return
    const game = morgues.find((m) => m.shortId === viewId || m.id === viewId)
    if (game) setViewingMorgue(game)
  }, [viewId, morgues])

  const [deleteConfirmGame, setDeleteConfirmGame] = useState<GameRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [resultFilter, setResultFilter] = useState<ResultFilter>(settings.morguesTable.resultFilter as ResultFilter)
  const [speciesFilter, setSpeciesFilter] = useState<SpeciesFilter>(settings.morguesTable.speciesFilter as SpeciesFilter)
  const [backgroundFilter, setBackgroundFilter] = useState<BackgroundFilter>(settings.morguesTable.backgroundFilter as BackgroundFilter)
  const [godFilter, setGodFilter] = useState<GodFilter>(settings.morguesTable.godFilter as GodFilter)
  const [sortField, setSortField] = useState<SortField | null>(settings.morguesTable.sortField as SortField | null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(settings.morguesTable.sortDirection as SortDirection)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const scrollRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef<HTMLTableRowElement>(null)

  const itemsPerPage = DEFAULT_PAGE_SIZE

  // Keep local state in sync if settings change elsewhere
  useEffect(() => {
    setResultFilter(settings.morguesTable.resultFilter as ResultFilter)
    setSpeciesFilter(settings.morguesTable.speciesFilter as SpeciesFilter)
    setBackgroundFilter(settings.morguesTable.backgroundFilter as BackgroundFilter)
    setGodFilter(settings.morguesTable.godFilter as GodFilter)
    setSortField(settings.morguesTable.sortField as SortField | null)
    setSortDirection(settings.morguesTable.sortDirection as SortDirection)
  }, [settings.morguesTable])

  const updateMorguesSettings = (partial: Partial<typeof settings.morguesTable>) => {
    setSettings((prev) => ({
      ...prev,
      morguesTable: {
        ...prev.morguesTable,
        ...partial,
      },
    }))
  }

  const filtersAtDefault =
    resultFilter === "all" &&
    speciesFilter === "all" &&
    backgroundFilter === "all" &&
    godFilter === "all" &&
    sortField === null &&
    sortDirection === "asc" &&
    currentPage === 1 &&
    settings.morguesTable.searchQuery === ""

  const resetMorgueFilters = () => {
    setCurrentPage(1)
    setSettings((prev) => ({
      ...prev,
      morguesTable: { ...defaultMorguesTableSettings },
    }))
  }

  const getCombo = (game: GameRecord) => {
    const species = (game.species ?? "").trim()
    const background = (game.background ?? "").trim()
    const speciesPart =
      species === "Octopode"
        ? "Op"
        : species === "Merfolk"
          ? "Mf"
        : species === "Deep Elf"
          ? "DE"
        : species === "Draconian" || DRACONIAN_COLOUR_NAMES.includes(species)
          ? "Dr"
          : species === "Mountain Dwarf"
            ? "MD"
            : species === "Demigod"
              ? "Dg"
              : species === "Demonspawn"
                ? "Ds"
                : species === "Gargoyle"
                  ? "Gr"
                  : species.substring(0, 2)
    const backgroundCodes: Record<string, string> = {
      "Chaos Knight": "CK",
      "Fire Elementalist": "FE",
      "Ice Elementalist": "IE",
      "Air Elementalist": "AE",
      "Earth Elementalist": "EE",
      "Forgewright": "FW",
      "Hedge Wizard": "HW",
      "Warper": "Wr",
      "Wanderer": "Wn",
      "Necromancer": "Ne",
      "Conjurer": "Co",
    }
    const bgPart = background
      ? (backgroundCodes[background] ?? background.substring(0, 2))
      : ""
    return `${speciesPart}${bgPart}`
  }

  const filteredAndSortedData = useMemo(() => {
    let data = [...morgues]

    // Then filter by result
    if (resultFilter !== "all") {
      data = data.filter((game) => game.result === resultFilter)
    }

    // Then filter by species
    if (speciesFilter !== "all") {
      data = data.filter((game) => (game.species ?? "") === speciesFilter)
    }

    // Then filter by background
    if (backgroundFilter !== "all") {
      data = data.filter((game) => (game.background ?? "") === backgroundFilter)
    }

    // Then filter by god
    if (godFilter !== "all") {
      if (godFilter === "(no god)") {
        data = data.filter((game) => !(game.god ?? "").trim())
      } else {
        data = data.filter((game) => (game.god ?? "").trim() === godFilter)
      }
    }

    // Then sort if a sort field is selected
    if (sortField) {
      data = [...data].sort((a, b) => {
        let comparison = 0
        switch (sortField) {
          case "character":
            comparison = a.character.localeCompare(b.character)
            break
          case "combo":
            comparison = getCombo(a).localeCompare(getCombo(b))
            break
          case "god": {
            const godA = (a.god ?? "").trim() || "(no god)"
            const godB = (b.god ?? "").trim() || "(no god)"
            comparison = godA.localeCompare(godB)
            break
          }
          case "xl":
            comparison = a.xl - b.xl
            break
          case "place":
            comparison = a.place.localeCompare(b.place)
            break
          case "duration":
            comparison = a.duration.localeCompare(b.duration)
            break
          case "date":
            comparison = a.date.localeCompare(b.date)
            break
          case "result":
            comparison = a.result.localeCompare(b.result)
            break
        }
        return sortDirection === "asc" ? comparison : -comparison
      })
    }

    return data
  }, [morgues, resultFilter, speciesFilter, backgroundFilter, godFilter, sortField, sortDirection])

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedData.length / itemsPerPage) || 1)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage)

  const filteredDataKey = useMemo(
    () => filteredAndSortedData.map((d) => d.id).join(","),
    [filteredAndSortedData],
  )

  useEffect(() => {
    if (!fillViewportHeight) return
    setVisibleCount(INITIAL_VISIBLE)
    scrollRef.current?.scrollTo({ top: 0 })
  }, [fillViewportHeight, filteredDataKey])

  const displayData = fillViewportHeight
    ? filteredAndSortedData.slice(0, visibleCount)
    : paginatedData
  const hasMore = fillViewportHeight && visibleCount < filteredAndSortedData.length

  useEffect(() => {
    if (!fillViewportHeight) return
    const root = scrollRef.current
    const sentinel = loadMoreRef.current
    if (!root || !sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + LOAD_MORE, filteredAndSortedData.length))
        }
      },
      { root, rootMargin: "120px", threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fillViewportHeight, hasMore, filteredAndSortedData.length, visibleCount, filteredDataKey])

  const totalCount = morgues.length
  const filteredCount = filteredAndSortedData.length
  const pct = totalCount > 0 ? ((filteredCount / totalCount) * 100).toFixed(1) : "0.0"
  const gamesWord = (n: number) => (n === 1 ? "Game" : "Games")
  const titleText =
    filteredCount === totalCount
      ? `${totalCount} ${gamesWord(totalCount)}`
      : `${filteredCount} of ${totalCount} ${gamesWord(totalCount)} (${pct}%)`

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      const nextDir: SortDirection = sortDirection === "asc" ? "desc" : "asc"
      setSortDirection(nextDir)
      updateMorguesSettings({ sortDirection: nextDir })
    } else {
      setSortField(field)
      setSortDirection("asc")
      updateMorguesSettings({ sortField: field, sortDirection: "asc" })
    }
    setCurrentPage(1)
    updateMorguesSettings({ currentPage: 1 })
  }

  const SortableHeader = ({ field, children, className = "" }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={cn(
        "font-mono text-sm text-primary cursor-pointer hover:bg-primary/10 select-none",
        fillViewportHeight && cn(STICKY_TABLE_HEAD, "hover:bg-background"),
        className,
      )}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </TableHead>
  )

  // Full canonical lists for filter dropdowns; options not in data are shown muted and disabled
  const fullSpeciesList = useMemo(
    () => [...ALL_SPECIES_NAMES, ...DRACONIAN_COLOUR_NAMES],
    []
  )
  const speciesInData = useMemo(
    () =>
      new Set(
        morgues
          .map((m) => (m.species ?? "").trim())
          .filter((s) => s.length > 0)
      ),
    [morgues]
  )
  const backgroundsInData = useMemo(
    () =>
      new Set(
        morgues
          .map((m) => (m.background ?? "").trim())
          .filter((b) => b.length > 0)
      ),
    [morgues]
  )
  const godsInData = useMemo(
    () =>
      new Set(
        morgues.map((m) => (m.god ?? "").trim() || "(no god)")
      ),
    [morgues]
  )
  const getGodShort = (game: GameRecord) => {
    const god = (game.god ?? "").trim()
    if (!god) return "—"
    if (god.toLowerCase().includes("shining one")) return "TSO"
    return GOD_SHORT_FORMS[god] ?? god
  }
  const getGodShortFromName = (godName: string) => {
    if (!godName || godName === "(no god)") return "no god"
    if (godName.toLowerCase().includes("shining one")) return "TSO"
    return GOD_SHORT_FORMS[godName] ?? godName
  }

  const handleDeleteConfirm = async () => {
    const game = deleteConfirmGame
    if (!game || !userId) return
    setIsDeleting(true)
    const { error } = await deleteMorgue(supabase, userId, { id: game.id, morgueFileId: game.morgueFileId })
    setIsDeleting(false)
    setDeleteConfirmGame(null)
    if (error) {
      toast({ title: "Delete failed", description: error, variant: "destructive" })
      return
    }
    toast({ title: "Morgue removed", description: "Stats have been updated." })
    onRefresh?.()
  }

  if (loading) {
    return (
      <Card
        className={cn(
          "w-full min-w-0 border-2 border-primary/30 rounded-none",
          fillViewportHeight && "flex min-h-0 flex-1 flex-col gap-0 py-0",
        )}
      >
        <CardHeader
          className={cn("border-b-2 border-primary/20 py-3 px-4", fillViewportHeight && "shrink-0")}
        >
          <CardTitle>Games</CardTitle>
        </CardHeader>
        <CardContent className={cn("p-8", fillViewportHeight && "flex min-h-0 flex-1 items-center justify-center")}>
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <div className="h-4 w-4 animate-spin border-2 border-primary border-t-transparent rounded-full" />
            Loading morgues…
          </div>
        </CardContent>
      </Card>
    )
  }

  if (morgues.length === 0) {
    return (
      <Card
        className={cn(
          "w-full min-w-0 border-2 border-primary/30 rounded-none",
          fillViewportHeight && "flex min-h-0 flex-1 flex-col gap-0 py-0",
        )}
      >
        <CardHeader
          className={cn("border-b-2 border-primary/20 py-3 px-4", fillViewportHeight && "shrink-0")}
        >
          <CardTitle>0 Games</CardTitle>
        </CardHeader>
        <CardContent className={cn("p-8 text-center", fillViewportHeight && "flex min-h-0 flex-1 items-center justify-center")}>
          <p className="text-sm text-muted-foreground">
            Add morgue files by either syncing with the DCSS game servers or manually uploading the files from your computer.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card
      className={cn(
        "w-full min-w-0 border-2 border-primary/30 rounded-none",
        fillViewportHeight && "flex min-h-0 flex-1 flex-col gap-0 py-0",
      )}
    >
      <CardHeader
        className={cn(
          "border-b-2 border-primary/20 pt-3 pb-0 px-4",
          fillViewportHeight && "shrink-0",
        )}
      >
        <div className="flex w-full min-w-0 flex-col gap-0 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <CardTitle className="shrink-0">{titleText}</CardTitle>
          <div className="flex w-full min-w-0 flex-col gap-3 py-3 lg:w-auto lg:flex-row lg:flex-wrap lg:items-center lg:justify-end lg:gap-x-3 lg:gap-y-2">
            {/* Result Filter */}
            <div className="flex flex-wrap gap-1">
              {(["all", "win", "death"] as const).map((filter) => (
                <FilterToggleButton
                  key={filter}
                  selected={resultFilter === filter}
                  onClick={() => {
                    setResultFilter(filter)
                    setCurrentPage(1)
                    updateMorguesSettings({
                      resultFilter: filter,
                      currentPage: 1,
                    })
                  }}
                >
                  {filter === "all" ? "All" : filter === "win" ? "Wins" : "Deaths"}
                </FilterToggleButton>
              ))}
            </div>
            <div className="grid w-full min-w-0 grid-cols-3 gap-2 lg:flex lg:w-auto lg:shrink-0 lg:gap-x-3">
              {/* Species filter */}
              <div className="min-w-0">
                <Select
                  value={speciesFilter}
                  onValueChange={(value) => {
                    const v = value as SpeciesFilter
                    setSpeciesFilter(v)
                    setCurrentPage(1)
                    updateMorguesSettings({
                      speciesFilter: v,
                      currentPage: 1,
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-full min-w-0 rounded-none border-2 border-primary/50 bg-background font-mono text-sm lg:w-[196px] lg:shrink-0">
                    <SelectValue placeholder="Species" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2 border-primary/50 bg-background">
                    <SelectItem value="all" className="font-mono text-sm cursor-pointer">
                      All species
                    </SelectItem>
                    {fullSpeciesList.map((s) => {
                      const inData = speciesInData.has(s)
                      return (
                        <SelectItem
                          key={s}
                          value={s}
                          disabled={!inData}
                          className={`font-mono text-sm ${inData ? "cursor-pointer" : "text-muted-foreground opacity-70"}`}
                        >
                          {s}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              {/* Background filter */}
              <div className="min-w-0">
                <Select
                  value={backgroundFilter}
                  onValueChange={(value) => {
                    const v = value as BackgroundFilter
                    setBackgroundFilter(v)
                    setCurrentPage(1)
                    updateMorguesSettings({
                      backgroundFilter: v,
                      currentPage: 1,
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-full min-w-0 rounded-none border-2 border-primary/50 bg-background font-mono text-sm lg:w-[224px] lg:shrink-0">
                    <SelectValue placeholder="Background" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2 border-primary/50 bg-background">
                    <SelectItem value="all" className="font-mono text-sm cursor-pointer">
                      All backgrounds
                    </SelectItem>
                    {ALL_BACKGROUND_NAMES.map((b) => {
                      const inData = backgroundsInData.has(b)
                      return (
                        <SelectItem
                          key={b}
                          value={b}
                          disabled={!inData}
                          className={`font-mono text-sm ${inData ? "cursor-pointer" : "text-muted-foreground opacity-70"}`}
                        >
                          {b}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              {/* God filter */}
              <div className="min-w-0">
                <Select
                  value={godFilter}
                  onValueChange={(value) => {
                    const v = value as GodFilter
                    setGodFilter(v)
                    setCurrentPage(1)
                    updateMorguesSettings({
                      godFilter: v,
                      currentPage: 1,
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-full min-w-0 rounded-none border-2 border-primary/50 bg-background font-mono text-sm lg:w-[182px] lg:shrink-0">
                    <SelectValue placeholder="God" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2 border-primary/50 bg-background">
                    <SelectItem value="all" className="font-mono text-sm cursor-pointer">
                      All gods
                    </SelectItem>
                    {ALL_GOD_NAMES.map((g) => {
                      const inData = godsInData.has(g)
                      return (
                        <SelectItem
                          key={g}
                          value={g}
                          disabled={!inData}
                          className={`font-mono text-sm ${inData ? "cursor-pointer" : "text-muted-foreground opacity-70"}`}
                        >
                          {g}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              className="gap-2 shrink-0 rounded-none border-2 border-primary bg-background font-mono text-sm text-primary hover:bg-primary/10"
              onClick={resetMorgueFilters}
              disabled={filtersAtDefault}
              aria-label="Reset filters"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={cn("p-0", fillViewportHeight && "flex min-h-0 flex-1 flex-col overflow-hidden")}
      >
        <Table
          containerRef={fillViewportHeight ? scrollRef : undefined}
          containerClassName={cn(
            "w-full min-w-0 min-h-0",
            fillViewportHeight && "flex-1 overflow-y-auto overflow-x-auto",
          )}
        >
          <TableHeader>
            <TableRow className="border-b-2 border-primary/20 hover:bg-transparent">
              <SortableHeader field="character">Character</SortableHeader>
              <SortableHeader field="combo">Combo</SortableHeader>
              <SortableHeader field="god">God</SortableHeader>
              <SortableHeader field="xl">XL</SortableHeader>
              <SortableHeader field="place" className="hidden sm:table-cell">Place</SortableHeader>
              <SortableHeader field="duration" className="hidden md:table-cell">Duration</SortableHeader>
              <SortableHeader field="date">Date</SortableHeader>
              <SortableHeader field="result">Result</SortableHeader>
              <TableHead
                className={cn(
                  "font-mono text-sm text-primary text-right",
                  fillViewportHeight && STICKY_TABLE_HEAD,
                  readOnly ? "w-14" : "w-24",
                )}
              >
                {readOnly ? "View" : "Actions"}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {displayData.map((game) => (
                <TableRow
                  key={game.id}
                  className="border-b border-primary/10 hover:bg-primary/5 cursor-pointer"
                  onClick={() => setViewingMorgue(game)}
                >
                  <TableCell className="font-medium">{game.character}</TableCell>
                  <TableCell className="text-sm text-foreground">
                    {getCombo(game)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {getGodShort(game)}
                  </TableCell>
                  <TableCell>{game.xl}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {game.place?.startsWith("Orcish Mines")
                      ? game.place.replace("Orcish Mines", "Orc")
                      : game.place}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {game.duration}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{game.date}</TableCell>
                  <TableCell>
                    {game.result === "win" ? (
                      <Badge className={cn("rounded-none hover:bg-success/30", colors.successBadge)}>
                        <Trophy className="mr-1 h-3 w-3" />
                        Win
                      </Badge>
                    ) : (
                      <Badge className={cn("rounded-none hover:bg-destructive/30", colors.destructiveBadge)}>
                        <Skull className="mr-1 h-3 w-3" />
                        Death
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-none hover:bg-primary/20"
                        onClick={(e) => {
                          e.stopPropagation()
                          setViewingMorgue(game)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-8 w-8 rounded-none hover:bg-destructive/20", colors.destructive)}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmGame(game)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {hasMore && (
                <TableRow ref={loadMoreRef} className="border-0 hover:bg-transparent">
                  <TableCell
                    colSpan={9}
                    className="py-3 text-center font-mono text-sm text-muted-foreground"
                  >
                    Loading more…
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

        <AlertDialog open={!readOnly && !!deleteConfirmGame} onOpenChange={(open) => !open && setDeleteConfirmGame(null)}>
          <AlertDialogContent className="rounded-none border-2 border-primary/30">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono">Delete morgue?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this morgue file and update your stats. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="rounded-none border-2 font-mono text-sm"
                disabled={isDeleting}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-none border-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono text-sm"
                onClick={(e) => {
                  e.preventDefault()
                  handleDeleteConfirm()
                }}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {!fillViewportHeight && (
          <div className="flex items-center justify-between border-t-2 border-primary/20 p-4">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredAndSortedData.length)} of{" "}
              {filteredAndSortedData.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="group h-9 w-9 rounded-none border-2 border-primary/50"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-5 w-5 group-hover:text-primary" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="group h-9 w-9 rounded-none border-2 border-primary/50"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight className="h-5 w-5 group-hover:text-primary" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    <MorgueViewerModal
      game={viewingMorgue}
      onClose={() => {
        setViewingMorgue(null)
        if (usernameSlug) router.replace(`/${usernameSlug}/morgues`)
      }}
      usernameSlug={usernameSlug}
      actionAveragesUserId={actionAveragesUserId ?? userId}
      backLabel="Back to Morgue list"
    />
    </>
  )
}
