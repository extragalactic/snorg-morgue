"use client"

import { useState } from "react"
import { Trophy, Crown, Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface LeaderboardEntry {
  rank: number
  player: string
  value: number | string
  character?: string
  combo?: string
}

const highScores: LeaderboardEntry[] = [
  { rank: 1, player: "XomFan42", value: "15,234,567", character: "Grindor", combo: "MiBe" },
  { rank: 2, player: "SprigganSpeed", value: "12,876,432", character: "Zippy", combo: "SpEn" },
  { rank: 3, player: "DeepDiver", value: "11,543,210", character: "Stonefist", combo: "GrFi" },
  { rank: 4, player: "RuneHunter", value: "10,987,654", character: "Splash", combo: "MfGl" },
  { rank: 5, player: "ZotRusher", value: "9,876,543", character: "Crusher", combo: "TrMo" },
  { rank: 6, player: "OrbMaster", value: "8,765,432", character: "Phoenix", combo: "DrCj" },
  { rank: 7, player: "VaultBreaker", value: "7,654,321", character: "Venom", combo: "NaVM" },
  { rank: 8, player: "SlimeKing", value: "6,543,210", character: "Boulder", combo: "GrEE" },
]

const mostWins: LeaderboardEntry[] = [
  { rank: 1, player: "XomFan42", value: 247 },
  { rank: 2, player: "DeepDiver", value: 189 },
  { rank: 3, player: "RuneHunter", value: 156 },
  { rank: 4, player: "OrbMaster", value: 134 },
  { rank: 5, player: "ZotRusher", value: 112 },
  { rank: 6, player: "SprigganSpeed", value: 98 },
  { rank: 7, player: "VaultBreaker", value: 87 },
  { rank: 8, player: "SlimeKing", value: 76 },
]

const bestWinRate: LeaderboardEntry[] = [
  { rank: 1, player: "ConsistentKing", value: "34.2%" },
  { rank: 2, player: "XomFan42", value: "28.7%" },
  { rank: 3, player: "DeepDiver", value: "25.3%" },
  { rank: 4, player: "OrbMaster", value: "22.1%" },
  { rank: 5, player: "RuneHunter", value: "19.8%" },
  { rank: 6, player: "ZotRusher", value: "17.5%" },
  { rank: 7, player: "SprigganSpeed", value: "15.2%" },
  { rank: 8, player: "VaultBreaker", value: "13.9%" },
]

function LeaderboardRow({ entry, showCharacter = false }: { entry: LeaderboardEntry; showCharacter?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-primary/10 p-3 transition-colors hover:bg-primary/5",
        entry.rank <= 3 && "bg-primary/5"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center border-2 font-mono text-sm",
            entry.rank === 1 && "border-primary bg-primary/20 text-primary",
            entry.rank === 2 && "border-gray-400 bg-gray-400/20 text-gray-400",
            entry.rank === 3 && "border-orange-500 bg-orange-500/20 text-orange-500",
            entry.rank > 3 && "border-primary/30 text-muted-foreground"
          )}
        >
          {entry.rank}
        </div>
        <div>
          <p className="text-sm font-medium">{entry.player}</p>
          {showCharacter && entry.character && (
            <p className="text-xs text-muted-foreground">
              {entry.character} ({entry.combo})
            </p>
          )}
        </div>
      </div>
      <p className="font-mono text-sm text-primary">{entry.value}</p>
    </div>
  )
}

export function Leaderboard() {
  const [activeTab, setActiveTab] = useState("high-scores")

  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle>
          LEADERBOARDS
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full rounded-none border-b-2 border-primary/20 bg-transparent p-0">
            <TabsTrigger
              value="high-scores"
              className={cn(
                "flex-1 rounded-none border-b-2 py-3 font-mono text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary",
                "border-transparent"
              )}
            >
              <Crown className="mr-2 h-4 w-4" />
              High Scores
            </TabsTrigger>
            <TabsTrigger
              value="most-wins"
              className={cn(
                "flex-1 rounded-none border-b-2 py-3 font-mono text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary",
                "border-transparent"
              )}
            >
              <Trophy className="mr-2 h-4 w-4" />
              Most Wins
            </TabsTrigger>
            <TabsTrigger
              value="win-rate"
              className={cn(
                "flex-1 rounded-none border-b-2 py-3 font-mono text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary",
                "border-transparent"
              )}
            >
              <Target className="mr-2 h-4 w-4" />
              Win Rate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="high-scores" className="m-0">
            {highScores.map((entry) => (
              <LeaderboardRow key={entry.rank} entry={entry} showCharacter />
            ))}
          </TabsContent>

          <TabsContent value="most-wins" className="m-0">
            {mostWins.map((entry) => (
              <LeaderboardRow key={entry.rank} entry={entry} />
            ))}
          </TabsContent>

          <TabsContent value="win-rate" className="m-0">
            {bestWinRate.map((entry) => (
              <LeaderboardRow key={entry.rank} entry={entry} />
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
