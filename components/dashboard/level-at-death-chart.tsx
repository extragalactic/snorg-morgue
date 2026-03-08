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
    payload: { level: number; deaths: number }
  }>
}

function LevelDeathTooltip({ active, payload }: LevelDeathTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="border-2 border-primary bg-card p-2">
        <p className="font-mono text-xs text-primary">Level {data.level}</p>
        <p className="text-sm">{data.deaths} deaths</p>
      </div>
    )
  }
  return null
}

export function LevelAtDeathChart({ morgues = [], loading }: { morgues?: GameRecord[]; loading?: boolean }) {
  const { themeStyle } = useTheme()
  const levelDeathData = morgues.length > 0 ? buildLevelDeathData(morgues) : emptyLevelData
  
  // Line color based on theme
  const lineColor = themeStyle === "ascii" ? "#22c55e" : "#d4a574"
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
        <CardTitle className="font-mono text-sm text-primary">
          LEVEL AT DEATH
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
            <Line
              type="monotone"
              dataKey="deaths"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ fill: lineColor, strokeWidth: 0, r: 3 }}
              activeDot={{ fill: lineColor, strokeWidth: 0, r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
