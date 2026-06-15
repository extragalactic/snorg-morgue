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
import { cn } from "@/lib/utils"
import { typography } from "@/lib/typography"
import { colors } from "@/lib/colors"

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

/** Secondary (branch) label for rune types. Partial list; unmapped runes get empty for now. */
const RUNE_TYPE_SECONDARY_LABEL: Record<string, string> = {
  Barnacled: "Shoals",
  Serpentine: "Snake",
  Slimy: "Slime",
  Gossamer: "Spider",
  Decaying: "Swamp",
  Abyssal: "Abyss",
  Silver: "Vaults",
}

/** Aggregate rune types from runesText (e.g. "serpentine, barnacled, slimy") across all games. */
function buildRuneByTypeData(morgues: GameRecord[] = []) {
  const map = new Map<
    string,
    { wins: number; attempts: number }
  >()
  for (const m of morgues) {
    const text = m.runesText?.trim()
    if (!text) continue
    const types = text.split(",").map((s) => s.trim()).filter(Boolean)
    const isWin = m.result === "win"
    for (const runeType of types) {
      const key = runeType.toLowerCase()
      const cur = map.get(key) ?? { wins: 0, attempts: 0 }
      cur.attempts += 1
      if (isWin) cur.wins += 1
      map.set(key, cur)
    }
  }
  return Array.from(map.entries())
    .map(([runeType, { wins, attempts }]) => {
      const displayName = runeType.charAt(0).toUpperCase() + runeType.slice(1)
      return {
        runeType: displayName,
        runeTypeSecondary: RUNE_TYPE_SECONDARY_LABEL[displayName] ?? "",
        wins,
        attemptsNonWin: Math.max(0, attempts - wins),
        attemptsTotal: attempts,
      }
    })
    .filter((d) => d.attemptsTotal > 0)
    .sort((a, b) => b.attemptsTotal - a.attemptsTotal)
}

type RuneByTypeDatum = {
  runeType: string
  runeTypeSecondary: string
  wins: number
  attemptsNonWin: number
  attemptsTotal: number
}

function RuneTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload as RuneDatum | undefined
  if (!p) return null

  const title = p.runes === 1 ? "1 Rune" : `${p.runes} Runes`

  return (
    <div className="border-2 border-primary bg-card p-3">
      <p className={typography.bodyMono}>{title}</p>
      {p.wins > 0 && (
        <p className={cn("text-base", colors.success)}>Wins: {p.wins}</p>
      )}
      {p.attemptsNonWin > 0 && (
        <p className="text-base text-muted-foreground">Attempts: {p.attemptsNonWin}</p>
      )}
      <p className="text-base text-muted-foreground">Total: {p.attemptsTotal}</p>
    </div>
  )
}

function RuneByTypeTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload as RuneByTypeDatum | undefined
  if (!p) return null
  const secondary = (p.runeTypeSecondary ?? "").trim()
  const title = secondary !== "" ? `${p.runeType} / ${secondary}` : p.runeType
  return (
    <div className="border-2 border-primary bg-card p-3">
      <p className={typography.bodyMono}>{title}</p>
      {p.wins > 0 && (
        <p className={cn("text-base", colors.success)}>Wins: {p.wins}</p>
      )}
      {p.attemptsNonWin > 0 && (
        <p className="text-base text-muted-foreground">Attempts: {p.attemptsNonWin}</p>
      )}
      <p className="text-base text-muted-foreground">Total: {p.attemptsTotal}</p>
    </div>
  )
}

export function RuneCollectionChart({ morgues = [] }: RuneCollectionChartProps) {
  const data = buildRuneData(morgues)
  const rawRuneByType = buildRuneByTypeData(morgues)
  const runeByTypeData =
    rawRuneByType.length === 0
      ? []
      : rawRuneByType.length >= 15
        ? rawRuneByType.slice(0, 15)
        : [
            ...rawRuneByType,
            ...Array.from(
              { length: 15 - rawRuneByType.length },
              () =>
                ({
                  runeType: "?",
                  runeTypeSecondary: "",
                  wins: 0,
                  attemptsNonWin: 0,
                  attemptsTotal: 0,
                }) satisfies RuneByTypeDatum,
            ),
          ]
  const { themeStyle } = useTheme()

  const winsColor =
    themeStyle === "ascii" ? "oklch(0.62 0.2 145)" : "rgba(250, 204, 21, 0.9)"
  const attemptsColor =
    themeStyle === "ascii" ? "oklch(0.52 0.12 145)" : "rgba(148, 163, 184, 0.9)"

  const hasTotalRunes = data.length > 0
  const hasRuneByType = runeByTypeData.length > 0

  if (!hasTotalRunes && !hasRuneByType) {
    return null
  }

  return (
    <div className="flex flex-col gap-6">
      {hasTotalRunes && (
        <Card className={cn(colors.cardBorder, "rounded-none")}>
          <CardHeader className={cn(colors.cardBorderBottom, "pb-3")}>
            <CardTitle>RUNES COLLECTED PER GAME</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 40 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="runes"
                  stroke="var(--muted-foreground)"
                  fontSize={14}
                  tickLine={false}
                  label={{
                    value: "Runes collected",
                    position: "bottom",
                    offset: 0,
                    style: { fill: "var(--muted-foreground)", fontSize: 14 },
                  }}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={14}
                  tickLine={false}
                  allowDecimals={false}
                  label={{
                    value: "Number of games",
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "var(--muted-foreground)", fontSize: 14, textAnchor: "middle" },
                  }}
                />
                <Tooltip
                  content={<RuneTooltip />}
                  cursor={{ fill: "rgba(148, 163, 184, 0.06)", stroke: "transparent" }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{
                    fontFamily: "var(--font-body)",
                    fontSize: 11,
                    bottom: 5,
                  }}
                  payload={[
                    {
                      id: "attemptsNonWin",
                      type: "square",
                      value: "Attempts",
                      color: attemptsColor,
                    },
                    {
                      id: "wins",
                      type: "square",
                      value: "Wins",
                      color: winsColor,
                    },
                  ]}
                />
                <Bar
                  dataKey="attemptsNonWin"
                  stackId="runes"
                  fill={attemptsColor}
                  radius={[0, 0, 2, 2]}
                />
                <Bar
                  dataKey="wins"
                  stackId="runes"
                  fill={winsColor}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      {hasRuneByType && (
        <Card className={cn(colors.cardBorder, "rounded-none")}>
          <CardHeader className={cn(colors.cardBorderBottom, "pb-3")}>
            <CardTitle>TOTAL RUNES BY TYPE</CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5">
            <ResponsiveContainer width="100%" height={Math.max(260, runeByTypeData.length * 40)}>
              <BarChart
                layout="vertical"
                data={runeByTypeData}
                margin={{ top: 10, right: 20, left: 8, bottom: 48 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--muted-foreground)"
                  fontSize={14}
                  tickLine={false}
                  allowDecimals={false}
                  label={{
                    value: "Total runes found",
                    position: "bottom",
                    offset: 0,
                    style: { fill: "var(--muted-foreground)", fontSize: 14 },
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="runeType"
                  width={100}
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  tick={(props) => {
                    const { x, y, payload } = props
                    const value =
                      typeof payload === "string"
                        ? payload
                        : (payload as { value?: string })?.value ?? ""
                    const datum = runeByTypeData.find((d) => d.runeType === value)
                    const secondary = datum?.runeTypeSecondary ?? ""
                    const fill = "var(--muted-foreground)"
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text
                          x={0}
                          y={0}
                          dx={-4}
                          dy={4}
                          textAnchor="end"
                          fill={fill}
                          fontSize={14}
                        >
                          {value}
                        </text>
                        <text
                          x={0}
                          y={0}
                          dx={-4}
                          dy={18}
                          textAnchor="end"
                          fill={fill}
                          fontSize={14}
                          opacity={0.9}
                        >
                          {secondary ? `(${secondary})` : "\u00A0"}
                        </text>
                      </g>
                    )
                  }}
                />
                <Tooltip
                  content={<RuneByTypeTooltip />}
                  cursor={{ fill: "rgba(148, 163, 184, 0.06)", stroke: "transparent" }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{
                    fontFamily: "var(--font-body)",
                    fontSize: 11,
                    paddingTop: 25,
                  }}
                  payload={[
                    {
                      id: "attemptsNonWin",
                      type: "square",
                      value: "Attempts",
                      color: attemptsColor,
                    },
                    {
                      id: "wins",
                      type: "square",
                      value: "Wins",
                      color: winsColor,
                    },
                  ]}
                />
                <Bar
                  dataKey="attemptsNonWin"
                  stackId="byType"
                  fill={attemptsColor}
                  name="Attempts"
                  radius={[2, 0, 0, 2]}
                />
                <Bar
                  dataKey="wins"
                  stackId="byType"
                  fill={winsColor}
                  name="Wins"
                  radius={[0, 2, 2, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

