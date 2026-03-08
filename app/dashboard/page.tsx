"use client"

import { useState, useEffect, useCallback } from "react"
import { Trophy, Skull, Target, Clock, Flame, Zap, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Navigation } from "@/components/dashboard/navigation"
import { StatCard } from "@/components/dashboard/stat-card"
import { PlayerStatsChart } from "@/components/dashboard/player-stats-chart"
import { PerformanceGraph } from "@/components/dashboard/performance-graph"
import { GoalProgress } from "@/components/dashboard/goal-progress"
import { LevelAtDeathChart } from "@/components/dashboard/level-at-death-chart"
import { UploadDialog } from "@/components/dashboard/upload-dialog"
import { UploadsTable } from "@/components/dashboard/uploads-table"
import { Extras } from "@/components/dashboard/extras"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import {
  fetchMorgues,
  fetchUserStats,
  formatPlayTime,
  formatFastestWin,
  deleteAllMorgues,
  type GameRecord,
} from "@/lib/morgue-api"

export default function DashboardPage() {
  const { userId } = useAuth()
  const [activeTab, setActiveTab] = useState("analysis")
  const [morgues, setMorgues] = useState<GameRecord[]>([])
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchUserStats>>>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [morguesLoading, setMorguesLoading] = useState(true)
  const [nukeConfirmOpen, setNukeConfirmOpen] = useState(false)
  const [isNuking, setIsNuking] = useState(false)

  const loadData = useCallback(async () => {
    if (!userId) {
      setMorgues([])
      setStats(null)
      setStatsLoading(false)
      setMorguesLoading(false)
      return
    }
    setMorguesLoading(true)
    setStatsLoading(true)
    const [morgueList, statsRow] = await Promise.all([
      fetchMorgues(supabase, userId),
      fetchUserStats(supabase, userId),
    ])
    setMorgues(morgueList)
    setStats(statsRow)
    setMorguesLoading(false)
    setStatsLoading(false)
  }, [userId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const hasStats = stats && stats.total_games > 0
  const isEmpty = !statsLoading && !morguesLoading && morgues.length === 0
  const statsData = stats
    ? {
        totalWins: stats.total_wins,
        totalDeaths: stats.total_deaths,
        winRate: stats.win_rate,
        totalPlayTime: formatPlayTime(stats.total_play_time_seconds),
        totalPlayTimeSeconds: stats.total_play_time_seconds,
        bestStreak: stats.best_streak,
        avgXlAtDeath: stats.avg_xl_at_death,
        totalRunes: stats.total_runes,
        fastestWin: formatFastestWin(stats.fastest_win_seconds),
      }
    : null

  return (
    <div className="min-h-screen bg-background">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-mono text-lg text-primary">
              {activeTab === "analysis" && "PERFORMANCE ANALYTICS"}
              {activeTab === "morgues" && "MORGUE FILES"}
              {activeTab === "extras" && "RESOURCES"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "analysis" && "Track and analyze your dungeon crawling progress"}
              {activeTab === "morgues" && "Upload and browse your morgue files"}
              {activeTab === "extras" && "Helpful links and community resources"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <UploadDialog onUploadComplete={loadData} />
            {activeTab === "morgues" && (
              <Button
                variant="destructive"
                className="rounded-none border-2 font-mono text-xs"
                onClick={() => setNukeConfirmOpen(true)}
                disabled={isNuking}
              >
                {isNuking ? "Nuking…" : "Nuke Morgue"}
              </Button>
            )}
          </div>
        </div>

        <AlertDialog open={nukeConfirmOpen} onOpenChange={setNukeConfirmOpen}>
          <AlertDialogContent className="rounded-none border-2 border-primary/30">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono">Nuke Morgue</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete all the morgue files for this user?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="rounded-none border-2 font-mono text-xs"
                disabled={isNuking}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-none border-2 bg-red-600 text-white hover:bg-red-700 font-mono text-xs"
                onClick={async (e) => {
                  e.preventDefault()
                  if (!userId) return
                  setIsNuking(true)
                  setNukeConfirmOpen(false)
                  const { error } = await deleteAllMorgues(supabase, userId)
                  setIsNuking(false)
                  if (error) {
                    toast({ title: "Nuke failed", description: error, variant: "destructive" })
                    return
                  }
                  toast({ title: "Morgues cleared", description: "All morgue files and stats have been removed." })
                  loadData()
                }}
                disabled={isNuking}
              >
                Yes, delete all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {activeTab === "analysis" && (
          <div className="space-y-6">
            <GoalProgress stats={statsData} morgues={morgues} loading={statsLoading} />
            <LevelAtDeathChart morgues={morgues} loading={statsLoading} />
            {isEmpty ? (
              <AnalysisEmptyState />
            ) : statsLoading ? (
              <AnalysisLoadingState />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    title="Total Wins"
                    value={statsData?.totalWins ?? 0}
                    subtitle={statsData ? "Escaped with the\nOrb of Zot" : undefined}
                    icon={Trophy}
                  />
                  <StatCard
                    title="Total Deaths"
                    value={statsData?.totalDeaths ?? 0}
                    subtitle="Brave attempts"
                    icon={Skull}
                  />
                  <StatCard
                    title="Win Rate"
                    value={statsData ? `${statsData.winRate.toFixed(1)}%` : "0%"}
                    subtitle="Overall percentage"
                    icon={Target}
                  />
                  <StatCard
                    title="Play Time"
                    value={statsData?.totalPlayTime ?? "0m"}
                    valueSubtext={statsData ? `${(statsData.totalPlayTimeSeconds / 3600).toFixed(1)} hours` : undefined}
                    subtitle="Total game time"
                    icon={Clock}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    title="Best Streak"
                    value={statsData?.bestStreak ?? 0}
                    subtitle="Consecutive wins"
                    icon={Flame}
                  />
                  <StatCard
                    title="Avg XL at Death"
                    value={statsData ? statsData.avgXlAtDeath.toFixed(1) : "—"}
                    subtitle="Experience level"
                    icon={Skull}
                  />
                  <StatCard
                    title="Runes Collected"
                    value={statsData?.totalRunes ?? 0}
                    subtitle="Lifetime total"
                    icon={Award}
                  />
                  <StatCard
                    title="Fastest Win"
                    value={statsData?.fastestWin ?? "—"}
                    subtitle="Speed record"
                    icon={Zap}
                  />
                </div>
                <PlayerStatsChart
                  speciesStats={stats?.species_stats}
                  backgroundStats={stats?.background_stats}
                  godStats={stats?.god_stats}
                >
                  <PerformanceGraph morgues={morgues} />
                </PlayerStatsChart>
              </>
            )}
          </div>
        )}

        {activeTab === "morgues" && (
          <div className="space-y-6">
            <UploadsTable
              morgues={morgues}
              loading={morguesLoading}
              onRefresh={loadData}
            />
          </div>
        )}

        {activeTab === "extras" && (
          <Extras />
        )}
      </main>

      <footer className="border-t-4 border-primary/30 bg-card mt-8">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <p className="text-center text-sm text-muted-foreground font-mono">
            Snorg.
          </p>
        </div>
      </footer>
    </div>
  )
}

function AnalysisEmptyState() {
  return (
    <div className="rounded-none border-2 border-primary/30 bg-card p-8 text-center">
      <p className="font-mono text-primary mb-2">No morgue data yet</p>
      <p className="text-sm text-muted-foreground">
        Upload morgue files from the &quot;Upload Morgue&quot; button to see your stats here.
      </p>
    </div>
  )
}

function AnalysisLoadingState() {
  return (
    <div className="rounded-none border-2 border-primary/30 bg-card p-8 text-center">
      <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">Loading stats…</p>
    </div>
  )
}
