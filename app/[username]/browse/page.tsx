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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import { cn } from "@/lib/utils"

export default function BrowsePage() {
  const params = useParams()
  const router = useRouter()
  const username = params?.username as string
  const { user } = useAuth()
  const { browseTarget, setBrowseTarget, clearBrowseTarget } = useBrowse()
  const { themeStyle } = useTheme()
  const [profiles, setProfiles] = useState<BrowseUserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const openPlayer = useCallback(
    (row: BrowseUserListItem) => {
      if (!slugFromUser) return
      setBrowseTarget({ userId: row.id, usernameSlug: row.usernameSlug })
      router.push(`/${slugFromUser}/${TAB_TO_PAGE.analysis}`)
    },
    [router, setBrowseTarget, slugFromUser],
  )

  const handleReturn = () => {
    clearBrowseTarget()
    if (slugFromUser) {
      router.push(`/${slugFromUser}/${TAB_TO_PAGE.analysis}`)
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
            <p className={typography.primaryPageSubtitle}>View another player&apos;s Snorg dashboard</p>
          </div>
        </div>

        <Card className="border-2 border-primary/30 rounded-none">
          <CardHeader className="border-b-2 border-primary/20 pb-3">
            <CardTitle>
              {loading
                ? "All players"
                : `All ${profiles.length} ${profiles.length === 1 ? "player" : "players"}`}
            </CardTitle>
            <CardDescription className="pt-2">(with number of wins)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {error && <p className="text-destructive font-mono text-sm">{error}</p>}
            {loading ? (
              <p className="text-muted-foreground font-mono text-sm">Loading…</p>
            ) : profiles.length === 0 ? (
              <p className="text-muted-foreground font-mono text-sm">No players to show.</p>
            ) : (
              <>
                <ul
                  className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                  role="list"
                >
                  {profiles.map((p) => (
                    <li key={p.id} className="min-w-0">
                      <button
                        type="button"
                        disabled={!slugFromUser}
                        onClick={() => openPlayer(p)}
                        className={cn(
                          "w-full rounded-none border-2 border-primary/25 bg-card px-3 py-2 text-left font-mono text-sm transition-colors",
                          "hover:border-primary/60 hover:bg-primary/5",
                          "disabled:pointer-events-none disabled:opacity-50",
                        )}
                      >
                        <span className="break-words text-foreground">
                          {p.usernameSlug}{" "}
                          <span className="whitespace-nowrap text-muted-foreground">
                            ({p.totalWins})
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground font-mono">
                  Click a player to view their analytics, achievements and morgues in read-only mode.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
