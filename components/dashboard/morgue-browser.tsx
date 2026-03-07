"use client"

import { useRef, useCallback } from "react"
import { ArrowLeft, Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface GameRecord {
  id: string
  character: string
  species: string
  background: string
  xl: number
  place: string
  turns: number
  duration: string
  date: string
  result: "win" | "death"
  runes: number
  killer?: string
}

interface MorgueBrowserProps {
  game: GameRecord
  onBack: () => void
}

// Line type definitions for syntax highlighting
type LineType = 
  | "header"
  | "section"
  | "subsection"
  | "stat"
  | "skill"
  | "spell"
  | "item"
  | "note"
  | "death"
  | "victory"
  | "rune"
  | "mutation"
  | "god"
  | "normal"

interface MorgueLine {
  text: string
  type: LineType
}

// Style mapping for different line types - only titles get highlighting
const lineStyles: Record<LineType, { bg: string; text: string; border?: string }> = {
  header: { bg: "bg-green-500/20", text: "text-green-400", border: "border-l-4 border-green-500" },
  section: { bg: "bg-primary/20", text: "text-primary", border: "border-l-4 border-primary" },
  subsection: { bg: "bg-primary/10", text: "text-primary/90", border: "border-l-2 border-primary/50" },
  stat: { bg: "", text: "text-foreground/80" },
  skill: { bg: "", text: "text-foreground/80" },
  spell: { bg: "", text: "text-foreground/80" },
  item: { bg: "", text: "text-foreground/80" },
  note: { bg: "", text: "text-foreground/80" },
  death: { bg: "bg-red-500/20", text: "text-red-400", border: "border-l-4 border-red-500" },
  victory: { bg: "bg-green-500/30", text: "text-green-300", border: "border-l-4 border-green-400" },
  rune: { bg: "", text: "text-foreground/80" },
  mutation: { bg: "", text: "text-foreground/80" },
  god: { bg: "", text: "text-foreground/80" },
  normal: { bg: "", text: "text-foreground/80" },
}

// Generate mock morgue content based on game record
function generateMorgueContent(game: GameRecord): MorgueLine[] {
  const lines: MorgueLine[] = [
    { text: " Dungeon Crawl Stone Soup version 0.31.0", type: "header" },
    { text: "", type: "normal" },
    { text: `${game.character} the ${getTitle(game.xl)} (${game.species} ${game.background})`, type: "header" },
    { text: "", type: "normal" },
    { text: game.result === "win" 
      ? `Escaped with the Orb of Zot on ${game.date}!` 
      : `Slain by ${game.killer || "unknown"} on ${game.date}`, 
      type: game.result === "win" ? "victory" : "death" 
    },
    { text: "", type: "normal" },
    { text: "============================================================", type: "section" },
    { text: " GAME SUMMARY", type: "section" },
    { text: "============================================================", type: "section" },
    { text: "", type: "normal" },
    { text: `   Game lasted ${game.duration} (${game.turns.toLocaleString()} turns)`, type: "stat" },
    { text: `   Reached experience level ${game.xl}`, type: "stat" },
    { text: `   Final location: ${game.place}`, type: "stat" },
    { text: `   Runes collected: ${game.runes}/15`, type: "rune" },
    { text: "", type: "normal" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: " Character Stats", type: "subsection" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: "", type: "normal" },
    { text: `   Health: ${game.xl * 8 + 20}/${game.xl * 8 + 20}    Magic: ${game.xl * 3 + 5}/${game.xl * 3 + 5}`, type: "stat" },
    { text: `   AC: ${Math.floor(game.xl * 1.5)}    EV: ${Math.floor(game.xl * 0.8) + 5}    SH: ${Math.floor(game.xl * 0.5)}`, type: "stat" },
    { text: "", type: "normal" },
    { text: `   Str: ${12 + Math.floor(game.xl / 3)}    Int: ${10 + Math.floor(game.xl / 4)}    Dex: ${11 + Math.floor(game.xl / 4)}`, type: "stat" },
    { text: "", type: "normal" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: " Religion", type: "subsection" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: "", type: "normal" },
    { text: `   Worshipping ${getRandomGod()}`, type: "god" },
    { text: `   Piety: ****** (maximal)`, type: "god" },
    { text: "", type: "normal" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: " Skills", type: "subsection" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: "", type: "normal" },
    { text: `   + Level ${Math.min(27, game.xl + 5)} Fighting`, type: "skill" },
    { text: `   + Level ${Math.min(27, game.xl + 3)} ${getMainSkill(game.background)}`, type: "skill" },
    { text: `   + Level ${Math.min(27, game.xl)} Armour`, type: "skill" },
    { text: `   + Level ${Math.min(27, game.xl - 2)} Dodging`, type: "skill" },
    { text: `   + Level ${Math.min(27, game.xl - 3)} Stealth`, type: "skill" },
    { text: "", type: "normal" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: " Spells Known", type: "subsection" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: "", type: "normal" },
    ...getSpells(game.background).map(spell => ({ text: `   ${spell}`, type: "spell" as LineType })),
    { text: "", type: "normal" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: " Mutations", type: "subsection" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: "", type: "normal" },
    ...getMutations(game.species).map(mut => ({ text: `   ${mut}`, type: "mutation" as LineType })),
    { text: "", type: "normal" },
    { text: "============================================================", type: "section" },
    { text: " INVENTORY", type: "section" },
    { text: "============================================================", type: "section" },
    { text: "", type: "normal" },
    { text: " Weapons:", type: "subsection" },
    { text: `   a - ${getWeapon(game.background)} (weapon)`, type: "item" },
    { text: "", type: "normal" },
    { text: " Armour:", type: "subsection" },
    { text: `   b - +${Math.floor(game.xl / 4)} ${getArmour(game.species)} (worn)`, type: "item" },
    { text: `   c - +${Math.floor(game.xl / 5)} cloak of invisibility (worn)`, type: "item" },
    { text: `   d - +${Math.floor(game.xl / 3)} pair of boots of running (worn)`, type: "item" },
    { text: "", type: "normal" },
    { text: " Jewellery:", type: "subsection" },
    { text: `   e - ring of protection from fire (left hand)`, type: "item" },
    { text: `   f - amulet of regeneration (around neck)`, type: "item" },
    { text: "", type: "normal" },
    { text: " Consumables:", type: "subsection" },
    { text: `   g - ${3 + Math.floor(game.xl / 5)} potions of curing`, type: "item" },
    { text: `   h - ${2 + Math.floor(game.xl / 7)} potions of heal wounds`, type: "item" },
    { text: `   i - ${1 + Math.floor(game.xl / 10)} scrolls of blinking`, type: "item" },
    { text: "", type: "normal" },
    { text: "============================================================", type: "section" },
    { text: " RUNES COLLECTED", type: "section" },
    { text: "============================================================", type: "section" },
    { text: "", type: "normal" },
    ...getRuneList(game.runes).map(rune => ({ text: `   ${rune}`, type: "rune" as LineType })),
    { text: "", type: "normal" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: " Notes", type: "subsection" },
    { text: "------------------------------------------------------------", type: "subsection" },
    { text: "", type: "normal" },
    { text: `   Turn 1: ${game.character} the ${game.species} ${game.background} began the quest.`, type: "note" },
    { text: `   Turn ${Math.floor(game.turns * 0.1)}: Entered the Lair of Beasts.`, type: "note" },
    { text: `   Turn ${Math.floor(game.turns * 0.3)}: Found a runed door.`, type: "note" },
    { text: `   Turn ${Math.floor(game.turns * 0.5)}: Reached skill level 15 in Fighting.`, type: "note" },
    game.result === "win" 
      ? { text: `   Turn ${game.turns}: Escaped with the Orb!`, type: "victory" }
      : { text: `   Turn ${game.turns}: Killed by ${game.killer}.`, type: "death" },
    { text: "", type: "normal" },
    { text: "============================================================", type: "section" },
    { text: " END OF MORGUE FILE", type: "section" },
    { text: "============================================================", type: "section" },
  ]
  
  return lines
}

function getTitle(xl: number): string {
  if (xl >= 27) return "Champion"
  if (xl >= 20) return "Hero"
  if (xl >= 15) return "Warrior"
  if (xl >= 10) return "Fighter"
  return "Adventurer"
}

function getRandomGod(): string {
  const gods = ["Trog", "Okawaru", "Makhleb", "Vehumet", "Sif Muna", "Yredelemnul", "Kikubaaqudgha", "Xom"]
  return gods[Math.floor(Math.random() * gods.length)]
}

function getMainSkill(background: string): string {
  const skills: Record<string, string> = {
    "Berserker": "Axes",
    "Fighter": "Long Blades",
    "Gladiator": "Polearms",
    "Monk": "Unarmed Combat",
    "Conjurer": "Conjurations",
    "Venom Mage": "Poison Magic",
    "Earth Elementalist": "Earth Magic",
  }
  return skills[background] || "Maces & Flails"
}

function getSpells(background: string): string[] {
  if (background.includes("Mage") || background.includes("Conjurer") || background.includes("Elementalist")) {
    return [
      "a - Magic Dart (1)         ####..",
      "b - Mephitic Cloud (3)     ###...",
      "c - Stone Arrow (4)        ##....",
      "d - Fireball (6)           #.....",
    ]
  }
  return ["   (No spells memorized)"]
}

function getMutations(species: string): string[] {
  const speciesMuts: Record<string, string[]> = {
    "Troll": ["Claws 3", "Regeneration 2", "Gourmand"],
    "Gargoyle": ["Petrification resistance", "Negative energy resistance 1", "Big wings"],
    "Merfolk": ["Fast swimming", "Tail 1"],
    "Draconian": ["Breath weapon", "Scales 2"],
    "Naga": ["Slow", "Constrict", "Poison resistance"],
    "Minotaur": ["Horns 2", "Wild magic 1"],
  }
  return speciesMuts[species] || ["(No mutations)"]
}

function getWeapon(background: string): string {
  const weapons: Record<string, string> = {
    "Berserker": "+8 executioner's axe of flaming",
    "Fighter": "+6 demon blade of freezing",
    "Gladiator": "+7 bardiche of electrocution",
    "Monk": "no weapon (unarmed)",
    "Conjurer": "+2 staff of conjuration",
    "Venom Mage": "+3 staff of poison",
    "Earth Elementalist": "+4 staff of earth",
  }
  return weapons[background] || "+5 mace of holy wrath"
}

function getArmour(species: string): string {
  if (species === "Troll" || species === "Naga" || species === "Draconian") {
    return "gold dragon scales"
  }
  return "plate armour of fire resistance"
}

function getRuneList(count: number): string[] {
  const allRunes = [
    "serpentine rune of Zot",
    "barnacled rune of Zot", 
    "gossamer rune of Zot",
    "decaying rune of Zot",
    "slimy rune of Zot",
    "silver rune of Zot",
    "abyssal rune of Zot",
    "demonic rune of Zot",
    "glowing rune of Zot",
    "magical rune of Zot",
    "fiery rune of Zot",
    "dark rune of Zot",
    "iron rune of Zot",
    "icy rune of Zot",
    "obsidian rune of Zot",
  ]
  return allRunes.slice(0, count)
}

// Section navigation config - maps button labels to line types to scroll to
const sectionNav = [
  { type: "section", label: "Summary", searchText: "GAME SUMMARY" },
  { type: "subsection", label: "Stats", searchText: "Character Stats" },
  { type: "subsection", label: "Religion", searchText: "Religion" },
  { type: "subsection", label: "Skills", searchText: "Skills" },
  { type: "subsection", label: "Spells", searchText: "Spells Known" },
  { type: "subsection", label: "Mutations", searchText: "Mutations" },
  { type: "section", label: "Inventory", searchText: "INVENTORY" },
  { type: "section", label: "Runes", searchText: "RUNES COLLECTED" },
  { type: "subsection", label: "Notes", searchText: "Notes" },
]

export function MorgueBrowser({ game, onBack }: MorgueBrowserProps) {
  const morgueContent = generateMorgueContent(game)
  const contentRef = useRef<HTMLDivElement>(null)
  const lineRefs = useRef<(HTMLDivElement | null)[]>([])

  const scrollToSection = useCallback((searchText: string) => {
    const lineIndex = morgueContent.findIndex(line => 
      line.text.includes(searchText)
    )
    if (lineIndex !== -1 && lineRefs.current[lineIndex]) {
      lineRefs.current[lineIndex]?.scrollIntoView({ 
        behavior: "smooth", 
        block: "start" 
      })
    }
  }, [morgueContent])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-none border-2 border-primary/50 hover:border-primary hover:bg-primary/10"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Morgues
          </Button>
          <div>
            <h2 className="font-mono text-lg text-primary">{game.character}</h2>
            <p className="text-sm text-muted-foreground">
              {game.species} {game.background} - {game.date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            className={`rounded-none ${
              game.result === "win" 
                ? "bg-green-500/20 text-green-400 border border-green-500/50" 
                : "bg-red-500/20 text-red-400 border border-red-500/50"
            }`}
          >
            {game.result === "win" ? "Victory" : "Death"} - XL {game.xl}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-none border-2 border-primary/50"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-none border-2 border-primary/50"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>

      {/* Morgue Content */}
      <Card className="border-2 border-primary/30 rounded-none">
        <CardHeader className="border-b-2 border-primary/20 py-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-primary">MORGUE FILE</p>
            <p className="text-xs text-muted-foreground">
              morgue-{game.character.toLowerCase()}-{game.date}.txt
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Sections Navigation */}
          <div className="border-b-2 border-primary/20 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-primary mr-2">SECTIONS:</span>
              {sectionNav.map(({ type, label, searchText }) => {
                const style = lineStyles[type as LineType]
                return (
                  <button
                    key={label}
                    onClick={() => scrollToSection(searchText)}
                    className={`px-3 py-1.5 text-xs font-mono ${style.bg} ${style.text} border border-current/30 hover:border-current/60 hover:brightness-110 transition-all cursor-pointer`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div ref={contentRef} className="h-[550px] overflow-y-auto">
            <div className="p-4 font-mono text-sm leading-relaxed">
              {morgueContent.map((line, index) => {
                const style = lineStyles[line.type]
                return (
                  <div
                    key={index}
                    ref={el => { lineRefs.current[index] = el }}
                    className={`px-3 py-0.5 ${style.bg} ${style.text} ${style.border || ""}`}
                  >
                    <pre className="whitespace-pre-wrap">{line.text || "\u00A0"}</pre>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
