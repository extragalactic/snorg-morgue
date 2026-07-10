"use client"

import { useEffect, useMemo, useState } from "react"
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
import type { TooltipProps } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { colors } from "@/lib/colors"
import { typography } from "@/lib/typography"
import { supabase } from "@/lib/supabase"
import { fetchWinnerSkillLevels } from "@/lib/morgue-api"
import type { GameRecord, WinnerSkillLevelRow } from "@/lib/morgue-api"

const MIN_THRESHOLD = 1
const MAX_THRESHOLD = 27
const DEFAULT_THRESHOLD = 12

/** SVG pattern ids for bar fills (global to the document). */
const MAGIC_PATTERN_ID = "winner-skills-magic-hatch"
const OTHER_PATTERN_ID = "winner-skills-other-dots"

/** Magic skills: Spellcasting + all spell schools (incl. legacy/newer names). */
const MAGIC_SKILLS = new Set<string>([
  "Spellcasting",
  "Conjurations",
  "Hexes",
  "Summonings",
  "Necromancy",
  "Forgecraft",
  "Translocations",
  "Alchemy",
  "Transmutations",
  "Fire Magic",
  "Ice Magic",
  "Air Magic",
  "Earth Magic",
])

/** Other skills: not martial, not a spell school. */
const OTHER_SKILLS = new Set<string>(["Invocations", "Evocations", "Shapeshifting"])

type SkillCategory = "martial" | "magic" | "other"

function skillCategory(skill: string): SkillCategory {
  if (MAGIC_SKILLS.has(skill)) return "magic"
  if (OTHER_SKILLS.has(skill)) return "other"
  return "martial"
}

function categoryFill(category: SkillCategory): string {
  if (category === "magic") return `url(#${MAGIC_PATTERN_ID})`
  if (category === "other") return `url(#${OTHER_PATTERN_ID})`
  return "var(--success)"
}

type SkillRow = { skill: string; count: number; pct: number; category: SkillCategory }

function WinnerSkillTooltip({
  active,
  payload,
  total,
}: TooltipProps<number, string> & { total: number }) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0].payload as SkillRow | undefined
  if (!p) return null
  return (
    <div className="border-2 border-primary bg-card p-3">
      <p className={typography.bodyMono}>{p.skill}</p>
      <p className="text-base text-muted-foreground">
        {p.count} of {total} winners ({p.pct.toFixed(0)}%)
      </p>
    </div>
  )
}

export function WinnerSkillsChart({
  morgues = [],
  userId,
  loading,
}: {
  morgues?: GameRecord[]
  userId?: string | null
  loading?: boolean
}) {
  const winnerCount = useMemo(
    () => morgues.filter((m) => m.result === "win").length,
    [morgues],
  )

  const [rows, setRows] = useState<WinnerSkillLevelRow[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)

  useEffect(() => {
    let cancelled = false
    if (!userId) {
      setRows([])
      return
    }
    setDataLoading(true)
    fetchWinnerSkillLevels(supabase, userId)
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false)
      })
    return () => {
      cancelled = true
    }
    // Refetch when the player changes or after the winner set changes (e.g. new import).
  }, [userId, winnerCount])

  const totalWinners = useMemo(() => {
    const games = new Set<string>()
    for (const r of rows) games.add(r.game_id)
    return games.size
  }, [rows])

  const chartData = useMemo<SkillRow[]>(() => {
    if (totalWinners === 0) return []
    // game_id -> set of skills meeting the threshold
    const countBySkill = new Map<string, number>()
    for (const r of rows) {
      if (r.level >= threshold) {
        countBySkill.set(r.skill, (countBySkill.get(r.skill) ?? 0) + 1)
      } else if (!countBySkill.has(r.skill)) {
        countBySkill.set(r.skill, 0)
      }
    }
    const result = Array.from(countBySkill.entries()).map(([skill, count]) => ({
      skill,
      count,
      pct: (count / totalWinners) * 100,
      category: skillCategory(skill),
    }))
    result.sort((a, b) => b.pct - a.pct || a.skill.localeCompare(b.skill))
    return result
  }, [rows, totalWinners, threshold])

  const chartHeight = Math.max(300, chartData.length * 26 + 90)

  const header = (
    <CardHeader className={cn(colors.cardBorderBottom, "pb-3")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>WINNER SKILLS</CardTitle>
          <CardDescription>
            Percentage of your winning characters that trained each skill to at least the selected level.
          </CardDescription>
        </div>
        <div className="flex w-full max-w-xs shrink-0 items-center gap-3 sm:w-64">
          <span className="shrink-0 font-mono text-sm text-muted-foreground">Min skill level</span>
          <Slider
            min={MIN_THRESHOLD}
            max={MAX_THRESHOLD}
            step={1}
            value={[threshold]}
            onValueChange={(v) => setThreshold(v[0] ?? DEFAULT_THRESHOLD)}
            aria-label="Minimum skill level"
            className="flex-1"
          />
          <span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-primary">
            {threshold}
          </span>
        </div>
      </div>
    </CardHeader>
  )

  let body: React.ReactNode
  if (winnerCount === 0) {
    body = <p className={typography.bodyMuted}>There is no winner data yet.</p>
  } else if (loading || (dataLoading && totalWinners === 0)) {
    body = (
      <div className={cn("flex h-40 items-center justify-center", typography.bodyMuted)}>
        Loading skill data…
      </div>
    )
  } else if (totalWinners === 0) {
    body = (
      <p className={typography.bodyMuted}>
        Skill data hasn&apos;t been computed for your winners yet. Refresh (manual uploads) or re-sync
        (online imports) your morgues to populate it.
      </p>
    )
  } else {
    body = (
      <>
        {/* Fill patterns for magic (cross-hatch) and other (dots) bars, referenced by fill=url(#...). */}
        <svg width="0" height="0" className="absolute" aria-hidden>
          <defs>
            <pattern id={MAGIC_PATTERN_ID} patternUnits="userSpaceOnUse" width="8" height="8">
              <rect width="8" height="8" fill="var(--success)" opacity="0.25" />
              <path d="M0 0 L8 8 M8 0 L0 8" stroke="var(--success)" strokeWidth="1.2" />
            </pattern>
            <pattern id={OTHER_PATTERN_ID} patternUnits="userSpaceOnUse" width="6" height="6">
              <rect width="6" height="6" fill="var(--success)" opacity="0.2" />
              <line x1="0" y1="0" x2="6" y2="0" stroke="var(--success)" strokeWidth="2.5" />
            </pattern>
          </defs>
        </svg>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className={typography.bodyMonoMuted}>
            Based on {totalWinners} winning {totalWinners === 1 ? "game" : "games"}.
          </p>
          <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-4" style={{ backgroundColor: "var(--success)" }} />
              Martial
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="16" height="12" className="inline-block">
                <rect
                  width="16"
                  height="12"
                  fill={`url(#${MAGIC_PATTERN_ID})`}
                  stroke="var(--success)"
                  strokeWidth="1"
                />
              </svg>
              Magic
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="16" height="12" className="inline-block">
                <rect
                  width="16"
                  height="12"
                  fill={`url(#${OTHER_PATTERN_ID})`}
                  stroke="var(--success)"
                  strokeWidth="1"
                />
              </svg>
              Other
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 5, right: 24, left: 8, bottom: 40 }}
            barCategoryGap="25%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              stroke="var(--muted-foreground)"
              fontSize={14}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: `% of winners with skill ≥ ${threshold}`,
                position: "bottom",
                offset: 0,
                style: { fill: "var(--muted-foreground)", fontSize: 14 },
              }}
            />
            <YAxis
              type="category"
              dataKey="skill"
              width={140}
              stroke="var(--muted-foreground)"
              fontSize={13}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <Tooltip
              content={<WinnerSkillTooltip total={totalWinners} />}
              cursor={{ fill: "rgba(148, 163, 184, 0.06)", stroke: "transparent" }}
            />
            <Bar dataKey="pct" radius={[0, 2, 2, 0]}>
              {chartData.map((row) => (
                <Cell
                  key={row.skill}
                  fill={categoryFill(row.category)}
                  stroke={row.category === "martial" ? undefined : "var(--success)"}
                  strokeWidth={row.category === "martial" ? undefined : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </>
    )
  }

  return (
    <Card className={cn(colors.cardBorder, "rounded-none")}>
      {header}
      <CardContent className="pt-4">{body}</CardContent>
    </Card>
  )
}
