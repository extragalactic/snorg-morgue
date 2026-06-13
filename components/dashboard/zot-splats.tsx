"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { typography } from "@/lib/typography"
import { parsePlaceBranchDepth } from "@/lib/morgue-parser"
import { MorgueViewerModal } from "./morgue-viewer-modal"
import type { GameRecord } from "@/lib/morgue-api"

/**
 * Characters that died in Zot and whose species/background combo has never been won.
 * These are the "almost won" games; once that combo is won it drops off the list.
 */
function buildZotSplats(morgues: GameRecord[]): GameRecord[] {
  const wonCombos = new Set<string>()
  for (const m of morgues) {
    if (m.result !== "win") continue
    const species = (m.species ?? "").trim()
    const background = (m.background ?? "").trim()
    if (species && background) wonCombos.add(`${species}|||${background}`)
  }

  return morgues
    .filter((m) => {
      if (m.result !== "death") return false
      const diedInZot = parsePlaceBranchDepth(m.place)?.branch === "Zot"
      if (!diedInZot && !m.diedHoldingOrb) return false
      const species = (m.species ?? "").trim()
      const background = (m.background ?? "").trim()
      if (!species || !background) return false
      return !wonCombos.has(`${species}|||${background}`)
    })
    .sort((a, b) => (b.xl ?? 0) - (a.xl ?? 0))
}

export function ZotSplats({
  morgues = [],
  loading,
  usernameSlug,
  actionAveragesUserId,
}: {
  morgues?: GameRecord[]
  loading?: boolean
  usernameSlug?: string
  actionAveragesUserId?: string | null
}) {
  const splats = useMemo(() => buildZotSplats(morgues), [morgues])
  const [viewingMorgue, setViewingMorgue] = useState<GameRecord | null>(null)

  const body = (() => {
    if (loading) {
      return (
        <div className={cn("h-20 flex items-center justify-center", typography.bodyMuted)}>Loading…</div>
      )
    }
    if (splats.length === 0) {
      return <p className={typography.bodyMuted}>No Zot deaths for combos you haven&apos;t won yet.</p>
    }
    return (
      <div className="overflow-x-auto">
        <table className={cn("w-full", typography.bodyMono)}>
          <thead>
            <tr className="border-b-2 border-primary/20 text-left text-muted-foreground">
              <th className="py-1.5 pr-3 font-normal">Species</th>
              <th className="py-1.5 pr-3 font-normal">Background</th>
              <th className="py-1.5 pr-3 font-normal">God</th>
              <th className="py-1.5 pr-3 font-normal">XL</th>
              <th className="py-1.5 font-normal" />
            </tr>
          </thead>
          <tbody>
            {splats.map((m) => (
              <tr
                key={m.id}
                className="border-b border-primary/10 hover:bg-primary/5 cursor-pointer"
                onClick={() => setViewingMorgue(m)}
              >
                <td className="py-1.5 pr-3 text-primary">{m.species}</td>
                <td className="py-1.5 pr-3 text-foreground">{m.background}</td>
                <td className="py-1.5 pr-3 text-muted-foreground">{m.god?.trim() || "—"}</td>
                <td className="py-1.5 pr-3 text-foreground">{m.xl}</td>
                <td className="py-1.5">
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setViewingMorgue(m)
                    }}
                  >
                    View morgue
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  })()

  return (
    <>
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle>ZOT SPLATS</CardTitle>
          <CardDescription>
            Characters that died in Zot or on the Orb Run, and you haven&apos;t won with that
            species/background combo yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1.5">{body}</CardContent>
      </Card>
      <MorgueViewerModal
        game={viewingMorgue}
        onClose={() => setViewingMorgue(null)}
        usernameSlug={usernameSlug}
        actionAveragesUserId={actionAveragesUserId}
      />
    </>
  )
}
