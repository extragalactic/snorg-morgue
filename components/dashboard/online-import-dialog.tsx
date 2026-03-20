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
 import { cn } from "@/lib/utils"
import { colors } from "@/lib/colors"
import { DCSS_SERVERS } from "@/lib/dcss-public-sources"
 import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"
import { Search } from "lucide-react"
import { HydraLoader } from "@/components/dashboard/hydra-loader"
 
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
  /** Time-based progress during import (0..importProgressTarget) so the bar animates. */
  const [importProgressDisplay, setImportProgressDisplay] = useState(0)
  const [importProgressTarget, setImportProgressTarget] = useState(0)
  const [importJustCompleted, setImportJustCompleted] = useState(false)
  const [activeScanIndex, setActiveScanIndex] = useState<number | null>(null)
  /** Shown after import completes: main dialog closes and this modal shows imported count. */
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [successImportedCount, setSuccessImportedCount] = useState(0)
  const scanAbortRef = useRef<AbortController | null>(null)
  const importAbortRef = useRef<AbortController | null>(null)
  const importProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const successDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevOpenRef = useRef(open)
  const isInitialImportPhase = isImporting && importProgressDisplay === 0

  // Persist selected servers to localStorage when checkboxes change.
  useEffect(() => {
    const selected = servers.filter((s) => s.checked).map((s) => s.abbreviation)
    saveSelectedServerAbbreviations(selected)
  }, [servers])

  // When the dialog transitions from closed -> open, reset transient scan/import UI
  // state so each open starts from a clean slate while preserving which servers
  // are selected. Do not reset while a scan/import is in progress.
  useEffect(() => {
    const wasOpen = prevOpenRef.current
    prevOpenRef.current = open
    // Only run when transitioning from closed -> open.
    if (!open || wasOpen) return
    if (isScanning || isImporting) return
    if (successDelayRef.current) {
      clearTimeout(successDelayRef.current)
      successDelayRef.current = null
    }
    setSuccessModalOpen(false)
    setImportSummary(null)
    setImportProgressDisplay(0)
    setImportProgressTarget(0)
    setImportJustCompleted(false)
    setActiveScanIndex(null)
    setLastScanUsername(null)
    setServers((prev) =>
      prev.map((server) => ({
        ...server,
        scan: initialServerState,
      })),
    )
  }, [open, isScanning, isImporting])

  // Clear success-delay timeout on unmount.
  useEffect(() => {
    return () => {
      if (successDelayRef.current) {
        clearTimeout(successDelayRef.current)
        successDelayRef.current = null
      }
    }
  }, [])

  const hasScan = servers.some(
    (s) => s.scan.status === "done" || s.scan.status === "error" || s.scan.status === "skipped",
  )
  const allSelectedServersScanned = servers
    .filter((s) => s.checked)
    .every(
      (s) =>
        s.scan.status === "done" ||
        s.scan.status === "error" ||
        s.scan.status === "skipped",
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
    allSelectedServersScanned &&
    totalNewGamesForSelected > 0 &&
    !isImporting &&
    !isScanning &&
    lastScanUsername === dcssUsername.trim()

  const handleClose = () => {
    if (isScanning || isImporting) return
    if (successDelayRef.current) {
      clearTimeout(successDelayRef.current)
      successDelayRef.current = null
    }
    setSuccessModalOpen(false)
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

  const handleCancelImport = () => {
    importAbortRef.current?.abort()
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

    setImportJustCompleted(false)
    if (successDelayRef.current) {
      clearTimeout(successDelayRef.current)
      successDelayRef.current = null
    }
    setSuccessModalOpen(false)
    setIsImporting(true)
    const totalSlots = maxNewGamesPerServer * selectedServerAbbreviations.length
    setImportProgressTarget(totalSlots)
    setImportProgressDisplay(0)
    if (importProgressIntervalRef.current) clearInterval(importProgressIntervalRef.current)
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
    const applyImportResult = (data: {
      summary: { totalNewGamesImported: number; totalDuplicatesSkipped: number }
      servers: {
        serverAbbreviation: string
        status: "ok" | "skipped" | "error"
        newGamesImported: number
        duplicatesSkipped: number
        errors: string[]
      }[]
    }) => {
      const imported = data.summary.totalNewGamesImported
      const dupes = data.summary.totalDuplicatesSkipped
      const allErrors = data.servers?.flatMap((s) => s.errors ?? []) ?? []
      if (importProgressIntervalRef.current) {
        clearInterval(importProgressIntervalRef.current)
        importProgressIntervalRef.current = null
      }
      setImportProgressDisplay(imported)
      setImportProgressTarget(totalSlots)
      if (allErrors.length > 0) {
        console.error("[snorg-morgue] Online import errors:", allErrors)
      }
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
      setImportJustCompleted(true)
      onImportComplete?.()
      if (imported >= 1) {
        setSuccessImportedCount(imported)
        successDelayRef.current = setTimeout(() => {
          successDelayRef.current = null
          setSuccessModalOpen(true)
        }, 500)
      }
    }
    try {
      const res = await fetch("/api/online-import/import-stream", {
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
      const reader = res.body?.getReader()
      if (!reader) {
        throw new Error("Streaming response has no body")
      }
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const event = JSON.parse(trimmed) as
              | { type: "progress"; imported: number }
              | { type: "done"; result: { summary: { totalNewGamesImported: number; totalDuplicatesSkipped: number }; servers: { serverAbbreviation: string; status: "ok" | "skipped" | "error"; newGamesImported: number; duplicatesSkipped: number; errors: string[] }[] } }
              | { type: "error"; error: string }
            if (event.type === "progress") {
              setImportProgressDisplay(event.imported)
            } else if (event.type === "done") {
              applyImportResult(event.result)
            } else if (event.type === "error") {
              throw new Error(event.error)
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
          }
        }
      }
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as
            | { type: "progress"; imported: number }
            | { type: "done"; result: unknown }
            | { type: "error"; error: string }
          if (event.type === "done") {
            applyImportResult((event as { type: "done"; result: Parameters<typeof applyImportResult>[0] }).result)
          } else if (event.type === "error") {
            throw new Error(event.error)
          }
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) {
            // ignore trailing partial line
          } else {
            throw parseErr
          }
        }
      }
    } catch (e) {
      if (importTimeoutId != null) clearTimeout(importTimeoutId)
      importAbortRef.current = null
      if (importProgressIntervalRef.current) {
        clearInterval(importProgressIntervalRef.current)
        importProgressIntervalRef.current = null
      }
      setImportProgressDisplay(0)
      // Errors are reflected in the import log; no toast needed.
      console.error("Online import failed", e)
    } finally {
      if (importTimeoutId != null) clearTimeout(importTimeoutId)
      if (importProgressIntervalRef.current) {
        clearInterval(importProgressIntervalRef.current)
        importProgressIntervalRef.current = null
      }
      setIsImporting(false)
      importAbortRef.current = null
    }
  }

  const handleSuccessOk = () => {
    setSuccessModalOpen(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          "rounded-none border-2 border-primary/30 flex max-h-[90vh] flex-col overflow-hidden",
          successModalOpen ? "sm:max-w-md" : "max-w-[calc(100%-2rem)] sm:max-w-[56.7rem]",
        )}
      >
        {successModalOpen ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono text-lg text-primary">Import complete</DialogTitle>
            </DialogHeader>
            <p className="font-mono text-sm text-muted-foreground">
              Successfully imported {successImportedCount} game{successImportedCount === 1 ? "" : "s"}.
            </p>
            <div className="flex justify-end pt-2">
              <Button
                className="rounded-none border-2 border-primary/60 font-mono text-xs"
                onClick={handleSuccessOk}
              >
                OK
              </Button>
            </div>
          </>
        ) : (
          <>
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="font-mono text-xl text-primary">
                Game Server Import (Stage 1)
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={dcssUsername}
                onChange={(e) => setDcssUsername(e.target.value)}
                placeholder="DCSS username"
                className="h-8 w-40 rounded-none border-2 border-primary/50 font-mono text-[11px] px-2"
              />
              <Input
                type="number"
                min={1}
                max={200}
                value={maxGames}
                onChange={(e) => setMaxGames(e.target.value)}
                placeholder="Max"
                className="h-8 w-16 rounded-none border-2 border-primary/50 font-mono text-[11px] px-2 text-center"
              />
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto -mr-6 pr-6">
        <div className="space-y-4 pt-2">
          <div className="rounded-none border-2 border-primary/50 bg-primary/5 px-3 py-2">
            <div className="text-center mb-2">
              <p className="font-mono text-sm text-primary">
                {isScanning
                  ? "Scanning selected servers for games…"
                  : isInitialImportPhase
                    ? "Preparing import (fetching morgue files)…"
                    : isImporting
                      ? `Importing… ${importProgressDisplay} of ${importProgressTarget} game${importProgressTarget === 1 ? "" : "s"}`
                      : importSummary
                        ? `Imported ${importSummary.lastImported} of ${
                            importProgressTarget || importSummary.lastRequested
                          } games`
                        : "Select which game server(s) you play on, then click Scan, then click Import."}
              </p>
              <p className="text-[11px] text-muted-foreground min-h-[1.1rem]">
                {importSummary ? (
                  <>Duplicates skipped: {importSummary.lastDuplicates} · Errors: {importSummary.lastErrors}</>
                ) : (
                  // Invisible placeholder to reserve space so layout doesn't shift when summary appears.
                  <span className="invisible">Duplicates skipped: 0 · Errors: 0</span>
                )}
              </p>
            </div>
            <div className="h-4 w-full max-w-[36rem] mx-auto overflow-hidden rounded-none border border-primary/40 bg-background">
              {isScanning || isInitialImportPhase ? (
                <div
                  className="h-full w-full animate-import-shimmer bg-gradient-to-r from-primary/20 via-primary/70 to-primary/20"
                  style={{ backgroundPosition: "0% 50%" }}
                />
              ) : (
                <div
                  className="h-full bg-primary/70 transition-all duration-300"
                  style={{
                    width:
                      importProgressTarget > 0
                        ? `${Math.min(100, Math.round((importProgressDisplay / importProgressTarget) * 100))}%`
                        : "0%",
                  }}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3">
            <div className="w-[260px] shrink-0">
              <Button
                type="button"
                variant="default"
                className={cn(
                  "rounded-none border-2 font-mono text-base font-bold h-11 px-5 shadow-sm transition-colors w-full",
                  !isImporting &&
                    "border-primary hover:shadow-md hover:bg-success/20 hover:text-success hover:border-success/50",
                  isImporting &&
                    "cursor-not-allowed opacity-60 bg-muted text-muted-foreground border-muted-foreground/40",
                )}
                onClick={handleScan}
                disabled={!canScan || isImporting}
              >
                <Search className="size-4 mr-2 shrink-0" aria-hidden />
                {isScanning ? "Scanning…" : hasScan ? "Re-scan Game Servers" : "Scan Game Servers"}
              </Button>
            </div>
            <div className="flex-1 min-w-0" />
            <Button
              type="button"
              className={cn(
                "rounded-none border-2 font-mono text-base font-bold w-[195px] h-11 shrink-0 px-4 shadow-sm transition-colors",
                isImporting && "border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive",
                !hasScan && !isImporting && !importJustCompleted && "opacity-50 cursor-not-allowed bg-muted text-muted-foreground border-muted-foreground/30",
                !isImporting && (hasScan || importJustCompleted) && "hover:bg-success/20 hover:text-success hover:border-success/50 hover:shadow-md"
              )}
              variant={isImporting ? "outline" : "default"}
              onClick={
                isImporting
                  ? handleCancelImport
                  : importJustCompleted
                    ? () => setImportJustCompleted(false)
                    : handleImport
              }
              disabled={!isImporting && !importJustCompleted && !canImport}
            >
              {isImporting ? "Cancel" : importJustCompleted ? "OK" : totalNewGamesForSelected > 0 ? `Import ${totalNewGamesForSelected} Game${totalNewGamesForSelected === 1 ? "" : "s"}` : "Import"}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-mono text-primary">Servers</p>
            <div className="grid grid-cols-3 gap-2 items-stretch">
              {servers.map((server, index) => {
                const isActive = activeScanIndex === index && isScanning
                const scan = server.scan
                const canToggle = !isScanning && !isImporting
                const toggleServer = () => {
                  if (!canToggle) return
                  setServers((prev) =>
                    prev.map((s) =>
                      s.abbreviation === server.abbreviation
                        ? { ...s, checked: !s.checked }
                        : s,
                    ),
                  )
                }
                return (
                  <Card
                    key={server.abbreviation}
                    role={canToggle ? "button" : undefined}
                    tabIndex={canToggle ? 0 : undefined}
                    onClick={canToggle ? (e: React.MouseEvent) => { if (!(e.target as HTMLElement).closest("[data-server-control]")) toggleServer() } : undefined}
                    onKeyDown={(e) => {
                      if (canToggle && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault()
                        toggleServer()
                      }
                    }}
                    className={cn(
                      "rounded-none p-3 border-2 min-w-0 flex flex-col h-[156px] overflow-hidden relative",
                      canToggle && "cursor-pointer transition-colors hover:border-primary/60 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
                      isActive && "border-primary bg-primary/5",
                      !isActive && server.checked && "border-primary",
                      !isActive && !server.checked && "border-primary/30",
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-mono mb-2 h-11 shrink-0">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span data-server-control>
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
                            className="mt-[1px] shrink-0 size-6"
                          />
                        </span>
                        <span className="text-primary truncate text-base font-medium">{server.name}</span>
                        {server.country && (
                          <span className="text-muted-foreground shrink-0 text-sm">({server.country})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-14 justify-end">
                        <span className="text-muted-foreground">{server.abbreviation}</span>
                        {isScanning && activeScanIndex === index ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-none border-2 border-amber-500/70 text-amber-700 dark:text-amber-400 font-mono text-[11px] h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSkipScan()
                            }}
                            data-server-control
                          >
                            Skip
                          </Button>
                        ) : (
                          <span className="inline-block w-10" aria-hidden />
                        )}
                      </div>
                    </div>
                    <div className="text-muted-foreground space-y-1 min-h-[3.5rem]">
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
                        {scan.status === "done" && (
                          <span
                            className={cn(
                              scan.totalGamesFound === 0 && "text-destructive",
                              scan.totalGamesFound > 0 && colors.success,
                            )}
                          >
                            {scan.totalGamesFound > 0 ? "Scan complete" : "No games found"}
                          </span>
                        )}
                        {scan.status === "error" && (
                          <span className="text-destructive">Error</span>
                        )}
                        {scan.status === "skipped" && (
                          <span className="text-amber-500 dark:text-amber-300">Skipped</span>
                        )}
                      </p>
                      <p className="text-sm">
                        Games found:{" "}
                        {scan.status === "idle" ? (
                          <span className="font-mono font-medium">—</span>
                        ) : (
                          <span
                            className={cn(
                              "font-mono font-medium",
                              scan.status === "skipped" &&
                                "text-amber-500 dark:text-amber-300",
                              scan.status === "done" &&
                                scan.totalGamesFound === 0 &&
                                "text-destructive",
                              scan.status === "done" &&
                                scan.totalGamesFound > 0 &&
                                colors.success,
                            )}
                          >
                            {scan.totalGamesFound}{" "}
                            {scan.totalGamesFound > 0 &&
                              scan.status !== "skipped" &&
                              `(new: ${scan.newGames})`}
                          </span>
                        )}
                      </p>
                      {scan.errorMessage ? (
                        <p className={cn("text-[11px]", colors.destructive)}>{scan.errorMessage}</p>
                      ) : (
                        <p className="text-[11px] invisible" aria-hidden>
                          &#8203;
                        </p>
                      )}
                    </div>
                    {isActive && (
                      <div className="absolute bottom-2 right-2 pointer-events-none" aria-hidden>
                        <HydraLoader active size={72} />
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>

          <div className="min-h-[1.5rem] flex items-center justify-center pt-1">
            {isImporting ? (
              <p className="font-mono text-xs text-primary animate-pulse">
                Importing…
              </p>
            ) : (
              <span className="invisible text-xs" aria-hidden>Importing…</span>
            )}
          </div>
        </div>
        </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

