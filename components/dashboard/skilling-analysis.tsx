"use client"

import { useEffect, useMemo, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ALL_SPECIES_NAMES, ALL_BACKGROUND_NAMES } from "@/lib/dcss-constants"
import { SPELL_SCHOOLS, WEAPON_SKILLS, RANGED_WEAPON_SKILLS } from "@/lib/dcss-skills"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

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
export function SkillingAnalysis({ globalOnly = true }: SkillingAnalysisProps) {
  const [speciesFilter, setSpeciesFilter] = useState<string>("Coglin")
  const [backgroundFilter, setBackgroundFilter] = useState<string>("Conjurer")
  const [data, setData] = useState<SkillAverageRow[] | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_skill_level_averages", {
          p_species: speciesFilter,
          p_background: backgroundFilter,
        })
        if (cancelled) return
        if (rpcError) {
          setError(rpcError.message)
          setData([])
          return
        }
        const rows: SkillAverageRow[] =
          (rpcData ?? []).map((row: any) => ({
            skill_group: String(row.skill_group ?? ""),
            checkpoint_xl: Number(row.checkpoint_xl ?? 0),
            avg_level: Number(row.avg_level ?? 0),
            sample_count: Number(row.sample_count ?? 0),
          })) ?? []
        setData(rows)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setData([])
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [speciesFilter, backgroundFilter])

  const desiredOrder = [
    "Fighting",
    "Weapon",
    "Secondary Weapon",
    "Ranged Weapons",
    "Throwing",
    "Armour",
    "Dodging",
    "Stealth",
    "Shields",
    "Spellcasting",
    "Spell School 1",
    "Spell School 2",
    "Spell School 3",
    "Spell School 4",
    "Spell School 5",
    "Shapeshifting",
    "Invocations",
    "Evocations",
  ]

  const weaponSkillNames = useMemo(
    () => new Set<string>([...WEAPON_SKILLS, ...RANGED_WEAPON_SKILLS]),
    [],
  )

  // Group by skill_group for table rows.
  const rowsBySkill = useMemo(() => {
    const map = new Map<string, SkillAverageRow[]>()
    for (const row of data ?? []) {
      if (SPELL_SCHOOLS.includes(row.skill_group as (typeof SPELL_SCHOOLS)[number])) continue
      if (weaponSkillNames.has(row.skill_group)) continue
      if (!map.has(row.skill_group)) map.set(row.skill_group, [])
      map.get(row.skill_group)!.push(row)
    }
    // Ensure all desired skills have at least an empty row array so they render even with no data.
    for (const name of desiredOrder) {
      if (!map.has(name)) {
        map.set(name, [])
      }
    }
    return map
  }, [data, weaponSkillNames, desiredOrder])

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
        <CardTitle>WINNER AVERAGE SKILL PROGRESSION</CardTitle>
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

        <div className="min-h-[260px] flex flex-col">
          {error && (
            <div className="h-24 flex items-center justify-center text-destructive font-mono text-xs text-center px-4">
              Failed to load skilling data: {error}
            </div>
          )}
          {!error && sortedSkillNames.length === 0 && !isLoading && (
            <div className="h-24 flex items-center justify-center text-muted-foreground font-mono text-sm">
              No skilling data available yet.
            </div>
          )}
          {!error && sortedSkillNames.length > 0 && (
            <>
            <div className="overflow-x-auto border border-primary/30 relative">
              {isLoading && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center text-muted-foreground font-mono text-sm z-10">
                  Loading skilling data…
                </div>
              )}
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="hover:bg-primary/5">
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
                          "group hover:bg-primary/5",
                          isTopAtFinal && "text-primary font-semibold",
                        )}
                      >
                        <td className="sticky left-0 z-10 bg-card border-t border-primary/30 px-2 py-1 font-mono text-sm group-hover:bg-primary/10">
                          {skill === "Weapon"
                            ? "Primary Melee Weapon"
                            : skill === "Secondary Weapon"
                              ? "Secondary Melee Weapon"
                              : skill === "Ranged Weapons"
                                ? "Ranged Weapons"
                            : skill === "Spell School 1"
                              ? "1st Highest Spell School"
                              : skill === "Spell School 2"
                                ? "2nd Highest Spell School"
                                : skill === "Spell School 3"
                                  ? "3rd Highest Spell School"
                                  : skill === "Spell School 4"
                                    ? "4th Highest Spell School"
                                    : skill === "Spell School 5"
                                      ? "5th Highest Spell School"
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
                                cell.skill_group === "Weapon" && "font-semibold",
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
            <div className="mt-5 space-y-1 font-mono text-sm text-muted-foreground">
              <p>
                * Primary Weapon represents the single highest melee weapon skill at XL 25: either Short Blades, Long Blades, Axes, Maces & Flails, Polearms, Staves or Unarmed Combat. Secondary Weapon represents the second highest melee weapon skill. Usage of specific melee weapons will vary depending on item RNG, so these rows show average weapon progression across all winners.
              </p>
              <br></br><p>
                * 1st–5th Highest Spell School are ranked by their skill level at XL 25. Usage of specific schools will vary depending on item RNG, so these rows show average magic progression across all winners.
              </p>
              <br></br><p>
                * Games with a zero in a skill are not included in averages. 
              </p>              
            </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

