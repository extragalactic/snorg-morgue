"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { GameRecord } from "@/lib/morgue-api"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  TooltipProps,
} from "recharts"
import { useTheme } from "@/contexts/theme-context"

interface RuneCollectionChartProps {
  morgues?: GameRecord[]
}

const MAX_RUNES = 15

function buildRuneData(morgues: GameRecord[] = []) {
  const counts = Array.from({ length: MAX_RUNES }, (_, i) => ({
    runes: i + 1,
    wins: 0,
    attempts: 0,
  }))

  for (const m of morgues) {
    const r = m.runes
    if (!r || r <= 0) continue
    const clamped = Math.min(MAX_RUNES, r)
    const idx = clamped - 1
    counts[idx].attempts += 1
    if (m.result === "win") {
      counts[idx].wins += 1
    }
  }

  // For the chart, we want wins to visually overwrite attempts where they overlap.
  // Use attemptsNonWin = attempts - wins as the grey base, and wins as the bright top segment.
  return counts
    .filter((c) => c.attempts > 0)
    .map((c) => {
      const nonWin = Math.max(0, c.attempts - c.wins)
      return {
        runes: c.runes,
        wins: c.wins,
        attemptsNonWin: nonWin,
        attemptsTotal: c.attempts,
      }
    })
}

type RuneDatum = {
  runes: number
  wins: number
  attemptsNonWin: number
  attemptsTotal: number
}

function RuneTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload as RuneDatum | undefined
  if (!p) return null

  const showWins = p.runes > 2 && p.wins > 0

  return (
    <div className="border-2 border-primary bg-card p-2">
      <p className="font-mono text-xs text-primary">Runes: {p.runes}</p>
      {showWins && (
        <p className="text-sm text-yellow-400">Wins: {p.wins}</p>
      )}
      <p className="text-sm text-muted-foreground">
        Attempts (wins + deaths): {p.attemptsTotal}
      </p>
    </div>
  )
}

export function RuneCollectionChart({ morgues = [] }: RuneCollectionChartProps) {
  const data = buildRuneData(morgues)
  const { themeStyle } = useTheme()

  // Use explicit colors for SVG fills; CSS variables like var(--foo) don't
  // consistently work as SVG attribute values across browsers.
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
        <CardTitle className="font-mono text-sm text-primary">RUNES COLLECTED</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis
              dataKey="runes"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              label={{
                value: "Runes collected",
                position: "bottom",
                offset: 0,
                style: { fill: "var(--muted-foreground)", fontSize: 12 },
              }}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              label={{
                value: "Number of games",
                angle: -90,
                position: "insideLeft",
                style: { fill: "var(--muted-foreground)", fontSize: 12, textAnchor: "middle" },
              }}
            />
            <Tooltip content={<RuneTooltip />} />
            <Legend
              verticalAlign="bottom"
              align="center"
              formatter={(value) =>
                value === "wins" ? "Wins" : "Attempts (wins + deaths)"
              }
              wrapperStyle={{
                fontFamily: "var(--font-body)",
                fontSize: 11,
                bottom: 5,
              }}
            />
            <Bar
              dataKey="wins"
              stackId="runes"
              fill={winsColor}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="attemptsNonWin"
              stackId="runes"
              fill={attemptsColor}
              radius={[0, 0, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

