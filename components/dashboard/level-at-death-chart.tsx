"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/contexts/theme-context"
import type { GameRecord } from "@/lib/morgue-api"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts"

function buildLevelDeathData(morgues: GameRecord[]): { level: number; deaths: number }[] {
  const deaths = morgues.filter((m) => m.result === "death")
  const byLevel: Record<number, number> = {}
  for (let i = 1; i <= 27; i++) byLevel[i] = 0
  deaths.forEach((m) => {
    const xl = Math.min(27, Math.max(1, m.xl))
    byLevel[xl] = (byLevel[xl] ?? 0) + 1
  })
  return Object.entries(byLevel).map(([level, deaths]) => ({
    level: parseInt(level, 10),
    deaths,
  }))
}

// Fallback when no data
const emptyLevelData = Array.from({ length: 27 }, (_, i) => ({ level: i + 1, deaths: 0 }))

interface LevelDeathTooltipProps {
  active?: boolean
  payload?: Array<{
    value: number
    name: string
    color: string
    payload: { level: number; deaths: number; avgDeaths?: number }
  }>
}

function LevelDeathTooltip({ active, payload }: LevelDeathTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="border-2 border-primary bg-card p-2">
        <p className="font-mono text-xs text-primary">Level {data.level}</p>
        {payload.map((p) => (
          <p key={p.name} className="text-sm" style={{ color: p.color }}>
            {p.name}: {p.value.toFixed ? p.value.toFixed(2) : p.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function LevelAtDeathChart({
  morgues = [],
  loading,
  globalAverageDeathsPerLevel,
  globalAverageUserCount,
}: {
  morgues?: GameRecord[]
  loading?: boolean
  /** Optional global average deaths per level (same length/order as chart data). */
  globalAverageDeathsPerLevel?: number[]
  /** Optional number of users that the global average line is based on. */
  globalAverageUserCount?: number
}) {
  const { themeStyle } = useTheme()
  const baseData = morgues.length > 0 ? buildLevelDeathData(morgues) : emptyLevelData
  const hasGlobal = Array.isArray(globalAverageDeathsPerLevel) && globalAverageDeathsPerLevel.length > 0
  const levelDeathData = hasGlobal
    ? baseData.map((d, idx) => ({
        ...d,
        avgDeaths: globalAverageDeathsPerLevel[idx] ?? 0,
      }))
    : baseData
  
  // Line color based on theme
  const lineColor = themeStyle === "ascii" ? "#22c55e" : "#d4a574"
  const globalLineColor = themeStyle === "ascii" ? "#38bdf8" : "#60a5fa"
  const gridColor = themeStyle === "ascii" ? "rgba(34,197,94,0.2)" : "rgba(212,165,116,0.2)"

  if (loading) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle className="font-mono text-sm text-primary">LEVEL AT DEATH</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="font-mono text-sm text-primary flex items-center justify-between gap-2">
          <span>LEVEL AT DEATH</span>
          {morgues.length > 0 && (() => {
            const deaths = morgues.filter((m) => m.result === "death").length
            return (
              <span className="font-mono text-xs font-normal text-muted-foreground">
                Total YASDs: {deaths}
              </span>
            )
          })()}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={levelDeathData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="level"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              label={{
                value: "Experience Level",
                position: "bottom",
                offset: 0,
                style: { fill: 'var(--muted-foreground)', fontSize: 12 }
              }}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              label={{
                value: "Number of Deaths",
                angle: -90,
                position: "insideLeft",
                style: { fill: 'var(--muted-foreground)', fontSize: 12, textAnchor: 'middle' }
              }}
            />
            <Tooltip content={<LevelDeathTooltip />} />
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{
                fontFamily: "var(--font-body)",
                fontSize: 11,
                bottom: 0,
              }}
            />
            <Line
              type="monotone"
              dataKey="deaths"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ fill: lineColor, strokeWidth: 0, r: 3 }}
              activeDot={{ fill: lineColor, strokeWidth: 0, r: 5 }}
              name="You"
            />
            {hasGlobal && (
              <Line
                type="monotone"
                dataKey="avgDeaths"
                stroke={globalLineColor}
                strokeWidth={2}
                dot={false}
                name={
                  globalAverageUserCount && globalAverageUserCount > 0
                    ? `Average (${globalAverageUserCount} users)`
                    : "Average"
                }
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
