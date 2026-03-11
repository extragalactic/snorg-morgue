"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { GameRecord } from "@/lib/morgue-api"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

function buildPerformanceData(morgues: GameRecord[]): { month: string; winRate: number; avgXL: number }[] {
  if (morgues.length === 0) {
    return [
      { month: "—", winRate: 0, avgXL: 0 },
    ]
  }
  const byMonth: Record<string, { wins: number; total: number; xlSum: number }> = {}
  morgues.forEach((m) => {
    const date = m.date.slice(0, 7)
    if (!byMonth[date]) byMonth[date] = { wins: 0, total: 0, xlSum: 0 }
    byMonth[date].total++
    if (m.result === "win") byMonth[date].wins++
    byMonth[date].xlSum += m.xl
  })
  const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
  return sorted.map(([month, d]) => ({
    month,
    winRate: d.total ? Math.round((d.wins / d.total) * 100) : 0,
    avgXL: d.total ? Math.round((d.xlSum / d.total) * 10) / 10 : 0,
  }))
}

const emptyPerformanceData = [{ month: "—", winRate: 0, avgXL: 0 }]

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="border-2 border-primary bg-card p-4">
        <p className="font-mono text-sm text-primary mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-base" style={{ color: entry.color }}>
            {entry.dataKey === "winRate"
              ? "Win Rate"
              : "Avg XL"}
            : {entry.value}
            {entry.dataKey === "winRate" ? "%" : ""}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function PerformanceGraph({ morgues = [] }: { morgues?: GameRecord[] }) {
  const performanceData = morgues.length > 0 ? buildPerformanceData(morgues) : emptyPerformanceData
  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="font-mono text-sm text-primary">
          YOUR PERFORMANCE OVER TIME
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={performanceData}>
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="stepAfter"
              dataKey="winRate"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ fill: "var(--chart-1)", strokeWidth: 0, r: 4 }}
            />
            <Line
              type="stepAfter"
              dataKey="avgXL"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={{ fill: "var(--chart-2)", strokeWidth: 0, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-[var(--chart-1)]" />
            <span className="text-xs text-muted-foreground">Win Rate %</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-[var(--chart-2)]" />
            <span className="text-xs text-muted-foreground">Avg XL</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
