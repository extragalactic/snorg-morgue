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

interface TestPerformanceChartProps {
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

function TestPerformanceTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload as RuneDatum | undefined
  if (!p) return null

  const showWins = p.runes > 2 && p.wins > 0

  return (
    <div className="border-2 border-primary bg-card p-3">
      <p className="font-mono text-sm text-primary">Runes: {p.runes}</p>
      {showWins && (
        <p className="text-base text-yellow-400">Wins: {p.wins}</p>
      )}
      <p className="text-base text-muted-foreground">
        Attempts (wins + deaths): {p.attemptsTotal}
      </p>
    </div>
  )
}

export function TestPerformanceChart({ morgues = [] }: TestPerformanceChartProps) {
  const data = buildRuneData(morgues)
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
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 20, left: 60, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
            <XAxis
              type="number"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              allowDecimals={false}
              label={{
                value: "Number of games",
                position: "bottom",
                offset: 0,
                style: { fill: "var(--muted-foreground)", fontSize: 12 },
              }}
            />
            <YAxis
              type="category"
              dataKey="runes"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              width={40}
              label={{
                value: "Runes collected",
                angle: -90,
                position: "insideLeft",
                style: { fill: "var(--muted-foreground)", fontSize: 12, textAnchor: "middle" },
              }}
            />
            <Tooltip
              content={<TestPerformanceTooltip />}
              cursor={{ fill: "rgba(148, 163, 184, 0.06)", stroke: "transparent" }}
            />
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
              radius={[0, 2, 2, 0]}
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

