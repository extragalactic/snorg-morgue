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

// All 27 species organized by difficulty tier
// Colors repeat for each tier
const tierColors = [
  "#d4a574", // tan/gold
  "#7eb8a2", // teal
  "#b8a07e", // khaki
  "#8fb8c9", // sky blue
  "#c9a08f", // dusty rose
  "#a0c98f", // sage green
  "#c9c98f", // pale yellow
  "#8f9fc9", // periwinkle
  "#c98fa0", // mauve
]

// Simple species (9) - max attempts capped at 7
const simpleSpecies = [
  { name: "Gnoll", wins: 3, attempts: 5 },
  { name: "Minotaur", wins: 4, attempts: 7 },
  { name: "Merfolk", wins: 2, attempts: 6 },
  { name: "Gargoyle", wins: 3, attempts: 7 },
  { name: "Mountain Dwarf", wins: 2, attempts: 4 },
  { name: "Draconian", wins: 1, attempts: 6 },
  { name: "Troll", wins: 3, attempts: 5 },
  { name: "Deep Elf", wins: 1, attempts: 4 },
  { name: "Armataur", wins: 1, attempts: 3 },
]

// Intermediate species (9)
const intermediateSpecies = [
  { name: "Human", wins: 2, attempts: 6 },
  { name: "Kobold", wins: 1, attempts: 4 },
  { name: "Revenant", wins: 1, attempts: 3 },
  { name: "Demonspawn", wins: 2, attempts: 5 },
  { name: "Djinni", wins: 1, attempts: 4 },
  { name: "Spriggan", wins: 2, attempts: 7 },
  { name: "Tengu", wins: 1, attempts: 5 },
  { name: "Oni", wins: 2, attempts: 4 },
  { name: "Barachi", wins: 1, attempts: 3 },
]

// Advanced species (9)
const advancedSpecies = [
  { name: "Coglin", wins: 0, attempts: 2 },
  { name: "Vine Stalker", wins: 1, attempts: 4 },
  { name: "Poltergeist", wins: 0, attempts: 1 },
  { name: "Demigod", wins: 0, attempts: 3 },
  { name: "Formicid", wins: 1, attempts: 5 },
  { name: "Naga", wins: 1, attempts: 4 },
  { name: "Octopode", wins: 0, attempts: 6 },
  { name: "Felid", wins: 0, attempts: 2 },
  { name: "Mummy", wins: 0, attempts: 5 },
]

// Combine all species with their tier and color
const allSpeciesData = [
  ...simpleSpecies.map((s, i) => ({ ...s, tier: "Simple", color: tierColors[i] })),
  ...intermediateSpecies.map((s, i) => ({ ...s, tier: "Intermediate", color: tierColors[i] })),
  ...advancedSpecies.map((s, i) => ({ ...s, tier: "Advanced", color: tierColors[i] })),
]

// Background colors - repeat for each category
const bgColors = [
  "#d4a574", "#7eb8a2", "#b8a07e", "#8fb8c9", "#c9a08f",
  "#a0c98f", "#c9c98f", "#8f9fc9", "#c98fa0", "#c9b88f",
]

// Warrior backgrounds (5)
const warriorBackgrounds = [
  { name: "Fighter", wins: 3, attempts: 6 },
  { name: "Gladiator", wins: 2, attempts: 5 },
  { name: "Monk", wins: 2, attempts: 7 },
  { name: "Hunter", wins: 1, attempts: 4 },
  { name: "Brigand", wins: 1, attempts: 3 },
]

// Zealot backgrounds (3)
const zealotBackgrounds = [
  { name: "Berserker", wins: 4, attempts: 7 },
  { name: "Cinder Acolyte", wins: 1, attempts: 3 },
  { name: "Chaos Knight", wins: 2, attempts: 5 },
]

// Adventurer backgrounds (4)
const adventurerBackgrounds = [
  { name: "Artificer", wins: 1, attempts: 4 },
  { name: "Shapeshifter", wins: 2, attempts: 5 },
  { name: "Wanderer", wins: 0, attempts: 3 },
  { name: "Delver", wins: 1, attempts: 2 },
]

// Warrior-mage backgrounds (4)
const warriorMageBackgrounds = [
  { name: "Warper", wins: 1, attempts: 4 },
  { name: "Hexslinger", wins: 2, attempts: 5 },
  { name: "Enchanter", wins: 1, attempts: 3 },
  { name: "Reaver", wins: 2, attempts: 6 },
]

// Mage backgrounds (10)
const mageBackgrounds = [
  { name: "Hedge Wizard", wins: 1, attempts: 5 },
  { name: "Conjurer", wins: 3, attempts: 7 },
  { name: "Summoner", wins: 2, attempts: 6 },
  { name: "Necromancer", wins: 2, attempts: 5 },
  { name: "Forgewright", wins: 1, attempts: 3 },
  { name: "Fire Elementalist", wins: 2, attempts: 6 },
  { name: "Ice Elementalist", wins: 1, attempts: 4 },
  { name: "Air Elementalist", wins: 1, attempts: 5 },
  { name: "Earth Elementalist", wins: 2, attempts: 4 },
  { name: "Alchemist", wins: 0, attempts: 2 },
]

// Combine all backgrounds with their category and color
const allBackgroundData = [
  ...warriorBackgrounds.map((b, i) => ({ ...b, category: "Warrior", color: bgColors[i % bgColors.length] })),
  ...zealotBackgrounds.map((b, i) => ({ ...b, category: "Zealot", color: bgColors[i % bgColors.length] })),
  ...adventurerBackgrounds.map((b, i) => ({ ...b, category: "Adventurer", color: bgColors[i % bgColors.length] })),
  ...warriorMageBackgrounds.map((b, i) => ({ ...b, category: "Warrior-mage", color: bgColors[i % bgColors.length] })),
  ...mageBackgrounds.map((b, i) => ({ ...b, category: "Mage", color: bgColors[i % bgColors.length] })),
]

// Gods data with descriptions from the DCSS pantheon
const godsData = [
  { name: "Ashenzari", wins: 2, attempts: 5, description: "The Shackled, god of divinations and curses" },
  { name: "Beogh", wins: 1, attempts: 4, description: "The Shepherd, evil god of the orcs" },
  { name: "Cheibriados", wins: 1, attempts: 3, description: "The Contemplative, the slow god" },
  { name: "Dithmenos", wins: 0, attempts: 2, description: "The Shadowed, god of darkness" },
  { name: "Elyvilon", wins: 2, attempts: 6, description: "The Healer, good god of healing" },
  { name: "Fedhas Madash", wins: 1, attempts: 4, description: "God of plants" },
  { name: "Gozag", wins: 3, attempts: 7, description: "Ym Sagoz the Greedy, god of gold and mercantilism" },
  { name: "Hepliaklqana", wins: 1, attempts: 3, description: "The Forgotten, god of ancestry and memory" },
  { name: "Ignis", wins: 0, attempts: 2, description: "The Dying Flame, fading god of guttering flames" },
  { name: "Jiyva", wins: 1, attempts: 5, description: "The Shapeless, chaotic god of slimes" },
  { name: "Kikubaaqudgha", wins: 2, attempts: 6, description: "Evil demon-god of necromancy" },
  { name: "Lugonu", wins: 1, attempts: 4, description: "The Unformed, chaotic evil god of the Abyss" },
  { name: "Makhleb", wins: 3, attempts: 7, description: "The Destroyer, chaotic evil god of slaughter and bloodshed" },
  { name: "Nemelex Xobeh", wins: 1, attempts: 5, description: "God of cards" },
  { name: "Okawaru", wins: 4, attempts: 7, description: "The Warmaster, god of battle and single combat" },
  { name: "Qazlal", wins: 2, attempts: 5, description: "Stormbringer, god of storms" },
  { name: "Ru", wins: 1, attempts: 4, description: "The Awakened, god of sacrifice and inner power" },
  { name: "Sif Muna", wins: 2, attempts: 6, description: "The Loreminder, god of magic and mystical secrets" },
  { name: "Trog", wins: 5, attempts: 7, description: "The Wrathful, god of violent rage" },
  { name: "Uskayaw", wins: 1, attempts: 3, description: "The Reveler, god of dancing and revelry" },
  { name: "Vehumet", wins: 2, attempts: 5, description: "God of destructive magic" },
  { name: "Wu Jian Council", wins: 2, attempts: 6, description: "A council of formerly mortal martial artists" },
  { name: "Xom", wins: 0, attempts: 4, description: "The Unpredictable, chaotic god of chaos" },
  { name: "Yredelemnul", wins: 1, attempts: 5, description: "The Dark, evil god of death and undeath" },
  { name: "Zin", wins: 2, attempts: 6, description: "The Law-Giver, good god of law and purity" },
  { name: "The Shining One", wins: 3, attempts: 7, description: "Good god of honourable crusades against evil" },
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

const allGodsData = godsData.map((g, i) => ({ ...g, color: godColors[i] }))

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
        <p className="font-mono text-xs text-primary">{data.name}</p>
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
        <p className="text-xs text-muted-foreground mb-1 italic">{data.description}</p>
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

interface PlayerStatsChartProps {
  children?: React.ReactNode
}

export function PlayerStatsChart({ children }: PlayerStatsChartProps) {
  const [sortMethod, setSortMethod] = useState<SortMethod>("default")
  const [showMode, setShowMode] = useState<ShowMode>("both")
  const [chartType, setChartType] = useState<ChartType>("species")
  const { themeStyle } = useTheme()

  // Memoize colors based on theme to force re-render when theme changes
  const speciesColors = useMemo(() => 
    allSpeciesData.map((entry, index) => 
      themeStyle === "ascii" ? asciiGreenShades[index % asciiGreenShades.length] : entry.color
    ),
    [themeStyle]
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

  const chartHeight = chartType === "gods" ? 850 : 900

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="border-2 border-primary/30 rounded-none">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-primary">SORT BY:</span>
              <div className="flex gap-2">
                <Button
                  variant={sortMethod === "default" ? "default" : "outline"}
                  size="sm"
                  className="rounded-none border-2 font-mono text-xs hover:text-yellow-400"
                  onClick={() => setSortMethod("default")}
                >
                  Default
                </Button>
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
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-primary">SHOW:</span>
              <div className="flex gap-2">
                <Button
                  variant={showMode === "both" ? "default" : "outline"}
                  size="sm"
                  className="rounded-none border-2 font-mono text-xs hover:text-yellow-400"
                  onClick={() => setShowMode("both")}
                >
                  Both
                </Button>
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
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
          </CardHeader>
          <CardContent className="pt-4">
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
                  domain={[0, 7]}
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
                  width={130}
                  tickLine={false}
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
