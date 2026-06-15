"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { colors } from "@/lib/colors"
import { MorgueBrowser } from "./morgue-browser"
import type { GameRecord } from "@/lib/morgue-api"

/**
 * Reusable modal that renders the full morgue viewer for a single game.
 * Can be opened from any page (Stats, Morgues, etc.) without navigating away.
 */
export function MorgueViewerModal({
  game,
  onClose,
  usernameSlug,
  actionAveragesUserId,
  backLabel = "Close",
}: {
  /** Game to display; when null the modal is closed. */
  game: GameRecord | null
  onClose: () => void
  /** Used to build the shareable URL (/usernameSlug/morgues/shortId). */
  usernameSlug?: string
  actionAveragesUserId?: string | null
  /** Label for the top-left back/close button. */
  backLabel?: string
}) {
  if (!game) return null

  const sharePath = usernameSlug ? `/${usernameSlug}/morgues/${game.shortId || game.id}` : undefined

  return (
    <Dialog
      open={!!game}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="morgue-detail-modal fixed left-1/2 top-5 bottom-5 m-0 flex h-[calc(100vh-40px)] w-[min(2400px,calc(100vw-100px))] max-w-none sm:max-w-none -translate-x-1/2 translate-y-0 flex-col gap-0 rounded-none border-2 border-primary/30 p-0"
      >
        <DialogHeader className="flex shrink-0 flex-row items-center gap-2 border-b-2 border-primary/20 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-2 rounded-none font-mono text-sm", colors.inputBorder, colors.highlightHover)}
            onClick={onClose}
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
          <DialogTitle className="sr-only">Morgue details</DialogTitle>
        </DialogHeader>
        <div className="morgue-modal-scroll flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          <MorgueBrowser
            game={game}
            onBack={onClose}
            hideBackButton
            showDownloadButton
            fillHeight
            sharePath={sharePath}
            actionAveragesUserId={actionAveragesUserId}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
