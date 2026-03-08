"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { GameRecord } from "@/lib/morgue-api"

function buildTop10Killers(morgues: GameRecord[]): { name: string; count: number }[] {
  const deaths = morgues.filter((m) => m.result === "death" && m.killer?.trim())
  const byKiller: Record<string, { count: number; maxXl: number }> = {}
  deaths.forEach((m) => {
    const k = m.killer!.trim()
    if (!byKiller[k]) byKiller[k] = { count: 0, maxXl: 0 }
    byKiller[k].count += 1
    byKiller[k].maxXl = Math.max(byKiller[k].maxXl, m.xl)
  })
  return Object.entries(byKiller)
    .map(([name, { count, maxXl }]) => ({ name, count, maxXl }))
    .sort((a, b) => b.count - a.count || b.maxXl - a.maxXl)
    .slice(0, 10)
    .map(({ name, count }) => ({ name, count }))
}

export function Top10Killers({ morgues = [], loading }: { morgues?: GameRecord[]; loading?: boolean }) {
  const top10 = useMemo(() => buildTop10Killers(morgues), [morgues])

  if (loading) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle className="font-mono text-sm text-primary">TOP 10 KILLERS</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        </CardContent>
      </Card>
    )
  }

  if (top10.length === 0) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle className="font-mono text-sm text-primary">TOP 10 KILLERS</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">No death data with killer information yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="font-mono text-sm text-primary">TOP 10 KILLERS</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ol className="list-decimal list-inside space-y-1.5 font-mono text-sm">
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
