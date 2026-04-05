"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { typography } from "@/lib/typography"
import type { GameRecord } from "@/lib/morgue-api"

/** Combine all N-headed hydra variants into a single bucket for counting. */
function normalizeKillerForGrouping(killer: string): string {
  if (/headed hydra$/i.test(killer.trim())) return "hydra (all sizes)"
  return killer
}

function buildTop10Killers(morgues: GameRecord[]): { name: string; count: number }[] {
  const deaths = morgues.filter((m) => m.result === "death" && m.killer?.trim())
  const byKiller: Record<string, { count: number; maxXl: number }> = {}
  deaths.forEach((m) => {
    const k = m.killer!.trim()
    const key = normalizeKillerForGrouping(k)
    if (!byKiller[key]) byKiller[key] = { count: 0, maxXl: 0 }
    byKiller[key].count += 1
    byKiller[key].maxXl = Math.max(byKiller[key].maxXl, m.xl)
  })
  return Object.entries(byKiller)
    .map(([name, { count, maxXl }]) => ({ name, count, maxXl }))
    .sort((a, b) => b.count - a.count || b.maxXl - a.maxXl)
    .slice(0, 10)
    .map(({ name, count }) => ({ name, count }))
}

/** Sum of XL at death per killer (hydra variants grouped like Top 10 Killers). */
function buildTop10NotoriousKillers(morgues: GameRecord[]): { name: string; points: number; deaths: number }[] {
  const deaths = morgues.filter((m) => m.result === "death" && m.killer?.trim())
  const byKiller: Record<string, { points: number; deaths: number; maxXl: number }> = {}
  deaths.forEach((m) => {
    const k = m.killer!.trim()
    const key = normalizeKillerForGrouping(k)
    if (!byKiller[key]) byKiller[key] = { points: 0, deaths: 0, maxXl: 0 }
    const xl = Math.max(0, m.xl ?? 0)
    byKiller[key].points += xl
    byKiller[key].deaths += 1
    byKiller[key].maxXl = Math.max(byKiller[key].maxXl, xl)
  })
  return Object.entries(byKiller)
    .map(([name, { points, deaths, maxXl }]) => ({ name, points, deaths, maxXl }))
    .sort((a, b) => b.points - a.points || b.deaths - a.deaths || b.maxXl - a.maxXl)
    .slice(0, 10)
    .map(({ name, points, deaths }) => ({ name, points, deaths }))
}

export function Top10Killers({ morgues = [], loading }: { morgues?: GameRecord[]; loading?: boolean }) {
  const top10 = useMemo(() => buildTop10Killers(morgues), [morgues])

  if (loading) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle>TOP 10 KILLERS</CardTitle>
        </CardHeader>
        <CardContent className="pt-1.5">
          <div className={cn("h-20 flex items-center justify-center", typography.bodyMuted)}>Loading…</div>
        </CardContent>
      </Card>
    )
  }

  if (top10.length === 0) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle>TOP 10 KILLERS</CardTitle>
        </CardHeader>
        <CardContent className="pt-1.5">
          <p className={typography.bodyMuted}>No death data with killer information yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle>TOP 10 KILLERS</CardTitle>
      </CardHeader>
      <CardContent className="pt-1.5">
        <ol className={cn("list-decimal list-inside space-y-1.5", typography.bodyMono)}>
          {top10.map(({ name, count }, i) => (
            <li key={`${name}-${i}`} className="text-foreground">
              <span className="text-primary">{name}</span>
              <span className="text-muted-foreground ml-1">({count})</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

export function Top10NotoriousKillers({ morgues = [], loading }: { morgues?: GameRecord[]; loading?: boolean }) {
  const top10 = useMemo(() => buildTop10NotoriousKillers(morgues), [morgues])

  if (loading) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle>TOP 10 NOTORIOUS KILLERS</CardTitle>
        </CardHeader>
        <CardContent className="pt-1.5">
          <div className={cn("h-20 flex items-center justify-center", typography.bodyMuted)}>Loading…</div>
        </CardContent>
      </Card>
    )
  }

  if (top10.length === 0) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle>TOP 10 NOTORIOUS KILLERS</CardTitle>
        </CardHeader>
        <CardContent className="pt-1.5">
          <p className={typography.bodyMuted}>No death data with killer information yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle>TOP 10 NOTORIOUS KILLERS</CardTitle>
        <CardDescription>
          Ranked by sum of XL at death (each death scores points equal to character level).
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-1.5">
        <ol className={cn("list-decimal list-inside space-y-1.5", typography.bodyMono)}>
          {top10.map(({ name, deaths }, i) => (
            <li key={`${name}-${i}`} className="text-foreground">
              <span className="text-primary">{name}</span>
              <span className="text-muted-foreground ml-1">({deaths})</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
