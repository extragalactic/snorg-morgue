 "use client"
 
 import { useState, useRef, useEffect } from "react"
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
 import { Checkbox } from "@/components/ui/checkbox"
 import { DCSS_SERVERS } from "@/lib/dcss-public-sources"
 import { useAuth } from "@/contexts/auth-context"
 import { toast } from "@/hooks/use-toast"
 
 type ServerRow = {
   abbreviation: string
   name: string
   country?: string
   gameCount?: number
   userCount?: number
   isDormant?: boolean
 }

interface OnlineImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful import so callers can refresh data. */
  onImportComplete?: () => void
}

interface ScanServerState {
  status: "idle" | "scanning" | "done" | "error" | "skipped"
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

interface UiServerState extends ServerRow {
  checked: boolean
  scan: ScanServerState
}

const STORAGE_KEY_SELECTED_SERVERS = "snorg-online-import-selected-servers"
const SCAN_TIMEOUT_MS = 60_000
const IMPORT_TIMEOUT_MS = 120_000

function loadSelectedServerAbbreviations(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SELECTED_SERVERS)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set((arr as string[]).filter((s) => typeof s === "string"))
  } catch {
    return new Set()
  }
}

function saveSelectedServerAbbreviations(abbreviations: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SELECTED_SERVERS, JSON.stringify(abbreviations))
  } catch {
    // ignore
  }
}

export function OnlineImportDialog({ open, onOpenChange, onImportComplete }: OnlineImportDialogProps) {
  const { userId } = useAuth()
  const [dcssUsername, setDcssUsername] = useState("particleface")
  const [maxGames, setMaxGames] = useState<string>("3")
  const [servers, setServers] = useState<UiServerState[]>(() => {
    const saved = loadSelectedServerAbbreviations()
    const activeServers = DCSS_SERVERS.filter((s) => !s.isDormant)
    return activeServers.map((s, index) => ({
      abbreviation: s.abbreviation,
      name: s.name,
      country: s.country,
      gameCount: s.gameCount,
      userCount: s.userCount,
      isDormant: s.isDormant,
      checked: saved.size > 0 ? saved.has(s.abbreviation) : index === 0,
      scan: initialServerState,
    })) as UiServerState[]
  })
  const [isScanning, setIsScanning] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [lastScanUsername, setLastScanUsername] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [activeScanIndex, setActiveScanIndex] = useState<number | null>(null)
  const scanAbortRef = useRef<AbortController | null>(null)
  const importAbortRef = useRef<AbortController | null>(null)

  // Persist selected servers to localStorage when checkboxes change.
  useEffect(() => {
    const selected = servers.filter((s) => s.checked).map((s) => s.abbreviation)
    saveSelectedServerAbbreviations(selected)
  }, [servers])

  const hasScan = servers.some(
    (s) => s.scan.status === "done" || s.scan.status === "error" || s.scan.status === "skipped",
  )
  const totalNewGamesForSelected = servers.reduce(
    (sum, s) => (s.checked ? sum + s.scan.newGames : sum),
    0,
  )
  const hasSelectedServer = servers.some((s) => s.checked)
  const canScan =
    !!userId &&
    dcssUsername.trim().length > 0 &&
    hasSelectedServer &&
    !isScanning &&
    !isImporting
  const canImport =
    !!userId &&
    hasScan &&
    totalNewGamesForSelected > 0 &&
    !isImporting &&
    !isScanning &&
    lastScanUsername === dcssUsername.trim()

  const handleClose = () => {
    if (isScanning || isImporting) return
    setImportSummary(null)
    setActiveScanIndex(null)
    onOpenChange(false)
  }

  const handleScan = async () => {
    if (!userId || !canScan) return
    const username = dcssUsername.trim()

    setIsScanning(true)
    setImportSummary(null)
    // Reset all scan state to idle before starting a new pass.
    setServers((prev) =>
      prev.map((server) => ({
        ...server,
        scan: { ...initialServerState, status: "idle" },
      })),
    )

    try {
      // Only scan servers that are selected (checked).
      const indicesToScan = servers
        .map((s, i) => (s.checked ? i : -1))
        .filter((i) => i >= 0)
      for (const index of indicesToScan) {
        const server = servers[index]
        const controller = new AbortController()
        scanAbortRef.current = controller
        const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS)

        setActiveScanIndex(index)
        setServers((prev) =>
          prev.map((s, i) =>
            i === index
              ? {
                  ...s,
                  scan: {
                    ...s.scan,
                    status: "scanning",
                    errorMessage: null,
                  },
                }
              : s,
          ),
        )

        try {
          const res = await fetch("/api/online-import/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              dcssUsername: username,
              serverAbbreviations: [server.abbreviation],
            }),
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
          scanAbortRef.current = null
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
          const result = data.servers[0]
          setServers((prev) =>
            prev.map((s) =>
              s.abbreviation === server.abbreviation
                ? {
                    ...s,
                    scan: {
                      status: result ? (result.status === "error" ? "error" : "done") : "error",
                      totalGamesFound: result?.totalGamesFound ?? 0,
                      totalGamesImported: result?.totalGamesImported ?? 0,
                      newGames: result?.newGames ?? 0,
                      errorMessage: result?.errorMessage ?? (result ? null : "No server data returned."),
                    },
                  }
                : s,
            ),
          )
        } catch (e) {
          clearTimeout(timeoutId)
          scanAbortRef.current = null
          const isAbort = e instanceof Error && e.name === "AbortError"
          setServers((prev) =>
            prev.map((s) =>
              s.abbreviation === server.abbreviation
                ? {
                    ...s,
                    scan: {
                      status: isAbort ? "skipped" : "error",
                      totalGamesFound: 0,
                      totalGamesImported: 0,
                      newGames: 0,
                      errorMessage: isAbort ? null : (e instanceof Error ? e.message : String(e)),
                    },
                  }
                : s,
            ),
          )
        }
      }
      setLastScanUsername(username)
    } finally {
      setIsScanning(false)
      setActiveScanIndex(null)
      scanAbortRef.current = null
    }
  }

  const handleSkipScan = () => {
    scanAbortRef.current?.abort()
  }

  const handleImport = async () => {
    if (!userId || !canImport) return
    const username = dcssUsername.trim()
    const max = Number.parseInt(maxGames, 10)
    const maxNewGamesPerServer = Number.isFinite(max) && max > 0 ? max : 3

    const selectedServerAbbreviations = servers.filter((s) => s.checked).map((s) => s.abbreviation)
    if (selectedServerAbbreviations.length === 0) {
      return
    }

    setIsImporting(true)
    // Seed summary so we can show the target count while the import runs.
    setImportSummary({
      lastRequested: maxNewGamesPerServer,
      lastImported: 0,
      lastDuplicates: 0,
      lastErrors: 0,
    })
    const importController = new AbortController()
    importAbortRef.current = importController
    let importTimeoutId: ReturnType<typeof setTimeout> | null = setTimeout(
      () => importController.abort(),
      IMPORT_TIMEOUT_MS,
    )
    try {
      const res = await fetch("/api/online-import/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          dcssUsername: username,
          maxNewGamesPerServer,
          serverAbbreviations: selectedServerAbbreviations,
        }),
        signal: importController.signal,
      })
      if (importTimeoutId != null) {
        clearTimeout(importTimeoutId)
        importTimeoutId = null
      }
      importAbortRef.current = null
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data.error as string) ?? `Import failed with status ${res.status}`)
      }
      const data = (await res.json()) as {
        summary: { totalNewGamesImported: number; totalDuplicatesSkipped: number }
        servers: {
          serverAbbreviation: string
          status: "ok" | "skipped" | "error"
          newGamesImported: number
          duplicatesSkipped: number
          errors: string[]
        }[]
      }

      const imported = data.summary.totalNewGamesImported
      const dupes = data.summary.totalDuplicatesSkipped
      const allErrors = data.servers?.flatMap((s) => s.errors ?? []) ?? []

      toast({
        title: "Online import complete",
        description:
          imported === 0 && dupes === 0
            ? "No new games were imported. All games are already in Snorg."
            : `${imported} new game${imported === 1 ? "" : "s"} imported, ${dupes} duplicate${dupes === 1 ? "" : "s"} skipped.`,
      })

      if (allErrors.length > 0) {
        // Log extra detail to console so we don't overwhelm the toast.
        console.error("[snorg-morgue] Online import errors:", allErrors)
      }

      // After a successful import, consider the "newGames" count consumed per server.
      setServers((prev) =>
        prev.map((server) => {
          const serverResult = data.servers.find((s) => s.serverAbbreviation === server.abbreviation)
          if (!serverResult) return server
          const importedForServer = serverResult.newGamesImported
          return {
            ...server,
            scan: {
              ...server.scan,
              newGames: Math.max(0, server.scan.newGames - importedForServer),
            },
          }
        }),
      )

      setImportSummary({
        lastRequested: maxNewGamesPerServer,
        lastImported: imported,
        lastDuplicates: dupes,
        lastErrors: allErrors.length,
      })

      onImportComplete?.()
    } catch (e) {
      if (importTimeoutId != null) clearTimeout(importTimeoutId)
      importAbortRef.current = null
      const message =
        e instanceof Error && e.name === "AbortError"
          ? "Import timed out. The server may be slow or unresponsive."
          : e instanceof Error ? e.message : String(e)
      toast({
        title: "Online import failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      if (importTimeoutId != null) clearTimeout(importTimeoutId)
      setIsImporting(false)
      importAbortRef.current = null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[56.7rem] rounded-none border-2 border-primary/30">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm text-primary">Online Import (Stage 1)</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Manually scan and import games from DCSS online servers into Snorg. For now this is limited to a few servers
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

          <div className="space-y-2">
            <p className="text-xs font-mono text-primary">Servers</p>
            <div className="grid grid-cols-3 gap-2">
              {servers.map((server, index) => {
                const isActive = activeScanIndex === index && isScanning
                const scan = server.scan
                return (
                  <Card
                    key={server.abbreviation}
                    className={`rounded-none p-3 border-2 ${
                      isActive ? "border-primary bg-primary/5" : "border-primary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Checkbox
                          checked={server.checked}
                          onCheckedChange={(checked) =>
                            setServers((prev) =>
                              prev.map((s) =>
                                s.abbreviation === server.abbreviation
                                  ? { ...s, checked: Boolean(checked) }
                                  : s,
                              ),
                            )
                          }
                          disabled={isScanning || isImporting}
                          className="mt-[1px]"
                        />
                        <span className="text-primary">{server.name}</span>
                        {server.country && (
                          <span className="text-muted-foreground">({server.country})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{server.abbreviation}</span>
                        {isScanning && activeScanIndex === index && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-none border-2 border-amber-500/70 text-amber-700 dark:text-amber-400 font-mono text-[11px] h-7 px-2"
                            onClick={handleSkipScan}
                          >
                            Skip
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="text-muted-foreground space-y-1">
                      <p className="text-sm font-medium">
                        Status:{" "}
                        {scan.status === "idle" && "Not scanned yet"}
                        {scan.status === "scanning" && (
                          <span className="inline-flex items-center text-primary">
                            Scanning
                            <span className="animate-scan-dots inline-flex ml-0.5">
                              <span>.</span>
                              <span>.</span>
                              <span>.</span>
                            </span>
                          </span>
                        )}
                        {scan.status === "done" && "Scan complete"}
                        {scan.status === "error" && "Error"}
                        {scan.status === "skipped" && "Skipped"}
                      </p>
                      {scan.status !== "idle" && (
                        <p className="text-sm">
                          Games found:{" "}
                          <span
                            className={`font-mono font-medium ${
                              scan.totalGamesFound > 0 ? "text-green-600 dark:text-green-400" : ""
                            }`}
                          >
                            {scan.totalGamesFound}{" "}
                            {scan.totalGamesFound > 0 ? `(new: ${scan.newGames})` : ""}
                          </span>
                        </p>
                      )}
                      {scan.errorMessage && <p className="text-[11px] text-red-500">{scan.errorMessage}</p>}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

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
              {isImporting
                ? "Importing…"
                : totalNewGamesForSelected > 0
                  ? `Import ${totalNewGamesForSelected} Game${totalNewGamesForSelected === 1 ? "" : "s"}`
                  : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

