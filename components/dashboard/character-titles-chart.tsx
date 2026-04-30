"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { GameRecord } from "@/lib/morgue-api"
import { collectUniqueFormattedTitles, epithetKeysFromWinners } from "@/lib/dcss-character-titles"
import { colors } from "@/lib/colors"
import { cn } from "@/lib/utils"
import { typography } from "@/lib/typography"

const ROW_BODY = "text-[calc(1rem-1pt)]"

export function CharacterTitlesChart({ morgues = [], loading }: { morgues?: GameRecord[]; loading?: boolean }) {
  const titles = useMemo(() => collectUniqueFormattedTitles(morgues), [morgues])
  const winnerEpithetKeys = useMemo(() => epithetKeysFromWinners(morgues), [morgues])
  const winnerTitleCount = winnerEpithetKeys.size

  if (loading) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle>CHARACTER TITLES</CardTitle>
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
          <span>CHARACTER TITLES</span>
          <span
            className={cn(
              "font-mono text-sm font-normal max-w-prose text-left sm:text-right flex flex-wrap items-baseline gap-x-3 gap-y-1"
            )}
          >
            <span className="text-muted-foreground">{titles.length} total</span>
            <span aria-hidden className="inline-flex shrink-0 font-mono select-none">
              <span className="text-muted-foreground">/</span>
              <span className={cn(colors.success)}>/</span>
            </span>
            <span className={cn(colors.success)}>
              {winnerTitleCount} winner title{winnerTitleCount === 1 ? "" : "s"}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {titles.length === 0 ? (
          <p className={cn(typography.bodyMuted, ROW_BODY)}>
            No character names with an epithet (Name the …) found in your morgues.
          </p>
        ) : (
          <ul
            className={cn(
              "list-none pl-0 font-mono leading-snug",
              "columns-1 sm:columns-2 xl:columns-3 [column-gap:2rem]",
              ROW_BODY,
              "text-foreground"
            )}
          >
            {titles.map((t) => {
              const isWinnerTitle = winnerEpithetKeys.has(t.toLowerCase())
              return (
                <li
                  key={t}
                  className={cn(
                    "break-inside-avoid py-0.5",
                    isWinnerTitle && cn(colors.success, "font-semibold")
                  )}
                >
                  {t}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
