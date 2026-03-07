"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/contexts/theme-context"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

// Generate sample death data for levels 1-27
// Most deaths occur in early-mid game with a spike around XL 14-15
const levelDeathData = [
  { level: 1, deaths: 12 },
  { level: 2, deaths: 18 },
  { level: 3, deaths: 25 },
  { level: 4, deaths: 22 },
  { level: 5, deaths: 28 },
  { level: 6, deaths: 20 },
  { level: 7, deaths: 15 },
  { level: 8, deaths: 18 },
  { level: 9, deaths: 14 },
  { level: 10, deaths: 16 },
  { level: 11, deaths: 19 },
  { level: 12, deaths: 22 },
  { level: 13, deaths: 25 },
  { level: 14, deaths: 30 },
  { level: 15, deaths: 28 },
  { level: 16, deaths: 20 },
  { level: 17, deaths: 15 },
  { level: 18, deaths: 12 },
  { level: 19, deaths: 10 },
  { level: 20, deaths: 8 },
  { level: 21, deaths: 6 },
  { level: 22, deaths: 5 },
  { level: 23, deaths: 4 },
  { level: 24, deaths: 3 },
  { level: 25, deaths: 2 },
  { level: 26, deaths: 1 },
  { level: 27, deaths: 1 },
]

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

export function LevelAtDeathChart() {
  const { themeStyle } = useTheme()
  
  // Line color based on theme
  const lineColor = themeStyle === "ascii" ? "#22c55e" : "#d4a574"
  const gridColor = themeStyle === "ascii" ? "rgba(34,197,94,0.2)" : "rgba(212,165,116,0.2)"

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
