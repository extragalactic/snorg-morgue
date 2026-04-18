"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { UserFavouriteSpellRow } from "@/lib/morgue-api"
import { DCSS_SPELL_LEVELS, resolveCanonicalDcssSpellName } from "@/lib/dcss-spell-levels"
import { cn } from "@/lib/utils"
import { typography } from "@/lib/typography"
import { colors } from "@/lib/colors"

/** One point smaller than Tailwind `text-base` / `text-sm` for this card. */
const SPELL_BODY = "text-[calc(1rem-1pt)]"
const SPELL_LABEL = "text-[calc(0.875rem-1pt)]"
/** “Level N” column headers: slightly larger than SPELL_LABEL (spell rows / em dash). */
const SPELL_LEVEL_TITLE = "text-sm"

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
          <div
            className={cn("flex h-40 items-center justify-center", typography.bodyMuted, SPELL_BODY)}
          >
            Loading…
          </div>
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
          <p className={cn(typography.bodyMuted, SPELL_BODY, "leading-relaxed")}>
            No mapped spell casts yet. Stats refresh when you upload morgues with an Action table; spell names must
            match DCSS (unknown or obsolete spells are skipped).
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
                className="flex min-h-[14rem] flex-col border-2 border-primary/20 bg-card/40 p-3"
              >
                <div
                  className={cn(
                    "mb-2 border-b border-primary/15 pb-1 font-mono uppercase tracking-wider text-muted-foreground",
                    SPELL_LEVEL_TITLE,
                  )}
                >
                  Level {level}
                </div>
                {spells.length === 0 ? (
                  <p className={cn("mt-auto text-muted-foreground", typography.bodyMono, SPELL_LABEL)}>—</p>
                ) : (
                  <ul className="flex flex-1 flex-col gap-2.5">
                    {spells.map((s) => {
                      const pct = globalMax > 0 ? Math.min(100, (s.total_uses / globalMax) * 100) : 0
                      const displaySpellName =
                        resolveCanonicalDcssSpellName(s.spell_key) ??
                        resolveCanonicalDcssSpellName(s.spell_name) ??
                        s.spell_name
                      return (
                        <li key={`${s.level_group}-${s.rank}-${s.spell_key}`} className="min-w-0">
                          <div
                            className={cn(
                              "mb-1 flex items-start justify-between gap-2 font-mono leading-snug",
                              SPELL_BODY,
                            )}
                          >
                            <span className="min-w-0 flex-1 break-words text-foreground">
                              {s.rank}. {displaySpellName}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{s.total_uses}</span>
                          </div>
                          <div className="h-2.5 w-full bg-muted/80">
                            <div
                              className="h-2.5 bg-primary transition-[width] duration-300 ease-out"
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
