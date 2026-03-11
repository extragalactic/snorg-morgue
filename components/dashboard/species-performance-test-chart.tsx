"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { StatEntry } from "@/lib/morgue-db"
import type { StatCategoryAverage } from "@/lib/morgue-api"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useTheme } from "@/contexts/theme-context"

interface SpeciesPerformanceTestChartProps {
  speciesStats?: StatEntry[]
  speciesAverages?: StatCategoryAverage[]
}

type SpeciesDatum = {
  name: string
  userAttempts: number
  avgAttempts: number
}

function buildSpeciesTestData(
  speciesStats: StatEntry[] = [],
  speciesAverages: StatCategoryAverage[] = [],
): SpeciesDatum[] {
  // Take the first 10 entries (as-is) and map to a simple flat shape.
  return speciesStats.slice(0, 10).map((s) => {
    const avg = speciesAverages.find((a) => a.name === s.name)
    return {
      name: s.name,
      userAttempts: s.attempts,
      avgAttempts: avg?.avgAttempts ?? 0,
    }
  })
}

export function SpeciesPerformanceTestChart({
  speciesStats = [],
  speciesAverages = [],
}: SpeciesPerformanceTestChartProps) {
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
        <CardTitle className="font-mono text-sm text-primary">
          SPECIES PERFORMANCE TEST (FIRST 10, ATTEMPTS)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={260}>
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
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              width={100}
            />
            <Tooltip
              formatter={(value: number, key: string, payload) => {
                const p = payload.payload as SpeciesDatum
                if (key === "userAttempts") return [value, "You (attempts)"]
                if (key === "avgAttempts") return [value, "Avg (all players)"]
                return [value, key]
              }}
              labelFormatter={(label) => `Species: ${label}`}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              formatter={(value) =>
                value === "userAttempts" ? "You (attempts)" : "Avg (all players)"
              }
              wrapperStyle={{
                fontFamily: "var(--font-body)",
                fontSize: 11,
                bottom: 5,
              }}
            />
            <Bar
              dataKey="userAttempts"
              fill={winsColor}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="avgAttempts"
              fill={attemptsColor}
              radius={[0, 0, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

