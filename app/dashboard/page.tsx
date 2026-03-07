"use client"

import { useState } from "react"
import { Trophy, Skull, Target, Clock, Flame, Zap, Award } from "lucide-react"
import { Navigation } from "@/components/dashboard/navigation"
import { StatCard } from "@/components/dashboard/stat-card"
import { PlayerStatsChart } from "@/components/dashboard/player-stats-chart"
import { PerformanceGraph } from "@/components/dashboard/performance-graph"
import { GoalProgress } from "@/components/dashboard/goal-progress"
import { LevelAtDeathChart } from "@/components/dashboard/level-at-death-chart"
import { UploadDialog } from "@/components/dashboard/upload-dialog"
import { UploadsTable } from "@/components/dashboard/uploads-table"
import { Extras } from "@/components/dashboard/extras"

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("analysis")

  return (
    <div className="min-h-screen bg-background">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-mono text-lg text-primary">
              {activeTab === "analysis" && "PERFORMANCE ANALYSIS"}
              {activeTab === "morgues" && "MORGUE FILES"}
              {activeTab === "extras" && "DCSS RESOURCES"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {activeTab === "analysis" && "Track and analyze your dungeon crawling progress"}
              {activeTab === "morgues" && "Browse and analyze your morgue files"}
              {activeTab === "extras" && "Helpful links and community resources"}
            </p>
          </div>
          <UploadDialog />
        </div>

        {/* Analysis Tab */}
        {activeTab === "analysis" && (
          <div className="space-y-6">
            {/* Goal Progress */}
            <GoalProgress />

            {/* Level at Death Chart */}
            <LevelAtDeathChart />

            {/* Quick Stats - 8 boxes in 2 rows */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Wins"
                value={38}
                subtitle="15-rune victories"
                icon={Trophy}
                trend="up"
                trendValue="3 this month"
              />
              <StatCard
                title="Total Deaths"
                value={245}
                subtitle="Brave attempts"
                icon={Skull}
                trend="neutral"
                trendValue="12 this month"
              />
              <StatCard
                title="Win Rate"
                value="13.4%"
                subtitle="Overall percentage"
                icon={Target}
                trend="up"
                trendValue="2.1% improvement"
              />
              <StatCard
                title="Play Time"
                value="482h"
                subtitle="Total game time"
                icon={Clock}
                trend="neutral"
                trendValue="28h this month"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Best Streak"
                value={5}
                subtitle="Consecutive wins"
                icon={Flame}
              />
              <StatCard
                title="Avg XL at Death"
                value={14.2}
                subtitle="Experience level"
                icon={Skull}
              />
              <StatCard
                title="Runes Collected"
                value={892}
                subtitle="Lifetime total"
                icon={Award}
              />
              <StatCard
                title="Fastest Win"
                value="2:45:12"
                subtitle="Speed record"
                icon={Zap}
              />
            </div>

            {/* Charts Row */}
            <PlayerStatsChart>
              <PerformanceGraph />
            </PlayerStatsChart>
          </div>
        )}

        {/* Morgues Tab */}
        {activeTab === "morgues" && (
          <div className="space-y-6">
            <UploadsTable />
          </div>
        )}

        {/* Extras Tab */}
        {activeTab === "extras" && (
          <Extras />
        )}
      </main>

      {/* Footer */}
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
