"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Trophy, Skull, Target, Flame, Zap, Timer, ChartColumnBig } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
import { GoalProgress } from "@/components/dashboard/goal-progress"
import { LevelAtDeathChart } from "@/components/dashboard/level-at-death-chart"
import { TotalTimeSpentAtEachLevelChart } from "@/components/dashboard/level-time-distribution-chart"
import { RuneCollectionChart } from "@/components/dashboard/rune-collection-chart"
import { TestPerformanceChart } from "@/components/dashboard/test-performance-chart"
import { Top10Killers } from "@/components/dashboard/top-10-killers"
import { SpeciesBackgroundComboGrid } from "@/components/dashboard/species-background-combo-grid"
import { DcssChargenSelectionGrid } from "@/components/dashboard/dcss-chargen-selection-grid"
import { UploadDialog } from "@/components/dashboard/upload-dialog"
import { OnlineImportDialog } from "@/components/dashboard/online-import-dialog"
import { UploadsTable } from "@/components/dashboard/uploads-table"
import { Extras } from "@/components/dashboard/extras"
import { useAuth } from "@/contexts/auth-context"
import { useBrowse } from "@/contexts/browse-context"
import { useTheme } from "@/contexts/theme-context"
import { supabase } from "@/lib/supabase"
import { toast } from "@/hooks/use-toast"
import {
  fetchMorgues,
  fetchUserStats,
  fetchGlobalAnalysisStats,
  type GlobalAnalysisStats,
  formatPlayTime,
  formatFastestWin,
  deleteAllMorgues,
  refreshMorguesFromRaw,
  type GameRecord,
} from "@/lib/morgue-api"
import { GOD_SHORT_FORMS } from "@/lib/dcss-constants"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { slugifyUsername, TAB_TO_PAGE } from "@/lib/slug"
import { typography, TITLE_GRAPHIC_SIZE_LARGE } from "@/lib/typography"
import { SkillingAnalysis } from "@/components/dashboard/skilling-analysis"
import { AverageLevelByGodChart } from "@/components/dashboard/average-level-by-god-chart"
import { MilestoneProgressionChart } from "@/components/dashboard/milestone-progression-chart"
import { cn } from "@/lib/utils"
import { isAdminEmail } from "@/lib/admin-auth"

function speciesCode(species: string): string {
  const s = (species ?? "").trim()
  if (!s) return ""
  if (s === "Octopode") return "Op"
  if (s === "Merfolk") return "Mf"
  if (s === "Deep Elf") return "DE"
  if (s === "Draconian") return "Dr"
  if (s === "Mountain Dwarf") return "MD"
  if (s === "Demigod") return "Dg"
  if (s === "Demonspawn") return "Ds"
  if (s === "Gargoyle") return "Gr"
  if (s.endsWith(" Draconian")) return "Dr"
  return s.slice(0, 2)
}

function backgroundCode(background: string): string {
  const b = (background ?? "").trim()
  if (!b) return ""
  const map: Record<string, string> = {
    "Chaos Knight": "CK",
    "Fire Elementalist": "FE",
    "Ice Elementalist": "IE",
    "Air Elementalist": "AE",
    "Earth Elementalist": "EE",
    "Forgewright": "FW",
    "Hedge Wizard": "HW",
    "Warper": "Wr",
    "Wanderer": "Wn",
    "Necromancer": "Ne",
    "Conjurer": "Co",
  }
  return map[b] ?? b.slice(0, 2)
}

function formatComboSubtitle(species: string, background: string, god?: string): string {
  const line1 = `${species} ${background}${god ? ` of ${god}` : ""}`
  const line2 = `(${speciesCode(species)}${backgroundCode(background)}${god ? `^${GOD_SHORT_FORMS[god] ?? god}` : ""})`
  return `${line1}\n${line2}`
}

function PerformanceAndRunesLayout({
  stats,
  statsLoading,
  morgues,
  showGlobalAverages,
  globalStats,
}: {
  stats: Awaited<ReturnType<typeof fetchUserStats>>
  statsLoading: boolean
  morgues: GameRecord[]
  showGlobalAverages: boolean
  globalStats: GlobalAnalysisStats | null
}) {
  const rightRef = useRef<HTMLDivElement>(null)
  const [rightHeight, setRightHeight] = useState<number | null>(null)

  useEffect(() => {
    const el = rightRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setRightHeight(entry.contentRect.height)
    })
    ro.observe(el)
    setRightHeight(el.getBoundingClientRect().height)
    return () => ro.disconnect()
  }, [morgues, statsLoading])

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={rightHeight != null ? { height: rightHeight } : undefined}
      >
        <div className="min-h-0 flex-1">
          <TestPerformanceChart
            speciesStats={stats?.species_stats ?? []}
            backgroundStats={stats?.background_stats ?? []}
            godStats={stats?.god_stats ?? []}
            showAverages={showGlobalAverages}
            averagePlayerCount={globalStats?.userCount}
            fillHeight
          />
        </div>
      </div>
      <div ref={rightRef} className="flex min-h-0 flex-col space-y-6">
        <RuneCollectionChart morgues={morgues} />
        <Top10Killers morgues={morgues} loading={statsLoading} />
      </div>
    </div>
  )
}

export default function DashboardPage({
  activeTab: activeTabProp,
  onTabChange: onTabChangeProp,
  usernameSlug,
}: {
  activeTab?: string
  onTabChange?: (tab: string) => void
  usernameSlug?: string
} = {}) {
  const { userId, user } = useAuth()
  const isAdmin = isAdminEmail(user?.email)
  const { browseTarget, clearBrowseTarget } = useBrowse()
  const { themeStyle } = useTheme()
  const router = useRouter()
  const isBrowsingOther = !!(browseTarget && userId && browseTarget.userId !== userId)
  const morguePublicSlug = browseTarget?.usernameSlug ?? usernameSlug
  const [internalTab, setInternalTab] = useState("analysis")
  const activeTab = activeTabProp ?? internalTab
  const setActiveTab = onTabChangeProp ?? setInternalTab
  const [morgues, setMorgues] = useState<GameRecord[]>([])
  const [globalLevelDeathAverages, setGlobalLevelDeathAverages] = useState<number[] | null>(null)
  const [globalLevelDeathUserCount, setGlobalLevelDeathUserCount] = useState<number | null>(null)
  const [globalStats, setGlobalStats] = useState<GlobalAnalysisStats | null>(null)
  const [showGlobalAverages, setShowGlobalAverages] = useState(false)
  /** Global player averages (charts + secondary stats) — only when admin turns the switch on. */
  const showGlobalComparison = isAdmin && showGlobalAverages

  useEffect(() => {
    if (!isAdmin) setShowGlobalAverages(false)
  }, [isAdmin])

  // Redirect /dashboard to /username/statistics when not using URL-driven tabs
  useEffect(() => {
    if (activeTabProp != null || onTabChangeProp != null) return
    if (!user?.name) return
    const slug = slugifyUsername(user.name)
    if (slug) router.replace(`/${slug}/${TAB_TO_PAGE.analysis}`)
  }, [user?.name, activeTabProp, onTabChangeProp, router])
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchUserStats>>>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [morguesLoading, setMorguesLoading] = useState(true)
  const [nukeConfirmOpen, setNukeConfirmOpen] = useState(false)
  const [isNuking, setIsNuking] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false)
  const [downloadConfirmOpen, setDownloadConfirmOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [onlineImportOpen, setOnlineImportOpen] = useState(false)
  const [versionStart, setVersionStart] = useState("0.32")
  const [versionEnd, setVersionEnd] = useState("0.34")

  const loadData = useCallback(async () => {
    setMorguesLoading(true)
    setStatsLoading(true)

    const targetBrowseId = browseTarget?.userId
    const useBrowseApi = !!(targetBrowseId && userId && targetBrowseId !== userId)

    try {
      const globalAnalysis = await fetchGlobalAnalysisStats(supabase)

      if (useBrowseApi) {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          setMorgues([])
          setStats(null)
        } else {
          const res = await fetch(
            `/api/browse/dashboard?userId=${encodeURIComponent(targetBrowseId)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            toast({
              title: "Could not load player data",
              description: (body.error as string) || res.statusText,
              variant: "destructive",
            })
            setMorgues([])
            setStats(null)
          } else {
            const payload = await res.json()
            setMorgues(payload.morgues ?? [])
            setStats(payload.stats ?? null)
          }
        }
      } else {
        const [morgueList, statsRow] = await Promise.all([
          userId ? fetchMorgues(supabase, userId) : Promise.resolve([]),
          userId ? fetchUserStats(supabase, userId) : Promise.resolve(null),
        ])
        setMorgues(morgueList)
        setStats(statsRow)
      }

      setGlobalStats(globalAnalysis)
      setGlobalLevelDeathAverages(globalAnalysis?.levelDeath.averages ?? null)
      setGlobalLevelDeathUserCount(globalAnalysis?.levelDeath.userCount ?? null)
    } catch (e) {
      toast({
        title: "Load failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setMorguesLoading(false)
      setStatsLoading(false)
    }
  }, [userId, browseTarget?.userId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const hasStats = stats && stats.total_games > 0
  const isEmpty = !statsLoading && !morguesLoading && morgues.length === 0
  const routeSlug = usernameSlug || (user?.name ? slugifyUsername(user.name) : "")
  const morguesPageHref =
    isBrowsingOther && browseTarget
      ? `/${browseTarget.usernameSlug}/${TAB_TO_PAGE.morgues}`
      : routeSlug
        ? `/${routeSlug}/${TAB_TO_PAGE.morgues}`
        : null
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

  const fastestWinGame =
    stats?.fastest_win_seconds != null && morgues.length > 0
      ? morgues.find(
          (m) => m.result === "win" && m.durationSeconds === stats.fastest_win_seconds
        )
      : undefined
  const fastestWinSubtitle = fastestWinGame
    ? formatComboSubtitle(
        fastestWinGame.species,
        fastestWinGame.background,
        fastestWinGame.god
      )
    : undefined

  // Filter morgues by version range for UI views that care about version (e.g. Morgues tab).
  // Versions are treated as short x.y (e.g. 0.33, 0.34); if parsing fails, the morgue is included.
  const filteredMorguesByVersion = morgues.filter((m) => {
    const v = m.version?.trim()
    if (!v) return true
    const mShort = v.match(/^(\d+\.\d+)/)?.[1]
    if (!mShort) return true
    const start = parseFloat(versionStart) || 0
    const end = parseFloat(versionEnd) || 999
    const val = parseFloat(mShort)
    return val >= Math.min(start, end) && val <= Math.max(start, end)
  })

  const smallestTurncountWin =
    morgues.length > 0
      ? morgues
          .filter((m) => m.result === "win")
          .reduce<GameRecord | undefined>((best, m) => {
            if (best == null) return m
            return m.turns < best.turns ? m : best
          }, undefined)
      : undefined
  const smallestTurncountValue = smallestTurncountWin != null ? smallestTurncountWin.turns : "—"
  const smallestTurncountSubtitle = smallestTurncountWin
    ? formatComboSubtitle(
        smallestTurncountWin.species,
        smallestTurncountWin.background,
        smallestTurncountWin.god
      )
    : undefined

  /** Modal (most common) XL among death games; ties favor the lower level. */
  const medianXlAtDeathMode = useMemo(() => {
    const deaths = morgues.filter((m) => m.result === "death" && Number.isFinite(m.xl))
    if (deaths.length === 0) return null
    const counts = new Map<number, number>()
    for (const m of deaths) {
      const xl = Math.min(27, Math.max(1, Math.round(m.xl)))
      counts.set(xl, (counts.get(xl) ?? 0) + 1)
    }
    let modeXl: number | null = null
    let maxC = -1
    for (const [xl, c] of counts) {
      if (c > maxC || (c === maxC && modeXl !== null && xl < modeXl)) {
        maxC = c
        modeXl = xl
      }
    }
    return modeXl
  }, [morgues])

  const handleDownloadAllMorgues = useCallback(async () => {
    if (!userId || isBrowsingOther || morgues.length === 0 || isDownloading) return
    setIsDownloading(true)
    try {
      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()
      const folder = zip.folder("morgues")!

      for (const game of morgues) {
        try {
          const res = await fetch(`/api/morgues/${encodeURIComponent(game.id)}`)
          if (!res.ok) continue
          const data = await res.json()
          const raw = (data.rawText as string) ?? ""
          const filename = (data.filename as string) || `morgue-${game.character}-${game.id}.txt`
          folder.file(filename, raw)
        } catch {
          // skip failed file
        }
      }

      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "snorg-morgues.zip"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("Failed to create morgues zip", e)
      toast({
        title: "Download failed",
        description: "Could not create morgue ZIP file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
      setDownloadConfirmOpen(false)
    }
  }, [userId, morgues, isDownloading, isBrowsingOther])

  return (
    <div
      className={cn(
        "bg-background",
        activeTab === "morgues" ? "flex h-dvh min-h-0 flex-col overflow-hidden" : "min-h-screen",
      )}
    >
      <div className={cn(activeTab === "morgues" && "shrink-0")}>
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} usernameSlug={usernameSlug} />
      </div>

      {browseTarget && (
        <div className="shrink-0 border-b-2 border-amber-500/60 bg-amber-500/10">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <p className="font-mono text-lg text-foreground">
              Viewing data for user:{" "}
              <span className="text-xl font-semibold text-primary">{browseTarget.usernameSlug}</span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "nav-signout rounded-none border-2 text-primary hover:bg-destructive/10 font-mono text-sm",
                themeStyle === "tiles" ? "border-primary/50" : "border-red-500/50",
              )}
              onClick={() => {
                clearBrowseTarget()
              }}
            >
              Return to your data
            </Button>
          </div>
        </div>
      )}

      <main
        className={cn(
          "mx-auto max-w-7xl px-4 py-6",
          activeTab === "morgues" && "flex w-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
            activeTab === "morgues" ? "mb-2 shrink-0" : "mb-6",
          )}
        >
          <div>
            <div className="flex flex-wrap items-center gap-3">
              {activeTab === "analysis" && (
                <Image
                  src="/images/tesseract-icon.png"
                  alt=""
                  width={TITLE_GRAPHIC_SIZE_LARGE}
                  height={TITLE_GRAPHIC_SIZE_LARGE}
                  className="object-contain shrink-0"
                  style={{ width: TITLE_GRAPHIC_SIZE_LARGE, height: TITLE_GRAPHIC_SIZE_LARGE }}
                />
              )}
              {activeTab === "achievements" && (
                <Image
                  src="/images/achievement-award-icon.png"
                  alt=""
                  width={TITLE_GRAPHIC_SIZE_LARGE}
                  height={TITLE_GRAPHIC_SIZE_LARGE}
                  className="object-contain shrink-0"
                  style={{ width: TITLE_GRAPHIC_SIZE_LARGE, height: TITLE_GRAPHIC_SIZE_LARGE }}
                />
              )}
              {activeTab === "morgues" && (
                <Image
                  src="/images/angelic-guardian-icon.png"
                  alt=""
                  width={TITLE_GRAPHIC_SIZE_LARGE}
                  height={TITLE_GRAPHIC_SIZE_LARGE}
                  className="object-contain shrink-0"
                  style={{ width: TITLE_GRAPHIC_SIZE_LARGE, height: TITLE_GRAPHIC_SIZE_LARGE }}
                />
              )}
              <div className="min-w-0">
                <h1 className={typography.primaryTitle}>
                  {activeTab === "analysis" && "GAME STATS"}
                  {activeTab === "skills" && "ANALYSIS"}
                  {activeTab === "achievements" && "OFFICIAL ACHIEVEMENTS"}
                  {activeTab === "morgues" && "MORGUE FILES"}
                  {activeTab === "extras" && "RESOURCES"}
                </h1>
                <p className={typography.bodyMuted}>
                  {activeTab === "analysis" && "Track your DCSS progress"}
                  {activeTab === "skills" && "Deeper analysis to find the patterns"}
                  {activeTab === "achievements" && "Impressive metrics of DCSS prowess"}
                  {activeTab === "morgues" && "Upload and browse your morgue files"}
                  {activeTab === "extras" && "Helpful links and community resources"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-6">
              {activeTab === "analysis" &&
                isAdmin &&
                globalStats &&
                globalStats.userCount > 0 && (
                  <div className="flex items-center gap-2 pr-5 sm:pr-0">
                    <div className="flex flex-col items-center">
                      <span className={typography.captionMono}>Show averages</span>
                      <span className={typography.captionMono}>
                        ({globalStats.userCount} total players)
                      </span>
                    </div>
                    <Switch
                      checked={showGlobalAverages}
                      onCheckedChange={setShowGlobalAverages}
                      className="data-[state=checked]:bg-average data-[state=checked]:border-average"
                    />
                  </div>
                )}
              {activeTab === "analysis" && !isBrowsingOther && userId && (
                <div className="flex items-center gap-2 pr-5 sm:pr-0">
                  <div className="flex flex-col items-center max-w-[11rem] text-center">
                    <span className={typography.captionMono}>Enable sharing</span>
                  </div>
                  <Switch
                    checked={user?.browseSharingEnabled ?? true}
                    onCheckedChange={async (enabled) => {
                      if (!userId) return
                      const { error } = await supabase.auth.updateUser({
                        data: { browse_sharing_enabled: enabled },
                      })
                      if (error) {
                        toast({
                          title: "Could not update sharing",
                          description: error.message,
                          variant: "destructive",
                        })
                        return
                      }
                    }}
                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                </div>
              )}
              {activeTab === "morgues" && !isBrowsingOther && (
                <UploadDialog onUploadComplete={loadData} />
              )}
              {activeTab === "morgues" && !isBrowsingOther && (
                <Button
                  className="gap-2 rounded-none border-2 border-primary bg-background text-primary hover:bg-primary/10 font-mono text-xs"
                  onClick={() => setOnlineImportOpen(true)}
                  disabled={!userId}
                >
                  Server Import
                </Button>
              )}
              {activeTab === "morgues" && !isBrowsingOther && morgues.length > 0 && (
                <Button
                  className="gap-2 rounded-none border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs"
                  onClick={() => setDownloadConfirmOpen(true)}
                  disabled={isDownloading}
                >
                  {isDownloading ? "Preparing…" : "Download"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <AlertDialog open={refreshConfirmOpen} onOpenChange={setRefreshConfirmOpen}>
          <AlertDialogContent className="rounded-none border-2 border-primary/30">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono">Refresh Morgues</AlertDialogTitle>
              <AlertDialogDescription>
                This will clear all parsed morgue data and stats for this user, then re-parse everything from the saved morgue files.
                Raw morgue files will be kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="rounded-none border-2 font-mono text-xs"
                disabled={isRefreshing}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-none border-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono text-xs"
                onClick={async (e) => {
                  e.preventDefault()
                  if (!userId) return
                  setIsRefreshing(true)
                  setRefreshConfirmOpen(false)
                  const { error } = await refreshMorguesFromRaw(supabase, userId)
                  setIsRefreshing(false)
                  if (error) {
                    toast({
                      title: "Refresh failed",
                      description: error,
                      variant: "destructive",
                    })
                    return
                  }
                  toast({
                    title: "Morgues refreshed",
                    description: "All morgue data and stats were regenerated from saved files.",
                  })
                  loadData()
                }}
                disabled={isRefreshing}
              >
                Yes, refresh
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={downloadConfirmOpen} onOpenChange={setDownloadConfirmOpen}>
          <AlertDialogContent className="rounded-none border-2 border-primary/30">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono">Download all morgues?</AlertDialogTitle>
              <AlertDialogDescription>
                This will download all of your original morgue files in a single ZIP archive. Only morgues you uploaded yourself are included; nothing is fetched from the DCSS servers. Large collections may take a little while to prepare.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="rounded-none border-2 border-primary/50 font-mono text-xs hover:text-primary"
                disabled={isDownloading}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-none border-2 border-primary bg-primary text-primary-foreground font-mono text-xs min-w-[5.5rem]"
                disabled={isDownloading}
                onClick={(e) => {
                  e.preventDefault()
                  void handleDownloadAllMorgues()
                }}
              >
                {isDownloading ? "Preparing…" : "Download ZIP"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
                className="rounded-none border-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono text-xs"
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
          <>
            <div className="space-y-6">
              {isEmpty ? (
                <AnalysisEmptyState morguesPageHref={morguesPageHref} />
              ) : statsLoading ? (
                <AnalysisLoadingState />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    title="Total Wins"
                    value={statsData?.totalWins ?? 0}
                    secondaryValue={
                      showGlobalComparison && globalStats && globalStats.userCount > 0
                        ? String(Math.floor(globalStats.totals.totalWins / globalStats.userCount))
                        : undefined
                    }
                    subtitle={statsData ? "Escaped with the\nOrb of Zot" : undefined}
                    icon={Trophy}
                  />
                  <StatCard
                    title="Total Deaths"
                    value={statsData?.totalDeaths ?? 0}
                    secondaryValue={
                      showGlobalComparison && globalStats && globalStats.userCount > 0
                        ? String(Math.floor(globalStats.totals.totalDeaths / globalStats.userCount))
                        : undefined
                    }
                    subtitle="Brave attempts"
                    icon={Skull}
                  />
                  <StatCard
                    title="Win Rate"
                    value={statsData ? `${statsData.winRate.toFixed(1)}%` : "0%"}
                    secondaryValue={
                      showGlobalComparison && globalStats
                        ? `${globalStats.totals.overallWinRate.toFixed(1)}%`
                        : undefined
                    }
                    subtitle="Overall percentage"
                    icon={Target}
                  />
                  <StatCard
                    title="Best Streak"
                    value={statsData?.bestStreak ?? 0}
                    secondaryValue={
                      showGlobalComparison && globalStats
                        ? String(Math.floor(globalStats.totals.avgBestStreak))
                        : undefined
                    }
                    subtitle="Consecutive wins"
                    icon={Flame}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    title="Avg XL at Death"
                    value={statsData ? statsData.avgXlAtDeath.toFixed(1) : "—"}
                    secondaryValue={
                      showGlobalComparison && globalStats
                        ? globalStats.totals.avgXlAtDeath.toFixed(1)
                        : undefined
                    }
                    subtitle="Experience level"
                    icon={Skull}
                  />
                  <StatCard
                    title="Median XL at Death"
                    value={medianXlAtDeathMode != null ? String(medianXlAtDeathMode) : "—"}
                    subtitle="Most common death XL"
                    icon={ChartColumnBig}
                  />
                  <StatCard
                    title="Fastest Win"
                    value={statsData?.fastestWin ?? "—"}
                    secondaryValue={
                      showGlobalComparison && globalStats
                        ? formatFastestWin(
                            globalStats.totals.fastestWinSeconds != null
                              ? Math.round(globalStats.totals.fastestWinSeconds)
                              : null,
                          )
                        : undefined
                    }
                    subtitle={fastestWinSubtitle}
                    icon={Zap}
                  />
                  <StatCard
                    title="Smallest Turncount"
                    value={smallestTurncountValue}
                    secondaryValue={
                      showGlobalComparison && globalStats?.totals.smallestTurncountWin != null
                        ? Math.round(globalStats.totals.smallestTurncountWin)
                        : undefined
                    }
                    subtitle={smallestTurncountSubtitle}
                    icon={Timer}
                  />
                </div>
                <LevelAtDeathChart
                  morgues={morgues}
                  loading={statsLoading}
                  globalAverageDeathsPerLevel={showGlobalComparison ? (globalLevelDeathAverages ?? undefined) : undefined}
                  globalAverageUserCount={showGlobalComparison ? globalLevelDeathUserCount ?? undefined : undefined}
                />
                <MilestoneProgressionChart
                  morgues={morgues}
                  loading={statsLoading}
                  globalLair5ReachRate={
                    showGlobalComparison && globalStats ? globalStats.totals.lair5ReachRate : undefined
                  }
                />
                <PerformanceAndRunesLayout
                  stats={stats}
                  statsLoading={statsLoading}
                  morgues={morgues}
                  showGlobalAverages={showGlobalComparison}
                  globalStats={globalStats}
                />
                <AverageLevelByGodChart morgues={morgues} />
                </>
              )}
            </div>
            {!morguesLoading && (
              <>
                <DcssChargenSelectionGrid morgues={morgues} />
                {morgues.length > 0 && <SpeciesBackgroundComboGrid morgues={morgues} />}
              </>
            )}
          </>
        )}

        {activeTab === "skills" && (
          <div className="space-y-6">
            {isEmpty ? (
              <AnalysisEmptyState morguesPageHref={morguesPageHref} />
            ) : statsLoading ? (
              <AnalysisLoadingState />
            ) : (
              <>
                {!isEmpty && (
                  <TotalTimeSpentAtEachLevelChart morgues={morgues} loading={false} />
                )}
                {isAdmin && (
                  <>
                    <div
                      className="flex items-center gap-4 py-2"
                      role="separator"
                      aria-label="Admin only charts"
                    >
                      <div className="h-px flex-1 bg-primary/30" />
                      <span className="shrink-0 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Admin Only
                      </span>
                      <div className="h-px flex-1 bg-primary/30" />
                    </div>
                    <SkillingAnalysis globalOnly />
                  </>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "achievements" && (
          <div className="space-y-6">
            <GoalProgress stats={statsData} morgues={morgues} loading={statsLoading} />
          </div>
        )}

        {activeTab === "morgues" && (
          <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2 pb-2">
            <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-3">
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <span>Version range:</span>
                <Select value={versionStart} onValueChange={setVersionStart}>
                  <SelectTrigger className="h-8 w-24 rounded-none border-2 border-primary/40 bg-background px-2 font-mono text-xs">
                    <SelectValue aria-label="Start version" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2 border-primary/40">
                    <SelectItem value="0.32" className="font-mono text-sm">
                      0.32
                    </SelectItem>
                    <SelectItem value="0.33" className="font-mono text-sm">
                      0.33
                    </SelectItem>
                    <SelectItem value="0.34" className="font-mono text-sm">
                      0.34
                    </SelectItem>
                  </SelectContent>
                </Select>
                <span>to</span>
                <Select value={versionEnd} onValueChange={setVersionEnd}>
                  <SelectTrigger className="h-8 w-24 rounded-none border-2 border-primary/40 bg-background px-2 font-mono text-xs">
                    <SelectValue aria-label="End version" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-2 border-primary/40">
                    <SelectItem value="0.32" className="font-mono text-sm">
                      0.32
                    </SelectItem>
                    <SelectItem value="0.33" className="font-mono text-sm">
                      0.33
                    </SelectItem>
                    <SelectItem value="0.34" className="font-mono text-sm">
                      0.34
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3">
              <UploadsTable
                morgues={filteredMorguesByVersion}
                loading={morguesLoading}
                onRefresh={loadData}
                usernameSlug={morguePublicSlug}
                fillViewportHeight
                readOnly={isBrowsingOther}
              />
              {!isBrowsingOther && (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pt-1">
                  <Button
                    variant="destructive"
                    className="rounded-none border-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-mono text-xs"
                    onClick={() => setRefreshConfirmOpen(true)}
                    disabled={isRefreshing || isNuking}
                  >
                    {isRefreshing ? "Refreshing…" : "Refresh Morgues"}
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-none border-2 font-mono text-xs"
                    onClick={() => setNukeConfirmOpen(true)}
                    disabled={isNuking || isRefreshing}
                  >
                    {isNuking ? "Nuking…" : "Nuke Morgue"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "extras" && (
          <Extras />
        )}
      </main>

      <OnlineImportDialog
        open={onlineImportOpen}
        onOpenChange={setOnlineImportOpen}
        onImportComplete={loadData}
      />

      <footer
        className={cn(
          "border-t-4 border-primary/30 bg-card",
          activeTab === "morgues" ? "mt-0 shrink-0" : "mt-8",
        )}
      >
        <div className="mx-auto max-w-7xl px-4 py-6">
          <p className="text-center text-sm text-muted-foreground font-mono">
            Snorg.
          </p>
        </div>
      </footer>
    </div>
  )
}

function AnalysisEmptyState({ morguesPageHref }: { morguesPageHref: string | null }) {
  return (
    <div className="rounded-none border-2 border-primary/30 bg-card p-8 text-center">
      <p className="font-mono text-primary mb-2">No morgue data yet</p>
      <p className={typography.bodyMuted}>
        Add some morgues files to start tracking your progress...
      </p>
      {morguesPageHref && (
        <Button
          asChild
          className="mt-6 rounded-none border-2 border-primary bg-background font-mono text-xs text-primary hover:bg-primary/10"
        >
          <Link href={morguesPageHref}>Go to morgue page</Link>
        </Button>
      )}
    </div>
  )
}

function AnalysisLoadingState() {
  return (
    <div className="rounded-none border-2 border-primary/30 bg-card p-8 text-center">
      <div className="h-6 w-6 animate-spin border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
      <p className={typography.bodyMuted}>Loading stats…</p>
    </div>
  )
}
