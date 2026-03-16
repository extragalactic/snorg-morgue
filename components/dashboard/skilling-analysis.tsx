"use client"

import { useMemo, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ALL_SPECIES_NAMES, ALL_BACKGROUND_NAMES } from "@/lib/dcss-constants"
import { cn } from "@/lib/utils"

const CHECKPOINTS = [5, 10, 15, 20, 25] as const
const FINAL_CHECKPOINT = 25

type SkillAverageRow = {
  skill_group: string
  checkpoint_xl: number
  avg_level: number
  sample_count: number
}

interface SkillingAnalysisProps {
  globalOnly?: boolean
}

// Temporary mock data so the UI can be reviewed without relying on live Supabase data.
const MOCK_DATA: SkillAverageRow[] = [
  // Primary Weapon (includes melee, unarmed, and ranged) + core skills
  { skill_group: "Weapon", checkpoint_xl: 5, avg_level: 5.2, sample_count: 42 },
  { skill_group: "Weapon", checkpoint_xl: 10, avg_level: 10.3, sample_count: 42 },
  { skill_group: "Weapon", checkpoint_xl: 15, avg_level: 14.8, sample_count: 42 },
  { skill_group: "Weapon", checkpoint_xl: 20, avg_level: 17.9, sample_count: 42 },
  { skill_group: "Weapon", checkpoint_xl: 25, avg_level: 19.8, sample_count: 42 },
  // Core defenses
  { skill_group: "Fighting", checkpoint_xl: 5, avg_level: 3.2, sample_count: 42 },
  { skill_group: "Fighting", checkpoint_xl: 10, avg_level: 7.9, sample_count: 42 },
  { skill_group: "Fighting", checkpoint_xl: 15, avg_level: 12.0, sample_count: 42 },
  { skill_group: "Fighting", checkpoint_xl: 20, avg_level: 16.1, sample_count: 42 },
  { skill_group: "Fighting", checkpoint_xl: 25, avg_level: 18.8, sample_count: 42 },
  { skill_group: "Armour", checkpoint_xl: 5, avg_level: 2.0, sample_count: 30 },
  { skill_group: "Armour", checkpoint_xl: 10, avg_level: 6.3, sample_count: 30 },
  { skill_group: "Armour", checkpoint_xl: 15, avg_level: 10.5, sample_count: 30 },
  { skill_group: "Armour", checkpoint_xl: 20, avg_level: 13.7, sample_count: 30 },
  { skill_group: "Armour", checkpoint_xl: 25, avg_level: 15.5, sample_count: 30 },
  { skill_group: "Dodging", checkpoint_xl: 5, avg_level: 3.0, sample_count: 35 },
  { skill_group: "Dodging", checkpoint_xl: 10, avg_level: 7.2, sample_count: 35 },
  { skill_group: "Dodging", checkpoint_xl: 15, avg_level: 11.5, sample_count: 35 },
  { skill_group: "Dodging", checkpoint_xl: 20, avg_level: 15.0, sample_count: 35 },
  { skill_group: "Dodging", checkpoint_xl: 25, avg_level: 17.3, sample_count: 35 },
  { skill_group: "Stealth", checkpoint_xl: 5, avg_level: 1.5, sample_count: 28 },
  { skill_group: "Stealth", checkpoint_xl: 10, avg_level: 4.5, sample_count: 28 },
  { skill_group: "Stealth", checkpoint_xl: 15, avg_level: 7.2, sample_count: 28 },
  { skill_group: "Stealth", checkpoint_xl: 20, avg_level: 9.0, sample_count: 28 },
  { skill_group: "Stealth", checkpoint_xl: 25, avg_level: 10.1, sample_count: 28 },
  { skill_group: "Shields", checkpoint_xl: 5, avg_level: 0.5, sample_count: 20 },
  { skill_group: "Shields", checkpoint_xl: 10, avg_level: 4.0, sample_count: 20 },
  { skill_group: "Shields", checkpoint_xl: 15, avg_level: 7.3, sample_count: 20 },
  { skill_group: "Shields", checkpoint_xl: 20, avg_level: 10.1, sample_count: 20 },
  { skill_group: "Shields", checkpoint_xl: 25, avg_level: 12.0, sample_count: 20 },
  // Utility skills
  { skill_group: "Spellcasting", checkpoint_xl: 5, avg_level: 2.5, sample_count: 28 },
  { skill_group: "Spellcasting", checkpoint_xl: 10, avg_level: 7.0, sample_count: 28 },
  { skill_group: "Spellcasting", checkpoint_xl: 15, avg_level: 11.2, sample_count: 28 },
  { skill_group: "Spellcasting", checkpoint_xl: 20, avg_level: 14.8, sample_count: 28 },
  { skill_group: "Spellcasting", checkpoint_xl: 25, avg_level: 16.8, sample_count: 28 },
  // Ranked spell schools (mocked as if many games have multiple trained schools)
  { skill_group: "Spell School 1", checkpoint_xl: 5, avg_level: 3.0, sample_count: 30 },
  { skill_group: "Spell School 1", checkpoint_xl: 10, avg_level: 8.5, sample_count: 30 },
  { skill_group: "Spell School 1", checkpoint_xl: 15, avg_level: 13.2, sample_count: 30 },
  { skill_group: "Spell School 1", checkpoint_xl: 20, avg_level: 17.0, sample_count: 30 },
  { skill_group: "Spell School 1", checkpoint_xl: 25, avg_level: 19.6, sample_count: 30 },
  { skill_group: "Spell School 2", checkpoint_xl: 5, avg_level: 1.5, sample_count: 18 },
  { skill_group: "Spell School 2", checkpoint_xl: 10, avg_level: 5.0, sample_count: 18 },
  { skill_group: "Spell School 2", checkpoint_xl: 15, avg_level: 8.4, sample_count: 18 },
  { skill_group: "Spell School 2", checkpoint_xl: 20, avg_level: 11.6, sample_count: 18 },
  { skill_group: "Spell School 2", checkpoint_xl: 25, avg_level: 13.9, sample_count: 18 },
  { skill_group: "Spell School 3", checkpoint_xl: 5, avg_level: 0.8, sample_count: 10 },
  { skill_group: "Spell School 3", checkpoint_xl: 10, avg_level: 3.2, sample_count: 10 },
  { skill_group: "Spell School 3", checkpoint_xl: 15, avg_level: 5.7, sample_count: 10 },
  { skill_group: "Spell School 3", checkpoint_xl: 20, avg_level: 7.9, sample_count: 10 },
  { skill_group: "Spell School 3", checkpoint_xl: 25, avg_level: 8.8, sample_count: 10 },
  { skill_group: "Throwing", checkpoint_xl: 5, avg_level: 1.0, sample_count: 12 },
  { skill_group: "Throwing", checkpoint_xl: 10, avg_level: 3.8, sample_count: 12 },
  { skill_group: "Throwing", checkpoint_xl: 15, avg_level: 5.9, sample_count: 12 },
  { skill_group: "Throwing", checkpoint_xl: 20, avg_level: 7.1, sample_count: 12 },
  { skill_group: "Throwing", checkpoint_xl: 25, avg_level: 7.8, sample_count: 12 },
  { skill_group: "Invocations", checkpoint_xl: 5, avg_level: 0.8, sample_count: 16 },
  { skill_group: "Invocations", checkpoint_xl: 10, avg_level: 4.2, sample_count: 16 },
  { skill_group: "Invocations", checkpoint_xl: 15, avg_level: 7.4, sample_count: 16 },
  { skill_group: "Invocations", checkpoint_xl: 20, avg_level: 9.5, sample_count: 16 },
  { skill_group: "Invocations", checkpoint_xl: 25, avg_level: 10.4, sample_count: 16 },
  { skill_group: "Evocations", checkpoint_xl: 5, avg_level: 0.5, sample_count: 20 },
  { skill_group: "Evocations", checkpoint_xl: 10, avg_level: 3.1, sample_count: 20 },
  { skill_group: "Evocations", checkpoint_xl: 15, avg_level: 5.7, sample_count: 20 },
  { skill_group: "Evocations", checkpoint_xl: 20, avg_level: 7.8, sample_count: 20 },
  { skill_group: "Evocations", checkpoint_xl: 25, avg_level: 8.6, sample_count: 20 },
]
export function SkillingAnalysis({ globalOnly = true }: SkillingAnalysisProps) {
  // For now this component uses mock data so the UI can be reviewed.
  const [speciesFilter, setSpeciesFilter] = useState<string>("Gnoll")
  const [backgroundFilter, setBackgroundFilter] = useState<string>("Fighter")

  const data = MOCK_DATA

  // Group by skill_group for table rows.
  const rowsBySkill = useMemo(() => {
    const map = new Map<string, SkillAverageRow[]>()
    for (const row of data) {
      if (!map.has(row.skill_group)) map.set(row.skill_group, [])
      map.get(row.skill_group)!.push(row)
    }
    return map
  }, [])

  // Find the three highest-average skills at the final checkpoint.
  const topSkillsAtFinal = useMemo(() => {
    const entries: { skill: string; avg: number }[] = []
    for (const [skill, rows] of rowsBySkill.entries()) {
      const cell = rows.find((r) => r.checkpoint_xl === FINAL_CHECKPOINT)
      if (!cell) continue
      entries.push({ skill, avg: cell.avg_level })
    }
    entries.sort((a, b) => b.avg - a.avg)
    return new Set(entries.slice(0, 3).map((e) => e.skill))
  }, [rowsBySkill])

  const desiredOrder = [
    "Fighting",
    "Weapon",
    "Armour",
    "Dodging",
    "Stealth",
    "Shields",
    "Spellcasting",
    "Spell School 1",
    "Spell School 2",
    "Spell School 3",
    "Throwing",
    "Invocations",
    "Evocations",
  ]

  const sortedSkillNames = useMemo(() => {
    const present = Array.from(rowsBySkill.keys())
    return desiredOrder.filter((name) => present.includes(name)).concat(
      present
        .filter((name) => !desiredOrder.includes(name))
        .sort((a, b) => a.localeCompare(b)),
    )
  }, [rowsBySkill])

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="flex flex-col gap-1">
          <span className="font-mono text-xl text-primary">
            Winner Skill Progression
          </span>
          <span className="font-mono text-sm text-muted-foreground">
            Shows average skill values by level for all global winners.
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <span>Species:</span>
            <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
              <SelectTrigger className="h-8 w-40 rounded-none border-2 border-primary/40 bg-background px-2 font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-primary/40">
                {ALL_SPECIES_NAMES.map((sp) => (
                  <SelectItem key={sp} value={sp} className="font-mono text-sm">
                    {sp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <span>Background:</span>
            <Select value={backgroundFilter} onValueChange={setBackgroundFilter}>
              <SelectTrigger className="h-8 w-40 rounded-none border-2 border-primary/40 bg-background px-2 font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2 border-primary/40">
                {ALL_BACKGROUND_NAMES.map((bg) => (
                  <SelectItem key={bg} value={bg} className="font-mono text-sm">
                    {bg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {sortedSkillNames.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-muted-foreground font-mono text-sm">
            No skilling data available yet.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border border-primary/30">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-card border-b border-primary/30 px-2 py-1 text-left font-mono text-sm">
                      Skill
                    </th>
                    {CHECKPOINTS.map((cp) => (
                      <th
                        key={cp}
                        className="border-b border-l border-primary/30 px-2 py-1 text-center font-mono text-sm"
                      >
                        XL {cp}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedSkillNames.map((skill) => {
                    const rows = rowsBySkill.get(skill)!
                    const isTopAtFinal = topSkillsAtFinal.has(skill)
                    return (
                      <tr
                        key={skill}
                        className={cn(
                          "hover:bg-primary/5",
                          isTopAtFinal && "text-primary font-semibold",
                        )}
                      >
                        <td className="sticky left-0 z-10 bg-card border-t border-primary/30 px-2 py-1 font-mono text-sm">
                          {skill === "Weapon"
                            ? "Primary Weapon"
                            : skill === "Spell School 1"
                              ? "Highest Spell School"
                              : skill === "Spell School 2"
                                ? "Second Spell School"
                                : skill === "Spell School 3"
                                  ? "Third Spell School"
                                  : skill}
                        </td>
                        {CHECKPOINTS.map((cp) => {
                          const cell = rows.find((r) => r.checkpoint_xl === cp)
                          if (!cell) {
                            return (
                              <td
                                key={cp}
                                className="border-t border-l border-primary/30 px-2 py-1 text-center font-mono text-sm text-muted-foreground"
                              >
                                —
                              </td>
                            )
                          }
                          return (
                            <td
                              key={cp}
                              className={cn(
                                "border-t border-l border-primary/30 px-2 py-1 text-center font-mono text-sm",
                                cell.skill_group === "Weapon" && "font-semibold text-primary",
                              )}
                              title={`Average level ${cell.avg_level.toFixed(1)} from ${cell.sample_count} games`}
                            >
                              {cell.avg_level.toFixed(1)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              * Primary Weapon is the highest level among: Short Blades, Long Blades, Axes,
              Maces &amp; Flails, Polearms, Staves, Ranged Weapons, and Unarmed Combat.
              Highest/Second/Third Spell School show the average of the highest, second-highest, and
              third-highest trained spell schools by level at each XL checkpoint (only counting games
              with at least that many trained spell schools at that checkpoint).
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

