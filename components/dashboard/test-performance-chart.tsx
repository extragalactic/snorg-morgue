 "use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StatEntry } from "@/lib/morgue-db"
import type { StatCategoryAverage } from "@/lib/morgue-api"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useTheme } from "@/contexts/theme-context"

interface TestPerformanceChartProps {
  speciesStats?: StatEntry[]
  speciesAverages?: StatCategoryAverage[]
}

type SpeciesDatum = {
  name: string
  userAttempts: number
  avgAttempts: number
  /** First segment length (closest to origin): always the smaller of avg vs you. */
  firstSeg: number
  /** Second segment length: the remainder so total bar = max(avg, you). */
  secondSeg: number
  /** True when first segment is avg (grey), second is you (yellow). */
  isAvgFirst: boolean
  /** True when avg was derived because no average data was provided. */
  avgIsEstimated?: boolean
}

function buildSpeciesTestData(
  speciesStats: StatEntry[] = [],
  speciesAverages: StatCategoryAverage[] = [],
): SpeciesDatum[] {
  const hasAverages = speciesAverages.length > 0
  return speciesStats.map((s) => {
    const avgEntry = speciesAverages.find((a) => a.name === s.name)
    const userAttempts = s.attempts
    const avgAttempts = hasAverages && avgEntry?.avgAttempts != null
      ? avgEntry.avgAttempts
      : Math.max(1, Math.round(userAttempts * 0.5))
    const avgIsEstimated = !hasAverages || avgEntry == null
    const low = Math.min(avgAttempts, userAttempts)
    const high = Math.max(avgAttempts, userAttempts)
    const firstSeg = low
    const secondSeg = high - low
    const isAvgFirst = avgAttempts < userAttempts
    return {
      name: s.name,
      userAttempts,
      avgAttempts: avgEntry?.avgAttempts ?? avgAttempts,
      firstSeg,
      secondSeg,
      isAvgFirst,
      avgIsEstimated,
    }
  })
}

export function TestPerformanceChart({
  speciesStats = [],
  speciesAverages = [],
}: TestPerformanceChartProps) {
  const data = buildSpeciesTestData(speciesStats, speciesAverages)
  const { themeStyle } = useTheme()

  const winsColor =
    themeStyle === "ascii" ? "oklch(0.8 0.2 145)" : "rgba(250, 204, 21, 0.9)"
  const attemptsColor =
    themeStyle === "ascii" ? "oklch(0.5 0.1 145)" : "rgba(148, 163, 184, 0.6)"

  if (data.length === 0) {
    return null
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="font-mono text-sm text-primary">TEST PERFORMANCE</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={520}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 20, left: 100, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis
              type="number"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              allowDecimals={false}
              label={{
                value: "Attempts",
                position: "bottom",
                offset: 0,
                style: { fill: "var(--muted-foreground)", fontSize: 12 },
              }}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              width={100}
              interval={0}
            />
            <Tooltip
              formatter={(value: number, key: string, payload) => {
                const p = payload.payload as SpeciesDatum
                if (key === "firstSeg") {
                  return [p.firstSeg, p.isAvgFirst ? "Avg (all players)" : "You (attempts)"]
                }
                if (key === "secondSeg") {
                  return [p.secondSeg, p.isAvgFirst ? "You (attempts)" : "Avg (all players)"]
                }
                return [value, key]
              }}
              labelFormatter={(label) => `Species: ${label}`}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as SpeciesDatum
                return (
                  <div className="border-2 border-primary bg-card p-3">
                    <p className="font-mono text-sm text-primary">{label}</p>
                    <p className="text-base text-muted-foreground">
                      You: {p.userAttempts} attempts
                    </p>
                    <p className="text-base text-muted-foreground">
                      Avg: {p.avgAttempts} attempts{p.avgIsEstimated ? " (estimated)" : ""}
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="firstSeg" stackId="attempts" radius={[0, 0, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`first-${index}`}
                  fill={entry.isAvgFirst ? attemptsColor : winsColor}
                />
              ))}
            </Bar>
            <Bar dataKey="secondSeg" stackId="attempts" radius={[0, 2, 2, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`second-${index}`}
                  fill={entry.isAvgFirst ? winsColor : attemptsColor}
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
            <span className="text-sm text-muted-foreground">You (attempts)</span>
          </div>
          {data.some((d) => d.avgIsEstimated) && (
            <span className="text-xs text-muted-foreground">Avg shown as estimated until global data is loaded</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

