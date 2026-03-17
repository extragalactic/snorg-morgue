"use client"

import { useEffect, useMemo, useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts"
import { FilterToggleButton } from "@/components/ui/filter-toggle-button"
import { ALL_SPECIES_NAMES, ALL_BACKGROUND_NAMES } from "@/lib/dcss-constants"
import { SPELL_SCHOOLS, WEAPON_SKILLS, RANGED_WEAPON_SKILLS } from "@/lib/dcss-skills"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/contexts/theme-context"

const CHECKPOINTS = [5, 10, 15, 20, 25] as const
const FINAL_CHECKPOINT = 25

type SkillAverageRow = {
  skill_group: string
  checkpoint_xl: number
  avg_level: number
  sample_count: number
  usage_fraction: number
}

interface GodPieTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
}

function GodPieTooltip({ active, payload }: GodPieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const { name, value } = payload[0]

  return (
    <div className="border-2 border-primary bg-card px-3 py-2">
      <p className="font-mono text-xs text-primary">{name}</p>
      <p className="font-mono text-sm text-foreground">Wins: {value}</p>
    </div>
  )
}

interface SkillingAnalysisProps {
  globalOnly?: boolean
}
export function SkillingAnalysis({ globalOnly = true }: SkillingAnalysisProps) {
  const { themeStyle } = useTheme()
  const [speciesFilter, setSpeciesFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "Coglin"
    try {
      const saved = window.localStorage.getItem("snorg_skilling_species")
      return saved && ALL_SPECIES_NAMES.includes(saved) ? saved : "Coglin"
    } catch {
      return "Coglin"
    }
  })
  const [backgroundFilter, setBackgroundFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "Conjurer"
    try {
      const saved = window.localStorage.getItem("snorg_skilling_background")
      return saved && ALL_BACKGROUND_NAMES.includes(saved) ? saved : "Conjurer"
    } catch {
      return "Conjurer"
    }
  })
  const [data, setData] = useState<SkillAverageRow[] | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [godModalOpen, setGodModalOpen] = useState(false)
  const [godError, setGodError] = useState<string | null>(null)
  const [godLoading, setGodLoading] = useState(false)
  const [godUsage, setGodUsage] = useState<Array<{ god: string; count: number }>>([])

  // Persist filters to localStorage whenever they change.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem("snorg_skilling_species", speciesFilter)
      window.localStorage.setItem("snorg_skilling_background", backgroundFilter)
    } catch {
      // Ignore localStorage errors
    }
  }, [speciesFilter, backgroundFilter])

  const openGodModal = async () => {
    setGodModalOpen(true)
    setGodError(null)
    setGodLoading(true)
    try {
      const { data: rows, error: dbError } = await supabase
        .from("parsed_morgues")
        .select("god, id")
        .eq("is_win", true)
        .eq("species", speciesFilter)
        .eq("background", backgroundFilter)

      if (dbError) {
        setGodError(dbError.message)
        setGodUsage([])
        return
      }
      const counts = new Map<string, number>()
      for (const row of rows ?? []) {
        const rawGod = (row as any).god as string | null
        const god = (rawGod ?? "").trim()
        if (!god) continue
        counts.set(god, (counts.get(god) ?? 0) + 1)
      }
      const usage = Array.from(counts.entries())
        .map(([god, count]) => ({ god, count }))
        .sort((a, b) => b.count - a.count)
      setGodUsage(usage)
    } catch (e) {
      setGodError(e instanceof Error ? e.message : String(e))
      setGodUsage([])
    } finally {
      setGodLoading(false)
    }
  }

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
            usage_fraction: Number(row.usage_fraction ?? 0),
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

  const winnerCount = useMemo(() => {
    if (!data || data.length === 0) return 0
    // At XL 25, sample_count is the number of games that had a non-zero value
    // for that skill at that checkpoint. The maximum across all skills at the
    // final checkpoint approximates the total number of winners for this combo.
    const xl25Rows = data.filter((row) => row.checkpoint_xl === FINAL_CHECKPOINT)
    if (xl25Rows.length === 0) return 0
    return xl25Rows.reduce((max, row) => (row.sample_count > max ? row.sample_count : max), 0)
  }, [data])

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
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
              <span>Species:</span>
              <Select value={speciesFilter} onValueChange={setSpeciesFilter}>
                <SelectTrigger className="h-8 w-48 rounded-none border-2 border-primary/40 bg-background px-2 font-mono text-sm">
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
                <SelectTrigger className="h-8 w-54 rounded-none border-2 border-primary/40 bg-background px-2 font-mono text-sm">
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
          <div className="mt-1">
            <FilterToggleButton
              selected={false}
              onClick={openGodModal}
              className="px-5 py-2 text-sm"
            >
              View God Data
            </FilterToggleButton>
          </div>
        </div>

        <div className="mt-2 font-mono text-sm text-muted-foreground">
          {winnerCount > 0 ? (
            <>
              Averaged across{" "}
              <span className="text-primary font-semibold">
                {winnerCount} winner{winnerCount === 1 ? "" : "s"}
              </span>{" "}
              for this combo.
            </>
          ) : (
            "No winners for this species/background yet."
          )}
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
                    <th className="border-b border-l border-primary/30 px-2 py-1 text-center font-mono text-sm">
                      % usage
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
                    const usageFraction = rows[0]?.usage_fraction ?? 0
                    return (
                      <tr
                        key={skill}
                        className={cn(
                          "group hover:bg-primary/5",
                          isTopAtFinal &&
                            (themeStyle === "ascii"
                              ? "text-yellow-300 font-semibold"
                              : "text-primary font-semibold"),
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
                        <td className="border-t border-l border-primary/30 px-2 py-1 text-center font-mono text-sm">
                          {(usageFraction * 100).toFixed(0)}%
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
                * Primary Weapon represents the single highest melee weapon skill at XL 25: either Short Blades, Long Blades, Axes, Maces & Flails, Polearms, Staves or Unarmed Combat. Secondary Weapon represents the second highest melee weapon skill. Usage of specific melee weapon types will vary depending on item RNG, so these rows show patterns of weapon progression across all winners.
              </p>
              <br></br><p>
                * 1st–5th Highest Spell School are ranked by their skill level at XL 25. Usage of specific schools will vary depending on item RNG, so these rows show patterns of magic progression across all winners.
              </p>
              <br></br><p>
                * Games with a zero in a skill are not included in averages. The % Usage column shows what percentage of winners used this skill. 
              </p>              
            </div>
            </>
          )}
        </div>
      </CardContent>

      <Dialog open={godModalOpen} onOpenChange={setGodModalOpen}>
        <DialogContent className="rounded-none border-2 border-primary/30 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-primary text-center leading-tight">
              <div className="text-sm uppercase tracking-wide">God Selection for</div>
              <div className="text-lg mt-1">
                {speciesFilter} {backgroundFilter}
              </div>
              <div className="text-sm uppercase tracking-wide mt-1">Winners</div>
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {godLoading && (
              <div className="h-24 flex items-center justify-center font-mono text-sm text-muted-foreground">
                Loading god data…
              </div>
            )}
            {!godLoading && godError && (
              <div className="h-24 flex items-center justify-center font-mono text-xs text-destructive text-center px-4">
                Failed to load god data: {godError}
              </div>
            )}
            {!godLoading && !godError && godUsage.length === 0 && (
              <div className="h-24 flex items-center justify-center font-mono text-sm text-muted-foreground">
                No winning gods for this combo yet.
              </div>
            )}
            {!godLoading && !godError && godUsage.length > 0 && (
              <div className="space-y-4">
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(220, 160 + godUsage.length * 10)}
                >
                    <PieChart>
                    <Pie
                      data={godUsage.map(({ god, count }) => ({ name: god, value: count }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      paddingAngle={2}
                      label={({ name }) => name}
                      labelLine={false}
                      animationDuration={200}
                    >
                      {godUsage.map((entry, index) => (
                        <Cell
                          key={entry.god}
                          fill={`var(--chart-${(index % 5) + 1})`}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<GodPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

