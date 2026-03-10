"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  TOTAL_SPECIES,
  TOTAL_BACKGROUNDS,
  TOTAL_GODS,
  DRACONIAN_COLOUR_NAMES,
  TOTAL_DRACONIAN_COLOURS,
  ALL_SPECIES_NAMES,
} from "@/lib/dcss-constants"
import type { GameRecord } from "@/lib/morgue-api"

/** Snorg Award display titles – single source of truth for conditional checks and list data */
const SNORG_TITLES = {
  D1_PADAWAN: "D1 Padawan",
  LAIR: "Lair Initiate",
  S_BRANCH_ASSASSIN: "S-Branch Assassin",
  VAULT_MERCENARY: "Vault Mercenary",
  ZOT_SPECIAL_OPS: "Zot Special Ops",
  NERD_GOD_KING: "Nerd God-King of the Realm",
} as const

/** Play time achievements: hours played -> { title, thresholdSeconds } */
const PLAY_TIME_ACHIEVEMENTS = [
  { title: SNORG_TITLES.D1_PADAWAN, hours: 100 },
  { title: SNORG_TITLES.LAIR, hours: 250 },
  { title: SNORG_TITLES.S_BRANCH_ASSASSIN, hours: 500 },
  { title: SNORG_TITLES.VAULT_MERCENARY, hours: 1000 },
  { title: SNORG_TITLES.ZOT_SPECIAL_OPS, hours: 2000 },
  { title: SNORG_TITLES.NERD_GOD_KING, hours: 4000 },
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
  const dracColours = new Set(
    wins
      .map((m) => m.species)
      .filter((s): s is string => !!s && DRACONIAN_COLOUR_NAMES.includes(s))
  )

  // For each species, track how many distinct backgrounds and gods have wins
  const speciesBackgroundWins = new Map<string, Set<string>>()
  const speciesGodWins = new Map<string, Set<string>>()
  for (const m of wins) {
    const sp = m.species
    const bg = m.background
    const god = m.god
    if (sp && bg) {
      let bgSet = speciesBackgroundWins.get(sp)
      if (!bgSet) {
        bgSet = new Set<string>()
        speciesBackgroundWins.set(sp, bgSet)
      }
      bgSet.add(bg)
    }
    if (sp && god) {
      let godSet = speciesGodWins.get(sp)
      if (!godSet) {
        godSet = new Set<string>()
        speciesGodWins.set(sp, godSet)
      }
      godSet.add(god)
    }
  }

  // For each species, track how many distinct backgrounds have *attempts* (win or loss)
  const speciesBackgroundAttempts = new Map<string, Set<string>>()
  for (const m of morgues) {
    const sp = m.species
    const bg = m.background
    if (!sp || !bg) continue
    let set = speciesBackgroundAttempts.get(sp)
    if (!set) {
      set = new Set<string>()
      speciesBackgroundAttempts.set(sp, set)
    }
    set.add(bg)
  }

  const goals: Goal[] = [
    {
      name: "Great Player",
      description: `Win with all ${TOTAL_SPECIES} species`,
      current: species.size,
      max: TOTAL_SPECIES,
    },
    {
      name: "Greater Player",
      description: `Achieve Great Player +\nWin with all ${TOTAL_BACKGROUNDS} backgrounds`,
      current: backgrounds.size,
      max: TOTAL_BACKGROUNDS,
    },
    {
      name: "Polytheist",
      description: `Win with all ${TOTAL_GODS} gods`,
      current: gods.size,
      max: TOTAL_GODS,
    },
    {
      name: "Tiamat",
      description: `Win with all ${TOTAL_DRACONIAN_COLOURS} colours of Draconian`,
      current: dracColours.size,
      max: TOTAL_DRACONIAN_COLOURS,
    },
  ]

  // Greater Species achievements: one per species, showing backgrounds won with that species
  for (const speciesName of ALL_SPECIES_NAMES) {
    const bgSet = speciesBackgroundWins.get(speciesName) ?? new Set<string>()
    // Hide species with zero wins (no backgrounds cleared yet)
    if (bgSet.size === 0) continue
    goals.push({
      name: `Greater ${speciesName}`,
      description: `Win with all ${TOTAL_BACKGROUNDS} backgrounds as a ${speciesName}`,
      current: bgSet.size,
      max: TOTAL_BACKGROUNDS,
    })
  }

  // Devoted Species achievements: one per species, showing gods won with that species
  for (const speciesName of ALL_SPECIES_NAMES) {
    const godSet = speciesGodWins.get(speciesName) ?? new Set<string>()
    // Hide species with zero wins (no gods yet)
    if (godSet.size === 0) continue
    goals.push({
      name: `Devoted ${speciesName}`,
      description: `Win with all ${TOTAL_GODS} gods as a ${speciesName}`,
      current: godSet.size,
      max: TOTAL_GODS,
    })
  }

  // Enthusiastic Species achievements: one per species, showing backgrounds *attempted* with that species
  for (const speciesName of ALL_SPECIES_NAMES) {
    const bgAttemptSet = speciesBackgroundAttempts.get(speciesName) ?? new Set<string>()
    if (bgAttemptSet.size === 0) continue
    goals.push({
      name: `Enthusiastic ${speciesName}`,
      description: `Attempt all ${TOTAL_BACKGROUNDS} backgrounds as a ${speciesName}`,
      current: bgAttemptSet.size,
      max: TOTAL_BACKGROUNDS,
    })
  }

  return goals
}

const defaultGoals: Goal[] = [
  { name: "Great Player", description: `Win with all ${TOTAL_SPECIES} species`, current: 0, max: TOTAL_SPECIES },
  { name: "Greater Player", description: `Achieve Great Player +\nWin with all ${TOTAL_BACKGROUNDS} backgrounds`, current: 0, max: TOTAL_BACKGROUNDS },
  { name: "Polytheist", description: `Win with all ${TOTAL_GODS} gods`, current: 0, max: TOTAL_GODS },
  { name: "Tiamat", description: `Win with all ${TOTAL_DRACONIAN_COLOURS} colours of Draconian`, current: 0, max: TOTAL_DRACONIAN_COLOURS },
]

export function GoalProgress({ stats, morgues = [], loading }: GoalProgressProps) {
  const goals = morgues.length > 0 ? computeGoals(morgues) : defaultGoals
  const coreGoals = goals.filter(
    (g) =>
      g.name === "Great Player" ||
      g.name === "Greater Player" ||
      g.name === "Polytheist" ||
      g.name === "Tiamat"
  )
  const greaterSpeciesGoals = goals.filter(
    (g) => g.name.startsWith("Greater ") && g.name !== "Greater Player"
  )
  const hasGreaterSpeciesProgress = greaterSpeciesGoals.some((g) => g.current >= 3)
  const devotedSpeciesGoals = goals.filter((g) => g.name.startsWith("Devoted "))
  const hasDevotedSpeciesProgress = devotedSpeciesGoals.some((g) => g.current >= 3)
  const enthusiasticSpeciesGoals = goals.filter((g) => g.name.startsWith("Enthusiastic "))
  const enthusiasticSpeciesWithProgress = enthusiasticSpeciesGoals.filter((g) => g.current >= 3)
  const hasEnthusiasticSpeciesProgress = enthusiasticSpeciesWithProgress.length > 0
  if (loading) {
    return (
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle className="font-mono text-sm text-primary">ACHIEVEMENTS</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">
            Loading…
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Great Players card */}
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle className="font-mono text-sm text-primary">GREAT PLAYERS</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-6 md:grid-cols-4">
          {coreGoals.map((goal) => {
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
                <p className="text-xs text-muted-foreground whitespace-pre-line">
                  {goal.description}
                </p>
              </div>
            )
          })}
          </div>
        </CardContent>
      </Card>

      {/* Snorg Awards card */}
      <Card className="mt-6 border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 pb-3">
          <CardTitle className="font-mono text-sm text-primary">SNORG AWARDS</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="font-mono text-sm text-muted-foreground mb-4">
            Total Play Time:{" "}
            <span className="font-mono text-base text-yellow-500">
              {stats?.totalPlayTime ?? "0m"}
              {stats?.totalPlayTimeSeconds != null &&
                ` (${(stats.totalPlayTimeSeconds / 3600).toFixed(1)} hours)`}
            </span>
          </p>
          <div className="flex flex-wrap gap-2 min-w-0">
            {PLAY_TIME_ACHIEVEMENTS.map((a) => {
              const unlocked =
                (stats?.totalPlayTimeSeconds ?? 0) >= a.thresholdSeconds

              const iconSrc =
                a.title === SNORG_TITLES.D1_PADAWAN
                  ? "/images/monster-orc-priest.png"
                  : a.title === SNORG_TITLES.LAIR
                    ? "/images/monster-hydra.png"
                    : a.title === SNORG_TITLES.S_BRANCH_ASSASSIN
                      ? "/images/monster-fire-salamander.png"
                      : a.title === SNORG_TITLES.VAULT_MERCENARY
                        ? "/images/monster-guardian-sphinx.png"
                        : a.title === SNORG_TITLES.ZOT_SPECIAL_OPS
                          ? "/images/monster-golden-dragon.png"
                          : a.title === SNORG_TITLES.NERD_GOD_KING
                            ? "/images/monster-orb-of-fire.png"
                            : null

              return (
                <div
                  key={a.title}
                  className={`flex flex-1 flex-col items-center justify-center gap-1 min-w-[150px] p-2 rounded-none border-2 transition-colors ${
                    unlocked
                      ? "border-[3px] border-primary/60 bg-transparent"
                      : "border-primary/20 bg-muted/30 opacity-70"
                  }`}
                >
                  <div
                    className={`snorg-award-icon h-10 w-10 flex flex-shrink-0 items-center justify-center rounded ${
                      unlocked ? "text-primary" : "opacity-70 snorg-award-locked"
                    }`}
                    aria-hidden
                  >
                    {iconSrc ? (
                      <img
                        src={iconSrc}
                        alt=""
                        className="h-10 w-10 object-contain"
                      />
                    ) : (
                      <span className="font-mono text-lg">★</span>
                    )}
                  </div>
                  <span
                    className={`font-mono text-sm leading-tight text-center ${
                      unlocked ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {a.title}
                  </span>
                  <span
                    className={`font-mono text-base ${
                      unlocked ? "text-yellow-500" : "text-muted-foreground"
                    }`}
                  >
                    {a.hours}h+
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Greater Species card */}
      {greaterSpeciesGoals.length > 0 && (
        <Card className="mt-6 border-2 border-primary/30 rounded-none">
          <CardHeader className="border-b-2 border-primary/20 pb-3">
            <CardTitle className="font-mono text-sm text-primary">GREATER SPECIES</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {hasGreaterSpeciesProgress ? (
              <div className="grid gap-6 md:grid-cols-4">
                {greaterSpeciesGoals.map((goal) => {
                  const percentage = (goal.current / goal.max) * 100
                  return (
                    <div key={goal.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-foreground">
                          {goal.name}
                        </span>
                        <span className="font-mono text-sm text-primary">
                          {goal.current}/{goal.max}
                        </span>
                      </div>
                      <Progress
                        value={percentage}
                        className="h-3 rounded-none bg-secondary border border-primary/30"
                      />
                      <p className="text-xs text-muted-foreground whitespace-pre-line">
                        {goal.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-mono">
                Before you see the Greater Species tracking you must win with a species with a minimum of 3 different backgrounds.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Enthusiastic Species card */}
      {enthusiasticSpeciesGoals.length > 0 && (
        <Card className="mt-6 border-2 border-primary/30 rounded-none">
          <CardHeader className="border-b-2 border-primary/20 pb-3">
            <CardTitle className="font-mono text-sm text-primary flex items-baseline gap-2">
              <span>ENTHUSIASTIC SPECIES</span>
              <span className="text-xs text-muted-foreground">
                …on the path to Greater Species
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {hasEnthusiasticSpeciesProgress ? (
              <div className="grid gap-6 md:grid-cols-4">
                {enthusiasticSpeciesWithProgress.map((goal) => {
                  const percentage = (goal.current / goal.max) * 100
                  return (
                    <div key={goal.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-foreground">
                          {goal.name}
                        </span>
                        <span className="font-mono text-sm text-primary">
                          {goal.current}/{goal.max}
                        </span>
                      </div>
                      <Progress
                        value={percentage}
                        className="h-3 rounded-none bg-secondary border border-primary/30"
                      />
                      <p className="text-xs text-muted-foreground whitespace-pre-line">
                        {goal.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-mono">
                Before you see the Enthusiastic Species tracking you must attempt a win with a species with a minimum of 3 different backgrounds.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Devoted Species card */}
      {devotedSpeciesGoals.length > 0 && (
        <Card className="mt-6 border-2 border-primary/30 rounded-none">
          <CardHeader className="border-b-2 border-primary/20 pb-3">
            <CardTitle className="font-mono text-sm text-primary">DEVOTED SPECIES</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {hasDevotedSpeciesProgress ? (
              <div className="grid gap-6 md:grid-cols-4">
                {devotedSpeciesGoals.map((goal) => {
                  const percentage = (goal.current / goal.max) * 100
                  return (
                    <div key={goal.name} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-foreground">
                          {goal.name}
                        </span>
                        <span className="font-mono text-sm text-primary">
                          {goal.current}/{goal.max}
                        </span>
                      </div>
                      <Progress
                        value={percentage}
                        className="h-3 rounded-none bg-secondary border border-primary/30"
                      />
                      <p className="text-xs text-muted-foreground whitespace-pre-line">
                        {goal.description}
                      </p>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground font-mono">
                Before you see the Devoted Species tracking you must win with a species with a minimum of 3 different gods.
              </p>
            )}
          </CardContent>
        </Card>
      )}

    </>
  )
}
