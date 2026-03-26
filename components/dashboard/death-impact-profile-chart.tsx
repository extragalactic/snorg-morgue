"use client"

/**
 * Death Significance Profile — horizontal comparison of summed per-death significance by zone.
 *
 * Layout (per row): [location label] | [track: baseline bar + lollipop + delta dash] | [numeric delta]
 * Row order is fixed progression order from data — never sorted by magnitude.
 * Baseline = all species (user-wide); overlay = selected species.
 */

import { useMemo, useId, useState, useEffect } from "react"
import { Star } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { GameRecord } from "@/lib/morgue-api"
import {
  buildDeathImpactProfileFromMorgues,
  speciesWithDeathsForImpact,
  type DeathImpactRowData,
} from "@/lib/death-impact-zones"

export type { DeathImpactRowData } from "@/lib/death-impact-zones"

/** Levels that are always called out as standout zones. */
const STANDOUT_LEVELS = new Set(["Vaults 5", "Zot 5"])

/** In “share” mode, highlight if this row’s share is at least this percentage. */
const HIGH_RISK_SHARE_THRESHOLD_PCT = 15

/** Minimum absolute significance (significance mode) for auto-highlight vs relative threshold. */
const HIGH_RISK_SIGNIFICANCE_FLOOR = 0.01

// --- Mock dataset for demo / Storybook-style layouts --------------------------------

export const MOCK_DEATH_IMPACT_ROWS: DeathImpactRowData[] = [
  {
    level: "Dungeon 1-5",
    globalImpact: 0.7,
    selectedImpact: 0.5,
    section: "Dungeon",
    deathCount: 12,
    avgHoursAtDeath: 0.9,
    weightedImpactScore: 0.5,
  },
  {
    level: "Dungeon 6-10",
    globalImpact: 1.2,
    selectedImpact: 0.9,
    section: "Dungeon",
    deathCount: 18,
    avgHoursAtDeath: 1.4,
    weightedImpactScore: 0.9,
  },
  {
    level: "Dungeon 11-15",
    globalImpact: 1.8,
    selectedImpact: 1.4,
    section: "Dungeon",
    deathCount: 22,
    avgHoursAtDeath: 2.1,
    weightedImpactScore: 1.4,
  },
  {
    level: "Lair 1-5",
    globalImpact: 2.4,
    selectedImpact: 2.9,
    section: "Branches",
    deathCount: 31,
    avgHoursAtDeath: 3.2,
    weightedImpactScore: 2.9,
  },
  {
    level: "Orc 1-2",
    globalImpact: 1.5,
    selectedImpact: 1.9,
    section: "Branches",
    deathCount: 14,
    avgHoursAtDeath: 2.8,
    weightedImpactScore: 1.9,
  },
  {
    level: "Swamp 1-4",
    globalImpact: 2.0,
    selectedImpact: 2.7,
    section: "Branches",
    deathCount: 19,
    avgHoursAtDeath: 4.1,
    weightedImpactScore: 2.7,
  },
  {
    level: "Shoals 1-4",
    globalImpact: 1.8,
    selectedImpact: 2.2,
    section: "Branches",
    deathCount: 16,
    avgHoursAtDeath: 3.9,
    weightedImpactScore: 2.2,
  },
  {
    level: "Spider 1-4",
    globalImpact: 2.1,
    selectedImpact: 3.0,
    section: "Branches",
    deathCount: 21,
    avgHoursAtDeath: 4.5,
    weightedImpactScore: 3.0,
  },
  {
    level: "Snake 1-4",
    globalImpact: 1.9,
    selectedImpact: 2.6,
    section: "Branches",
    deathCount: 17,
    avgHoursAtDeath: 4.0,
    weightedImpactScore: 2.6,
  },
  {
    level: "Vaults 1-4",
    globalImpact: 2.7,
    selectedImpact: 2.9,
    section: "Late Game",
    deathCount: 24,
    avgHoursAtDeath: 5.2,
    weightedImpactScore: 2.9,
  },
  {
    level: "Vaults 5",
    globalImpact: 3.4,
    selectedImpact: 4.2,
    section: "Late Game",
    deathCount: 28,
    avgHoursAtDeath: 6.1,
    weightedImpactScore: 4.2,
  },
  {
    level: "Slime 1-4",
    globalImpact: 2.0,
    selectedImpact: 1.6,
    section: "Late Game",
    deathCount: 11,
    avgHoursAtDeath: 5.0,
    weightedImpactScore: 1.6,
  },
  {
    level: "Crypt 1-3",
    globalImpact: 1.5,
    selectedImpact: 1.1,
    section: "Late Game",
    deathCount: 9,
    avgHoursAtDeath: 5.4,
    weightedImpactScore: 1.1,
  },
  {
    level: "Abyss",
    globalImpact: 1.3,
    selectedImpact: 0.9,
    section: "Late Game",
    deathCount: 7,
    avgHoursAtDeath: 4.2,
    weightedImpactScore: 0.9,
  },
  {
    level: "Depths 1-4",
    globalImpact: 2.3,
    selectedImpact: 2.0,
    section: "Endgame",
    deathCount: 18,
    avgHoursAtDeath: 6.8,
    weightedImpactScore: 2.0,
  },
  {
    level: "Zot 1-4",
    globalImpact: 2.8,
    selectedImpact: 2.4,
    section: "Endgame",
    deathCount: 20,
    avgHoursAtDeath: 7.5,
    weightedImpactScore: 2.4,
  },
  {
    level: "Zot 5",
    globalImpact: 3.2,
    selectedImpact: 3.9,
    section: "Endgame",
    deathCount: 26,
    avgHoursAtDeath: 8.2,
    weightedImpactScore: 3.9,
  },
  {
    level: "Orb run",
    globalImpact: 1.1,
    selectedImpact: 0.8,
    section: "Endgame",
    deathCount: 5,
    avgHoursAtDeath: 9.1,
    weightedImpactScore: 0.8,
  },
  {
    level: "Other",
    globalImpact: 0.6,
    selectedImpact: 0.4,
    section: "Other",
    deathCount: 4,
    avgHoursAtDeath: 2.0,
    weightedImpactScore: 0.4,
  },
]

// --- Pure helpers ------------------------------------------------------------------

type ChartMode = "significance" | "share"

type PreparedRow = {
  level: string
  section: string
  displayGlobal: number
  displaySelected: number
  delta: number
  deathCount: number
  avgHoursAtDeath: number
  weightedImpactScore: number
  pctOfTotalSelected: number
  rawGlobal: number
  rawSelected: number
}

function prepareRows(rows: DeathImpactRowData[], mode: ChartMode): PreparedRow[] {
  const totalGlobal = rows.reduce((s, r) => s + r.globalImpact, 0) || 1
  const totalSelected = rows.reduce((s, r) => s + r.selectedImpact, 0) || 1

  return rows.map((r) => {
    const displayGlobal =
      mode === "significance" ? r.globalImpact : (r.globalImpact / totalGlobal) * 100
    const displaySelected =
      mode === "significance" ? r.selectedImpact : (r.selectedImpact / totalSelected) * 100
    const delta = displaySelected - displayGlobal
    const pctOfTotalSelected = (r.selectedImpact / totalSelected) * 100

    return {
      level: r.level,
      section: r.section,
      displayGlobal,
      displaySelected,
      delta,
      deathCount: r.deathCount,
      avgHoursAtDeath: r.avgHoursAtDeath,
      weightedImpactScore: r.weightedImpactScore,
      pctOfTotalSelected,
      rawGlobal: r.globalImpact,
      rawSelected: r.selectedImpact,
    }
  })
}

function chartMaxForRows(prepared: PreparedRow[]): number {
  let m = 0
  for (const r of prepared) {
    m = Math.max(m, r.displayGlobal, r.displaySelected)
  }
  return m > 0 ? m : 1
}

function isStandoutRow(
  row: PreparedRow,
  mode: ChartMode,
  relativeImpactThreshold: number,
): boolean {
  if (STANDOUT_LEVELS.has(row.level)) return true
  if (mode === "significance") {
    const t = Math.max(HIGH_RISK_SIGNIFICANCE_FLOOR, relativeImpactThreshold)
    return row.rawSelected >= t
  }
  return row.displaySelected >= HIGH_RISK_SHARE_THRESHOLD_PCT
}

// --- Subcomponents -----------------------------------------------------------------

function DeathImpactSummaryCards({
  prepared,
  mode,
  baselineLabel,
}: {
  prepared: PreparedRow[]
  mode: ChartMode
  baselineLabel: string
}) {
  const top = useMemo(() => {
    const copy = [...prepared]
    copy.sort((a, b) => b.displaySelected - a.displaySelected)
    return copy.slice(0, 3)
  }, [prepared])

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {top.map((row, i) => (
        <div
          key={row.level}
          className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Top risk zone {i + 1}
          </p>
          <p className="mt-1.5 text-base font-semibold tracking-tight text-card-foreground">{row.level}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="rounded-full border border-border bg-secondary font-medium text-secondary-foreground"
            >
              {mode === "significance" ? (
                <>Significance {row.displaySelected.toFixed(1)}</>
              ) : (
                <>Share {row.displaySelected.toFixed(1)}%</>
              )}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "rounded-full border font-medium",
                row.delta >= 0
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              {row.delta >= 0 ? "+" : ""}
              {mode === "significance" ? row.delta.toFixed(1) : `${row.delta.toFixed(2)} pp`} vs{" "}
              {baselineLabel}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}

export type DeathImpactProfileChartProps = {
  /** Live morgues: per-death significance is sqrt(hours)×zoneWeight², summed by zone (baseline vs species). */
  morgues?: GameRecord[]
  /**
   * Optional explicit rows (e.g. tests). When set, overrides `morgues` and hides the species control.
   */
  rows?: DeathImpactRowData[]
  /** Controlled species (requires `onSpeciesChange`) when embedding in a parent that owns state. */
  selectedSpecies?: string
  onSpeciesChange?: (species: string) => void
  /** Fallback label when using mock data or before species is chosen. */
  selectedLabel?: string
  /** User-facing name for baseline (default: all species). */
  baselineLabel?: string
}

export function DeathImpactProfileChart({
  morgues,
  rows: rowsProp,
  selectedSpecies: controlledSpecies,
  onSpeciesChange,
  selectedLabel = "Selected species",
  baselineLabel = "all species",
}: DeathImpactProfileChartProps) {
  const baseId = useId()
  const modeGroupId = `${baseId}-mode`
  const [mode, setMode] = useState<ChartMode>("significance")
  const [internalSpecies, setInternalSpecies] = useState("")

  const speciesOptions = useMemo(() => (morgues ? speciesWithDeathsForImpact(morgues) : []), [morgues])
  const isControlled = controlledSpecies !== undefined && onSpeciesChange !== undefined

  useEffect(() => {
    if (isControlled || rowsProp !== undefined || !morgues?.length) return
    const list = speciesWithDeathsForImpact(morgues)
    if (!list.length) {
      setInternalSpecies("")
      return
    }
    setInternalSpecies((prev) => (prev && list.includes(prev) ? prev : list[0]))
  }, [morgues, isControlled, rowsProp])

  const effectiveSpecies = useMemo(() => {
    if (isControlled) return (controlledSpecies ?? "").trim()
    const fallback = speciesOptions[0] ?? ""
    if (internalSpecies && speciesOptions.includes(internalSpecies)) return internalSpecies
    return fallback
  }, [isControlled, controlledSpecies, internalSpecies, speciesOptions])

  const usingMock = rowsProp === undefined && !morgues

  const sourceRows = useMemo(() => {
    if (rowsProp !== undefined) return rowsProp
    if (morgues?.length && effectiveSpecies) {
      return buildDeathImpactProfileFromMorgues(morgues, effectiveSpecies)
    }
    return MOCK_DEATH_IMPACT_ROWS
  }, [rowsProp, morgues, effectiveSpecies])

  const seriesName = usingMock ? selectedLabel : effectiveSpecies || selectedLabel

  const prepared = useMemo(() => prepareRows(sourceRows, mode), [sourceRows, mode])
  const maxVal = useMemo(() => chartMaxForRows(prepared), [prepared])
  const relativeHighlightThreshold = useMemo(() => {
    let maxSel = 0
    for (const r of sourceRows) {
      maxSel = Math.max(maxSel, r.selectedImpact)
    }
    return maxSel * 0.38
  }, [sourceRows])

  const tickPositions = [0.25, 0.5, 0.75]
  const showSpeciesControl = rowsProp === undefined && morgues !== undefined

  if (showSpeciesControl && morgues && speciesOptions.length === 0) {
    return (
      <Card className="mt-0 rounded-3xl border border-border bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-card-foreground">
            Death significance profile
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            No deaths in your morgues yet. When you have deaths, this compares each species’s death
            significance by zone versus your overall baseline (time × progression depth).
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const setSpecies = (v: string) => {
    if (isControlled) onSpeciesChange!(v)
    else setInternalSpecies(v)
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-5">
        <DeathImpactSummaryCards
          prepared={prepared}
          mode={mode}
          baselineLabel={baselineLabel}
        />

        <Card className="overflow-hidden rounded-3xl border border-border bg-card shadow-md">
          <CardHeader className="gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-lg font-semibold tracking-tight text-card-foreground sm:text-xl">
                Death significance profile
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                Where <span className="font-medium text-foreground">{seriesName}</span> accumulates
                death significance versus your{" "}
                <span className="font-medium text-foreground">{baselineLabel}</span> baseline. Death
                significance blends{" "}
                <span className="whitespace-nowrap font-medium text-foreground">time invested</span>{" "}
                and{" "}
                <span className="font-medium text-foreground">how deep the run progressed</span> —
                late deaths weigh far more than early ones. Order follows game progression, not bar
                length.
              </CardDescription>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:items-end shrink-0">
              {showSpeciesControl && speciesOptions.length > 0 && (
                <div className="flex flex-col gap-1.5 sm:items-end">
                  <span id={`${baseId}-species-label`} className="text-xs font-medium text-muted-foreground">
                    Species
                  </span>
                  <Select value={effectiveSpecies || undefined} onValueChange={setSpecies}>
                    <SelectTrigger
                      aria-labelledby={`${baseId}-species-label`}
                      className="h-9 w-full min-w-[10rem] max-w-[18rem] rounded-xl border-border bg-background shadow-sm sm:w-[14rem]"
                    >
                      <SelectValue placeholder="Choose species" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-popover text-popover-foreground">
                      {speciesOptions.map((s) => (
                        <SelectItem key={s} value={s} className="rounded-lg">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            {/* Mode toggle: keyboard-friendly, aria-pressed, not color-only */}
            <div
              role="group"
              aria-labelledby={modeGroupId}
              className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-muted/40 p-1"
            >
              <span id={modeGroupId} className="sr-only">
                Chart value mode
              </span>
              <button
                type="button"
                aria-pressed={mode === "significance"}
                onClick={() => setMode("significance")}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-sm font-medium outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                  mode === "significance"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-card/80"
                )}
              >
                Significance score
              </button>
              <button
                type="button"
                aria-pressed={mode === "share"}
                onClick={() => setMode("share")}
                className={cn(
                  "rounded-xl px-3.5 py-2 text-sm font-medium outline-none transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
                  mode === "share"
                    ? "bg-card text-card-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-card/80"
                )}
              >
                Share of total
              </button>
            </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="mb-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-9 rounded-full bg-muted-foreground/35" aria-hidden />
                <span>{baselineLabel} baseline</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-0.5" aria-hidden>
                  <span className="h-px w-6 bg-primary" />
                  <span className="size-2.5 shrink-0 rounded-full border-2 border-card bg-primary shadow" />
                </span>
                <span>{seriesName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="h-0 w-8 border-t border-dashed border-muted-foreground/50"
                  aria-hidden title="Delta connector legend"
                />
                <span>Delta vs {baselineLabel}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              {/* min-width keeps three-column chart readable on small screens */}
              <div className="min-w-[min(100%,960px)] sm:min-w-0">
                <div className="grid grid-cols-[minmax(8rem,11rem)_1fr_minmax(4.5rem,5.5rem)] items-center gap-x-3 border-b border-border pb-3 sm:grid-cols-[minmax(11rem,14rem)_1fr_minmax(4.5rem,5.5rem)] sm:gap-x-5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Death location
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {mode === "significance" ? "Significance score" : "Share of total significance"}
                  </div>
                  <div className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Delta
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {prepared.map((row, index) => {
                    const gw = (row.displayGlobal / maxVal) * 100
                    const sw = (row.displaySelected / maxVal) * 100
                    const left = Math.min(gw, sw)
                    const span = Math.abs(sw - gw)
                    const standout = isStandoutRow(row, mode, relativeHighlightThreshold)
                    const showSection =
                      index === 0 || prepared[index - 1].section !== row.section

                    const deltaText =
                      row.delta >= 0
                        ? `+${mode === "significance" ? row.delta.toFixed(1) : `${row.delta.toFixed(2)} pp`}`
                        : mode === "significance"
                          ? row.delta.toFixed(1)
                          : `${row.delta.toFixed(2)} pp`

                    const tooltipDelta =
                      mode === "significance"
                        ? `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(2)}`
                        : `${row.delta >= 0 ? "+" : ""}${row.delta.toFixed(2)} pts (share)`

                    return (
                      <div key={row.level} className="text-left">
                        {showSection && (
                          <div className="pt-5 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70 first:pt-2">
                            {row.section}
                          </div>
                        )}

                        <TooltipPrimitive.Root>
                          <TooltipPrimitive.Trigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "grid w-full grid-cols-[minmax(8rem,11rem)_1fr_minmax(4.5rem,5.5rem)] items-center gap-x-3 py-3.5 text-left outline-none sm:grid-cols-[minmax(11rem,14rem)_1fr_minmax(4.5rem,5.5rem)] sm:gap-x-5",
                                "transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
                              )}
                            >
                              <div className="flex min-w-0 items-start gap-2 pr-1">
                                <span className="truncate text-sm font-medium text-card-foreground">{row.level}</span>
                                {standout && (
                                  <span
                                    className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full border border-primary/35 bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                                    title="Standout zone"
                                  >
                                    <Star className="size-3" aria-hidden strokeWidth={2.5} />
                                    <span className="sr-only">Standout risk zone. </span>
                                    Hot
                                  </span>
                                )}
                              </div>

                              {/* Track: guides + baseline capsule + delta dash + lollipop */}
                              <div className="relative h-11">
                                <div
                                  className="absolute inset-0 rounded-xl bg-muted/50"
                                  aria-hidden
                                />
                                {tickPositions.map((t) => (
                                  <div
                                    key={t}
                                    className="pointer-events-none absolute inset-y-1 w-px bg-border/80"
                                    style={{ left: `${t * 100}%` }}
                                    aria-hidden
                                  />
                                ))}

                                {/* Baseline (all species): soft rounded bar */}
                                <div
                                  className="absolute top-1/2 h-6 max-w-full -translate-y-1/2 rounded-full bg-muted-foreground/30 transition-[width] duration-500 ease-out"
                                  style={{ width: `${gw}%` }}
                                  aria-hidden
                                />

                                {/* Dashed segment between baseline and selected endpoints */}
                                <div
                                  className="absolute top-1/2 h-0 -translate-y-1/2 border-t border-dashed border-muted-foreground/45"
                                  style={{
                                    left: `${left}%`,
                                    width: `${span}%`,
                                  }}
                                  aria-hidden
                                />

                                {/* Lollipop stem */}
                                <div
                                  className="absolute top-1/2 h-0.5 max-w-full -translate-y-1/2 bg-primary transition-[width] duration-500 ease-out"
                                  style={{ width: `${sw}%` }}
                                  aria-hidden
                                />

                                {/* Lollipop head */}
                                <div
                                  className="absolute top-1/2 size-3.5 max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary shadow-md transition-[left] duration-500 ease-out"
                                  style={{ left: `${sw}%` }}
                                  aria-hidden
                                />

                                <span className="sr-only">
                                  {row.level}: {baselineLabel}{" "}
                                  {mode === "significance"
                                    ? row.displayGlobal.toFixed(2)
                                    : `${row.displayGlobal.toFixed(1)}%`}
                                  , {seriesName}{" "}
                                  {mode === "significance"
                                    ? row.displaySelected.toFixed(2)
                                    : `${row.displaySelected.toFixed(1)}%`}
                                  , delta {tooltipDelta}.
                                </span>
                              </div>

                              <div className="text-right">
                                <span
                                  className={cn(
                                    "text-sm font-semibold tabular-nums tracking-tight",
                                    row.delta > 0 && "text-primary",
                                    row.delta < 0 && "text-muted-foreground",
                                    row.delta === 0 && "text-card-foreground"
                                  )}
                                >
                                  {deltaText}
                                  {row.delta > 0 && (
                                    <span className="sr-only"> above {baselineLabel}</span>
                                  )}
                                  {row.delta < 0 && (
                                    <span className="sr-only"> below {baselineLabel}</span>
                                  )}
                                </span>
                              </div>
                            </button>
                          </TooltipPrimitive.Trigger>
                          <TooltipContent
                            side="top"
                            sideOffset={8}
                            className="max-w-[22rem] border border-border bg-popover text-popover-foreground shadow-lg"
                          >
                            <div className="space-y-2 text-xs leading-relaxed">
                              <p className="font-semibold text-popover-foreground">{row.level}</p>
                              <p className="text-muted-foreground">
                                Death significance is computed from time invested and how deep the run
                                progressed. Late-game deaths carry much more weight than early deaths.
                              </p>
                              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                                <dt className="text-muted-foreground">Deaths</dt>
                                <dd className="font-medium tabular-nums text-popover-foreground">
                                  {row.deathCount}
                                </dd>
                                <dt className="text-muted-foreground">Avg hrs at death</dt>
                                <dd className="font-medium tabular-nums text-popover-foreground">
                                  {row.avgHoursAtDeath.toFixed(1)} h
                                </dd>
                                <dt className="text-muted-foreground">Death significance</dt>
                                <dd className="font-medium tabular-nums text-popover-foreground">
                                  {row.weightedImpactScore.toFixed(2)}
                                </dd>
                                <dt className="text-muted-foreground">Share of total significance</dt>
                                <dd className="font-medium tabular-nums text-popover-foreground">
                                  {row.pctOfTotalSelected.toFixed(1)}%
                                </dd>
                                <dt className="text-muted-foreground">Δ vs {baselineLabel}</dt>
                                <dd className="font-medium tabular-nums text-popover-foreground">
                                  {tooltipDelta}
                                </dd>
                              </dl>
                            </div>
                          </TooltipContent>
                        </TooltipPrimitive.Root>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Significance score uses{" "}
              <span className="font-mono text-[0.7rem] text-foreground/90">
                sqrt(hours) × zoneWeight²
              </span>{" "}
              so late meaningful deaths outweigh frequent early deaths.
            </p>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

