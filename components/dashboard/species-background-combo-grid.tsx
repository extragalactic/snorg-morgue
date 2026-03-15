"use client"

import { useMemo, useState, Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FilterToggleButton } from "@/components/ui/filter-toggle-button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ALL_SPECIES_NAMES, ALL_BACKGROUND_NAMES, GOD_SHORT_FORMS } from "@/lib/dcss-constants"
import type { GameRecord } from "@/lib/morgue-api"

/** Temporary: inject test wins for Troll Fighter to test tooltip with multiple gods. Remove later. */
const TEST_COMBO_TOOLTIP = true
const TEST_COMBO_KEY = "Troll|||Fighter"
const TEST_WIN_GODS = ["Dithmenos", "Dithmenos", "Okawaru", "Okawaru", "Makhleb"]

type Mode = "wins" | "attempts"

/**
 * Impossible species–background combinations (e.g. Felid Berserker, Demigod Brigand).
 * These cells are shown as disabled with a grey X.
 */
const DISABLED_COMBOS = new Set<string>([
  "Demigod|||Brigand",
  "Demigod|||Cinder Acolyte",
  "Demigod|||Chaos Knight",
  "Demigod|||Ice Elementalist",
  "Felid|||Brigand",
  "Felid|||Gladiator",
  "Felid|||Hedge Wizard",
  "Felid|||Hexslinger",
  "Gargoyle|||Shapeshifter",
  "Gargoyle|||Summoner",
  "Mummy|||Shapeshifter",
  "Mummy|||Summoner",
  "Poltergeist|||Shapeshifter",
  "Revenant|||Shapeshifter",
])

const TOTAL_COMBOS = ALL_SPECIES_NAMES.length * ALL_BACKGROUND_NAMES.length - DISABLED_COMBOS.size

function speciesCode(species: string): string {
  const s = species.trim()
  if (!s) return ""
  if (s === "Octopode") return "Op"
  if (s === "Merfolk") return "Mf"
  if (s === "Deep Elf") return "DE"
  if (s === "Draconian") return "Dr"
  if (s === "Mountain Dwarf") return "MD"
  if (s === "Demonspawn") return "Ds"
  if (s === "Gargoyle") return "Gr"
  // Coloured draconians use the base Dr code
  if (s.endsWith(" Draconian")) return "Dr"
  return s.slice(0, 2)
}

function backgroundCode(background: string): string {
  const b = background.trim()
  if (!b) return ""
  const map: Record<string, string> = {
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
  return map[b] ?? b.slice(0, 2)
}

/** Group wins by god and return list of { god, count } (count > 0). (no god) / empty grouped under "(no god)". */
function groupWinsByGod(wins: Array<{ god?: string }>): Array<{ god: string; count: number }> {
  const byGod = new Map<string, number>()
  for (const { god } of wins) {
    const key = (god ?? "").trim() || "(no god)"
    byGod.set(key, (byGod.get(key) ?? 0) + 1)
  }
  return Array.from(byGod.entries()).map(([god, count]) => ({ god, count }))
}

function ComboTooltipBody({
  species,
  background,
  comboCode,
  wins,
  counts,
}: {
  species: string
  background: string
  comboCode: string
  wins: Array<{ god?: string }>
  counts: { wins: number; attempts: number }
}) {
  const byGod = groupWinsByGod(wins)
  const godShort = (god: string) => GOD_SHORT_FORMS[god] ?? god
  const codeLine = byGod.length === 1 && byGod[0].god !== "(no god)"
    ? `${comboCode}^${godShort(byGod[0].god)}`
    : comboCode

  return (
    <div className="font-mono text-sm">
      <div className="font-semibold text-base">
        {species} {background}
      </div>
      {byGod.length > 0 && (
        <ul className="mt-1 space-y-0.5 list-none pl-0">
          {byGod.map(({ god, count }) => (
            <li key={god}>
              of {god}{count > 1 ? ` x ${count}` : ""}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1 text-primary font-semibold">
        {codeLine}
      </div>
      <div className="mt-1 text-xs text-neutral-400">
        Wins: {counts.wins} · Attempts: {counts.attempts}
      </div>
    </div>
  )
}

export function SpeciesBackgroundComboGrid({
  morgues = [],
}: {
  morgues?: GameRecord[]
}) {
  const [mode, setMode] = useState<Mode>("wins")
  const [hoveredSpecies, setHoveredSpecies] = useState<string | null>(null)
  const [hoveredBackground, setHoveredBackground] = useState<string | null>(null)

  const clearHover = () => {
    setHoveredSpecies(null)
    setHoveredBackground(null)
  }

  const { comboCounts, comboWins, winComboCount, attemptComboCount } = useMemo(() => {
    const map = new Map<string, { wins: number; attempts: number }>()
    const winsMap = new Map<string, Array<{ god?: string }>>()
    for (const m of morgues) {
      const species = (m.species ?? "").trim()
      const background = (m.background ?? "").trim()
      if (!species || !background) continue
      const key = `${species}|||${background}`
      const entry = map.get(key) ?? { wins: 0, attempts: 0 }
      entry.attempts += 1
      if (m.result === "win") {
        entry.wins += 1
        const list = winsMap.get(key) ?? []
        list.push({ god: m.god?.trim() || undefined })
        winsMap.set(key, list)
      }
      map.set(key, entry)
    }
    if (TEST_COMBO_TOOLTIP) {
      const entry = map.get(TEST_COMBO_KEY) ?? { wins: 0, attempts: 0 }
      const list = winsMap.get(TEST_COMBO_KEY) ?? []
      for (const god of TEST_WIN_GODS) {
        entry.wins += 1
        list.push({ god })
      }
      map.set(TEST_COMBO_KEY, entry)
      winsMap.set(TEST_COMBO_KEY, list)
    }
    let winCombos = 0
    let attemptCombos = 0
    for (const entry of map.values()) {
      if (entry.wins > 0) winCombos += 1
      if (entry.attempts > 0) attemptCombos += 1
    }
    return { comboCounts: map, comboWins: winsMap, winComboCount: winCombos, attemptComboCount: attemptCombos }
  }, [morgues])

  const hasData = morgues.length > 0

  return (
    <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 bg-background border-b-2 border-primary/30 mt-2">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Card className="border-2 border-primary/30 rounded-none">
          <CardHeader className="border-b-2 border-primary/20 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>
              SPECIES–BACKGROUND COMBO GRID
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-primary">SHOW:</span>
              <div className="flex gap-2">
                <FilterToggleButton selected={mode === "wins"} onClick={() => setMode("wins")}>
                  Wins
                </FilterToggleButton>
                <FilterToggleButton
                  selected={mode === "attempts"}
                  onClick={() => setMode("attempts")}
                >
                  Attempts
                </FilterToggleButton>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {!hasData ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground font-mono">
                Upload morgues to see your species–background grid.
              </div>
            ) : (
              <div
                className="overflow-auto"
                onMouseLeave={clearHover}
              >
                <p className="mb-4 ml-20 font-mono text-sm text-muted-foreground">
                  You have{" "}
                  {mode === "wins" ? "won with" : "attempted"}{" "}
                  {((mode === "wins" ? winComboCount : attemptComboCount) / TOTAL_COMBOS * 100).toFixed(1)}
                  % of the different combos (
                  {mode === "wins" ? winComboCount : attemptComboCount} out of {TOTAL_COMBOS}).
                </p>
                <div
                  className="inline-grid gap-px w-full"
                  style={{
                    gridTemplateColumns: `80px repeat(${ALL_BACKGROUND_NAMES.length}, minmax(0, 1fr))`,
                  }}
                >
                  {/* Empty corner cell */}
                  <div />
                  {/* Column headers (background codes) */}
                  {ALL_BACKGROUND_NAMES.map((bg) => (
                    <div
                      key={bg}
                      className={`aspect-square w-full flex items-end justify-center text-sm font-mono text-muted-foreground rotate-[-60deg] origin-bottom mb-2 transition-colors ${
                        hoveredBackground === bg ? "bg-muted/40" : ""
                      }`}
                    >
                      {backgroundCode(bg)}
                    </div>
                  ))}

                  {/* Rows: species labels + grid cells */}
                  {ALL_SPECIES_NAMES.map((sp) => {
                    const spCode = speciesCode(sp)
                    const isRowHovered = hoveredSpecies === sp
                    return (
                      <Fragment key={sp}>
                        <div
                          className={`flex items-center justify-end pr-2 font-mono text-sm text-muted-foreground h-full transition-colors ${
                            isRowHovered ? "bg-muted/40" : ""
                          }`}
                        >
                          {spCode}
                        </div>
                        {ALL_BACKGROUND_NAMES.map((bg) => {
                          const isColHovered = hoveredBackground === bg
                          const isCellHighlighted = isRowHovered || isColHovered
                          const onCellHover = () => {
                            setHoveredSpecies(sp)
                            setHoveredBackground(bg)
                          }
                          const key = `${sp}|||${bg}`
                          const disabled = DISABLED_COMBOS.has(key)
                          const counts = comboCounts.get(key) ?? { wins: 0, attempts: 0 }
                          const active =
                            mode === "wins" ? counts.wins > 0 : counts.attempts > 0
                          const comboCode = `${speciesCode(sp)}${backgroundCode(bg)}`
                          const value = mode === "wins" ? counts.wins : counts.attempts

                          if (disabled) {
                            return (
                              <div
                                key={key}
                                className={`aspect-square w-full border border-primary/20 flex items-center justify-center text-muted-foreground font-mono text-lg select-none transition-colors ${
                                  isCellHighlighted ? "bg-muted/60" : "bg-muted/50"
                                }`}
                                onMouseEnter={onCellHover}
                                aria-label={`${sp} ${bg} (impossible)`}
                              >
                                ×
                              </div>
                            )
                          }

                          if (!active) {
                            return (
                              <div
                                key={key}
                                className={`aspect-square w-full border border-primary/20 transition-colors ${
                                  isCellHighlighted ? "bg-muted/40" : "bg-background"
                                }`}
                                onMouseEnter={onCellHover}
                                aria-label={`${sp} ${bg} ${mode}`}
                              />
                            )
                          }

                          const colorClass =
                            mode === "wins" ? "border-success text-success" : "border-primary text-primary"

                          return (
                            <Tooltip key={key}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`aspect-square w-full border-2 flex items-center justify-center font-mono text-sm transition-colors ${colorClass} ${
                                    isCellHighlighted ? "bg-muted/40" : "bg-background"
                                  }`}
                                  onMouseEnter={onCellHover}
                                  aria-label={`${sp} ${bg} ${mode}`}
                                >
                                  {value}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="text-left rounded-none border border-primary/40 bg-black/90 text-neutral-100 shadow-lg px-3 py-2"
                              >
                                <ComboTooltipBody
                                  species={sp}
                                  background={bg}
                                  comboCode={comboCode}
                                  wins={comboWins.get(key) ?? []}
                                  counts={counts}
                                />
                              </TooltipContent>
                            </Tooltip>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
