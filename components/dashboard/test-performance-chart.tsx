 "use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StatEntry } from "@/lib/morgue-db"
import type { StatCategoryAverage } from "@/lib/morgue-api"
import { DRACONIAN_COLOUR_NAMES } from "@/lib/dcss-constants"
import {
  buildSpeciesListWithDraconian,
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

type ShowMode = "wins" | "attempts"

type SpeciesDatum = {
  name: string
  userAttempts: number
  avgAttempts: number
  userWins: number
  avgWins: number
  /** Attempts: first (avg) and second (you) segment lengths. */
  firstSeg: number
  secondSeg: number
  isAvgFirst: boolean
  /** Wins: first (avg) and second (you) segment lengths. */
  firstSegWins: number
  secondSegWins: number
  isAvgFirstWins: boolean
  avgIsEstimated?: boolean
}

interface TestPerformanceChartProps {
  speciesStats?: StatEntry[]
  speciesAverages?: StatCategoryAverage[]
}

function buildSpeciesTestData(
  speciesList: StatEntry[],
  speciesAverages: StatCategoryAverage[] = [],
): SpeciesDatum[] {
  const hasAverages = speciesAverages.length > 0
  return speciesList.map((s) => {
    const avgEntry = speciesAverages.find((a) => a.name === s.name) as { avgAttempts?: number; avgWins?: number } | undefined
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
}: TestPerformanceChartProps) {
  const speciesList = buildSpeciesListWithDraconian(speciesStats)
  const data = buildSpeciesTestData(speciesList, speciesAverages)
  const { themeStyle } = useTheme()
  const [showMode, setShowMode] = useState<ShowMode>("attempts")

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
    ? Math.min(900, Math.max(200, displayData.length * 36))
    : 400

  if (displayData.length === 0) {
    return null
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="font-mono text-sm text-primary">TEST PERFORMANCE</CardTitle>
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
              tick={(props: { x: number; y: number; payload?: { value?: string } }) => {
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
              }}
            />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.06)", stroke: "transparent" }}
              formatter={(value: number, key: string, payload) => {
                const p = payload.payload as SpeciesDatum & { firstSegDisplay: number; secondSegDisplay: number; isAvgFirstDisplay: boolean }
                if (key === "firstSegDisplay") {
                  return [p.firstSegDisplay, p.isAvgFirstDisplay ? "Avg (all players)" : showMode === "wins" ? "You (wins)" : "You (attempts)"]
                }
                if (key === "secondSegDisplay") {
                  return [p.secondSegDisplay, p.isAvgFirstDisplay ? (showMode === "wins" ? "You (wins)" : "You (attempts)") : "Avg (all players)"]
                }
                return [value, key]
              }}
              labelFormatter={(label) => `Species: ${label}`}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as SpeciesDatum
                return (
                  <div className="border-2 border-primary bg-card p-3">
                    <p className="font-mono text-sm text-primary">{speciesDisplayLabel(String(label))}</p>
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
                  fill={(entry as SpeciesDatum & { isAvgFirstDisplay: boolean }).isAvgFirstDisplay ? attemptsColor : winsColor}
                />
              ))}
            </Bar>
            <Bar dataKey="secondSegDisplay" stackId="stack" radius={[0, 2, 2, 0]}>
              {displayData.map((entry, index) => (
                <Cell
                  key={`second-${index}`}
                  fill={(entry as SpeciesDatum & { isAvgFirstDisplay: boolean }).isAvgFirstDisplay ? winsColor : attemptsColor}
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

