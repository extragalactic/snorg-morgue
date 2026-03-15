"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/dashboard/navigation"
import { useAuth } from "@/contexts/auth-context"
import { isAdminEmail } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { typography } from "@/lib/typography"

interface ImportEvent {
  id: string
  userId: string
  userEmail: string | null
  eventType: string
  morgueCount: number
  serverAbbreviation: string | null
  dcssUsername: string | null
  createdAt: string
}

interface AdminStats {
  usersWithMorgues: number
  totalParsedMorgues: number
  totalMorgueFiles: number
  totalUserStatsRows: number
  importEvents: ImportEvent[]
  database: {
    sizeBytes: number | null
    limitBytes: number
    limitMb: number
  }
}

function describeImportEvent(e: ImportEvent): string {
  if (e.eventType === "manual_upload") {
    return `Manual upload: ${e.morgueCount} morgue${e.morgueCount !== 1 ? "s" : ""}`
  }
  if (e.eventType === "online_sync" && e.serverAbbreviation) {
    const server = e.serverAbbreviation
    const as = e.dcssUsername ? ` as "${e.dcssUsername}"` : ""
    return `Synced ${server}${as}: ${e.morgueCount} morgue${e.morgueCount !== 1 ? "s" : ""}`
  }
  return `${e.eventType}: ${e.morgueCount} morgues`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return iso
  }
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailSearch, setEmailSearch] = useState("")
  const [serverFilter, setServerFilter] = useState<string>("all")

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/")
      return
    }
    if (!isAdminEmail(user.email)) {
      router.replace("/")
      return
    }
  }, [authLoading, user, router])

  useEffect(() => {
    if (!user || !isAdminEmail(user.email)) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        if (!cancelled) {
          setError("Not signed in")
          setLoading(false)
        }
        return
      }

      try {
        const res = await fetch("/api/admin/stats", {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (!cancelled) setError((body.error as string) || `HTTP ${res.status}`)
          return
        }
        const data = await res.json()
        if (!cancelled) setStats(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load stats")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [user])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-mono inline-flex items-center">
          Loading
          <span className="animate-scan-dots inline-flex ml-0.5">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      </div>
    )
  }

  if (!isAdminEmail(user.email)) {
    router.replace("/")
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-mono">Redirecting…</p>
      </div>
    )
  }

  const dbSize = stats?.database?.sizeBytes ?? 0
  const dbLimit = stats?.database?.limitBytes ?? 500 * 1024 * 1024
  const dbPct = dbLimit > 0 ? Math.min(100, (dbSize / dbLimit) * 100) : 0

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        activeTab=""
        onTabChange={() => {}}
        usernameSlug={undefined}
        adminActive
      />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className={typography.primaryTitle}>ADMIN</h1>
          <p className={typography.bodyMuted}>Site and user stats (restricted to admin)</p>
        </div>

        {error && (
          <Card className="mb-6 border-2 border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-destructive font-mono text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading && !stats && (
          <p className="text-muted-foreground font-mono inline-flex items-center">
            Loading stats
            <span className="animate-scan-dots inline-flex ml-0.5">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </p>
        )}

        {stats && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="rounded-none border-2 border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-muted-foreground">Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-mono font-semibold">{stats.usersWithMorgues}</p>
                </CardContent>
              </Card>
              <Card className="rounded-none border-2 border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-muted-foreground">Parsed morgues</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-mono font-semibold">{stats.totalParsedMorgues.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="rounded-none border-2 border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono text-muted-foreground">Morgue files (raw)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-mono font-semibold">{stats.totalMorgueFiles.toLocaleString()}</p>
                </CardContent>
              </Card>
            </div>

            {/* Database size vs limit */}
            <Card className="rounded-none border-2 border-primary/30">
              <CardHeader>
                <CardTitle className="font-mono">Database storage</CardTitle>
                <CardDescription>
                  Supabase free tier limit: {stats.database.limitMb} MB
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm font-mono">
                  <span>{stats.database.sizeBytes != null ? formatBytes(stats.database.sizeBytes) : "—"}</span>
                  <span>{formatBytes(stats.database.limitBytes)}</span>
                </div>
                <div className="h-4 w-full rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary/70 transition-all"
                    style={{ width: `${dbPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {stats.database.sizeBytes != null
                    ? `${dbPct.toFixed(1)}% of limit used`
                    : "Run the admin_db_size RPC in Supabase to see size."}
                </p>
              </CardContent>
            </Card>

            {/* Import activity summaries */}
            <Card className="rounded-none border-2 border-primary/30">
              <CardHeader>
                <CardTitle className="font-mono">Import activity</CardTitle>
                <CardDescription>
                  Upload and sync events: manual uploads and server syncs by user
                </CardDescription>
              </CardHeader>
              <CardContent>
                {((stats.importEvents ?? []).length) > 0 && (
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Input
                      type="search"
                      placeholder="Search by email"
                      value={emailSearch}
                      onChange={(e) => setEmailSearch(e.target.value)}
                      className="font-mono text-sm max-w-xs rounded-none border-2 border-primary/30"
                    />
                    <Select value={serverFilter} onValueChange={setServerFilter}>
                      <SelectTrigger className="font-mono text-sm w-[180px] rounded-none border-2 border-primary/30">
                        <SelectValue placeholder="Server" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-2 border-primary/30">
                        <SelectItem value="all" className="font-mono text-sm">
                          All servers
                        </SelectItem>
                        {[
                          ...new Set(
                            (stats.importEvents ?? [])
                              .map((e) => e.serverAbbreviation)
                              .filter((s): s is string => s != null && s !== "")
                          ),
                        ]
                          .sort()
                          .map((abbr) => (
                            <SelectItem key={abbr} value={abbr} className="font-mono text-sm">
                              {abbr}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(() => {
                  const events = stats.importEvents ?? []
                  const emailTrim = emailSearch.trim().toLowerCase()
                  const filtered = events.filter((e) => {
                    const matchEmail =
                      !emailTrim ||
                      (e.userEmail?.toLowerCase().includes(emailTrim) ?? false)
                    const matchServer =
                      serverFilter === "all" || e.serverAbbreviation === serverFilter
                    return matchEmail && matchServer
                  })
                  return (
                <Table>
                  <TableHeader>
                    <TableRow className="border-primary/20">
                      <TableHead className="font-mono text-xs">User</TableHead>
                      <TableHead className="font-mono text-xs">Event</TableHead>
                      <TableHead className="font-mono text-xs text-right">Count</TableHead>
                      <TableHead className="font-mono text-xs">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!events.length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground font-mono text-sm">
                          No import events yet. Manual uploads and online syncs will appear here after you run the import_events migration.
                        </TableCell>
                      </TableRow>
                    ) : !filtered.length ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-muted-foreground font-mono text-sm">
                          No events match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((e) => (
                        <TableRow key={e.id} className="border-primary/10">
                          <TableCell className="font-mono text-sm">
                            {e.userEmail ?? (
                              <span className="text-muted-foreground" title={e.userId}>
                                {e.userId.slice(0, 8)}…
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {describeImportEvent(e)}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-right">
                            {e.morgueCount}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {formatDate(e.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                  )
                })()}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
