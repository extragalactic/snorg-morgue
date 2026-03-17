"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/contexts/theme-context"
import type { GameRecord, GlobalGodAvgXl } from "@/lib/morgue-api"
import { ALL_GOD_NAMES, GOD_SHORT_FORMS } from "@/lib/dcss-constants"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface AverageLevelByGodChartProps {
  morgues: GameRecord[]
  /** Global average XL at death per god across all users (from global stats). */
  globalGodAverages?: GlobalGodAvgXl[]
}

type GodDatum = {
  god: string
  short: string
  userAvgXl: number
  userCount: number
  globalAvgXl: number
  globalCount: number
  firstSeg: number
  secondSeg: number
  isGlobalFirst: boolean
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

export function AverageLevelByGodChart({ morgues, globalGodAverages = [] }: AverageLevelByGodChartProps) {
  const { themeStyle } = useTheme()

  const data: GodDatum[] = useMemo(() => {
    const userSums = new Map<string, { xlTotal: number; count: number }>()

    for (const game of morgues) {
      const godName = normalizeGod(game.god)
      const current = userSums.get(godName) ?? { xlTotal: 0, count: 0 }
      current.xlTotal += game.xl
      current.count += 1
      userSums.set(godName, current)
    }

    const globalMap = new Map<string, { avgXlAtDeath: number; deathCount: number }>()
    for (const g of globalGodAverages) {
      const name = normalizeGod(g.god)
      globalMap.set(name, {
        avgXlAtDeath: g.avgXlAtDeath,
        deathCount: g.deathCount,
      })
    }

    return ALL_GOD_NAMES.map((name) => {
      const userStats = userSums.get(name)
      const userAvgXl = userStats && userStats.count > 0 ? userStats.xlTotal / userStats.count : 0
      const userCount = userStats?.count ?? 0

      const globalStats = globalMap.get(name)
      const globalAvgXl = globalStats?.avgXlAtDeath ?? 0
      const globalCount = globalStats?.deathCount ?? 0

      const userVal = userAvgXl
      const globalVal = globalAvgXl

      const low = Math.min(userVal, globalVal)
      const high = Math.max(userVal, globalVal)
      const firstSeg = low
      const secondSeg = high - low
      const isGlobalFirst = globalVal <= userVal

      const short = GOD_SHORT_FORMS[name] ?? name

      return {
        god: name,
        short,
        userAvgXl,
        userCount,
        globalAvgXl,
        globalCount,
        firstSeg,
        secondSeg,
        isGlobalFirst,
      }
    })
  }, [morgues, globalGodAverages])

  const youColor =
    themeStyle === "ascii" ? "oklch(0.62 0.2 145)" : "rgba(250, 204, 21, 0.9)"
  const gridColor = themeStyle === "ascii" ? "rgba(34,197,94,0.15)" : "rgba(212,165,116,0.15)"
  const avgColor = "var(--average)"

  const hasAnyData = data.some((d) => d.userCount > 0 || d.globalCount > 0)

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="flex items-center justify-between gap-2">
          <span>AVERAGE LEVEL PROGRESSION BY GOD</span>
          {hasAnyData && (
            <span className="font-mono text-[13px] sm:text-sm font-normal text-muted-foreground">
              Based on {morgues.length} games
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={360}>
          <BarChart
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
                value: "Average XL reached",
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
                      You: {d.userCount > 0 ? d.userAvgXl.toFixed(1) : "—"} XL
                      {d.userCount > 0 ? ` (from ${d.userCount} games)` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Average: {d.globalCount > 0 ? d.globalAvgXl.toFixed(1) : "—"} XL
                      {d.globalCount > 0 ? ` (from ${d.globalCount} games)` : ""}
                    </p>
                  </div>
                )
              }}
            />
            <Bar dataKey="firstSeg" stackId="stack" radius={[2, 2, 0, 0]}>
              {data.map((d, index) => (
                <Cell
                  key={`first-${index}`}
                  fill={d.isGlobalFirst ? avgColor : youColor}
                />
              ))}
            </Bar>
            <Bar dataKey="secondSeg" stackId="stack" radius={[2, 2, 0, 0]}>
              {data.map((d, index) => (
                <Cell
                  key={`second-${index}`}
                  fill={d.isGlobalFirst ? youColor : avgColor}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-1 flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground font-mono text-center">
            God Worshipped
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-6" style={{ backgroundColor: youColor }} />
              <span className="text-xs text-muted-foreground">You</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-6" style={{ backgroundColor: avgColor }} />
              <span className="text-xs text-muted-foreground">Global Average</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

