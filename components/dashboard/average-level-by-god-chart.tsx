"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/contexts/theme-context"
import type { GameRecord } from "@/lib/morgue-api"
import { ALL_GOD_NAMES, GOD_SHORT_FORMS } from "@/lib/dcss-constants"
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

/** Half-width (px) of the horizontal average marker on each bar. */
function avgMarkerHalfWidth(godCount: number): number {
  return Math.max(9, Math.min(20, 280 / Math.max(1, godCount)))
}

interface AverageLevelByGodChartProps {
  morgues: GameRecord[]
}

type GodDatum = {
  god: string
  short: string
  userAvgXl: number
  /** Highest XL in any single game with this god. */
  userMaxXl: number
  /** True if you have at least one win worshipping this god. */
  userHasWinWithGod: boolean
  userCount: number
}

function normalizeGod(raw: string | undefined | null): string {
  const name = (raw ?? "").trim()
  if (!name) return "(no god)"
  if (name === "(no god)") return "(no god)"
  if (name === "Fedhas Madash" || name === "Fedhas") return "Fedhas"
  if (name.toLowerCase().startsWith("nemelex")) return "Nemelex"
  if (name.toLowerCase().includes("shining one")) return "The Shining One"
  if (name.toLowerCase().startsWith("gozag")) return "Gozag"
  return name
}

export function AverageLevelByGodChart({ morgues }: AverageLevelByGodChartProps) {
  const { themeStyle } = useTheme()

  const data: GodDatum[] = useMemo(() => {
    const userSums = new Map<
      string,
      { xlTotal: number; count: number; maxXl: number; hasWin: boolean }
    >()

    for (const game of morgues) {
      const godName = normalizeGod(game.god)
      const current = userSums.get(godName) ?? {
        xlTotal: 0,
        count: 0,
        maxXl: 0,
        hasWin: false,
      }
      current.xlTotal += game.xl
      current.count += 1
      current.maxXl = Math.max(current.maxXl, game.xl)
      if (game.result === "win") current.hasWin = true
      userSums.set(godName, current)
    }

    return ALL_GOD_NAMES.map((name) => {
      const userStats = userSums.get(name)
      const userAvgXl = userStats && userStats.count > 0 ? userStats.xlTotal / userStats.count : 0
      const userMaxXl = userStats && userStats.count > 0 ? userStats.maxXl : 0
      const userHasWinWithGod = userStats?.hasWin ?? false
      const userCount = userStats?.count ?? 0

      const short = GOD_SHORT_FORMS[name] ?? name

      return {
        god: name,
        short,
        userAvgXl,
        userMaxXl,
        userHasWinWithGod,
        userCount,
      }
    })
  }, [morgues])

  const youColor =
    themeStyle === "ascii" ? "oklch(0.62 0.2 145)" : "rgba(250, 204, 21, 0.9)"
  /** Dimmer bars when you have no win with that god yet. */
  const youColorMuted =
    themeStyle === "ascii" ? "oklch(0.4 0.11 145)" : "rgba(161, 98, 7, 0.92)"
  const gridColor = themeStyle === "ascii" ? "rgba(34,197,94,0.15)" : "rgba(212,165,116,0.15)"
  const avgColor = "var(--average)"
  const avgMarkHalfW = avgMarkerHalfWidth(data.length)

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="tracking-tight">LEVEL PROGRESSION BY GOD</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="short"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              interval={0}
              height={50}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              allowDecimals={false}
              label={{
                value: "Best & average XL",
                angle: -90,
                position: "insideLeft",
                style: { fill: "var(--muted-foreground)", fontSize: 12, textAnchor: "middle" },
              }}
              domain={[0, 27]}
            />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as GodDatum
                return (
                  <div className="border-2 border-primary bg-card p-2">
                    <p className="font-mono text-xs text-primary mb-1">{d.god}</p>
                    <p className="text-xs text-muted-foreground">
                      Your best: {d.userCount > 0 ? d.userMaxXl : "—"} XL
                      {d.userCount > 0 ? ` (from ${d.userCount} games with this god)` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your average: {d.userCount > 0 ? d.userAvgXl.toFixed(1) : "—"} XL
                    </p>
                    {d.userCount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {d.userHasWinWithGod ? "Includes a win with this god." : "No win with this god yet."}
                      </p>
                    )}
                  </div>
                )
              }}
            />
            <Bar dataKey="userMaxXl" radius={[2, 2, 0, 0]}>
              {data.map((d, index) => (
                <Cell
                  key={`best-${index}`}
                  fill={d.userCount > 0 && d.userHasWinWithGod ? youColor : youColorMuted}
                />
              ))}
            </Bar>
            <Line
              type="linear"
              dataKey="userAvgXl"
              stroke="transparent"
              strokeWidth={0}
              isAnimationActive={false}
              dot={(props) => {
                const { cx, cy, payload } = props
                const row = payload as GodDatum | undefined
                if (cx == null || cy == null || !row?.userCount) return null
                return (
                  <line
                    key={`avg-cap-${row.short}`}
                    x1={cx - avgMarkHalfW}
                    x2={cx + avgMarkHalfW}
                    y1={cy}
                    y2={cy}
                    stroke={avgColor}
                    strokeWidth={2.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )
              }}
              activeDot={false}
              legendType="none"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-1 flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground font-mono text-center">
            God Worshipped
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-6" style={{ backgroundColor: youColorMuted }} />
              <span className="text-xs text-muted-foreground">Best run (no win)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-6" style={{ backgroundColor: youColor }} />
              <span className="text-xs text-muted-foreground">Best run (won)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-6 rounded-none" style={{ backgroundColor: avgColor }} />
              <span className="text-xs text-muted-foreground">Your average XL</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
