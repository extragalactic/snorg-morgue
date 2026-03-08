"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { TOTAL_SPECIES, TOTAL_BACKGROUNDS, TOTAL_GODS } from "@/lib/dcss-constants"
import type { GameRecord } from "@/lib/morgue-api"

/** Play time achievements: hours + min wins -> { title, thresholdSeconds, minWins } */
const PLAY_TIME_ACHIEVEMENTS = [
  { title: "D1 Padawan", hours: 100, minWins: 1 },
  { title: "S-Branch Assassin", hours: 250, minWins: 5 },
  { title: "Vault Mercenary", hours: 500, minWins: 10 },
  { title: "Zot Special Ops", hours: 1000, minWins: 25 },
  { title: "Nerd God-King of the Realm", hours: 2000, minWins: 100 },
].map((a) => ({ ...a, thresholdSeconds: a.hours * 3600 }))

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
    totalPlayTime?: string
    totalPlayTimeSeconds?: number
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

        {/* Play Time row: left-aligned play time, achievement boxes fill remaining width */}
        <div className="mt-6 pt-6 border-t-2 border-primary/20 flex flex-col sm:flex-row sm:items-stretch gap-4">
          <div className="flex-shrink-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Play Time</p>
            <p className="font-mono text-xl text-primary">
              {stats?.totalPlayTime ?? "0m"}
            </p>
            {stats?.totalPlayTimeSeconds != null && (
              <p className="font-mono text-sm text-yellow-500">
                {(stats.totalPlayTimeSeconds / 3600).toFixed(1)} hours
              </p>
            )}
          </div>
          <div className="flex flex-1 flex-wrap gap-2 min-w-0">
            {PLAY_TIME_ACHIEVEMENTS.map((a) => {
              const totalWins = stats?.totalWins ?? 0
              const unlocked =
                (stats?.totalPlayTimeSeconds ?? 0) >= a.thresholdSeconds &&
                totalWins >= a.minWins
              return (
                <div
                  key={a.title}
                  className={`flex flex-1 flex-col items-center justify-center gap-1 min-w-[150px] p-2 rounded-none border-2 transition-colors ${
                    unlocked
                      ? "border-primary/50 bg-primary/10"
                      : "border-primary/20 bg-muted/30 opacity-70"
                  }`}
                >
                  <div
                    className={`h-10 w-10 flex flex-shrink-0 items-center justify-center rounded ${
                      unlocked ? "text-primary" : "grayscale"
                    }`}
                    aria-hidden
                  >
                    {/* Placeholder icon - replace with graphic later */}
                    <span className="font-mono text-lg">★</span>
                  </div>
                  <span
                    className={`font-mono text-sm leading-tight text-center ${
                      unlocked ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {a.title}
                  </span>
                  <span className="font-mono text-base text-yellow-500">
                    {a.hours}h + {a.minWins} {a.minWins === 1 ? "win" : "wins"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
