"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
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
import { typography, TITLE_GRAPHIC_SIZE_LARGE } from "@/lib/typography"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

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
  totalAuthUsers: number
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

interface AdminUser {
  id: string
  email: string | null
  createdAt: string
  lastSignInAt: string | null
  morgueCount: number
  uploadCount: number
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
  const [importPage, setImportPage] = useState(1)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersFetched, setUsersFetched] = useState(false)
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [usersPage, setUsersPage] = useState(1)
  const [usersSortKey, setUsersSortKey] = useState<"email" | "id" | "morgues" | "uploads" | "created" | "lastSignIn">("created")
  /** false = descending (e.g. newest Created first) */
  const [usersSortAsc, setUsersSortAsc] = useState(false)

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

  const fetchUsers = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    setUsersLoading(true)
    setUsersError(null)
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setUsersError((body.error as string) || `HTTP ${res.status}`)
        return
      }
      const data = await res.json()
      setUsers(data.users ?? [])
      setUsersFetched(true)
    } catch (e) {
      setUsersError(e instanceof Error ? e.message : "Failed to load users")
    } finally {
      setUsersLoading(false)
    }
  }, [])

  const handleUsersTabSelect = useCallback(() => {
    if (users.length === 0 && !usersLoading && !usersError) {
      fetchUsers()
    }
  }, [users.length, usersLoading, usersError, fetchUsers])

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
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/images/meow-icon.png"
            alt=""
            width={TITLE_GRAPHIC_SIZE_LARGE}
            height={TITLE_GRAPHIC_SIZE_LARGE}
            className="object-contain shrink-0"
            style={{ width: TITLE_GRAPHIC_SIZE_LARGE, height: TITLE_GRAPHIC_SIZE_LARGE }}
          />
          <div className="min-w-0">
            <h1 className={typography.primaryTitle}>ADMIN</h1>
            <p className={typography.bodyMuted}>Site and user stats</p>
          </div>
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
          <Tabs
            defaultValue="overview"
            className="space-y-6"
            onValueChange={(v) => v === "users" && handleUsersTabSelect()}
          >
            <TabsList className="w-full sm:w-auto rounded-none border-b-2 border-primary/20 bg-transparent p-0 gap-0">
              <TabsTrigger
                value="overview"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-mono text-sm px-4 pb-2 -mb-0.5"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-mono text-sm px-4 pb-2 -mb-0.5"
              >
                Users{` (${usersFetched ? users.length : stats.totalAuthUsers})`}
              </TabsTrigger>
              <TabsTrigger
                value="import-summary"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent font-mono text-sm px-4 pb-2 -mb-0.5"
              >
                Import Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="m-0 space-y-6">
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
            </TabsContent>

            <TabsContent value="users" className="m-0">
            <Card className="rounded-none border-2 border-primary/30">
              <CardHeader>
                <CardTitle className="font-mono">Users</CardTitle>
              </CardHeader>
              <CardContent>
                {usersError && (
                  <p className="text-destructive font-mono text-sm mb-4">{usersError}</p>
                )}
                {usersLoading && (
                  <p className="text-muted-foreground font-mono text-sm inline-flex">
                    Loading users
                    <span className="animate-scan-dots inline-flex ml-0.5">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </p>
                )}
                {!usersLoading && !usersError && (
                  (() => {
                    const pageSize = 20
                    const sortUsers = (a: AdminUser, b: AdminUser): number => {
                      let cmp = 0
                      switch (usersSortKey) {
                        case "email":
                          cmp = (a.email ?? "").localeCompare(b.email ?? "")
                          break
                        case "id":
                          cmp = a.id.localeCompare(b.id)
                          break
                        case "morgues":
                          cmp = a.morgueCount - b.morgueCount
                          break
                        case "uploads":
                          cmp = a.uploadCount - b.uploadCount
                          break
                        case "created":
                          cmp = (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
                          break
                        case "lastSignIn":
                          cmp = (a.lastSignInAt ?? "").localeCompare(b.lastSignInAt ?? "")
                          break
                      }
                      return usersSortAsc ? cmp : -cmp
                    }
                    const sortedUsers = [...users].sort(sortUsers)
                    const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize))
                    const currentPage = Math.min(usersPage, totalPages)
                    const start = (currentPage - 1) * pageSize
                    const pageUsers = sortedUsers.slice(start, start + pageSize)

                    const SortableTh = ({
                      label,
                      sortKey,
                      alignRight,
                    }: { label: string; sortKey: typeof usersSortKey; alignRight?: boolean }) => {
                      const isActive = usersSortKey === sortKey
                      return (
                        <TableHead
                          className={cn(
                            "font-mono text-xs cursor-pointer hover:text-primary transition-colors select-none",
                            alignRight && "text-right"
                          )}
                          onClick={() => {
                            setUsersSortKey(sortKey)
                            setUsersSortAsc(isActive ? !usersSortAsc : true)
                            setUsersPage(1)
                          }}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            {label}
                            {isActive
                              ? usersSortAsc
                                ? <ChevronUp className="h-3 w-3" />
                                : <ChevronDown className="h-3 w-3" />
                              : null}
                          </span>
                        </TableHead>
                      )
                    }

                    return (
                      <>
                        <Table>
                          <TableHeader>
                            <TableRow className="border-primary/20">
                              <SortableTh label="Email" sortKey="email" />
                              <SortableTh label="User ID" sortKey="id" />
                              <SortableTh label="Morgues" sortKey="morgues" alignRight />
                              <SortableTh label="Uploads" sortKey="uploads" alignRight />
                              <SortableTh label="Created" sortKey="created" />
                              <SortableTh label="Last sign in" sortKey="lastSignIn" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pageUsers.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-muted-foreground font-mono text-sm">
                                  No users found.
                                </TableCell>
                              </TableRow>
                            ) : (
                              pageUsers.map((u) => (
                                <TableRow key={u.id} className="border-primary/10">
                                  <TableCell className="font-mono text-sm">
                                    {u.email ?? <span className="text-muted-foreground">—</span>}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground" title={u.id}>
                                    {u.id.slice(0, 8)}…
                                  </TableCell>
                                  <TableCell className="font-mono text-sm text-right">
                                    {u.morgueCount.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm text-right">
                                    {(u.uploadCount ?? 0).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">
                                    {u.createdAt ? formatDate(u.createdAt) : "—"}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-muted-foreground">
                                    {u.lastSignInAt ? formatDate(u.lastSignInAt) : "—"}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                        {sortedUsers.length > pageSize && (
                          <div className="mt-3 flex items-center justify-between">
                            <span className="font-mono text-xs text-muted-foreground">
                              Showing {start + 1}–{Math.min(start + pageSize, sortedUsers.length)} of {sortedUsers.length}
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-none border-2 border-primary/40 font-mono text-xs"
                                disabled={currentPage === 1}
                                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                              >
                                Prev
                              </Button>
                              <span className="font-mono text-xs text-muted-foreground">
                                {currentPage} / {totalPages}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-none border-2 border-primary/40 font-mono text-xs"
                                disabled={currentPage === totalPages}
                                onClick={() => setUsersPage((p) => Math.min(totalPages, p + 1))}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()
                )}
              </CardContent>
            </Card>
            </TabsContent>

            <TabsContent value="import-summary" className="m-0">
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
                          All
                        </SelectItem>
                        <SelectItem value="uploads" className="font-mono text-sm">
                          Uploads
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
                      serverFilter === "all"
                        ? true
                        : serverFilter === "uploads"
                          ? e.eventType === "manual_upload"
                          : e.serverAbbreviation === serverFilter
                    return matchEmail && matchServer
                  })
                  const pageSize = 15
                  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
                  const currentPage = Math.min(importPage, totalPages)
                  const start = (currentPage - 1) * pageSize
                  const pageItems = filtered.slice(start, start + pageSize)
                  return (
                <>
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
                        pageItems.map((e) => (
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
                  {filtered.length > pageSize && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">
                        Showing {start + 1}–{Math.min(start + pageSize, filtered.length)} of {filtered.length}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none border-2 border-primary/40 font-mono text-xs"
                          disabled={currentPage === 1}
                          onClick={() => setImportPage((p) => Math.max(1, p - 1))}
                        >
                          Prev
                        </Button>
                        <span className="font-mono text-xs text-muted-foreground">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-none border-2 border-primary/40 font-mono text-xs"
                          disabled={currentPage === totalPages}
                          onClick={() => setImportPage((p) => Math.min(totalPages, p + 1))}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
                  )
                })()}
              </CardContent>
            </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  )
}
