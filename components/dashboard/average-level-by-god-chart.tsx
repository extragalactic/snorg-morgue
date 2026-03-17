"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/contexts/theme-context"
import type { GameRecord } from "@/lib/morgue-api"
import { ALL_GOD_NAMES, GOD_SHORT_FORMS } from "@/lib/dcss-constants"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts"

interface AverageLevelByGodChartProps {
  morgues: GameRecord[]
  /** Global average XL at death across all users (from global stats). */
  globalAvgXlAtDeath?: number
}

type GodDatum = {
  god: string
  short: string
  avgXl: number
  count: number
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

export function AverageLevelByGodChart({ morgues, globalAvgXlAtDeath }: AverageLevelByGodChartProps) {
  const { themeStyle } = useTheme()

  const data: GodDatum[] = useMemo(() => {
    const sums = new Map<string, { xlTotal: number; count: number }>()

    for (const game of morgues) {
      const godName = normalizeGod(game.god)
      const current = sums.get(godName) ?? { xlTotal: 0, count: 0 }
      current.xlTotal += game.xl
      current.count += 1
      sums.set(godName, current)
    }

    return ALL_GOD_NAMES.map((name) => {
      const stats = sums.get(name)
      const avgXl = stats && stats.count > 0 ? stats.xlTotal / stats.count : 0
      const short = GOD_SHORT_FORMS[name] ?? name
      return {
        god: name,
        short,
        avgXl,
        count: stats?.count ?? 0,
      }
    })
  }, [morgues])

  const barColor = themeStyle === "ascii" ? "#22c55e" : "#d4a574"
  const gridColor = themeStyle === "ascii" ? "rgba(34,197,94,0.15)" : "rgba(212,165,116,0.15)"
  const globalLineColor = "var(--average)"

  const hasAnyData = data.some((d) => d.count > 0)

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
            {typeof globalAvgXlAtDeath === "number" && globalAvgXlAtDeath > 0 && (
              <ReferenceLine
                y={globalAvgXlAtDeath}
                stroke={globalLineColor}
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{
                  value: `Global avg XL (${globalAvgXlAtDeath.toFixed(1)})`,
                  position: "right",
                  style: { fill: "var(--muted-foreground)", fontSize: 12 },
                }}
              />
            )}
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              contentStyle={{
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                border: "2px solid var(--primary)",
                borderRadius: 0,
                padding: "8px 10px",
              }}
              labelStyle={{
                color: "var(--primary)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
              itemStyle={{
                color: "var(--foreground)",
                fontSize: 12,
              }}
              formatter={(value: number, _name, payload) => {
                const d = payload?.payload as GodDatum
                return [
                  value.toFixed(1),
                  d.count > 0 ? `Avg XL (from ${d.count} games)` : "Avg XL (no games)",
                ]
              }}
              labelFormatter={(_label, payload) => {
                const d = (payload?.[0]?.payload ?? {}) as GodDatum
                return d.god
              }}
            />
            <Bar dataKey="avgXl" fill={barColor} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-1 text-xs text-muted-foreground font-mono text-center">
          God Worshipped
        </p>
      </CardContent>
    </Card>
  )
}

