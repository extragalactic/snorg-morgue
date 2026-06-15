"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTheme } from "@/contexts/theme-context"
import type { GameRecord } from "@/lib/morgue-api"
import { buildDeathPlaceImpactSections } from "@/lib/dcss-death-place-impact"
import { cn } from "@/lib/utils"
import { typography } from "@/lib/typography"

/** Match Most Used Spells chart row / bar sizing. */
const ROW_BODY = "text-[calc(1rem-1pt)]"
const ROW_LABEL = "text-[calc(0.875rem-1pt)]"

function ImpactRow({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="min-w-0" title={String(value)}>
      <div className={cn("mb-1 flex items-baseline justify-between gap-2 font-mono leading-snug", ROW_BODY)}>
        <span className="min-w-0 flex-1 tabular-nums text-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2.5 w-full bg-muted/80">
        <div
          className="h-2.5 bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function DeathPlaceImpactChart({ morgues = [], loading }: { morgues?: GameRecord[]; loading?: boolean }) {
  const { themeStyle } = useTheme()
  const { sections, otherValue, orbRunValue } = useMemo(
    () => buildDeathPlaceImpactSections(morgues),
    [morgues]
  )
  const topRows = useMemo(() => {
    const rows = sections.flatMap((section) =>
      section.rows.map((row) => ({
        label: section.rows.length === 1 ? section.title : `${section.title} ${row.label}`,
        value: row.value,
      }))
    )
    rows.push({ label: "Other", value: otherValue })
    rows.push({ label: "Orb Run", value: orbRunValue })
    return rows
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [sections, otherValue, orbRunValue])
  const scaleMax = useMemo(() => {
    return topRows.reduce((m, r) => Math.max(m, r.value), 1)
  }, [topRows])
  const subtitle = useMemo(() => {
    if (topRows.length === 0) return "No qualifying death-place impact yet."
    return "Top 10 places by impact (sum of XL for deaths). Orb Run included when it ranks."
  }, [topRows])
  const accent = themeStyle === "ascii" ? "#22c55e" : "#d4a574"

  if (loading) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle>DEATH PLACE IMPACT (SUM OF XL)</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className={cn("flex h-40 items-center justify-center", typography.bodyMuted, ROW_BODY)}>Loading…</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
          <span>DEATH PLACE IMPACT (SUM OF XL)</span>
          <span
            className={cn(
              typography.captionMono,
              "font-normal text-muted-foreground max-w-prose text-left sm:text-right"
            )}
          >
            {subtitle}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2.5" style={{ color: "var(--foreground)" }}>
          {topRows.length === 0 ? (
            <p className={cn(typography.bodyMuted, ROW_LABEL)}>No deaths with tracked place impact yet.</p>
          ) : (
            topRows.map((row, idx) => (
              <ImpactRow
                key={`${row.label}-${idx}`}
                label={`${idx + 1}. ${row.label}`}
                value={row.value}
                max={scaleMax}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
