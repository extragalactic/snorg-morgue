"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TOTAL_SPECIES, TOTAL_BACKGROUNDS, TOTAL_GODS } from "@/lib/dcss-constants"
import type { GameRecord } from "@/lib/morgue-api"

interface Goal {
  name: string
  description: string
  current: number
  max: number
}

interface GoalProgressProps {
  stats?: {
    totalWins: number
    totalDeaths: number
    totalRunes: number
  } | null
  morgues?: GameRecord[]
  loading?: boolean
}

function computeGoals(morgues: GameRecord[]): Goal[] {
  const wins = morgues.filter((m) => m.result === "win")
  const species = new Set(wins.map((m) => m.species))
  const backgrounds = new Set(wins.map((m) => m.background))
  const gods = new Set(wins.map((m) => m.god).filter(Boolean) as string[])
  return [
    { name: "Great Player", description: `Win with all ${TOTAL_SPECIES} species`, current: species.size, max: TOTAL_SPECIES },
    { name: "Greater Player", description: `Achieve Great Player +\nWin with all ${TOTAL_BACKGROUNDS} backgrounds`, current: backgrounds.size, max: TOTAL_BACKGROUNDS },
    { name: "Polytheist", description: `Win with all ${TOTAL_GODS} gods`, current: gods.size, max: TOTAL_GODS },
  ]
}

const defaultGoals: Goal[] = [
  { name: "Great Player", description: `Win with all ${TOTAL_SPECIES} species`, current: 0, max: TOTAL_SPECIES },
  { name: "Greater Player", description: `Achieve Great Player +\nWin with all ${TOTAL_BACKGROUNDS} backgrounds`, current: 0, max: TOTAL_BACKGROUNDS },
  { name: "Polytheist", description: `Win with all ${TOTAL_GODS} gods`, current: 0, max: TOTAL_GODS },
]

export function GoalProgress({ stats, morgues = [], loading }: GoalProgressProps) {
  const goals = morgues.length > 0 ? computeGoals(morgues) : defaultGoals
  if (loading) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle className="font-mono text-sm text-primary">ACHIEVEMENT PROGRESS</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="font-mono text-sm text-primary">
          ACHIEVEMENT PROGRESS
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid gap-6 md:grid-cols-3">
          {goals.map((goal) => {
            const percentage = (goal.current / goal.max) * 100
            return (
              <div key={goal.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-foreground">{goal.name}</span>
                  <span className="font-mono text-sm text-primary">
                    {goal.current}/{goal.max}
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-3 rounded-none bg-secondary border border-primary/30"
                />
                <p className="text-xs text-muted-foreground whitespace-pre-line">{goal.description}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
