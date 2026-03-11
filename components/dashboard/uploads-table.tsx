"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, Eye, ChevronLeft, ChevronRight, Skull, Trophy, ChevronUp, ChevronDown, Trash2, X, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilterToggleButton } from "@/components/ui/filter-toggle-button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useTheme } from "@/contexts/theme-context"
import { toast } from "@/hooks/use-toast"
import { DRACONIAN_COLOUR_NAMES, GOD_SHORT_FORMS } from "@/lib/dcss-constants"
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

interface UploadsTableProps {
  morgues: GameRecord[]
  loading?: boolean
  onRefresh?: () => void
  /** When set, row click navigates to /usernameSlug/morgues/shortId for shareable URL. */
  usernameSlug?: string
}

export function UploadsTable({ morgues, loading, onRefresh, usernameSlug }: UploadsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userId } = useAuth()
  const { themeStyle } = useTheme()
  const { settings, setSettings } = useSettings()
  const [searchQuery, setSearchQuery] = useState(settings.morguesTable.searchQuery)
  const [currentPage, setCurrentPage] = useState(settings.morguesTable.currentPage)
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
  const itemsPerPage = 15

  // Keep local state in sync if settings change elsewhere
  useEffect(() => {
    setSearchQuery(settings.morguesTable.searchQuery)
    setCurrentPage(settings.morguesTable.currentPage)
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
            : species === "Demonspawn"
              ? "Ds"
              : species === "Gargoyle"
                ? "Gr"
                : species.substring(0, 2)
    const backgroundCodes: Record<string, string> = {
      "Fire Elementalist": "FE",
      "Ice Elementalist": "IE",
      "Air Elementalist": "AE",
      "Earth Elementalist": "EE",
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
    // First filter by search query (including combo)
    let data = morgues.filter((game) => {
      const combo = getCombo(game).toLowerCase()
      const query = searchQuery.toLowerCase()
      return (
        game.character.toLowerCase().includes(query) ||
        game.species.toLowerCase().includes(query) ||
        game.background.toLowerCase().includes(query) ||
        combo.includes(query)
      )
    })

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
  }, [morgues, searchQuery, resultFilter, speciesFilter, backgroundFilter, godFilter, sortField, sortDirection])

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage)
  const totalCount = morgues.length
  const filteredCount = filteredAndSortedData.length
  const titleText =
    filteredCount === totalCount
      ? `${totalCount} Morgue Files`
      : `${filteredCount} of ${totalCount} Morgue Files`

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
      className={`font-mono text-xs text-primary cursor-pointer hover:bg-primary/10 select-none ${className}`}
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

  // Distinct species/background lists for filters
  const allSpecies = useMemo(
    () =>
      Array.from(
        new Set(
          morgues
            .map((m) => (m.species ?? "").trim())
            .filter((s) => s.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [morgues]
  )
  const allBackgrounds = useMemo(
    () =>
      Array.from(
        new Set(
          morgues
            .map((m) => (m.background ?? "").trim())
            .filter((b) => b.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [morgues]
  )
  const allGods = useMemo(
    () =>
      Array.from(
        new Set(
          morgues.map((m) => (m.god ?? "").trim() || "(no god)")
        )
      ).sort((a, b) => a.localeCompare(b)),
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
    const { error } = await deleteMorgue(supabase, userId, game.morgueFileId)
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
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle className="font-mono text-sm text-primary">Morgue Files</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
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
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle className="font-mono text-sm text-primary">0 Morgue Files</CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <p className="font-mono text-primary mb-2">No morgue files yet</p>
          <p className="text-sm text-muted-foreground">
            Upload morgue files using the &quot;Upload Morgue&quot; button above to list them here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="font-mono text-sm text-primary">
              {titleText}
            </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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
              <SelectTrigger className="w-[140px] rounded-none border-2 border-primary/50 font-mono text-xs h-8 bg-background">
                <SelectValue placeholder="Species" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-primary/50 bg-background">
                <SelectItem value="all" className="font-mono text-xs cursor-pointer">
                  All species
                </SelectItem>
                {allSpecies.map((s) => (
                  <SelectItem key={s} value={s} className="font-mono text-xs cursor-pointer">
                    {s}
                  </SelectItem>
                ))}
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
              <SelectTrigger className="w-[160px] rounded-none border-2 border-primary/50 font-mono text-xs h-8 bg-background">
                <SelectValue placeholder="Background" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-primary/50 bg-background">
                <SelectItem value="all" className="font-mono text-xs cursor-pointer">
                  All backgrounds
                </SelectItem>
                {allBackgrounds.map((b) => (
                  <SelectItem key={b} value={b} className="font-mono text-xs cursor-pointer">
                    {b}
                  </SelectItem>
                ))}
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
              <SelectTrigger className="w-[130px] rounded-none border-2 border-primary/50 font-mono text-xs h-8 bg-background">
                <SelectValue placeholder="God" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-primary/50 bg-background">
                <SelectItem value="all" className="font-mono text-xs cursor-pointer">
                  All gods
                </SelectItem>
                {allGods.map((g) => (
                  <SelectItem key={g} value={g} className="font-mono text-xs cursor-pointer">
                    {getGodShortFromName(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search morgues..."
                value={searchQuery}
                onChange={(e) => {
                  const value = e.target.value
                  setSearchQuery(value)
                  setCurrentPage(1)
                  updateMorguesSettings({
                    searchQuery: value,
                    currentPage: 1,
                  })
                }}
                className="rounded-none border-2 border-primary/50 bg-input pl-9 pr-9 text-sm focus:border-primary"
              />
              {searchQuery.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 rounded-none text-muted-foreground hover:text-foreground hover:bg-primary/10"
                  onClick={() => {
                    setSearchQuery("")
                    setCurrentPage(1)
                    updateMorguesSettings({
                      searchQuery: "",
                      currentPage: 1,
                    })
                  }}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
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
                <TableHead className="font-mono text-xs text-primary w-24 text-right">Actions</TableHead>
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
                  <TableCell className={`text-sm ${themeStyle === "ascii" ? "text-green-300" : "text-white"}`}>
                    {getCombo(game)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
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
                      <Badge className="rounded-none bg-green-500/20 text-green-500 border border-green-500/50 hover:bg-green-500/30">
                        <Trophy className="mr-1 h-3 w-3" />
                        Win
                      </Badge>
                    ) : (
                      <Badge className="rounded-none bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-none hover:bg-red-500/20 text-red-500"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmGame(game)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <AlertDialog open={!!deleteConfirmGame} onOpenChange={(open) => !open && setDeleteConfirmGame(null)}>
          <AlertDialogContent className="rounded-none border-2 border-primary/30">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono">Delete morgue?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this morgue file and update your stats. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="rounded-none border-2 font-mono text-xs"
                disabled={isDeleting}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-none border-2 bg-red-600 text-white hover:bg-red-700 font-mono text-xs"
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
        <div className="flex items-center justify-between border-t-2 border-primary/20 p-4">
          <p className="text-xs text-muted-foreground">
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
                  updateMorguesSettings({ currentPage: next })
                  return next
                })
              }}
            >
              <ChevronLeft className={`h-5 w-5 ${themeStyle === "ascii" ? "group-hover:text-green-400" : "group-hover:text-yellow-400"}`} />
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
                  updateMorguesSettings({ currentPage: next })
                  return next
                })
              }}
            >
              <ChevronRight className={`h-5 w-5 ${themeStyle === "ascii" ? "group-hover:text-green-400" : "group-hover:text-yellow-400"}`} />
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
              className="gap-2 rounded-none border-2 border-primary/50 hover:border-primary hover:bg-primary/10 hover:text-yellow-400 font-mono text-xs"
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
            />
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}
