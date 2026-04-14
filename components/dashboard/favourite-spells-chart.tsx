"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { UserFavouriteSpellRow } from "@/lib/morgue-api"
import { DCSS_SPELL_LEVELS } from "@/lib/dcss-spell-levels"
import { cn } from "@/lib/utils"
import { typography } from "@/lib/typography"
import { colors } from "@/lib/colors"

export function FavouriteSpellsChart({
  rows = [],
  loading,
}: {
  rows?: UserFavouriteSpellRow[]
  loading?: boolean
}) {
  const { byGroup, globalMax } = useMemo(() => {
    const m = new Map<string, UserFavouriteSpellRow[]>()
    let maxUses = 1
    for (const r of rows) {
      maxUses = Math.max(maxUses, r.total_uses)
      if (!m.has(r.level_group)) m.set(r.level_group, [])
      m.get(r.level_group)!.push(r)
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.rank - b.rank)
    }
    return { byGroup: m, globalMax: maxUses }
  }, [rows])

  const hasAnySpell = rows.length > 0

  if (loading) {
    return (
      <Card className={cn(colors.cardBorder, "rounded-none")}>
        <CardHeader className={cn(colors.cardBorderBottom, "pb-3")}>
          <CardTitle>FAVOURITE SPELLS</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className={cn("flex h-40 items-center justify-center", typography.bodyMuted)}>Loading…</div>
        </CardContent>
      </Card>
    )
  }

  if (!hasAnySpell) {
    return (
      <Card className={cn(colors.cardBorder, "rounded-none")}>
        <CardHeader className={cn(colors.cardBorderBottom, "pb-3")}>
          <CardTitle>FAVOURITE SPELLS</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className={typography.bodyMuted}>
            No mapped spell casts yet. Stats refresh when you upload morgues with an Action table; spell names must match
            DCSS (unknown or obsolete spells are skipped).
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(colors.cardBorder, "rounded-none")}>
      <CardHeader className={cn(colors.cardBorderBottom, "pb-3")}>
        <CardTitle>FAVOURITE SPELLS</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DCSS_SPELL_LEVELS.map((level) => {
            const key = String(level)
            const spells = byGroup.get(key) ?? []
            return (
              <div
                key={key}
                className="flex min-h-[7.5rem] flex-col border-2 border-primary/20 bg-card/40 p-2.5"
              >
                <div
                  className={cn(
                    "mb-2 border-b border-primary/15 pb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground",
                  )}
                >
                  Level {level}
                </div>
                {spells.length === 0 ? (
                  <p className={cn("mt-auto text-xs text-muted-foreground", typography.bodyMono)}>—</p>
                ) : (
                  <ul className="flex flex-1 flex-col gap-2">
                    {spells.map((s) => {
                      const pct = globalMax > 0 ? Math.min(100, (s.total_uses / globalMax) * 100) : 0
                      return (
                        <li key={`${s.level_group}-${s.rank}-${s.spell_key}`} className="min-w-0">
                          <div className="mb-0.5 flex items-baseline justify-between gap-1 font-mono text-[11px] leading-tight">
                            <span className="min-w-0 truncate text-foreground" title={s.spell_name}>
                              {s.rank}. {s.spell_name}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{s.total_uses}</span>
                          </div>
                          <div className="h-2 w-full bg-muted/80">
                            <div
                              className="h-2 bg-primary transition-[width] duration-300 ease-out"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
