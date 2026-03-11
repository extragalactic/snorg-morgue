 "use client"

import { useMemo, useState } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

type ChartType = "species" | "background" | "gods"
type ShowMode = "wins" | "attempts"

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
}: TestPerformanceChartProps) {
  const { themeStyle } = useTheme()
  const [chartType, setChartType] = useState<ChartType>("species")
  const [showMode, setShowMode] = useState<ShowMode>("attempts")

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

  const winsColor =
    themeStyle === "ascii" ? "oklch(0.8 0.2 145)" : "rgba(250, 204, 21, 0.9)"
  const attemptsColor =
    themeStyle === "ascii" ? "oklch(0.5 0.1 145)" : "rgba(148, 163, 184, 0.6)"

  const displayData = useMemo(() => data.map((d) => ({
    ...d,
    firstSegDisplay: showMode === "wins" ? d.firstSegWins : d.firstSeg,
    secondSegDisplay: showMode === "wins" ? d.secondSegWins : d.secondSeg,
    isAvgFirstDisplay: showMode === "wins" ? d.isAvgFirstWins : d.isAvgFirst,
  })), [data, showMode])

  const chartHeight = displayData.length > 0
    ? Math.min(chartType === "gods" ? 850 : 900, Math.max(200, displayData.length * 36))
    : 400

  const categoryLabel = chartType === "species" ? "Species" : chartType === "background" ? "Background" : "God"

  if (displayData.length === 0) {
    return null
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="font-mono text-sm text-primary flex items-center gap-2">
          <Select value={chartType} onValueChange={(v: ChartType) => setChartType(v)}>
            <SelectTrigger className="w-[140px] rounded-none border-2 border-primary/50 font-mono text-sm h-8 hover:text-yellow-400">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none border-2 border-primary/50">
              <SelectItem value="species" className="font-mono text-sm cursor-pointer hover:text-yellow-400">Species</SelectItem>
              <SelectItem value="background" className="font-mono text-sm cursor-pointer hover:text-yellow-400">Background</SelectItem>
              <SelectItem value="gods" className="font-mono text-sm cursor-pointer hover:text-yellow-400">Gods</SelectItem>
            </SelectContent>
          </Select>
          <span>TEST PERFORMANCE</span>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-6 pt-3">
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
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={displayData}
            layout="vertical"
            barGap={0}
            barCategoryGap="20%"
          >
            <XAxis
              type="number"
              stroke="var(--muted-foreground)"
              fontSize={14}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--muted-foreground)"
              fontSize={14}
              width={160}
              tickLine={false}
              interval={0}
              tick={
                chartType === "species"
                  ? (props: { x: number; y: number; payload?: { value?: string } }) => {
                      const value = props.payload?.value ?? ""
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
                  : chartType === "background"
                    ? (props: { x: number; y: number; payload?: { value?: string } }) => {
                        const value = (props.payload?.value ?? "").replace(/\bElementalist\b/g, "Elem.")
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
                            {value}
                          </text>
                        )
                      }
                    : undefined
              }
            />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.06)", stroke: "transparent" }}
              formatter={(value: number, key: string, payload) => {
                const p = payload.payload as CategoryDatum & { firstSegDisplay: number; secondSegDisplay: number; isAvgFirstDisplay: boolean }
                if (key === "firstSegDisplay") {
                  return [p.firstSegDisplay, p.isAvgFirstDisplay ? "Avg (all players)" : showMode === "wins" ? "You (wins)" : "You (attempts)"]
                }
                if (key === "secondSegDisplay") {
                  return [p.secondSegDisplay, p.isAvgFirstDisplay ? (showMode === "wins" ? "You (wins)" : "You (attempts)") : "Avg (all players)"]
                }
                return [value, key]
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
                      You: {p.userAttempts} attempts, {p.userWins} wins
                    </p>
                    <p className="text-base text-muted-foreground">
                      Avg: {p.avgAttempts} attempts{p.avgIsEstimated ? " (est.)" : ""}, {p.avgWins} wins
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="firstSegDisplay" stackId="stack" radius={[0, 0, 0, 0]}>
              {displayData.map((entry, index) => (
                <Cell
                  key={`first-${index}`}
                  fill={(entry as CategoryDatum & { isAvgFirstDisplay: boolean }).isAvgFirstDisplay ? attemptsColor : winsColor}
                />
              ))}
            </Bar>
            <Bar dataKey="secondSegDisplay" stackId="stack" radius={[0, 2, 2, 0]}>
              {displayData.map((entry, index) => (
                <Cell
                  key={`second-${index}`}
                  fill={(entry as CategoryDatum & { isAvgFirstDisplay: boolean }).isAvgFirstDisplay ? winsColor : attemptsColor}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-6" style={{ backgroundColor: attemptsColor }} />
            <span className="text-sm text-muted-foreground">Avg (all players)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-6" style={{ backgroundColor: winsColor }} />
            <span className="text-sm text-muted-foreground">
              You ({showMode === "wins" ? "wins" : "attempts"})
            </span>
          </div>
          {data.some((d) => d.avgIsEstimated) && (
            <span className="text-xs text-muted-foreground">Avg shown as estimated until global data is loaded</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

