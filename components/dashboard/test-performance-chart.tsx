"use client"

import { useMemo, useState, useEffect, useLayoutEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StatEntry } from "@/lib/morgue-db"
import type { StatCategoryAverage } from "@/lib/morgue-api"
import { ALL_BACKGROUND_NAMES, DRACONIAN_COLOUR_NAMES, GOD_NAMES_FOR_CHART } from "@/lib/dcss-constants"
import {
  buildSpeciesListWithDraconian,
  mergeWithFullList,
  speciesDisplayLabel,
  DRACONIAN_LABEL_GREY,
} from "@/components/dashboard/player-stats-chart"
import { FilterToggleButton } from "@/components/ui/filter-toggle-button"
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useTheme } from "@/contexts/theme-context"
import { useSettings } from "@/contexts/settings-context"

type ChartType = "species" | "background" | "gods"
type ShowMode = "wins" | "attempts"

const BAR_VALUE_TRANSITION_MS = 480

function toBarPx(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

/**
 * Recharts' built-in bar animation matches segments by index, which breaks across Species /
 * Background / God. We disable that and tween `x` / `width` with CSS so lengths animate reliably.
 */
function WinPerfAnimatedBarRect(props: Record<string, unknown>) {
  const xTarget = toBarPx(props.x)
  const y = toBarPx(props.y)
  const h = toBarPx(props.height)
  const wTarget = Math.max(0, toBarPx(props.width))
  const fill = typeof props.fill === "string" ? props.fill : "#888"

  const [live, setLive] = useState(() => ({ x: xTarget, w: 0 }))

  useLayoutEffect(() => {
    setLive({ x: xTarget, w: wTarget })
  }, [xTarget, wTarget])

  return (
    <rect
      x={live.x}
      y={y}
      height={h}
      width={live.w}
      fill={fill}
      style={{
        transitionProperty: "width, x",
        transitionDuration: `${BAR_VALUE_TRANSITION_MS}ms`,
        transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
      }}
    />
  )
}

type CategoryDatum = {
  name: string
  userAttempts: number
  avgAttempts: number
  userWins: number
  avgWins: number
  firstSeg: number
  secondSeg: number
  isAvgFirst: boolean
  firstSegWins: number
  secondSegWins: number
  isAvgFirstWins: boolean
  avgIsEstimated?: boolean
}

interface TestPerformanceChartProps {
  speciesStats?: StatEntry[]
  speciesAverages?: StatCategoryAverage[]
  backgroundStats?: StatEntry[]
  backgroundAverages?: StatCategoryAverage[]
  godStats?: StatEntry[]
  godAverages?: StatCategoryAverage[]
  /** When false, only "You" data is shown (no Avg segment). Follows the dashboard "Show averages" switch. */
  showAverages?: boolean
  /** Total players used for averages, e.g. 8 -> "Average (8 players)". */
  averagePlayerCount?: number
  /** When true, card and chart expand to fill the container height (e.g. to align with adjacent column). */
  fillHeight?: boolean
}

function buildCategoryTestData(
  list: StatEntry[],
  averages: StatCategoryAverage[] = [],
): CategoryDatum[] {
  const hasAverages = averages.length > 0
  return list.map((s) => {
    const avgEntry = averages.find((a) => a.name === s.name) as { avgAttempts?: number; avgWins?: number } | undefined
    const userAttempts = s.attempts
    const avgAttempts = Math.floor(
      hasAverages && avgEntry?.avgAttempts != null
        ? Number(avgEntry.avgAttempts)
        : Math.floor(userAttempts * 0.5)
    )
    const userWins = s.wins
    const avgWins = Math.floor(
      (avgEntry?.avgWins != null) ? Number(avgEntry.avgWins) : Math.floor(userWins * 0.5)
    )
    const avgIsEstimated = !hasAverages || avgEntry == null
    const low = Math.min(avgAttempts, userAttempts)
    const high = Math.max(avgAttempts, userAttempts)
    const firstSeg = low
    const secondSeg = high - low
    const isAvgFirst = avgAttempts < userAttempts
    const lowWins = Math.min(avgWins, userWins)
    const highWins = Math.max(avgWins, userWins)
    const firstSegWins = lowWins
    const secondSegWins = highWins - lowWins
    const isAvgFirstWins = avgWins < userWins
    return {
      name: s.name,
      userAttempts,
      avgAttempts,
      userWins,
      avgWins,
      firstSeg,
      secondSeg,
      isAvgFirst,
      firstSegWins,
      secondSegWins,
      isAvgFirstWins,
      avgIsEstimated,
    }
  })
}

export function TestPerformanceChart({
  speciesStats = [],
  speciesAverages = [],
  backgroundStats = [],
  backgroundAverages = [],
  godStats = [],
  godAverages = [],
  showAverages = true,
  averagePlayerCount,
  fillHeight = false,
}: TestPerformanceChartProps) {
  const { themeStyle } = useTheme()
  const { settings, setSettings } = useSettings()

  // Normalize legacy "both" showMode to "attempts" for this chart
  const settingsShowMode: ShowMode = settings.performanceChart.showMode === "both" ? "attempts" : settings.performanceChart.showMode

  const [chartType, setChartType] = useState<ChartType>(settings.performanceChart.chartType)
  const [showMode, setShowMode] = useState<ShowMode>(settingsShowMode)

  // Sync from settings when they change (e.g. loaded from localStorage)
  useEffect(() => {
    setChartType(settings.performanceChart.chartType)
    setShowMode(settings.performanceChart.showMode === "both" ? "attempts" : settings.performanceChart.showMode)
  }, [settings.performanceChart.chartType, settings.performanceChart.showMode])

  const updatePerformanceSettings = (partial: Partial<typeof settings.performanceChart>) => {
    setSettings((prev) => ({
      ...prev,
      performanceChart: {
        ...prev.performanceChart,
        ...partial,
      },
    }))
  }

  const categoryList = useMemo(() => {
    if (chartType === "species") return buildSpeciesListWithDraconian(speciesStats)
    if (chartType === "background") return mergeWithFullList(ALL_BACKGROUND_NAMES, backgroundStats)
    return mergeWithFullList(GOD_NAMES_FOR_CHART, godStats)
  }, [chartType, speciesStats, backgroundStats, godStats])

  const averages = useMemo(() => {
    if (chartType === "species") return speciesAverages
    if (chartType === "background") return backgroundAverages
    return godAverages
  }, [chartType, speciesAverages, backgroundAverages, godAverages])

  const data = useMemo(
    () => buildCategoryTestData(categoryList, averages ?? []),
    [categoryList, averages]
  )

  const sortedData = useMemo(() => {
    const sortKey = showMode === "wins" ? "userWins" : "userAttempts"
    if (chartType === "species") {
      const others = data.filter(
        (d) => d.name !== "Draconian" && !DRACONIAN_COLOUR_NAMES.includes(d.name)
      )
      const draconianMain = data.find((d) => d.name === "Draconian")
      const draconianColourRows = DRACONIAN_COLOUR_NAMES.map((name) => data.find((d) => d.name === name)).filter((d): d is CategoryDatum => d != null)
      const toSort: CategoryDatum[] = draconianMain != null ? [...others, draconianMain] : others
      const sorted = [...toSort].sort((a, b) => b[sortKey] - a[sortKey])
      return sorted.flatMap((d) =>
        d.name === "Draconian" ? [d, ...draconianColourRows] : [d]
      )
    }
    return [...data].sort((a, b) => b[sortKey] - a[sortKey])
  }, [data, showMode, chartType])

  const winsColor =
    themeStyle === "ascii" ? "oklch(0.62 0.2 145)" : "rgba(250, 204, 21, 0.9)"
  const attemptsColor = "var(--average)"

  const averageAxisLabel =
    typeof averagePlayerCount === "number" && averagePlayerCount > 0
      ? `Average (${averagePlayerCount} players)`
      : "Average"

  const displayData = useMemo(
    () =>
      sortedData.map((d) => {
        const isAvgFirstBase = showMode === "wins" ? d.isAvgFirstWins : d.isAvgFirst
        const firstSegBase = showMode === "wins" ? d.firstSegWins : d.firstSeg
        const secondSegBase = showMode === "wins" ? d.secondSegWins : d.secondSeg

        // When averages are off, bars should represent only the user's value.
        if (!showAverages) {
          const userValue = showMode === "wins" ? d.userWins : d.userAttempts
          return {
            ...d,
            firstSegDisplay: userValue,
            secondSegDisplay: 0,
            isAvgFirstDisplay: false,
          }
        }

        // When averages are on, use stacked segments for overlap vs difference.
        return {
          ...d,
          firstSegDisplay: firstSegBase,
          secondSegDisplay: secondSegBase,
          isAvgFirstDisplay: isAvgFirstBase,
        }
      }),
    [sortedData, showMode, showAverages]
  )

  /** Per-row vertical budget (bar + gap). Must not hard-cap below `n * rowPitchPx` or pitch tweaks have no effect. */
  const rowPitchPx = 37
  /** Fixed pixel thickness so Species / Background / Gods match (default %-gap sizing can differ slightly per band). */
  const barThicknessPx = Math.max(14, Math.floor(rowPitchPx * 0.52))
  const chartHeight = displayData.length > 0
    ? Math.min(6000, Math.max(200, displayData.length * rowPitchPx))
    : 400

  const categoryLabel = chartType === "species" ? "Species" : chartType === "background" ? "Background" : "God"

  const xDomainMax = useMemo(() => {
    if (!displayData.length) return 3
    const totals = displayData.map((d) => d.firstSegDisplay + d.secondSegDisplay)
    return Math.max(3, ...totals)
  }, [displayData])

  const noGodSummary = useMemo(() => {
    const total = godStats.reduce((s, e) => s + e.attempts, 0)
    const noGod = godStats.find((e) => e.name === "(no god)")
    const count = noGod?.attempts ?? 0
    const pct = total ? (count / total) * 100 : 0
    return { count, pct }
  }, [godStats])

  if (displayData.length === 0) {
    return null
  }

  return (
    <Card
      className={
        fillHeight
          ? "flex h-full min-h-0 flex-col border-2 border-primary/30 rounded-none"
          : "border-2 border-primary/30 rounded-none"
      }
    >
      <CardHeader className="flex-shrink-0 border-b-2 border-primary/20 pb-3">
        <div className="space-y-3">
          <CardTitle className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-lg sm:text-xl">
            <span className="tracking-tight">WIN PERFORMANCE</span>
            {chartType === "gods" && (
              <span className="text-sm font-normal text-muted-foreground">
                {noGodSummary.pct.toFixed(0)}% of games had no god
              </span>
            )}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <FilterToggleButton
              selected={chartType === "species"}
              onClick={() => {
                setChartType("species")
                updatePerformanceSettings({ chartType: "species" })
              }}
            >
              Species
            </FilterToggleButton>
            <FilterToggleButton
              selected={chartType === "background"}
              onClick={() => {
                setChartType("background")
                updatePerformanceSettings({ chartType: "background" })
              }}
            >
              Background
            </FilterToggleButton>
            <FilterToggleButton
              selected={chartType === "gods"}
              onClick={() => {
                setChartType("gods")
                updatePerformanceSettings({ chartType: "gods" })
              }}
            >
              God
            </FilterToggleButton>
          </div>
        </div>
        <div className="flex flex-col gap-3 pt-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-primary">SHOW:</span>
            <div className="flex gap-2">
              <FilterToggleButton
                selected={showMode === "wins"}
                onClick={() => {
                  setShowMode("wins")
                  updatePerformanceSettings({ showMode: "wins" })
                }}
              >
                Wins
              </FilterToggleButton>
              <FilterToggleButton
                selected={showMode === "attempts"}
                onClick={() => {
                  setShowMode("attempts")
                  updatePerformanceSettings({ showMode: "attempts" })
                }}
              >
                Attempts
              </FilterToggleButton>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={
          fillHeight ? "flex min-h-0 flex-1 flex-col pt-1.5 pb-0" : "pt-1.5 pb-0"
        }
      >
        <div className="w-full shrink-0" style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={displayData}
              layout="vertical"
              barGap={0}
              barCategoryGap="23%"
              barSize={barThicknessPx}
              margin={{ top: 5, right: 5, bottom: 26, left: 5 }}
            >
              <XAxis
                type="number"
                stroke="var(--muted-foreground)"
                fontSize={14}
                tickLine={false}
                domain={[0, xDomainMax]}
                allowDecimals={false}
                label={{
                  value: showMode === "wins" ? "Number of Wins" : "Number of Attempts",
                  position: "bottom",
                  style: { fill: "var(--muted-foreground)", fontSize: 12 },
                  offset: 0,
                }}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="var(--muted-foreground)"
                fontSize={14}
                width={160}
                tickLine={false}
                interval={0}
                tick={(props: { x: number; y: number; payload?: { value?: string } }) => {
                  const value = props.payload?.value ?? ""
                  if (chartType === "species") {
                    const isGrey = DRACONIAN_COLOUR_NAMES.includes(value)
                    return (
                      <text
                        x={props.x}
                        y={props.y}
                        dy={4}
                        textAnchor="end"
                        fill={isGrey ? DRACONIAN_LABEL_GREY : "var(--muted-foreground)"}
                        fontSize={14}
                        className="font-mono"
                      >
                        {speciesDisplayLabel(value)}
                      </text>
                    )
                  }
                  const label =
                    chartType === "background"
                      ? value.replace(/\bElementalist\b/g, "Elem.")
                      : value
                  return (
                    <text
                      x={props.x}
                      y={props.y}
                      dy={4}
                      textAnchor="end"
                      fill="var(--muted-foreground)"
                      fontSize={14}
                      className="font-mono"
                    >
                      {label}
                    </text>
                  )
                }}
              />
              <Tooltip
                cursor={{ fill: "rgba(148, 163, 184, 0.06)", stroke: "transparent" }}
                formatter={(value: number, key: string, payload) => {
                  const p = payload.payload as CategoryDatum & {
                    firstSegDisplay: number
                    secondSegDisplay: number
                    isAvgFirstDisplay: boolean
                  }
                  const total = p.firstSegDisplay + p.secondSegDisplay
                  const label = !showAverages
                    ? showMode === "wins"
                      ? "Max wins"
                      : "Max attempts"
                    : showMode === "wins"
                      ? "Max wins shown (You vs Avg)"
                      : "Max attempts shown (You vs Avg)"
                  return [total, label]
                }}
                labelFormatter={(label) => `${categoryLabel}: ${label}`}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as CategoryDatum
                  const displayName = chartType === "species"
                    ? speciesDisplayLabel(String(label))
                    : chartType === "background"
                      ? String(label).replace(/\bElementalist\b/g, "Elem.")
                      : String(label)
                  return (
                    <div className="border-2 border-primary bg-card p-3">
                      <p className="font-mono text-sm text-primary">{displayName}</p>
                      <p className="text-base text-muted-foreground">
                        {showAverages ? "You: " : ""}
                        {p.userAttempts} attempts, {p.userWins} wins
                      </p>
                      {showAverages && (
                        <p className="text-base text-muted-foreground">
                          Avg: {p.avgAttempts} attempts{p.avgIsEstimated ? " (est.)" : ""}, {p.avgWins} wins
                        </p>
                      )}
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="firstSegDisplay"
                stackId="stack"
                radius={[0, 0, 0, 0]}
                isAnimationActive={false}
                shape={(p: unknown) => (
                  <WinPerfAnimatedBarRect {...(p as Record<string, unknown>)} />
                )}
              >
                {displayData.map((entry) => (
                  <Cell
                    key={`first-${entry.name}`}
                    fill={(entry as CategoryDatum & { isAvgFirstDisplay: boolean }).isAvgFirstDisplay ? attemptsColor : winsColor}
                  />
                ))}
              </Bar>
              <Bar
                dataKey="secondSegDisplay"
                stackId="stack"
                radius={[0, 2, 2, 0]}
                isAnimationActive={false}
                shape={(p: unknown) => (
                  <WinPerfAnimatedBarRect {...(p as Record<string, unknown>)} />
                )}
              >
                {displayData.map((entry) => (
                  <Cell
                    key={`second-${entry.name}`}
                    fill={(entry as CategoryDatum & { isAvgFirstDisplay: boolean }).isAvgFirstDisplay ? winsColor : attemptsColor}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-[31px] flex flex-shrink-0 flex-wrap items-center justify-center gap-4">
          {showAverages && (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-6" style={{ backgroundColor: attemptsColor }} />
                <span className="text-sm text-muted-foreground">{averageAxisLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-6" style={{ backgroundColor: winsColor }} />
                <span className="text-sm text-muted-foreground">
                  You
                </span>
              </div>
            </>
          )}
          {/* {showAverages && data.some((d) => d.avgIsEstimated) && (
            <span className="text-xs text-muted-foreground">Avg shown as estimated until global data is loaded</span>
          )} */}
        </div>
        {fillHeight && <div className="min-h-0 flex-1" aria-hidden />}
      </CardContent>
    </Card>
  )
}

