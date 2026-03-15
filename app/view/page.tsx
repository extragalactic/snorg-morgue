"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { MorgueBrowser } from "@/components/dashboard/morgue-browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { isAllowedMorgueUrl } from "@/lib/morgue-url-allowlist"
import type { GameRecord } from "@/lib/morgue-api"
import { typography } from "@/lib/typography"

/** Minimal GameRecord for URL-only viewing (no DB). */
function gameRecordFromUrl(morgueUrl: string): GameRecord {
  return {
    id: "url-view",
    shortId: "url-view",
    morgueUrl,
    character: "—",
    species: "—",
    background: "—",
    xl: 0,
    place: "—",
    turns: 0,
    duration: "—",
    date: "—",
    result: "death",
    runes: 0,
  }
}

export default function MorgueViewerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlParam = searchParams?.get("url")?.trim() ?? ""

  const [inputUrl, setInputUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (urlParam) {
      setInputUrl(urlParam)
      if (!isAllowedMorgueUrl(urlParam)) {
        setError("This URL is not from an allowed DCSS server. Use a morgue link from crawl.dcss.io, crawl.akrasiac.org, or other supported servers.")
      }
    }
  }, [urlParam])

  const urlAllowed = !!urlParam && isAllowedMorgueUrl(urlParam)
  const showViewer = urlAllowed
  const showForm = !showViewer

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const raw = inputUrl.trim()
    if (!raw) {
      setError("Enter a morgue URL.")
      return
    }
    setError(null)
    try {
      new URL(raw)
    } catch {
      setError("Enter a valid URL.")
      return
    }
    if (!isAllowedMorgueUrl(raw)) {
      setError("This URL is not from an allowed DCSS server. Use a morgue link from crawl.dcss.io, crawl.akrasiac.org, or other supported servers.")
      return
    }
    router.push(`/view?url=${encodeURIComponent(raw)}`)
  }

  const handleBack = () => {
    router.push("/view")
  }

  if (showViewer) {
    const game = gameRecordFromUrl(urlParam)
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden px-4 pt-[14px] pb-6">
          <MorgueBrowser
            game={game}
            onBack={handleBack}
            hideBackButton={false}
            showDownloadButton={false}
            backButtonLabel="Back"
            fillHeight
            hideResultBadge
            hideLevelTitle
            useParsedHeaderFromRaw
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        <h1 className={cn(typography.primaryTitle, "text-center")}>
          DCSS Morgue Viewer
        </h1>
        <p className="text-center text-sm text-muted-foreground font-mono">
          Paste a URL to a morgue file on a DCSS game server.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="url"
            placeholder=""
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value)
              setError(null)
            }}
            className="rounded-none border-2 border-primary/50 font-mono text-sm"
            aria-label="Morgue URL"
          />
          {error && (
            <p className="text-sm text-destructive font-mono" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="w-full rounded-none border-2 border-primary font-mono"
          >
            View Morgue
          </Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="underline hover:text-primary">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
