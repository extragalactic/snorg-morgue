"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/contexts/theme-context"
import type { GameRecord } from "@/lib/morgue-api"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { typography } from "@/lib/typography"

export interface MilestoneProgressionChartProps {
  morgues?: GameRecord[]
  loading?: boolean
  /** When set with showGlobalAverages, Lair:5 row notes the all-players rate in the tooltip. */
  globalLair5ReachRate?: number
}

type Row = {
  label: string
  pct: number
  count: number
  globalPct?: number
}

function buildRows(morgues: GameRecord[], globalLair5ReachRate?: number): Row[] {
  const n = morgues.length
  const row = (label: string, reached: number): Row => ({
    label,
    pct: n > 0 ? Math.round((reached / n) * 100) : 0,
    count: reached,
  })

  const d7 = morgues.filter((m) => m.reachedDungeon7 === true).length
  const lair = morgues.filter((m) => m.reachedLair5 === true).length
  const depths = morgues.filter((m) => m.reachedDepthsMilestone === true).length
  const zot = morgues.filter((m) => m.reachedZotMilestone === true).length

  const global = globalLair5ReachRate
  return [
    row("D:7", d7),
    {
      ...row("Lair:5", lair),
      globalPct: global != null && Number.isFinite(global) ? Math.round(global) : undefined,
    },
    row("Depths:1", depths),
    row("Zot:1", zot),
  ]
}

function MilestoneTooltip({
  active,
  payload,
  totalGames,
}: {
  active?: boolean
  payload?: Array<{ payload: Row }>
  totalGames: number
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="border-2 border-primary bg-card p-3">
      <p className="font-mono text-sm text-primary">{row.label}</p>
      <p className="text-base text-muted-foreground">
        {row.pct}% of games
        {totalGames > 0 && (
          <span className="block font-mono text-xs text-muted-foreground">
            {row.count} / {totalGames}
          </span>
        )}
      </p>
      {row.globalPct != null && (
        <p className="mt-1 font-mono text-xs text-average">All players avg: {row.globalPct}%</p>
      )}
    </div>
  )
}

export function MilestoneProgressionChart({
  morgues = [],
  loading,
  globalLair5ReachRate,
}: MilestoneProgressionChartProps) {
  const { themeStyle } = useTheme()
  const totalGames = morgues.length

  const data = useMemo(
    () => buildRows(morgues, globalLair5ReachRate),
    [morgues, globalLair5ReachRate],
  )

  /** Same primary bar fill as RUNES COLLECTED / wins segments elsewhere. */
  const barColor = themeStyle === "ascii" ? "oklch(0.62 0.2 145)" : "rgba(250, 204, 21, 0.9)"
  const gridColor = themeStyle === "ascii" ? "rgba(34,197,94,0.15)" : "rgba(212,165,116,0.15)"

  if (loading) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle className={typography.secondaryTitle}>Milestone Progression</CardTitle>
          <CardDescription className="pt-2">Share of games reaching each milestone</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className={typography.secondaryTitle}>Milestone Progression</CardTitle>
        <CardDescription className="pt-2">Share of games reaching each milestone</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {totalGames === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
            No games yet
          </div>
        ) : (
          <div className="h-[260px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
                barGap={0}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={76}
                  tick={{ fill: "var(--foreground)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--primary)" }}
                />
                <Tooltip
                  content={<MilestoneTooltip totalGames={totalGames} />}
                  cursor={{ fill: "rgba(148, 163, 184, 0.06)", stroke: "transparent" }}
                />
                <Bar
                  dataKey="pct"
                  name="% of games"
                  fill={barColor}
                  radius={[0, 2, 2, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
