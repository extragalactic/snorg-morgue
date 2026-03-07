"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

const performanceData = [
  { month: "Jan", winRate: 8, avgXL: 12, runesCollected: 2 },
  { month: "Feb", winRate: 10, avgXL: 14, runesCollected: 5 },
  { month: "Mar", winRate: 7, avgXL: 11, runesCollected: 3 },
  { month: "Apr", winRate: 15, avgXL: 16, runesCollected: 8 },
  { month: "May", winRate: 18, avgXL: 18, runesCollected: 12 },
  { month: "Jun", winRate: 22, avgXL: 20, runesCollected: 15 },
  { month: "Jul", winRate: 20, avgXL: 19, runesCollected: 14 },
  { month: "Aug", winRate: 25, avgXL: 22, runesCollected: 18 },
]

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="border-2 border-primary bg-card p-3">
        <p className="font-mono text-xs text-primary mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.dataKey === "winRate"
              ? "Win Rate"
              : entry.dataKey === "avgXL"
              ? "Avg XL"
              : "Runes"}
            : {entry.value}
            {entry.dataKey === "winRate" ? "%" : ""}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function PerformanceGraph() {
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
            <Line
              type="stepAfter"
              dataKey="runesCollected"
              stroke="var(--chart-3)"
              strokeWidth={2}
              dot={{ fill: "var(--chart-3)", strokeWidth: 0, r: 4 }}
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
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-[var(--chart-3)]" />
            <span className="text-xs text-muted-foreground">Runes Collected</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
