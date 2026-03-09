"use client"

import { useMemo, useState, Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FilterToggleButton } from "@/components/ui/filter-toggle-button"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ALL_SPECIES_NAMES, ALL_BACKGROUND_NAMES } from "@/lib/dcss-constants"
import type { GameRecord } from "@/lib/morgue-api"

type Mode = "wins" | "attempts"

const TOTAL_COMBOS = ALL_SPECIES_NAMES.length * ALL_BACKGROUND_NAMES.length

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

export function SpeciesBackgroundComboGrid({
  morgues = [],
}: {
  morgues?: GameRecord[]
}) {
  const [mode, setMode] = useState<Mode>("wins")

  const { comboCounts, winComboCount, attemptComboCount } = useMemo(() => {
    const map = new Map<string, { wins: number; attempts: number }>()
    for (const m of morgues) {
      const species = (m.species ?? "").trim()
      const background = (m.background ?? "").trim()
      if (!species || !background) continue
      const key = `${species}|||${background}`
      const entry = map.get(key) ?? { wins: 0, attempts: 0 }
      entry.attempts += 1
      if (m.result === "win") entry.wins += 1
      map.set(key, entry)
    }
    let winCombos = 0
    let attemptCombos = 0
    for (const entry of map.values()) {
      if (entry.wins > 0) winCombos += 1
      if (entry.attempts > 0) attemptCombos += 1
    }
    return { comboCounts: map, winComboCount: winCombos, attemptComboCount: attemptCombos }
  }, [morgues])

  const hasData = morgues.length > 0

  return (
    <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 bg-background border-y-2 border-primary/30 mt-8">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Card className="border-2 border-primary/30 rounded-none">
          <CardHeader className="border-b-2 border-primary/20 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="font-mono text-sm text-primary">
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
              <div className="overflow-auto">
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
                      className="aspect-square w-full flex items-end justify-center text-sm font-mono text-muted-foreground rotate-[-60deg] origin-bottom mb-2"
                    >
                      {backgroundCode(bg)}
                    </div>
                  ))}

                  {/* Rows: species labels + grid cells */}
                  {ALL_SPECIES_NAMES.map((sp) => {
                    const spCode = speciesCode(sp)
                    return (
                      <Fragment key={sp}>
                        <div className="flex items-center justify-end pr-2 font-mono text-sm text-muted-foreground h-full">
                          {spCode}
                        </div>
                        {ALL_BACKGROUND_NAMES.map((bg) => {
                          const key = `${sp}|||${bg}`
                          const counts = comboCounts.get(key) ?? { wins: 0, attempts: 0 }
                          const active =
                            mode === "wins" ? counts.wins > 0 : counts.attempts > 0
                          const comboCode = `${speciesCode(sp)}${backgroundCode(bg)}`

                          if (!active) {
                            return (
                              <div
                                key={key}
                                className="aspect-square w-full border border-primary/20 bg-background"
                                aria-label={`${sp} ${bg} ${mode}`}
                              />
                            )
                          }

                          return (
                            <Tooltip key={key}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`aspect-square w-full border border-primary/20 ${
                                    mode === "wins" ? "bg-green-500/60" : "bg-yellow-400/60"
                                  }`}
                                  aria-label={`${sp} ${bg} ${mode}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-center">
                                <div className="font-mono">
                                  <div className="text-lg font-semibold">
                                    {sp} {bg}
                                  </div>
                                  <div className="text-lg font-semibold mt-0.5">
                                    {comboCode}
                                  </div>
                                  <div className="mt-1 text-xs">
                                    Wins: {counts.wins} · Attempts: {counts.attempts}
                                  </div>
                                </div>
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
