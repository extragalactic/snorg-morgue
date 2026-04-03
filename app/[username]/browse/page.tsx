"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Navigation } from "@/components/dashboard/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useBrowse } from "@/contexts/browse-context"
import { useTheme } from "@/contexts/theme-context"
import { supabase } from "@/lib/supabase"
import type { BrowseUserListItem } from "@/app/api/browse/users/route"
import { slugifyUsername, TAB_TO_PAGE } from "@/lib/slug"
import { typography, TITLE_GRAPHIC_SIZE_LARGE } from "@/lib/typography"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Image from "next/image"
import { cn } from "@/lib/utils"

export default function BrowsePage() {
  const params = useParams()
  const router = useRouter()
  const username = params?.username as string
  const { user, userId } = useAuth()
  const { browseTarget, setBrowseTarget, clearBrowseTarget } = useBrowse()
  const { themeStyle } = useTheme()
  const [profiles, setProfiles] = useState<BrowseUserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>("")
  /** Controlled so we can close before router.push; otherwise Radix can leave outside pointer-events disabled. */
  const [playerSelectOpen, setPlayerSelectOpen] = useState(false)

  const slugFromUser = user?.name ? slugifyUsername(user.name) : null

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        setError("Not signed in")
        setProfiles([])
        return
      }
      const res = await fetch("/api/browse/users", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError((body.error as string) || `HTTP ${res.status}`)
        setProfiles([])
        return
      }
      const payload = await res.json()
      setProfiles((payload.users ?? []) as BrowseUserListItem[])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users")
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  const pushAfterSelectReleased = useCallback(
    (path: string) => {
      setPlayerSelectOpen(false)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          router.push(path)
        })
      })
    },
    [router],
  )

  const handleView = () => {
    if (!selectedId || !slugFromUser) return
    const row = profiles.find((p) => p.id === selectedId)
    if (!row) return
    setBrowseTarget({ userId: row.id, usernameSlug: row.usernameSlug })
    pushAfterSelectReleased(`/${slugFromUser}/${TAB_TO_PAGE.analysis}`)
  }

  const handleReturn = () => {
    clearBrowseTarget()
    if (slugFromUser) {
      pushAfterSelectReleased(`/${slugFromUser}/${TAB_TO_PAGE.analysis}`)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation activeTab="" onTabChange={() => {}} usernameSlug={slugFromUser ?? username} />

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
              onClick={handleReturn}
            >
              Return to your data
            </Button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Image
            src="/images/book-icon.png"
            alt=""
            width={TITLE_GRAPHIC_SIZE_LARGE}
            height={TITLE_GRAPHIC_SIZE_LARGE}
            className="object-contain shrink-0"
            style={{ width: TITLE_GRAPHIC_SIZE_LARGE, height: TITLE_GRAPHIC_SIZE_LARGE }}
          />
          <div className="min-w-0">
            <h1 className={typography.primaryTitle}>BROWSE PLAYERS</h1>
            <p className={typography.bodyMuted}>View another player&apos;s Snorg dashboard</p>
          </div>
        </div>

        <Card className="border-2 border-primary/30 rounded-none">
          <CardHeader className="border-b-2 border-primary/20 pb-3">
            <CardTitle>All players</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {error && <p className="text-destructive font-mono text-sm">{error}</p>}
            {loading ? (
              <p className="text-muted-foreground font-mono text-sm">Loading…</p>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="space-y-2 flex-1 min-w-[200px]">
                    <label className="font-mono text-xs text-muted-foreground">Select user</label>
                    <Select
                      open={playerSelectOpen}
                      onOpenChange={setPlayerSelectOpen}
                      value={selectedId}
                      onValueChange={setSelectedId}
                    >
                      <SelectTrigger className="rounded-none border-2 border-primary/50 font-mono text-sm">
                        <SelectValue placeholder="Choose a player…" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-2 border-primary/50 max-h-72">
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id} className="font-mono text-sm">
                            {p.usernameSlug}
                            {p.id === userId ? " (you)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    className="rounded-none border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-sm"
                    disabled={!selectedId}
                    onClick={handleView}
                  >
                    View
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  Opens their analytics, achievements, morgues, and skills in read-only mode (no uploads while viewing).
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
