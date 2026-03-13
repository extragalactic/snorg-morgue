"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { DCSS_SERVERS } from "@/lib/dcss-public-sources"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"

type ServerRow = {
  abbreviation: string
  name: string
}

const PRIMARY_SERVER_ABBR = "CDI"

function getPrimaryServerRow(): ServerRow {
  const server = DCSS_SERVERS.find((s) => s.abbreviation === PRIMARY_SERVER_ABBR)
  if (!server) {
    return { abbreviation: PRIMARY_SERVER_ABBR, name: PRIMARY_SERVER_ABBR }
  }
  return { abbreviation: server.abbreviation, name: server.name }
}

interface OnlineImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful import so callers can refresh data. */
  onImportComplete?: () => void
}

interface ScanServerState {
  status: "idle" | "scanning" | "done" | "error"
  totalGamesFound: number
  totalGamesImported: number
  newGames: number
  errorMessage: string | null
}

const initialServerState: ScanServerState = {
  status: "idle",
  totalGamesFound: 0,
  totalGamesImported: 0,
  newGames: 0,
  errorMessage: null,
}

interface ImportSummary {
  lastRequested: number
  lastImported: number
  lastDuplicates: number
  lastErrors: number
}

export function OnlineImportDialog({ open, onOpenChange, onImportComplete }: OnlineImportDialogProps) {
  const { userId } = useAuth()
  const [dcssUsername, setDcssUsername] = useState("particleface")
  const [maxGames, setMaxGames] = useState<string>("3")
  const [serverState, setServerState] = useState<ScanServerState>(initialServerState)
  const [isScanning, setIsScanning] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [lastScanUsername, setLastScanUsername] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  const serverRow = getPrimaryServerRow()
  const hasScan = serverState.status === "done" || serverState.status === "error"
  const canScan = !!userId && dcssUsername.trim().length > 0 && !isScanning && !isImporting
  const canImport =
    !!userId &&
    hasScan &&
    serverState.newGames > 0 &&
    !isImporting &&
    !isScanning &&
    lastScanUsername === dcssUsername.trim()

  const handleClose = () => {
    if (isScanning || isImporting) return
    setImportSummary(null)
    onOpenChange(false)
  }

  const handleScan = async () => {
    if (!userId || !canScan) return
    const username = dcssUsername.trim()

    setIsScanning(true)
    setServerState({ ...initialServerState, status: "scanning" })

    try {
      const res = await fetch("/api/online-import/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          dcssUsername: username,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data.error as string) ?? `Scan failed with status ${res.status}`)
      }
      const data = (await res.json()) as {
        servers: {
          serverAbbreviation: string
          status: "ok" | "skipped" | "error"
          totalGamesFound: number
          totalGamesImported: number
          newGames: number
          errorMessage: string | null
        }[]
      }
      const primary = data.servers[0]
      if (!primary) {
        setServerState({
          status: "error",
          totalGamesFound: 0,
          totalGamesImported: 0,
          newGames: 0,
          errorMessage: "No server data returned.",
        })
      } else {
        setServerState({
          status: primary.status === "error" ? "error" : "done",
          totalGamesFound: primary.totalGamesFound,
          totalGamesImported: primary.totalGamesImported,
          newGames: primary.newGames,
          errorMessage: primary.errorMessage,
        })
        setLastScanUsername(username)
      }
    } catch (e) {
      setServerState({
        status: "error",
        totalGamesFound: 0,
        totalGamesImported: 0,
        newGames: 0,
        errorMessage: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setIsScanning(false)
    }
  }

  const handleImport = async () => {
    if (!userId || !canImport) return
    const username = dcssUsername.trim()
    const max = Number.parseInt(maxGames, 10)
    const maxNewGamesPerServer = Number.isFinite(max) && max > 0 ? max : 3

    setIsImporting(true)
    // Seed summary so we can show the target count while the import runs.
    setImportSummary({
      lastRequested: maxNewGamesPerServer,
      lastImported: 0,
      lastDuplicates: 0,
      lastErrors: 0,
    })
    try {
      const res = await fetch("/api/online-import/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          dcssUsername: username,
          maxNewGamesPerServer,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data.error as string) ?? `Import failed with status ${res.status}`)
      }
      const data = (await res.json()) as {
        summary: { totalNewGamesImported: number; totalDuplicatesSkipped: number }
        servers: { errors: string[] }[]
      }

      const imported = data.summary.totalNewGamesImported
      const dupes = data.summary.totalDuplicatesSkipped
      const primaryErrors = data.servers?.[0]?.errors ?? []

      toast({
        title: "Online import complete",
        description:
          imported === 0 && dupes === 0
            ? "No new games were imported. All games are already in Snorg."
            : `${imported} new game${imported === 1 ? "" : "s"} imported, ${dupes} duplicate${dupes === 1 ? "" : "s"} skipped.`,
      })

      if (primaryErrors.length > 0) {
        // Log extra detail to console so we don't overwhelm the toast.
        console.error("[snorg-morgue] Online import errors:", primaryErrors)
      }

      // After a successful import, consider the "newGames" count consumed by the number of imported games.
      setServerState((prev) => ({
        ...prev,
        newGames: Math.max(0, prev.newGames - imported),
      }))

      setImportSummary({
        lastRequested: maxNewGamesPerServer,
        lastImported: imported,
        lastDuplicates: dupes,
        lastErrors: primaryErrors.length,
      })

      onImportComplete?.()
    } catch (e) {
      toast({
        title: "Online import failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl rounded-none border-2 border-primary/30">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm text-primary">Online Import (Stage 1)</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Manually scan and import games from a DCSS online server into Snorg. For now this is limited to a single server
            and small test imports.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {importSummary && (
            <div className="rounded-none border-2 border-primary/50 bg-primary/5 px-3 py-2">
              <div className="text-center mb-2">
                {isImporting ? (
                  <p className="font-mono text-sm text-primary">
                    Importing up to {importSummary.lastRequested} game{importSummary.lastRequested === 1 ? "" : "s"}…
                  </p>
                ) : (
                  <p className="font-mono text-sm text-primary">
                    Imported {importSummary.lastImported} of {importSummary.lastRequested} games
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Duplicates skipped: {importSummary.lastDuplicates} · Errors: {importSummary.lastErrors}
                </p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-none border border-primary/40 bg-background">
                {isImporting ? (
                  <div className="h-full w-1/3 bg-primary/60 animate-[pulse_1s_ease-in-out_infinite]" />
                ) : (
                  <div
                    className="h-full bg-primary/70 transition-all"
                    style={{
                      width:
                        importSummary.lastRequested > 0
                          ? `${Math.min(100, Math.round((importSummary.lastImported / importSummary.lastRequested) * 100))}%`
                          : "0%",
                    }}
                  />
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-mono text-primary">
              DCSS username (testing field, not yet linked to Snorg account)
            </label>
            <Input
              value={dcssUsername}
              onChange={(e) => setDcssUsername(e.target.value)}
              placeholder="Exact DCSS account name (case-insensitive)"
              className="rounded-none border-2 border-primary/50 font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono text-primary">
              Max games to import per server (for testing)
            </label>
            <Input
              type="number"
              min={1}
              max={200}
              value={maxGames}
              onChange={(e) => setMaxGames(e.target.value)}
              className="w-24 rounded-none border-2 border-primary/50 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              The initial scan will count all matching games. This limit only caps how many new games are imported per run so tests stay fast.
            </p>
          </div>

          <Card className="border-2 border-primary/30 rounded-none p-3">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-primary">{serverRow.name}</span>
              <span className="text-muted-foreground">{serverRow.abbreviation}</span>
            </div>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <p>
                Status:{" "}
                {serverState.status === "idle" && "Not scanned yet"}
                {serverState.status === "scanning" && "Scanning…"}
                {serverState.status === "done" && "Scan complete"}
                {serverState.status === "error" && "Error"}
              </p>
              {serverState.status !== "idle" && (
                <p>
                  Games found:{" "}
                  <span className="font-mono">
                    {serverState.totalGamesFound}{" "}
                    {serverState.totalGamesFound > 0 ? `(new: ${serverState.newGames})` : ""}
                  </span>
                </p>
              )}
              {serverState.errorMessage && (
                <p className="text-red-500">
                  {serverState.errorMessage}
                </p>
              )}
            </div>
          </Card>

          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-none border-2 border-primary/60 font-mono text-xs"
              onClick={handleScan}
              disabled={!canScan}
            >
              {isScanning ? "Scanning…" : hasScan ? "Refresh" : "Scan"}
            </Button>
            <Button
              type="button"
              className="rounded-none border-2 border-primary bg-primary text-primary-foreground font-mono text-xs"
              onClick={handleImport}
              disabled={!canImport}
            >
              {isImporting ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

