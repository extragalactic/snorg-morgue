"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MorgueBrowser } from "@/components/dashboard/morgue-browser"
import { useAuth } from "@/contexts/auth-context"
import { slugifyUsername } from "@/lib/slug"
import { supabase } from "@/lib/supabase"
import { fetchMorgueById } from "@/lib/morgue-api"
import type { GameRecord } from "@/lib/morgue-api"

export default function PublicMorguePage() {
  const params = useParams()
  const router = useRouter()
  const { user, userId } = useAuth()
  const username = params?.username as string
  const morgueId = params?.morgueId as string

  const [data, setData] = useState<{
    gameRecord: GameRecord
    rawText: string
    filename: string
    ownerSlug: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!morgueId?.trim()) return
    let cancelled = false
    const slug = user ? slugifyUsername(user.name) : ""

    async function load() {
      if (userId && slug === username) {
        const gameRecord = await fetchMorgueById(supabase, morgueId)
        if (cancelled) return
        if (gameRecord) {
          router.replace(`/${username}/morgues?view=${encodeURIComponent(morgueId)}`)
          return
        }
      }
      const res = await fetch(`/api/morgues/${encodeURIComponent(morgueId.trim())}`)
      if (cancelled) return
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          (body.error as string) || (body.message as string) || (res.status === 404 ? "Morgue not found" : res.status === 503 ? "Public morgue links are not configured." : "Failed to load")
        )
      }
      if (cancelled) return
      if (body.ownerSlug !== username) {
        router.replace(`/${body.ownerSlug}/morgues/${morgueId}`)
        return
      }
      setData({
        gameRecord: body.gameRecord,
        rawText: body.rawText,
        filename: body.filename || "",
        ownerSlug: body.ownerSlug,
      })
    }

    load().catch((e) => {
      if (!cancelled) setError(e.message || "Failed to load morgue")
    })
    return () => { cancelled = true }
  }, [morgueId, username, userId, user, router])

  const isOwner = !!user && slugifyUsername(user.name) === username

  // Lock document scroll so only the morgue content div scrolls (and shows the custom scrollbar).
  useEffect(() => {
    if (!data) return
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.body.style.overflow = prevBody
    }
  }, [data])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-destructive font-mono">{error}</p>
        <a href="/" className="text-primary underline text-sm">Go home</a>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-mono">Loading…</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden px-4 py-6">
        <MorgueBrowser
          game={data.gameRecord}
          onBack={() => router.push(`/${username}/morgues`)}
          hideBackButton={!isOwner}
          showDownloadButton={isOwner}
          initialRawText={data.rawText}
          initialFilename={data.filename}
          fillHeight
          sharePath={isOwner && username && morgueId ? `/${username}/morgues/${morgueId}` : undefined}
        />
      </main>
    </div>
  )
}
