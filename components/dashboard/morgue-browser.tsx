"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { fetchRawMorgue } from "@/lib/morgue-api"
import type { GameRecord } from "@/lib/morgue-api"

interface MorgueBrowserProps {
  game: GameRecord
  onBack: () => void
  /** When true, hide the "Back to Morgues" button (e.g. when used inside a modal that has its own back button). */
  hideBackButton?: boolean
  /** When true, fill available vertical space (e.g. in modal) instead of fixed height. */
  fillHeight?: boolean
}

export function MorgueBrowser({ game, onBack, hideBackButton, fillHeight }: MorgueBrowserProps) {
  const [rawText, setRawText] = useState<string | null>(null)
  const [filename, setFilename] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const data = await fetchRawMorgue(supabase, game.morgueFileId)
      if (cancelled) return
      if (data) {
        setRawText(data.raw_text)
        setFilename(data.filename)
      } else {
        setError("Could not load morgue file.")
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [game.morgueFileId])

  const handleDownload = () => {
    if (!rawText) return
    const blob = new Blob([rawText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename || `morgue-${game.character}-${game.date}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {!hideBackButton && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 rounded-none border-2 border-primary/50 hover:border-primary hover:bg-primary/10"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Morgues
            </Button>
          )}
          <div>
            <h2 className="font-mono text-lg text-primary">{game.character}</h2>
            <p className="text-sm text-muted-foreground">
              {game.species} {game.background} — {game.date}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              game.result === "win"
                ? "rounded-none bg-green-500/20 text-green-400 border border-green-500/50"
                : "rounded-none bg-red-500/20 text-red-400 border border-red-500/50"
            }
          >
            {game.result === "win" ? "Victory" : "Death"} — XL {game.xl}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-none border-2 border-primary/50"
            onClick={handleDownload}
            disabled={!rawText}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        </div>
      </div>

      <Card className={fillHeight ? "flex min-h-0 flex-1 flex-col border-2 border-primary/30 rounded-none" : "border-2 border-primary/30 rounded-none"}>
        <CardHeader className="flex-shrink-0 border-b-2 border-primary/20 py-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-primary">MORGUE FILE</p>
            {filename && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{filename}</p>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          <div className={fillHeight ? "min-h-0 flex-1 overflow-y-auto bg-background morgue-modal-scroll" : "h-[550px] overflow-y-auto bg-background"}>
            {loading && (
              <div className="p-8 flex items-center justify-center text-muted-foreground text-sm">
                <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent rounded-full mr-2" />
                Loading…
              </div>
            )}
            {error && (
              <div className="p-8 text-center text-destructive text-sm">{error}</div>
            )}
            {rawText && !loading && (
              <pre className="p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
                {rawText}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
