"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/contexts/theme-context"
import type { GameRecord } from "@/lib/morgue-api"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const LEVEL_COUNT = 27
/** Per-run estimates exist for bands through XL 26; XL 27 omitted from chart */
const CHART_LEVELS = 26

function endingLevel(m: GameRecord): number | null {
  const xlNum = Number(m.xl)
  if (!Number.isFinite(xlNum)) return null
  return Math.min(LEVEL_COUNT, Math.max(1, Math.round(xlNum)))
}

export type TotalTimeSpentAtLevelRow = {
  level: number
  gamesEndedHere: number
  gamesReachedHereOrHigher: number
  avgDurationMinutes: number | null
  perRunLevelTimeMinutes: number | null
  totalLevelTimeMinutes: number | null
  totalLevelTimeHours: number | null
  blockMerged: boolean
  blockEndLevel: number | null
}

/**
 * Adjacent avg duration differences with negative-gap block merge; × reachedCount; levels 1–26 only.
 */
export function buildTotalTimeSpentAtEachLevelData(morgues: GameRecord[]): TotalTimeSpentAtLevelRow[] {
  const countEnded = new Array<number>(LEVEL_COUNT).fill(0)
  const durationsByLevelMin: number[][] = Array.from({ length: LEVEL_COUNT }, () => [])

  for (const m of morgues) {
    const el = endingLevel(m)
    if (el == null) continue
    countEnded[el - 1] += 1

    const sec = m.durationSeconds
    if (sec != null && Number.isFinite(sec) && sec > 0) {
      durationsByLevelMin[el - 1].push(sec / 60)
    }
  }

  const reachedCount = new Array<number>(LEVEL_COUNT).fill(0)
  for (const m of morgues) {
    const el = endingLevel(m)
    if (el == null) continue
    for (let L = 1; L <= el; L++) {
      reachedCount[L - 1] += 1
    }
  }

  const avgDuration: (number | null)[] = Array(LEVEL_COUNT).fill(null)
  for (let i = 0; i < LEVEL_COUNT; i++) {
    const arr = durationsByLevelMin[i]
    if (arr.length === 0) continue
    avgDuration[i] = arr.reduce((a, b) => a + b, 0) / arr.length
  }

  const perRun = new Array<number | null>(CHART_LEVELS).fill(null)
  const blockMerged = new Array<boolean>(CHART_LEVELS).fill(false)
  const blockEndLevel = new Array<number | null>(CHART_LEVELS).fill(null)

  let level = 1
  while (level <= CHART_LEVELS) {
    const i = level - 1
    const avL = avgDuration[i]
    const avNext = avgDuration[i + 1]

    if (avL == null || avNext == null) {
      level += 1
      continue
    }

    const diff = avNext - avL
    if (diff >= 0) {
      perRun[i] = diff
      blockMerged[i] = false
      blockEndLevel[i] = null
      level += 1
      continue
    }

    const start = level
    const startIdx = start - 1
    const avStart = avgDuration[startIdx]
    if (avStart == null) {
      level += 1
      continue
    }

    let end: number | null = null
    for (let k = level + 2; k <= LEVEL_COUNT; k++) {
      const avK = avgDuration[k - 1]
      if (avK != null && avK > avStart) {
        end = k
        break
      }
    }

    if (end == null) {
      level += 1
      continue
    }

    const avEnd = avgDuration[end - 1]!
    const totalGain = avEnd - avStart
    const steps = end - start
    const shared = totalGain / steps

    for (let j = start; j <= end - 1; j++) {
      const ji = j - 1
      if (ji >= 0 && ji < CHART_LEVELS) {
        perRun[ji] = shared
        blockMerged[ji] = true
        blockEndLevel[ji] = end
      }
    }

    level = end
  }

  return Array.from({ length: CHART_LEVELS }, (_, idx) => {
    const L = idx + 1
    const pr = perRun[idx]
    const reached = reachedCount[idx]
    const totalMin = pr != null ? pr * reached : null
    const totalHr = totalMin != null ? totalMin / 60 : null

    return {
      level: L,
      gamesEndedHere: countEnded[idx],
      gamesReachedHereOrHigher: reached,
      avgDurationMinutes: avgDuration[idx],
      perRunLevelTimeMinutes: pr,
      totalLevelTimeMinutes: totalMin,
      totalLevelTimeHours: totalHr,
      blockMerged: blockMerged[idx],
      blockEndLevel: blockEndLevel[idx],
    }
  })
}

function isKnownHour(x: number | null | undefined): x is number {
  return x != null && Number.isFinite(x)
}

/**
 * Line-only series: carry endpoints, linear interpolation between known estimates inside the range.
 * Used only to build a continuous path before smoothing (not shown as raw values).
 */
function fillValuesForTrendLine(values: (number | null)[]): number[] {
  const n = values.length
  const filled = new Array<number>(n)
  if (n === 0) return filled

  let firstK = -1
  let lastK = -1
  for (let i = 0; i < n; i++) {
    if (isKnownHour(values[i])) {
      if (firstK < 0) firstK = i
      lastK = i
    }
  }

  if (firstK < 0) {
    return new Array(n).fill(0)
  }

  for (let i = 0; i < n; i++) {
    if (isKnownHour(values[i])) {
      filled[i] = values[i]!
      continue
    }
    if (i < firstK) {
      filled[i] = values[firstK]!
      continue
    }
    if (i > lastK) {
      filled[i] = values[lastK]!
      continue
    }

    let p = i - 1
    while (p >= 0 && !isKnownHour(values[p])) p--
    let q = i + 1
    while (q < n && !isKnownHour(values[q])) q++

    if (p < 0) {
      filled[i] = values[firstK]!
    } else if (q >= n) {
      filled[i] = values[lastK]!
    } else {
      const vp = values[p]!
      const vq = values[q]!
      filled[i] = vp + ((i - p) / (q - p)) * (vq - vp)
    }
  }

  return filled
}

/** Moving average on the filled series: 2-point ends, 3-point interior. */
function movingAverageOnFilledSeries(filled: number[]): number[] {
  const n = filled.length
  if (n === 0) return []
  const out = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    const L = i + 1
    if (L === 1) out[i] = (filled[0] + filled[1]) / 2
    else if (L === CHART_LEVELS) out[i] = (filled[n - 2] + filled[n - 1]) / 2
    else out[i] = (filled[i - 1] + filled[i] + filled[i + 1]) / 3
  }
  return out
}

/** Gap-filled underlying estimates → simple moving average (not regression). */
function computeSmoothedTrendHours(rows: TotalTimeSpentAtLevelRow[]): number[] {
  const values = rows.map((r) => r.totalLevelTimeHours)
  const filled = fillValuesForTrendLine(values)
  return movingAverageOnFilledSeries(filled)
}

type ChartDatum = TotalTimeSpentAtLevelRow & {
  smoothedHours: number
}

function toChartData(rows: TotalTimeSpentAtLevelRow[]): ChartDatum[] {
  const smoothed = computeSmoothedTrendHours(rows)
  return rows.map((r, i) => ({
    ...r,
    smoothedHours: smoothed[i] ?? 0,
  }))
}

interface TipProps {
  active?: boolean
  payload?: Array<{ payload: ChartDatum }>
}

function EstimatedTimeTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload

  return (
    <div className="border-2 border-primary bg-card p-3 font-mono text-sm max-w-xs">
      <p className="text-primary">Level {d.level}</p>
      <p className="text-base text-foreground">
        Estimated total time: {d.smoothedHours.toFixed(1)}h
      </p>
      <p className="text-base text-muted-foreground">Games ended here: {d.gamesEndedHere}</p>
      <p className="text-base text-muted-foreground">
        Games reached level {d.level}+: {d.gamesReachedHereOrHigher}
      </p>
      {d.blockMerged && d.blockEndLevel != null && (
        <p className="mt-2 text-xs text-muted-foreground">
          Point estimate used a merged block through level {d.blockEndLevel} before smoothing.
        </p>
      )}
      {d.totalLevelTimeHours == null && (
        <p className="mt-1 text-xs text-muted-foreground">
          No standalone model estimate at this XL; the trend line still passes through via smoothing.
        </p>
      )}
    </div>
  )
}

const CARD_TITLE = "ESTIMATED TOTAL TIME SPENT ACROSS LEVELS"

export function TotalTimeSpentAtEachLevelChart({
  morgues = [],
  loading,
}: {
  morgues?: GameRecord[]
  loading?: boolean
}) {
  const { themeStyle } = useTheme()
  const rows = buildTotalTimeSpentAtEachLevelData(morgues)
  const data = toChartData(rows)

  const lineColor =
    themeStyle === "ascii" ? "oklch(0.62 0.19 145)" : "rgba(234, 88, 12, 0.95)"
  const dotFill =
    themeStyle === "ascii" ? "oklch(0.78 0.14 145)" : "rgba(253, 186, 116, 0.98)"
  const gridColor = themeStyle === "ascii" ? "rgba(34,197,94,0.2)" : "rgba(212,165,116,0.2)"

  const maxSmoothed = data.reduce((m, d) => Math.max(m, d.smoothedHours), 0)
  const yAxisMax = maxSmoothed <= 0 ? 1 : Math.ceil(maxSmoothed * 11) / 10

  const runsWithDuration = morgues.filter(
    (m) =>
      endingLevel(m) != null &&
      m.durationSeconds != null &&
      Number.isFinite(m.durationSeconds) &&
      m.durationSeconds > 0,
  ).length

  if (loading) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle>{CARD_TITLE}</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{CARD_TITLE}</span>
          {morgues.length > 0 && (
            <span className="font-mono text-[13px] sm:text-sm font-normal text-muted-foreground">
              Runs with duration: {runsWithDuration}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              type="category"
              dataKey="level"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              interval={0}
              label={{
                value: "Character level",
                position: "bottom",
                offset: 0,
                style: { fill: "var(--muted-foreground)", fontSize: 12 },
              }}
            />
            <YAxis
              domain={[0, yAxisMax]}
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              width={52}
              label={{
                value: "Estimated hours (smoothed)",
                angle: -90,
                position: "insideLeft",
                style: { fill: "var(--muted-foreground)", fontSize: 12, textAnchor: "middle" },
              }}
            />
            <Tooltip content={<EstimatedTimeTooltip />} />
            <Line
              type="monotone"
              dataKey="smoothedHours"
              name="Estimated trend"
              stroke={lineColor}
              strokeWidth={2.5}
              dot={{ r: 3, fill: dotFill, stroke: lineColor, strokeWidth: 1 }}
              activeDot={{ r: 4, fill: dotFill, stroke: lineColor, strokeWidth: 1 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
          This chart shows an estimated trend of where total play time is spent across levels for this
          player. Values are derived from differences in average run durations between levels and are
          smoothed to improve readability. This is an approximation, not direct in-game time tracking.
        </p>
      </CardContent>
    </Card>
  )
}
