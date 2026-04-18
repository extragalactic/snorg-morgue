"use client"

import { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, ChevronLeft, ChevronRight, Skull, Trophy, ChevronUp, ChevronDown, Trash2, ArrowLeft } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MorgueBrowser } from "./morgue-browser"
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
import { useSettings } from "@/contexts/settings-context"

type ResultFilter = "all" | "win" | "death"
type SpeciesFilter = "all" | string
type BackgroundFilter = "all" | string
type GodFilter = "all" | string
type SortField = "character" | "combo" | "god" | "xl" | "place" | "duration" | "date" | "result"
type SortDirection = "asc" | "desc"

const DEFAULT_PAGE_SIZE = 15
const MIN_DYNAMIC_ROWS = 3
const FALLBACK_ROW_PX = 46
const FALLBACK_HEADER_PX = 41

interface UploadsTableProps {
  morgues: GameRecord[]
  loading?: boolean
  onRefresh?: () => void
  /** When set, row click navigates to /usernameSlug/morgues/shortId for shareable URL. */
  usernameSlug?: string
  /** Grow with the parent flex column and fit page size to available table body height. */
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
  const [measuredItemsPerPage, setMeasuredItemsPerPage] = useState(DEFAULT_PAGE_SIZE)
  const tableBodySlotRef = useRef<HTMLDivElement>(null)

  const itemsPerPage = fillViewportHeight ? measuredItemsPerPage : DEFAULT_PAGE_SIZE

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

  useLayoutEffect(() => {
    if (!fillViewportHeight) return
    const el = tableBodySlotRef.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      const theadRow = el.querySelector("thead tr")
      const headerH = theadRow?.getBoundingClientRect().height ?? FALLBACK_HEADER_PX
      const firstBodyRow = el.querySelector("tbody tr")
      const rowH = firstBodyRow?.getBoundingClientRect().height ?? FALLBACK_ROW_PX
      const available = rect.height - headerH
      if (available <= 0 || rowH <= 0) return
      const next = Math.max(MIN_DYNAMIC_ROWS, Math.floor(available / rowH))
      setMeasuredItemsPerPage((prev) => (prev === next ? prev : next))
    }

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [fillViewportHeight, loading, morgues.length, filteredAndSortedData.length, measuredItemsPerPage])
  const totalCount = morgues.length
  const filteredCount = filteredAndSortedData.length
  const pct = totalCount > 0 ? Math.round((filteredCount / totalCount) * 100) : 0
  const titleText =
    filteredCount === totalCount
      ? `${totalCount} Files`
      : `${filteredCount} of ${totalCount} Files (${pct}%)`

  useEffect(() => {
    if (!fillViewportHeight) return
    const tp = Math.max(1, Math.ceil(filteredAndSortedData.length / itemsPerPage) || 1)
    if (currentPage > tp) {
      setCurrentPage(tp)
      setSettings((prev) => ({
        ...prev,
        morguesTable: { ...prev.morguesTable, currentPage: tp },
      }))
    }
  }, [fillViewportHeight, filteredAndSortedData.length, itemsPerPage, currentPage, setSettings])

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
      className={`font-mono text-sm text-primary cursor-pointer hover:bg-primary/10 select-none ${className}`}
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
          fillViewportHeight && "min-h-0 flex-1 gap-0 py-0",
        )}
      >
        <CardHeader
          className={cn("border-b-2 border-primary/20 py-3 px-4", fillViewportHeight && "shrink-0")}
        >
          <CardTitle>Files</CardTitle>
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
          fillViewportHeight && "min-h-0 flex-1 gap-0 py-0",
        )}
      >
        <CardHeader
          className={cn("border-b-2 border-primary/20 py-3 px-4", fillViewportHeight && "shrink-0")}
        >
          <CardTitle>0 Files</CardTitle>
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
        fillViewportHeight && "min-h-0 flex-1 gap-0 py-0",
      )}
    >
      <CardHeader
        className={cn(
          "border-b-2 border-primary/20 pt-3 pb-0 px-4",
          fillViewportHeight && "shrink-0",
        )}
      >
        <div className="flex w-full min-w-0 flex-col gap-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <CardTitle className="shrink-0">{titleText}</CardTitle>
          <div className="flex w-full min-w-0 flex-col gap-3 py-3 sm:w-auto sm:flex-row sm:justify-end">
            {/* Result Filter */}
            <div className="flex gap-1">
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
            {/* Species filter */}
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
              <SelectTrigger className="w-[140px] rounded-none border-2 border-primary/50 font-mono text-sm h-8 bg-background">
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
            {/* Background filter */}
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
              <SelectTrigger className="w-[160px] rounded-none border-2 border-primary/50 font-mono text-sm h-8 bg-background">
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
            {/* God filter */}
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
              <SelectTrigger className="w-[130px] rounded-none border-2 border-primary/50 font-mono text-sm h-8 bg-background">
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
      </CardHeader>
      <CardContent
        className={cn("p-0", fillViewportHeight && "flex min-h-0 flex-1 flex-col overflow-hidden")}
      >
        <div
          ref={tableBodySlotRef}
          className={cn(
            "w-full min-w-0 min-h-0",
            fillViewportHeight && "flex-1 overflow-y-hidden",
          )}
        >
          <Table>
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
                <TableHead className={cn("font-mono text-sm text-primary text-right", readOnly ? "w-14" : "w-24")}>
                  {readOnly ? "View" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((game) => (
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
            </TableBody>
          </Table>
        </div>

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

        {/* Pagination */}
        <div
          className={cn(
            "flex items-center justify-between border-t-2 border-primary/20 p-4",
            fillViewportHeight && "shrink-0",
          )}
        >
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
              onClick={() => {
                setCurrentPage((p) => {
                  const next = p - 1
                  return next
                })
              }}
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
              onClick={() => {
                setCurrentPage((p) => {
                  const next = p + 1
                  return next
                })
              }}
            >
              <ChevronRight className="h-5 w-5 group-hover:text-primary" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    {viewingMorgue && (
      <Dialog
        open={!!viewingMorgue}
        onOpenChange={(open) => {
          if (!open) {
            setViewingMorgue(null)
            if (usernameSlug) router.replace(`/${usernameSlug}/morgues`)
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="morgue-detail-modal fixed left-1/2 top-5 bottom-5 m-0 flex h-[calc(100vh-40px)] w-[min(2400px,calc(100vw-100px))] max-w-none sm:max-w-none -translate-x-1/2 translate-y-0 flex-col gap-0 rounded-none border-2 border-primary/30 p-0"
        >
          <DialogHeader className="flex shrink-0 flex-row items-center gap-2 border-b-2 border-primary/20 px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-2 rounded-none font-mono text-sm", colors.inputBorder, colors.highlightHover)}
              onClick={() => {
                setViewingMorgue(null)
                if (usernameSlug) router.replace(`/${usernameSlug}/morgues`)
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Morgue list
            </Button>
            <DialogTitle className="sr-only">Morgue details</DialogTitle>
          </DialogHeader>
          <div className="morgue-modal-scroll flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <MorgueBrowser
              game={viewingMorgue}
              onBack={() => {
                setViewingMorgue(null)
                if (usernameSlug) router.replace(`/${usernameSlug}/morgues`)
              }}
              hideBackButton
              showDownloadButton
              fillHeight
              sharePath={usernameSlug && viewingMorgue ? `/${usernameSlug}/morgues/${viewingMorgue.shortId || viewingMorgue.id}` : undefined}
              actionAveragesUserId={actionAveragesUserId ?? userId}
            />
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}
