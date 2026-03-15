"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const globalActivityData = [
  { date: "Week 1", games: 1250, wins: 95 },
  { date: "Week 2", games: 1420, wins: 112 },
  { date: "Week 3", games: 1180, wins: 88 },
  { date: "Week 4", games: 1550, wins: 125 },
  { date: "Week 5", games: 1680, wins: 142 },
  { date: "Week 6", games: 1420, wins: 108 },
  { date: "Week 7", games: 1890, wins: 165 },
  { date: "Week 8", games: 2100, wins: 180 },
]

const speciesPopularity = [
  { name: "Minotaur", value: 28, color: "var(--chart-1)" },
  { name: "Gargoyle", value: 22, color: "var(--chart-2)" },
  { name: "Troll", value: 18, color: "var(--chart-3)" },
  { name: "Merfolk", value: 15, color: "var(--chart-4)" },
  { name: "Other", value: 17, color: "var(--chart-5)" },
]

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
            {entry.dataKey === "games" ? "Total Games" : "Wins"}: {entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

interface PieTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { color: string } }>
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="border-2 border-primary bg-card p-3">
        <p className="font-mono text-sm" style={{ color: payload[0].payload.color }}>
          {payload[0].name}
        </p>
        <p className="text-base text-foreground">{payload[0].value}%</p>
      </div>
    )
  }
  return null
}

export function AllUsersGraph() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-2 border-primary/30 rounded-none lg:col-span-2">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle>
            GLOBAL ACTIVITY
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={globalActivityData}>
              <defs>
                <linearGradient id="gamesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="winsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="stepAfter"
                dataKey="games"
                stroke="var(--chart-2)"
                strokeWidth={2}
                fill="url(#gamesGradient)"
              />
              <Area
                type="stepAfter"
                dataKey="wins"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#winsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-[var(--chart-2)]" />
              <span className="text-xs text-muted-foreground">Total Games</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-[var(--chart-1)]" />
              <span className="text-xs text-muted-foreground">Wins</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle>
            SPECIES POPULARITY
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={speciesPopularity}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {speciesPopularity.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {speciesPopularity.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div
                  className="h-2 w-2"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-muted-foreground truncate">
                  {entry.name}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
