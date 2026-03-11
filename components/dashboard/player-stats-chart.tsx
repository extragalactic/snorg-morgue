"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FilterToggleButton } from "@/components/ui/filter-toggle-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme } from "@/contexts/theme-context"
import {
  ALL_SPECIES_NAMES,
  DRACONIAN_COLOUR_NAMES,
  ALL_BACKGROUND_NAMES,
  GOD_NAMES_FOR_CHART,
} from "@/lib/dcss-constants"
import type { StatEntry } from "@/lib/morgue-db"
import type { StatCategoryAverage } from "@/lib/morgue-api"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

type SortMethod = "default" | "wins" | "attempts"
type ShowMode = "both" | "wins" | "attempts"
type ChartType = "species" | "background" | "gods"

// ASCII mode green shades - 8 different shades cycling through
const asciiGreenShades = [
  "#22c55e", // green-500
  "#4ade80", // green-400
  "#16a34a", // green-600
  "#86efac", // green-300
  "#15803d", // green-700
  "#bbf7d0", // green-200
  "#166534", // green-800
  "#dcfce7", // green-100
]

// Species colors
const tierColors = [
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f", "#c9c98f", "#8f9fc9", "#c98fa0", "#c9b88f",
]

// Background colors
const bgColors = [
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f", "#c9c98f", "#8f9fc9", "#c98fa0", "#c9b88f",
]

// God colors
const godColors = [
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f", "#c9c98f", "#8f9fc9", "#c98fa0", "#c9b88f",
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f", "#c9c98f", "#8f9fc9", "#c98fa0", "#c9b88f",
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f",
]

const DRACONIAN_BAR_GREY = "#9ca3af"
const DRACONIAN_LABEL_GREY = "#6b7280"

/** Display label for species: draconian colours show just the colour (e.g. "Red"), not "Red Draconian". */
function speciesDisplayLabel(name: string): string {
  if (DRACONIAN_COLOUR_NAMES.includes(name)) return name.replace(/\s+Draconian$/, "")
  return name
}

function mergeWithFullList(fullNames: string[], stats: StatEntry[]): StatEntry[] {
  const byName = new Map(stats.map((s) => [s.name, s]))
  return fullNames.map((name) => byName.get(name) ?? { name, wins: 0, attempts: 0 })
}

/** Species list with Draconian as summary row + one row per colour (grey styling for colours).
 * Any species in stats that are not in the canonical list are aggregated into an "Other" row so totals match. */
function buildSpeciesListWithDraconian(stats: StatEntry[]): StatEntry[] {
  const byName = new Map(stats.map((s) => [s.name, s]))
  const canonicalSpecies = new Set([
    ...ALL_SPECIES_NAMES,
    ...DRACONIAN_COLOUR_NAMES,
  ])
  const draconianNames = ["Draconian", ...DRACONIAN_COLOUR_NAMES]
  let draconianWins = 0
  let draconianAttempts = 0
  for (const name of draconianNames) {
    const e = byName.get(name)
    if (e) {
      draconianWins += e.wins
      draconianAttempts += e.attempts
    }
  }
  const before = ALL_SPECIES_NAMES.slice(0, 5) // Gnoll .. Mountain Dwarf
  const after = ALL_SPECIES_NAMES.slice(6)     // Troll ..
  const fullNames = [...before, "Draconian", ...DRACONIAN_COLOUR_NAMES, ...after]
  const result: StatEntry[] = []
  for (const name of fullNames) {
    if (name === "Draconian") {
      result.push({ name: "Draconian", wins: draconianWins, attempts: draconianAttempts })
    } else if (DRACONIAN_COLOUR_NAMES.includes(name)) {
      result.push(byName.get(name) ?? { name, wins: 0, attempts: 0 })
    } else {
      result.push(byName.get(name) ?? { name, wins: 0, attempts: 0 })
    }
  }
  // Include wins/attempts for species not in canonical list (e.g. different DCSS version spelling) so chart total matches
  let otherWins = 0
  let otherAttempts = 0
  for (const entry of stats) {
    if (!canonicalSpecies.has(entry.name)) {
      otherWins += entry.wins
      otherAttempts += entry.attempts
    }
  }
  if (otherWins > 0 || otherAttempts > 0) {
    result.push({ name: "Other", wins: otherWins, attempts: otherAttempts })
  }
  return result
}

function withColors<T extends Record<string, unknown>>(
  entries: StatEntry[],
  colorArray: string[],
  extra: (e: StatEntry, i: number) => T
): (StatEntry & T & { color: string })[] {
  return entries.map((e, i) => ({ ...e, color: colorArray[i % colorArray.length], ...extra(e, i) }))
}

interface SpeciesTooltipProps {
  active?: boolean
  payload?: Array<{ 
    value: number
    dataKey: string
    payload: { name: string; wins: number; attempts: number; tier: string; avgWins?: number; avgAttempts?: number } 
  }>
}

function SpeciesTooltip({ active, payload }: SpeciesTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const winRate = data.attempts > 0 ? ((data.wins / data.attempts) * 100).toFixed(1) : "0"
    const hasAvg = data.avgWins !== undefined && data.avgAttempts !== undefined
    const avgWinRate = hasAvg && (data.avgAttempts ?? 0) > 0
      ? (((data.avgWins ?? 0) / (data.avgAttempts ?? 0)) * 100).toFixed(1)
      : null
    return (
      <div className="border-2 border-primary bg-card p-2">
        <p className="font-mono text-xs text-primary">{speciesDisplayLabel(data.name)}</p>
        <p className="text-xs text-muted-foreground mb-1">{data.tier}</p>
        <p className="text-sm">Wins: {data.wins}</p>
        <p className="text-sm">Attempts: {data.attempts}</p>
        <p className="text-sm text-primary">Win Rate: {winRate}%</p>
        {hasAvg && (
          <>
            <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border">Avg wins: {data.avgWins} · Avg attempts: {data.avgAttempts}</p>
            {avgWinRate != null && <p className="text-xs text-muted-foreground">Avg win rate: {avgWinRate}%</p>}
          </>
        )}
      </div>
    )
  }
  return null
}

interface BackgroundTooltipProps {
  active?: boolean
  payload?: Array<{ 
    value: number
    dataKey: string
    payload: { name: string; wins: number; attempts: number; category: string; avgWins?: number; avgAttempts?: number } 
  }>
}

function BackgroundTooltip({ active, payload }: BackgroundTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const winRate = data.attempts > 0 ? ((data.wins / data.attempts) * 100).toFixed(1) : "0"
    const hasAvg = data.avgWins !== undefined && data.avgAttempts !== undefined
    const avgWinRate = hasAvg && (data.avgAttempts ?? 0) > 0
      ? (((data.avgWins ?? 0) / (data.avgAttempts ?? 0)) * 100).toFixed(1)
      : null
    return (
      <div className="border-2 border-primary bg-card p-2">
        <p className="font-mono text-xs text-primary">{data.name}</p>
        <p className="text-xs text-muted-foreground mb-1">{data.category}</p>
        <p className="text-sm">Wins: {data.wins}</p>
        <p className="text-sm">Attempts: {data.attempts}</p>
        <p className="text-sm text-primary">Win Rate: {winRate}%</p>
        {hasAvg && (
          <>
            <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border">Avg wins: {data.avgWins} · Avg attempts: {data.avgAttempts}</p>
            {avgWinRate != null && <p className="text-xs text-muted-foreground">Avg win rate: {avgWinRate}%</p>}
          </>
        )}
      </div>
    )
  }
  return null
}

interface GodsTooltipProps {
  active?: boolean
  payload?: Array<{ 
    value: number
    dataKey: string
    payload: { name: string; wins: number; attempts: number; description: string; avgWins?: number; avgAttempts?: number } 
  }>
}

function GodsTooltip({ active, payload }: GodsTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const winRate = data.attempts > 0 ? ((data.wins / data.attempts) * 100).toFixed(1) : "0"
    const hasAvg = data.avgWins !== undefined && data.avgAttempts !== undefined
    const avgWinRate = hasAvg && (data.avgAttempts ?? 0) > 0
      ? (((data.avgWins ?? 0) / (data.avgAttempts ?? 0)) * 100).toFixed(1)
      : null
    return (
      <div className="border-2 border-primary bg-card p-2 max-w-xs">
        <p className="font-mono text-xs text-primary">{data.name}</p>
        {data.description && <p className="text-xs text-muted-foreground mb-1 italic">{data.description}</p>}
        <p className="text-sm">Wins: {data.wins}</p>
        <p className="text-sm">Attempts: {data.attempts}</p>
        <p className="text-sm text-primary">Win Rate: {winRate}%</p>
        {hasAvg && (
          <>
            <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border">Avg wins: {data.avgWins} · Avg attempts: {data.avgAttempts}</p>
            {avgWinRate != null && <p className="text-xs text-muted-foreground">Avg win rate: {avgWinRate}%</p>}
          </>
        )}
      </div>
    )
  }
  return null
}

// Custom pattern for wins (striped)
function StripedPattern({ id, color }: { id: string; color: string }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
      <rect width="2" height="4" fill={color} />
      <rect x="2" width="2" height="4" fill={color} fillOpacity="0.4" />
    </pattern>
  )
}

/** Custom bar shape that forces fill onto the rect so bars are always visible (works around Recharts default fill not showing). */
function BarRectShape(props: Record<string, unknown>) {
  const { fill, fillOpacity, x, y, width, height } = props as {
    fill?: string
    fillOpacity?: number
    x?: number
    y?: number
    width?: number
    height?: number
  }
  const fx = Number(x) || 0
  const fy = Number(y) || 0
  const fw = Math.max(0, Number(width) || 0)
  const fh = Math.max(0, Number(height) || 0)
  if (fw === 0 || fh === 0) return null
  const barFill = fill && String(fill).trim() ? String(fill) : "#d4a574"
  const opacity = fillOpacity !== undefined && fillOpacity !== null ? Number(fillOpacity) : 1
  return <rect x={fx} y={fy} width={fw} height={fh} fill={barFill} fillOpacity={opacity} />
}

export interface PlayerStatsChartProps {
  speciesStats?: StatEntry[]
  backgroundStats?: StatEntry[]
  godStats?: StatEntry[]
  speciesAverages?: StatCategoryAverage[]
  backgroundAverages?: StatCategoryAverage[]
  godAverages?: StatCategoryAverage[]
}

export function PlayerStatsChart({
  speciesStats = [],
  backgroundStats = [],
  godStats = [],
  speciesAverages = [],
  backgroundAverages = [],
  godAverages = [],
}: PlayerStatsChartProps) {
  const [sortMethod, setSortMethod] = useState<SortMethod>("default")
  const [showMode, setShowMode] = useState<ShowMode>("wins")
  const [chartType, setChartType] = useState<ChartType>("species")
  const { themeStyle } = useTheme()

  // Build chart data: merge full canonical lists with user stats so zero-data entries show
  const allSpeciesData = useMemo(() => {
    const entries = buildSpeciesListWithDraconian(speciesStats)
    return entries.map((e, i) => {
      const isDraconianColour = DRACONIAN_COLOUR_NAMES.includes(e.name)
      return {
        ...e,
        tier: "—",
        color: isDraconianColour ? DRACONIAN_BAR_GREY : tierColors[i % tierColors.length],
        isDraconianColour,
      }
    })
  }, [speciesStats])
  const allBackgroundData = useMemo(
    () => withColors(mergeWithFullList(ALL_BACKGROUND_NAMES, backgroundStats), bgColors, () => ({ category: "—" })),
    [backgroundStats]
  )
  const allGodsData = useMemo(
    () => withColors(mergeWithFullList(GOD_NAMES_FOR_CHART, godStats), godColors, () => ({ description: "" })),
    [godStats]
  )

  // No-god summary for Gods chart header (from full godStats including "(no god)")
  const noGodSummary = useMemo(() => {
    const total = godStats.reduce((s, e) => s + e.attempts, 0)
    const noGod = godStats.find((e) => e.name === "(no god)")
    const count = noGod?.attempts ?? 0
    const pct = total ? (count / total) * 100 : 0
    return { count, pct }
  }, [godStats])

  // Memoize colors based on theme to force re-render when theme changes
  const speciesColors = useMemo(() => 
    allSpeciesData.map((entry, index) => {
      const e = entry as { color: string; isDraconianColour?: boolean }
      if (e.isDraconianColour) return DRACONIAN_BAR_GREY
      return themeStyle === "ascii" ? asciiGreenShades[index % asciiGreenShades.length] : e.color
    }),
    [themeStyle, allSpeciesData]
  )

  const backgroundColors = useMemo(() => 
    allBackgroundData.map((entry, index) => 
      themeStyle === "ascii" ? asciiGreenShades[index % asciiGreenShades.length] : entry.color
    ),
    [themeStyle, allBackgroundData]
  )

  const godsColors = useMemo(() => 
    allGodsData.map((entry, index) => 
      themeStyle === "ascii" ? asciiGreenShades[index % asciiGreenShades.length] : entry.color
    ),
    [themeStyle, allGodsData]
  )

  const sortedSpeciesData = useMemo(() => {
    if (sortMethod === "default") return allSpeciesData
    // Keep Draconian block (main row + colour rows) together; only the main Draconian row participates in sort.
    const others = allSpeciesData.filter(
      (e) => e.name !== "Draconian" && !DRACONIAN_COLOUR_NAMES.includes(e.name)
    )
    const draconianMain = allSpeciesData.find((e) => e.name === "Draconian")!
    const draconianColourRows = DRACONIAN_COLOUR_NAMES.map((name) =>
      allSpeciesData.find((e) => e.name === name)!
    )
    const sortKey = sortMethod === "wins" ? "wins" : "attempts"
    const sorted = [...others, draconianMain].sort(
      (a, b) => (b[sortKey] as number) - (a[sortKey] as number)
    )
    return sorted.flatMap((e) =>
      e.name === "Draconian" ? [e, ...draconianColourRows] : [e]
    )
  }, [sortMethod, allSpeciesData])

  const sortedBackgroundData = useMemo(() => {
    if (sortMethod === "default") return allBackgroundData
    return [...allBackgroundData].sort((a, b) => 
      sortMethod === "wins" ? b.wins - a.wins : b.attempts - a.attempts
    )
  }, [sortMethod, allBackgroundData])

  const sortedGodsData = useMemo(() => {
    if (sortMethod === "default") return allGodsData
    return [...allGodsData].sort((a, b) => 
      sortMethod === "wins" ? b.wins - a.wins : b.attempts - a.attempts
    )
  }, [sortMethod, allGodsData])

  // Get current chart data, colors, and tooltip based on selected type
  const currentChartData = chartType === "species" ? sortedSpeciesData 
    : chartType === "background" ? sortedBackgroundData 
    : sortedGodsData

  const currentColors = chartType === "species" ? speciesColors 
    : chartType === "background" ? backgroundColors 
    : godsColors

  const currentAllData = chartType === "species" ? allSpeciesData 
    : chartType === "background" ? allBackgroundData 
    : allGodsData

  const CurrentTooltip = chartType === "species" ? SpeciesTooltip 
    : chartType === "background" ? BackgroundTooltip 
    : GodsTooltip

  const currentAverages = chartType === "species" ? speciesAverages 
    : chartType === "background" ? backgroundAverages 
    : godAverages
  const currentAveragesMap = useMemo(
    () => new Map(currentAverages.map((a) => [a.name, a])),
    [currentAverages]
  )
  const hasAverages = currentAverages.length > 0

  type ChartRow = (typeof currentChartData)[number] & {
    barSegLeft?: number
    barSegRight?: number
    leftIsAvg?: boolean
    avgWins?: number
    avgAttempts?: number
  }
  const chartDataForBars = useMemo((): ChartRow[] => {
    if (!hasAverages) {
      return currentChartData.map((row) => ({
        ...row,
        wins: Number(row.wins) || 0,
        attempts: Number(row.attempts) || 0,
      })) as ChartRow[]
    }
    const metric = showMode === "wins" ? "wins" : "attempts"
    return currentChartData.map((row) => {
      const avg = currentAveragesMap.get(row.name)
      const userVal = Number(row[metric]) || 0
      const avgVal = metric === "wins" ? (Number(avg?.avgWins) || 0) : (Number(avg?.avgAttempts) || 0)
      const leftLen = Math.min(userVal, avgVal)
      const rightLen = Math.max(userVal, avgVal) - leftLen
      const leftIsAvg = avgVal <= userVal
      return {
        ...row,
        wins: Number(row.wins) || 0,
        attempts: Number(row.attempts) || 0,
        barSegLeft: leftLen,
        barSegRight: rightLen,
        leftIsAvg,
        avgWins: avg?.avgWins ?? 0,
        avgAttempts: avg?.avgAttempts ?? 0,
      }
    })
  }, [hasAverages, currentChartData, showMode, currentAveragesMap])

  const chartHeight = currentChartData.length > 0
    ? Math.min(chartType === "gods" ? 850 : 900, Math.max(200, currentChartData.length * 36))
    : 400
  const xDomainMax = chartDataForBars.length
    ? hasAverages
      ? Math.max(3, ...chartDataForBars.map((d) => (Number(d.barSegLeft) || 0) + (Number(d.barSegRight) || 0)))
      : showMode === "wins"
        ? Math.max(3, ...chartDataForBars.map((d) => Number(d.wins) || 0))
        : Math.max(3, ...chartDataForBars.map((d) => Number(d.attempts) || 0))
    : 3
  const xDomain: [number, number] = [0, xDomainMax]
  const hasData = currentChartData.length > 0

  const maxDataValue = hasData
    ? showMode === "wins"
      ? Math.max(...chartDataForBars.map((d) => Number(d.wins) || 0))
      : Math.max(...chartDataForBars.map((d) => Number(d.attempts) || 0))
    : 0
  const hasAnyValues = maxDataValue > 0

  // Minimal data to verify Recharts renders bars; remove or set to false once confirmed
  const DEBUG_BAR_CHART = false
  const displayData: Array<{ name: string; wins: number; attempts: number }> = DEBUG_BAR_CHART
    ? [
        { name: "Test A", wins: 3, attempts: 10 },
        { name: "Test B", wins: 1, attempts: 5 },
        { name: "Test C", wins: 0, attempts: 2 },
      ]
    : chartDataForBars.map((d) => ({ name: d.name, wins: Number(d.wins) || 0, attempts: Number(d.attempts) || 0 }))

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="font-mono text-sm text-primary flex items-center gap-2">
          <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
            <SelectTrigger className="w-[140px] rounded-none border-2 border-primary/50 font-mono text-sm h-8 hover:text-yellow-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2 border-primary/50">
              <SelectItem value="species" className="font-mono text-sm cursor-pointer hover:text-yellow-400">Species</SelectItem>
              <SelectItem value="background" className="font-mono text-sm cursor-pointer hover:text-yellow-400">Background</SelectItem>
              <SelectItem value="gods" className="font-mono text-sm cursor-pointer hover:text-yellow-400">Gods</SelectItem>
            </SelectContent>
          </Select>
          <span>PERFORMANCE</span>
          {chartType === "gods" && (
            <span className="text-muted-foreground text-sm font-normal" style={{ marginLeft: 20 }}>
              {noGodSummary.pct.toFixed(0)}% of games had no god
            </span>
          )}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-6 pt-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-primary">SORT BY:</span>
            <div className="flex gap-2">
              <FilterToggleButton
                selected={sortMethod === "wins"}
                onClick={() => setSortMethod("wins")}
              >
                Wins
              </FilterToggleButton>
              <FilterToggleButton
                selected={sortMethod === "attempts"}
                onClick={() => setSortMethod("attempts")}
              >
                Attempts
              </FilterToggleButton>
              <FilterToggleButton
                selected={sortMethod === "default"}
                onClick={() => setSortMethod("default")}
              >
                Default
              </FilterToggleButton>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-primary">SHOW:</span>
            <div className="flex gap-2">
              <FilterToggleButton
                selected={showMode === "wins"}
                onClick={() => setShowMode("wins")}
              >
                Wins
              </FilterToggleButton>
              <FilterToggleButton
                selected={showMode === "attempts"}
                onClick={() => setShowMode("attempts")}
              >
                Attempts
              </FilterToggleButton>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {hasData ? (
          hasAnyValues ? (
          <div style={{ width: "100%", minWidth: 400, minHeight: chartHeight }}>
          <BarChart
              data={displayData}
              width={600}
              height={DEBUG_BAR_CHART ? 300 : chartHeight}
              barGap={4}
              barCategoryGap="10%"
              margin={{ top: 5, right: 30, left: 5, bottom: DEBUG_BAR_CHART ? 40 : 80 }}
            >
              <defs>
                {chartDataForBars.map((entry, index) => {
                  const origIndex = currentAllData.findIndex((d: { name: string }) => d.name === entry.name)
                  const color = (origIndex >= 0 ? currentColors[origIndex] : currentColors[0]) ?? "#888"
                  return (
                    <StripedPattern key={`pattern-${index}`} id={`stripe-${index}`} color={color} />
                  )
                })}
              </defs>
              <XAxis
                type="category"
                dataKey="name"
                stroke="var(--muted-foreground)"
                fontSize={12}
                angle={DEBUG_BAR_CHART ? 0 : -45}
                textAnchor={DEBUG_BAR_CHART ? "middle" : "end"}
                height={DEBUG_BAR_CHART ? 40 : 80}
                interval={0}
              />
              <YAxis
                type="number"
                stroke="var(--muted-foreground)"
                fontSize={14}
                domain={DEBUG_BAR_CHART ? [0, 10] : xDomain}
                allowDecimals={false}
              />
              <Tooltip content={<CurrentTooltip />} />
              {hasAverages && !DEBUG_BAR_CHART ? (
                <>
                  <Bar dataKey="barSegLeft" stackId="dual" radius={0} shape={BarRectShape}>
                    {chartDataForBars.map((entry, index) => {
                      const origIndex = currentAllData.findIndex((d: { name: string }) => d.name === entry.name)
                      if (entry.leftIsAvg) {
                        return <Cell key={`left-${index}`} fill="var(--average-color)" />
                      }
                      return (
                        <Cell
                          key={`left-${index}`}
                          fill={showMode === "wins" ? `url(#stripe-${index})` : currentColors[origIndex]}
                          fillOpacity={showMode === "attempts" ? 0.5 : 1}
                        />
                      )
                    })}
                  </Bar>
                  <Bar dataKey="barSegRight" stackId="dual" radius={0} shape={BarRectShape}>
                    {chartDataForBars.map((entry, index) => {
                      const origIndex = currentAllData.findIndex((d: { name: string }) => d.name === entry.name)
                      if (!entry.leftIsAvg) {
                        return <Cell key={`right-${index}`} fill="var(--average-color)" />
                      }
                      return (
                        <Cell
                          key={`right-${index}`}
                          fill={showMode === "wins" ? `url(#stripe-${index})` : currentColors[origIndex]}
                          fillOpacity={showMode === "attempts" ? 0.5 : 1}
                        />
                      )
                    })}
                  </Bar>
                </>
              ) : (
                <>
                  {showMode === "attempts" && (
                    <Bar dataKey="attempts" radius={0} fill="#888888" isAnimationActive={false} shape={BarRectShape}>
                      {displayData.map((row, index) => {
                        const origIndex = currentAllData.findIndex((d: { name: string }) => d.name === row.name)
                        const color = (origIndex >= 0 ? currentColors[origIndex] : currentColors[0]) ?? "#888"
                        return <Cell key={`attempts-${index}`} fill={color} fillOpacity={0.7} />
                      })}
                    </Bar>
                  )}
                  {showMode === "wins" && (
                    <Bar dataKey="wins" radius={0} fill="#d4a574" isAnimationActive={false} shape={BarRectShape}>
                      {displayData.map((row, index) => {
                        const origIndex = currentAllData.findIndex((d: { name: string }) => d.name === row.name)
                        const color = (origIndex >= 0 ? currentColors[origIndex] : currentColors[0]) ?? "#d4a574"
                        return <Cell key={`wins-${index}`} fill={color ? `url(#stripe-${index})` : "#d4a574"} />
                      })}
                    </Bar>
                  )}
                </>
              )}
            </BarChart>
          </div>
          ) : (
            <div className="flex flex-col items-center justify-center font-mono text-sm text-muted-foreground py-12 gap-2" style={{ height: chartHeight }}>
              <p>No wins or attempts data for this view.</p>
              <p className="text-xs">Species: {speciesStats?.length ?? 0} · Backgrounds: {backgroundStats?.length ?? 0} · Gods: {godStats?.length ?? 0}</p>
              <p className="text-xs">If you have morgues uploaded, try re-uploading one or refreshing the page to recalculate stats.</p>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center font-mono text-sm text-muted-foreground" style={{ height: chartHeight }}>
            {chartType === "species" && "No species data yet"}
            {chartType === "background" && "No background data yet"}
            {chartType === "gods" && "No god data yet"}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          {showMode === "wins" && (
            <div className="flex items-center gap-2">
              <div 
                className="h-3 w-6" 
                style={{ 
                  backgroundSize: '6px 6px', 
                  backgroundImage: themeStyle === "ascii" 
                    ? 'repeating-linear-gradient(-45deg, #22c55e, #22c55e 2px, rgba(34,197,94,0.4) 2px, rgba(34,197,94,0.4) 4px)'
                    : 'repeating-linear-gradient(-45deg, #d4a574, #d4a574 2px, rgba(212,165,116,0.4) 2px, rgba(212,165,116,0.4) 4px)' 
                }} 
              />
              <span className="text-sm text-muted-foreground">Wins</span>
            </div>
          )}
          {showMode === "attempts" && (
            <div className="flex items-center gap-2">
              <div 
                className="h-3 w-6" 
                style={{ backgroundColor: themeStyle === "ascii" ? "rgba(34,197,94,0.5)" : "rgba(212,165,116,0.5)" }} 
              />
              <span className="text-sm text-muted-foreground">Attempts</span>
            </div>
          )}
          {hasAverages && (
            <div className="flex items-center gap-2">
              <div className="h-3 w-6" style={{ backgroundColor: "var(--average-color)" }} />
              <span className="text-sm text-muted-foreground">Average</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
