"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme } from "@/contexts/theme-context"
import type { StatEntry } from "@/lib/morgue-db"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

type SortMethod = "default" | "wins" | "attempts"
type ShowMode = "both" | "wins" | "attempts"
type ChartType = "species" | "background" | "gods"

// ASCII mode green shades - 8 different shades cycling through
const asciiGreenShades = [
  "#22c55e", // green-500
  "#4ade80", // green-400
  "#16a34a", // green-600
  "#86efac", // green-300
  "#15803d", // green-700
  "#bbf7d0", // green-200
  "#166534", // green-800
  "#dcfce7", // green-100
]

// Species colors
const tierColors = [
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f", "#c9c98f", "#8f9fc9", "#c98fa0", "#c9b88f",
]

// Background colors
const bgColors = [
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f", "#c9c98f", "#8f9fc9", "#c98fa0", "#c9b88f",
]

// God colors
const godColors = [
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f", "#c9c98f", "#8f9fc9", "#c98fa0", "#c9b88f",
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f", "#c9c98f", "#8f9fc9", "#c98fa0", "#c9b88f",
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f",
]

// Full canonical lists so we can show zero-data entries (DCSS playable species, backgrounds, gods)
const ALL_SPECIES_NAMES = [
  "Gnoll", "Minotaur", "Merfolk", "Gargoyle", "Mountain Dwarf", "Draconian", "Troll", "Deep Elf", "Armataur",
  "Human", "Kobold", "Revenant", "Demonspawn", "Djinni", "Spriggan", "Tengu", "Oni", "Barachi",
  "Coglin", "Vine Stalker", "Poltergeist", "Demigod", "Formicid", "Naga", "Octopode", "Felid", "Mummy",
]
// Draconian colour variants (sub-rows under "Draconian" summary); bar and label use grey
const DRACONIAN_COLOUR_NAMES = [
  "Red Draconian", "Green Draconian", "White Draconian", "Black Draconian", "Yellow Draconian",
  "Purple Draconian", "Grey Draconian", "Mottled Draconian", "Pale Draconian",
]
const DRACONIAN_BAR_GREY = "#9ca3af"
const DRACONIAN_LABEL_GREY = "#6b7280"

/** Display label for species: draconian colours show just the colour (e.g. "Red"), not "Red Draconian". */
function speciesDisplayLabel(name: string): string {
  if (DRACONIAN_COLOUR_NAMES.includes(name)) return name.replace(/\s+Draconian$/, "")
  return name
}
const ALL_BACKGROUND_NAMES = [
  "Fighter", "Gladiator", "Monk", "Hunter", "Brigand",
  "Berserker", "Cinder Acolyte", "Chaos Knight",
  "Artificer", "Shapeshifter", "Wanderer", "Delver",
  "Warper", "Hexslinger", "Enchanter", "Reaver",
  "Hedge Wizard", "Conjurer", "Summoner", "Necromancer", "Forgewright",
  "Fire Elementalist", "Ice Elementalist", "Air Elementalist", "Earth Elementalist", "Alchemist",
]
const ALL_GOD_NAMES = [
  "Ashenzari", "Beogh", "Cheibriados", "Dithmenos", "Elyvilon", "Fedhas Madash", "Gozag", "Hepliaklqana",
  "Ignis", "Jiyva", "Kikubaaqudgha", "Lugonu", "Makhleb", "Nemelex Xobeh", "Okawaru", "Qazlal", "Ru",
  "Sif Muna", "Trog", "Uskayaw", "Vehumet", "Wu Jian", "Xom", "Yredelemnul", "Zin", "The Shining One",
  "(no god)",
]

function mergeWithFullList(fullNames: string[], stats: StatEntry[]): StatEntry[] {
  const byName = new Map(stats.map((s) => [s.name, s]))
  return fullNames.map((name) => byName.get(name) ?? { name, wins: 0, attempts: 0 })
}

/** Species list with Draconian as summary row + one row per colour (grey styling for colours). */
function buildSpeciesListWithDraconian(stats: StatEntry[]): StatEntry[] {
  const byName = new Map(stats.map((s) => [s.name, s]))
  const draconianNames = ["Draconian", ...DRACONIAN_COLOUR_NAMES]
  let draconianWins = 0
  let draconianAttempts = 0
  for (const name of draconianNames) {
    const e = byName.get(name)
    if (e) {
      draconianWins += e.wins
      draconianAttempts += e.attempts
    }
  }
  const before = ALL_SPECIES_NAMES.slice(0, 5) // Gnoll .. Mountain Dwarf
  const after = ALL_SPECIES_NAMES.slice(6)     // Troll ..
  const fullNames = [...before, "Draconian", ...DRACONIAN_COLOUR_NAMES, ...after]
  const result: StatEntry[] = []
  for (const name of fullNames) {
    if (name === "Draconian") {
      result.push({ name: "Draconian", wins: draconianWins, attempts: draconianAttempts })
    } else if (DRACONIAN_COLOUR_NAMES.includes(name)) {
      result.push(byName.get(name) ?? { name, wins: 0, attempts: 0 })
    } else {
      result.push(byName.get(name) ?? { name, wins: 0, attempts: 0 })
    }
  }
  return result
}

function withColors<T extends Record<string, unknown>>(
  entries: StatEntry[],
  colorArray: string[],
  extra: (e: StatEntry, i: number) => T
): (StatEntry & T & { color: string })[] {
  return entries.map((e, i) => ({ ...e, color: colorArray[i % colorArray.length], ...extra(e, i) }))
}

interface SpeciesTooltipProps {
  active?: boolean
  payload?: Array<{ 
    value: number
    dataKey: string
    payload: { name: string; wins: number; attempts: number; tier: string } 
  }>
}

function SpeciesTooltip({ active, payload }: SpeciesTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const winRate = data.attempts > 0 ? ((data.wins / data.attempts) * 100).toFixed(1) : "0"
    return (
      <div className="border-2 border-primary bg-card p-2">
        <p className="font-mono text-xs text-primary">{speciesDisplayLabel(data.name)}</p>
        <p className="text-xs text-muted-foreground mb-1">{data.tier}</p>
        <p className="text-sm">Wins: {data.wins}</p>
        <p className="text-sm">Attempts: {data.attempts}</p>
        <p className="text-sm text-primary">Win Rate: {winRate}%</p>
      </div>
    )
  }
  return null
}

interface BackgroundTooltipProps {
  active?: boolean
  payload?: Array<{ 
    value: number
    dataKey: string
    payload: { name: string; wins: number; attempts: number; category: string } 
  }>
}

function BackgroundTooltip({ active, payload }: BackgroundTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const winRate = data.attempts > 0 ? ((data.wins / data.attempts) * 100).toFixed(1) : "0"
    return (
      <div className="border-2 border-primary bg-card p-2">
        <p className="font-mono text-xs text-primary">{data.name}</p>
        <p className="text-xs text-muted-foreground mb-1">{data.category}</p>
        <p className="text-sm">Wins: {data.wins}</p>
        <p className="text-sm">Attempts: {data.attempts}</p>
        <p className="text-sm text-primary">Win Rate: {winRate}%</p>
      </div>
    )
  }
  return null
}

interface GodsTooltipProps {
  active?: boolean
  payload?: Array<{ 
    value: number
    dataKey: string
    payload: { name: string; wins: number; attempts: number; description: string } 
  }>
}

function GodsTooltip({ active, payload }: GodsTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const winRate = data.attempts > 0 ? ((data.wins / data.attempts) * 100).toFixed(1) : "0"
    return (
      <div className="border-2 border-primary bg-card p-2 max-w-xs">
        <p className="font-mono text-xs text-primary">{data.name}</p>
        {data.description && <p className="text-xs text-muted-foreground mb-1 italic">{data.description}</p>}
        <p className="text-sm">Wins: {data.wins}</p>
        <p className="text-sm">Attempts: {data.attempts}</p>
        <p className="text-sm text-primary">Win Rate: {winRate}%</p>
      </div>
    )
  }
  return null
}

// Custom pattern for wins (striped)
function StripedPattern({ id, color }: { id: string; color: string }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
      <rect width="2" height="4" fill={color} />
      <rect x="2" width="2" height="4" fill={color} fillOpacity="0.4" />
    </pattern>
  )
}

export interface PlayerStatsChartProps {
  children?: React.ReactNode
  speciesStats?: StatEntry[]
  backgroundStats?: StatEntry[]
  godStats?: StatEntry[]
}

export function PlayerStatsChart({ children, speciesStats = [], backgroundStats = [], godStats = [] }: PlayerStatsChartProps) {
  const [sortMethod, setSortMethod] = useState<SortMethod>("default")
  const [showMode, setShowMode] = useState<ShowMode>("wins")
  const [chartType, setChartType] = useState<ChartType>("species")
  const { themeStyle } = useTheme()

  // Build chart data: merge full canonical lists with user stats so zero-data entries show
  const allSpeciesData = useMemo(() => {
    const entries = buildSpeciesListWithDraconian(speciesStats)
    return entries.map((e, i) => {
      const isDraconianColour = DRACONIAN_COLOUR_NAMES.includes(e.name)
      return {
        ...e,
        tier: "—",
        color: isDraconianColour ? DRACONIAN_BAR_GREY : tierColors[i % tierColors.length],
        isDraconianColour,
      }
    })
  }, [speciesStats])
  const allBackgroundData = useMemo(
    () => withColors(mergeWithFullList(ALL_BACKGROUND_NAMES, backgroundStats), bgColors, () => ({ category: "—" })),
    [backgroundStats]
  )
  const allGodsData = useMemo(
    () => withColors(mergeWithFullList(ALL_GOD_NAMES, godStats), godColors, () => ({ description: "" })),
    [godStats]
  )

  // Memoize colors based on theme to force re-render when theme changes
  const speciesColors = useMemo(() => 
    allSpeciesData.map((entry, index) => {
      const e = entry as { color: string; isDraconianColour?: boolean }
      if (e.isDraconianColour) return DRACONIAN_BAR_GREY
      return themeStyle === "ascii" ? asciiGreenShades[index % asciiGreenShades.length] : e.color
    }),
    [themeStyle, allSpeciesData]
  )

  const backgroundColors = useMemo(() => 
    allBackgroundData.map((entry, index) => 
      themeStyle === "ascii" ? asciiGreenShades[index % asciiGreenShades.length] : entry.color
    ),
    [themeStyle]
  )

  const godsColors = useMemo(() => 
    allGodsData.map((entry, index) => 
      themeStyle === "ascii" ? asciiGreenShades[index % asciiGreenShades.length] : entry.color
    ),
    [themeStyle]
  )

  const sortedSpeciesData = useMemo(() => {
    if (sortMethod === "default") return allSpeciesData
    return [...allSpeciesData].sort((a, b) => 
      sortMethod === "wins" ? b.wins - a.wins : b.attempts - a.attempts
    )
  }, [sortMethod])

  const sortedBackgroundData = useMemo(() => {
    if (sortMethod === "default") return allBackgroundData
    return [...allBackgroundData].sort((a, b) => 
      sortMethod === "wins" ? b.wins - a.wins : b.attempts - a.attempts
    )
  }, [sortMethod])

  const sortedGodsData = useMemo(() => {
    if (sortMethod === "default") return allGodsData
    return [...allGodsData].sort((a, b) => 
      sortMethod === "wins" ? b.wins - a.wins : b.attempts - a.attempts
    )
  }, [sortMethod])

  // Get current chart data, colors, and tooltip based on selected type
  const currentChartData = chartType === "species" ? sortedSpeciesData 
    : chartType === "background" ? sortedBackgroundData 
    : sortedGodsData

  const currentColors = chartType === "species" ? speciesColors 
    : chartType === "background" ? backgroundColors 
    : godsColors

  const currentAllData = chartType === "species" ? allSpeciesData 
    : chartType === "background" ? allBackgroundData 
    : allGodsData

  const CurrentTooltip = chartType === "species" ? SpeciesTooltip 
    : chartType === "background" ? BackgroundTooltip 
    : GodsTooltip

  const chartHeight = currentChartData.length > 0
    ? Math.min(chartType === "gods" ? 850 : 900, Math.max(200, currentChartData.length * 36))
    : 400
  const xDomainMax = currentChartData.length
    ? Math.max(7, ...currentChartData.map((d) => d.attempts))
    : 7
  const hasData = currentChartData.length > 0

  return (
    <div className="space-y-4">
      {/* Chart and Performance Graph side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-2 border-primary/30 rounded-none">
          <CardHeader className="border-b-2 border-primary/20 pb-3">
            <CardTitle className="font-mono text-sm text-primary flex items-center gap-2">
              <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
                <SelectTrigger className="w-[140px] rounded-none border-2 border-primary/50 font-mono text-sm h-8 hover:text-yellow-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-2 border-primary/50">
                  <SelectItem value="species" className="font-mono text-sm cursor-pointer hover:text-yellow-400">Species</SelectItem>
                  <SelectItem value="background" className="font-mono text-sm cursor-pointer hover:text-yellow-400">Background</SelectItem>
                  <SelectItem value="gods" className="font-mono text-sm cursor-pointer hover:text-yellow-400">Gods</SelectItem>
                </SelectContent>
              </Select>
              <span>PERFORMANCE</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-6 pt-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-primary">SORT BY:</span>
                <div className="flex gap-2">
                  <Button
                    variant={sortMethod === "wins" ? "default" : "outline"}
                    size="sm"
                    className="rounded-none border-2 font-mono text-xs hover:text-yellow-400"
                    onClick={() => setSortMethod("wins")}
                  >
                    Wins
                  </Button>
                  <Button
                    variant={sortMethod === "attempts" ? "default" : "outline"}
                    size="sm"
                    className="rounded-none border-2 font-mono text-xs hover:text-yellow-400"
                    onClick={() => setSortMethod("attempts")}
                  >
                    Attempts
                  </Button>
                  <Button
                    variant={sortMethod === "default" ? "default" : "outline"}
                    size="sm"
                    className="rounded-none border-2 font-mono text-xs hover:text-yellow-400"
                    onClick={() => setSortMethod("default")}
                  >
                    Default
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-primary">SHOW:</span>
                <div className="flex gap-2">
                  <Button
                    variant={showMode === "wins" ? "default" : "outline"}
                    size="sm"
                    className="rounded-none border-2 font-mono text-xs hover:text-yellow-400"
                    onClick={() => setShowMode("wins")}
                  >
                    Wins
                  </Button>
                  <Button
                    variant={showMode === "attempts" ? "default" : "outline"}
                    size="sm"
                    className="rounded-none border-2 font-mono text-xs hover:text-yellow-400"
                    onClick={() => setShowMode("attempts")}
                  >
                    Attempts
                  </Button>
                  <Button
                    variant={showMode === "both" ? "default" : "outline"}
                    size="sm"
                    className="rounded-none border-2 font-mono text-xs hover:text-yellow-400"
                    onClick={() => setShowMode("both")}
                  >
                    Both
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {hasData ? (
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={currentChartData} layout="vertical" barGap={0} barCategoryGap="20%">
                <defs>
                  {currentChartData.map((entry, index) => {
                    const origIndex = currentAllData.findIndex((d: { name: string }) => d.name === entry.name)
                    return (
                      <StripedPattern key={`pattern-${index}`} id={`stripe-${index}`} color={currentColors[origIndex]} />
                    )
                  })}
                </defs>
                <XAxis 
                  type="number" 
                  stroke="var(--muted-foreground)" 
                  fontSize={14}
                  domain={[0, xDomainMax]}
                  label={{ 
                    value: "Wins / Attempts", 
                    position: "bottom", 
                    offset: -5,
                    style: { fill: 'var(--muted-foreground)', fontSize: 13 }
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--muted-foreground)"
                  fontSize={14}
                  width={160}
                  tickLine={false}
                  interval={0}
                  tick={chartType === "species" ? (props: { x: number; y: number; payload?: { value?: string } }) => {
                    const value = props.payload?.value ?? ""
                    const isGrey = DRACONIAN_COLOUR_NAMES.includes(value)
                    return (
                      <text
                        x={props.x}
                        y={props.y}
                        dy={4}
                        textAnchor="end"
                        fill={isGrey ? DRACONIAN_LABEL_GREY : "var(--muted-foreground)"}
                        fontSize={14}
                        className="font-mono"
                      >
                        {speciesDisplayLabel(value)}
                      </text>
                    )
                  } : undefined}
                />
                <Tooltip content={<CurrentTooltip />} />
                {(showMode === "both" || showMode === "attempts") && (
                  <Bar dataKey="attempts" stackId="a" radius={0}>
                    {currentChartData.map((entry, index) => {
                      const origIndex = currentAllData.findIndex((d: { name: string }) => d.name === entry.name)
                      return (
                        <Cell key={`attempts-${index}`} fill={currentColors[origIndex]} fillOpacity={0.5} />
                      )
                    })}
                  </Bar>
                )}
                {(showMode === "both" || showMode === "wins") && (
                  <Bar dataKey="wins" radius={0}>
                    {currentChartData.map((_, index) => (
                      <Cell key={`wins-${index}`} fill={`url(#stripe-${index})`} />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center font-mono text-sm text-muted-foreground" style={{ height: chartHeight }}>
                {chartType === "species" && "No species data yet"}
                {chartType === "background" && "No background data yet"}
                {chartType === "gods" && "No god data yet"}
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <div 
                  className="h-3 w-6" 
                  style={{ 
                    backgroundSize: '4px 100%', 
                    backgroundImage: themeStyle === "ascii" 
                      ? 'repeating-linear-gradient(90deg, #22c55e, #22c55e 2px, rgba(34,197,94,0.4) 2px, rgba(34,197,94,0.4) 4px)'
                      : 'repeating-linear-gradient(90deg, #d4a574, #d4a574 2px, rgba(212,165,116,0.4) 2px, rgba(212,165,116,0.4) 4px)' 
                  }} 
                />
                <span className="text-sm text-muted-foreground">Wins</span>
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="h-3 w-6" 
                  style={{ backgroundColor: themeStyle === "ascii" ? "rgba(34,197,94,0.5)" : "rgba(212,165,116,0.5)" }} 
                />
                <span className="text-sm text-muted-foreground">Attempts</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right side - Performance Graph */}
        <div className="flex flex-col">
          {children}
        </div>
      </div>
    </div>
  )
}
