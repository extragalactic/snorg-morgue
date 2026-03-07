"use client"

import { useState, useMemo } from "react"
import { Search, Eye, ChevronLeft, ChevronRight, Skull, Trophy, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { MorgueBrowser } from "./morgue-browser"

type ResultFilter = "all" | "win" | "death"
type SortField = "character" | "combo" | "xl" | "place" | "duration" | "result"
type SortDirection = "asc" | "desc"

interface GameRecord {
  id: string
  character: string
  species: string
  background: string
  xl: number
  place: string
  turns: number
  duration: string
  date: string
  result: "win" | "death"
  runes: number
  killer?: string
}

const mockData: GameRecord[] = [
  {
    id: "1",
    character: "Grindor",
    species: "Minotaur",
    background: "Berserker",
    xl: 27,
    place: "Zot:5",
    turns: 98234,
    duration: "4:32:15",
    date: "2024-01-15",
    result: "win",
    runes: 15,
  },
  {
    id: "2",
    character: "Stonefist",
    species: "Gargoyle",
    background: "Fighter",
    xl: 18,
    place: "Vaults:4",
    turns: 45678,
    duration: "2:15:42",
    date: "2024-01-14",
    result: "death",
    runes: 3,
    killer: "vault sentinel",
  },
  {
    id: "3",
    character: "Splash",
    species: "Merfolk",
    background: "Gladiator",
    xl: 22,
    place: "Depths:3",
    turns: 67890,
    duration: "3:05:20",
    date: "2024-01-13",
    result: "death",
    runes: 5,
    killer: "caustic shrike",
  },
  {
    id: "4",
    character: "Crusher",
    species: "Troll",
    background: "Monk",
    xl: 27,
    place: "Zot:5",
    turns: 112345,
    duration: "5:18:33",
    date: "2024-01-12",
    result: "win",
    runes: 6,
  },
  {
    id: "5",
    character: "Firebreath",
    species: "Draconian",
    background: "Conjurer",
    xl: 14,
    place: "Lair:4",
    turns: 23456,
    duration: "1:12:08",
    date: "2024-01-11",
    result: "death",
    runes: 0,
    killer: "hydra",
  },
  {
    id: "6",
    character: "Axemaster",
    species: "Minotaur",
    background: "Fighter",
    xl: 27,
    place: "Zot:5",
    turns: 87654,
    duration: "4:05:17",
    date: "2024-01-10",
    result: "win",
    runes: 15,
  },
  {
    id: "7",
    character: "Rockwall",
    species: "Gargoyle",
    background: "Earth Elementalist",
    xl: 20,
    place: "Slime:5",
    turns: 54321,
    duration: "2:45:30",
    date: "2024-01-09",
    result: "death",
    runes: 4,
    killer: "the Royal Jelly",
  },
  {
    id: "8",
    character: "Venom",
    species: "Naga",
    background: "Venom Mage",
    xl: 16,
    place: "Spider:3",
    turns: 34567,
    duration: "1:38:22",
    date: "2024-01-08",
    result: "death",
    runes: 2,
    killer: "ghost moth",
  },
]

export function UploadsTable() {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [viewingMorgue, setViewingMorgue] = useState<GameRecord | null>(null)
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const itemsPerPage = 5

  const getCombo = (game: GameRecord) => 
    `${game.species.substring(0, 2)}${game.background.substring(0, 2)}`

  const filteredAndSortedData = useMemo(() => {
    // First filter by search query (including combo)
    let data = mockData.filter((game) => {
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
          case "xl":
            comparison = a.xl - b.xl
            break
          case "place":
            comparison = a.place.localeCompare(b.place)
            break
          case "duration":
            comparison = a.duration.localeCompare(b.duration)
            break
          case "result":
            comparison = a.result.localeCompare(b.result)
            break
        }
        return sortDirection === "asc" ? comparison : -comparison
      })
    }

    return data
  }, [searchQuery, resultFilter, sortField, sortDirection])

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
    setCurrentPage(1)
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

  // If viewing a morgue, show the Morgue Browser
  if (viewingMorgue) {
    return (
      <MorgueBrowser 
        game={viewingMorgue} 
        onBack={() => setViewingMorgue(null)} 
      />
    )
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="font-mono text-sm text-primary">
            MORGUE FILES
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Result Filter */}
            <div className="flex gap-1">
              {(["all", "win", "death"] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={resultFilter === filter ? "default" : "outline"}
                  size="sm"
                  className="rounded-none border-2 font-mono text-xs capitalize"
                  onClick={() => {
                    setResultFilter(filter)
                    setCurrentPage(1)
                  }}
                >
                  {filter === "all" ? "All" : filter === "win" ? "Wins" : "Deaths"}
                </Button>
              ))}
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search morgues..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="rounded-none border-2 border-primary/50 bg-input pl-9 text-sm focus:border-primary"
              />
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
                <SortableHeader field="xl">XL</SortableHeader>
                <SortableHeader field="place" className="hidden sm:table-cell">Place</SortableHeader>
                <SortableHeader field="duration" className="hidden md:table-cell">Duration</SortableHeader>
                <SortableHeader field="result">Result</SortableHeader>
                <TableHead className="font-mono text-xs text-primary w-12"></TableHead>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {getCombo(game)}
                  </TableCell>
                  <TableCell>{game.xl}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {game.place}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {game.duration}
                  </TableCell>
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
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

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
              className="h-8 w-8 rounded-none border-2 border-primary/50"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-none border-2 border-primary/50"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
