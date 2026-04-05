"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Upload, X, FileText, CheckCircle, AlertCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { colors } from "@/lib/colors"
import { supabase } from "@/lib/supabase"
import { uploadMorgues } from "@/lib/morgue-api"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"
import { HydraLoader } from "@/components/dashboard/hydra-loader"

interface PendingFile {
  id: string
  name: string
  size: number
  file: File
  status: "pending" | "uploading" | "complete" | "error"
  error?: string
}

interface UploadDialogProps {
  onUploadComplete?: () => void
}

const LOADER_MESSAGES = [
  "Sending documents to the Hall of Records...",
  "Parsing tales of bravery and tactical prowess...",
  "Compiling YASD and estimating emotional response...",
  "Analyzing with Orb of Knowledge...",
] as const

export function UploadDialog({ onUploadComplete }: UploadDialogProps) {
  const { userId } = useAuth()
  const [open, setOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<PendingFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingCurrent, setProcessingCurrent] = useState(0)
  const [processingTotal, setProcessingTotal] = useState(0)
  const [failureModalOpen, setFailureModalOpen] = useState(false)
  const [failureItems, setFailureItems] = useState<{ filename: string; reason: string }[]>([])
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [successImportedCount, setSuccessImportedCount] = useState(0)
  const successDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (successDelayRef.current) {
        clearTimeout(successDelayRef.current)
        successDelayRef.current = null
      }
    }
  }, [])

  const handleFailureModalClose = useCallback(() => {
    setFailureModalOpen(false)
    if (successImportedCount > 0) {
      if (successDelayRef.current) clearTimeout(successDelayRef.current)
      successDelayRef.current = setTimeout(() => {
        successDelayRef.current = null
        setSuccessModalOpen(true)
      }, 500)
    }
  }, [successImportedCount])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const addFiles = useCallback((fileList: FileList) => {
    const newFiles: PendingFile[] = Array.from(fileList)
      .filter((f) => f.name.toLowerCase().endsWith(".txt"))
      .map((file) => ({
        id: Math.random().toString(36).slice(2, 11),
        name: file.name,
        size: file.size,
        file,
        status: "pending" as const,
      }))
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addFiles(e.target.files)
    },
    [addFiles]
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const processFiles = useCallback(async () => {
    if (!userId) {
      toast({ title: "Not signed in", description: "Sign in to upload morgue files.", variant: "destructive" })
      return
    }
    const pending = files.filter((f) => f.status === "pending")
    if (pending.length === 0) {
      setOpen(false)
      setFiles([])
      onUploadComplete?.()
      return
    }

    setIsProcessing(true)
    setProcessingTotal(pending.length)
    setProcessingCurrent(0)
    const total = pending.length

    // Time-based progress: a timer alone drives the displayed count (1 → 2 → … → total)
    // every 1000ms, so it always counts up on screen regardless of how fast the work runs.
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    setProcessingCurrent(1)
    progressIntervalRef.current = setInterval(() => {
      setProcessingCurrent((prev) => {
        if (prev >= total) {
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current)
            progressIntervalRef.current = null
          }
          return total
        }
        return prev + 1
      })
    }, 1000)

    const toUpload: { name: string; text: string }[] = []
    const failedReads: { name: string; error: string }[] = []

    try {
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i]
      setFiles((prev) =>
        prev.map((f) => (f.id === p.id ? { ...f, status: "uploading" as const } : f))
      )
      if (!p.name.toLowerCase().startsWith("morgue-")) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === p.id
              ? {
                  ...f,
                  status: "error" as const,
                  error: "Can only upload completed games.",
                }
              : f
          )
        )
        failedReads.push({
          name: p.name,
          error: "Can only upload completed games.",
        })
        continue
      }
      try {
        const text = await p.file.text()
        toUpload.push({ name: p.name, text })
        setFiles((prev) =>
          prev.map((f) => (f.id === p.id ? { ...f, status: "complete" as const } : f))
        )
      } catch {
        const errMsg = "Could not read file."
        failedReads.push({ name: p.name, error: errMsg })
        console.error("[snorg-morgue] Morgue import failed:", {
          type: "morgue_import_failed",
          filename: p.name,
          userMessage: errMsg,
          debug: { phase: "read" as const, fileSize: p.file.size },
        })
        setFiles((prev) =>
          prev.map((f) => (f.id === p.id ? { ...f, status: "error" as const, error: errMsg } : f))
        )
      }
    }

    if (toUpload.length > 0) {
      const result = await uploadMorgues(supabase, userId, toUpload)
      result.failed.forEach(({ filename, error }) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.name === filename ? { ...f, status: "error" as const, error } : f
          )
        )
      })
      if (result.success > 0) {
        await Promise.resolve(onUploadComplete?.())
        setSuccessImportedCount(result.success)
      }
      const allFailures: { filename: string; reason: string }[] = [
        ...result.failed.map((f) => ({ filename: f.filename, reason: f.error })),
        ...failedReads.map((f) => ({ filename: f.name, reason: f.error })),
      ]
      if (allFailures.length > 0) {
        setFailureItems(allFailures)
        setFailureModalOpen(true)
      } else if (result.success > 0) {
        successDelayRef.current = setTimeout(() => {
          successDelayRef.current = null
          setSuccessModalOpen(true)
        }, 500)
      }
    } else if (failedReads.length > 0) {
      setFailureItems(failedReads.map((f) => ({ filename: f.name, reason: f.error })))
      setFailureModalOpen(true)
    }

    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      setProcessingCurrent(pending.length)
    }

    setIsProcessing(false)
    setFiles([])
    setOpen(false)
  }, [files, userId, onUploadComplete])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const hasPending = files.some((f) => f.status === "pending")
  const canProcess = files.length > 0 && !isProcessing

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 rounded-none border-2 border-primary bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs">
          <Upload className="h-4 w-4" />
          Upload Morgue
        </Button>
      </DialogTrigger>
      <DialogContent className="border-4 border-primary rounded-none bg-card sm:max-w-[547px]">
        <DialogHeader className="border-b-2 border-primary/30 pb-4">
          <DialogTitle className="font-mono text-primary">
            UPLOAD MORGUE FILES
          </DialogTitle>
          <DialogDescription className="mt-1 font-mono text-xs text-muted-foreground">
            Currently tested with v0.33 and v0.34 (...work in progress)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary/50 p-8 gap-2 min-h-[220px]">
              <HydraLoader active size={72} className="shrink-0" />
              <p className="font-mono text-sm text-foreground">
                Processing {processingCurrent} of {processingTotal} files…
              </p>
              <p className="text-xs text-muted-foreground">
                {LOADER_MESSAGES[Math.floor((processingCurrent - 1) / 5) % LOADER_MESSAGES.length]}
              </p>
            </div>
          ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center border-2 border-dashed p-8 transition-colors min-h-[220px]",
              isDragging
                ? "border-primary bg-primary/10"
                : "border-primary/50 hover:border-primary hover:bg-primary/5"
            )}
          >
            <Upload
              className={cn(
                "mb-3 h-10 w-10",
                isDragging ? "text-primary" : "text-muted-foreground"
              )}
            />
            <p className="mb-1 text-sm text-foreground">
              Drag and drop morgue files here
            </p>
            <p className="mb-3 text-xs text-muted-foreground text-center">
              or click to browse
              <br />
              (.txt only; will ignore .lst files)
            </p>
            <input
              type="file"
              multiple
              accept=".txt"
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <Button
              variant="outline"
              size="sm"
              className="rounded-none border-2 border-primary/50 font-mono text-xs pointer-events-none"
            >
              Browse Files
            </Button>
          </div>
          )}

          {files.length > 0 && (
            <>
            <p className="text-xs text-muted-foreground font-mono">
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </p>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center justify-between border-2 bg-secondary/50 p-3",
                    file.status === "error"
                      ? "border-destructive/50"
                      : "border-primary/30"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate max-w-[200px]">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {file.status === "error" && file.error
                          ? file.error
                          : formatSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {file.status === "uploading" && (
                      <div className="h-4 w-4 animate-spin border-2 border-primary border-t-transparent rounded-full" />
                    )}
                    {file.status === "complete" && (
                      <CheckCircle className={cn("h-4 w-4", colors.success)} />
                    )}
                    {file.status === "error" && (
                      <AlertCircle className={cn("h-4 w-4", colors.destructive)} />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-none hover:bg-destructive/20"
                      onClick={() => removeFile(file.id)}
                      disabled={isProcessing}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            </>
          )}

          <div className="rounded-none border-2 border-primary/20 bg-muted/30 p-3 space-y-2">
            <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Where to find morgue files on your computer:
            </p>
            <ul className="font-mono text-xs text-muted-foreground space-y-1 pl-5">
              <li><span className="text-foreground/80">Windows:</span> <code className="break-all">%USERPROFILE%\AppData\Local\crawl\morgue</code></li>
              <li><span className="text-foreground/80">Linux:</span> <code className="break-all">~/.crawl/morgue</code></li>
              <li><span className="text-foreground/80">Mac:</span> <code className="break-all">~/Library/Application Support/Dungeon Crawl Stone Soup/morgue</code></li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 border-t-2 border-primary/30 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                setFiles([])
              }}
              disabled={isProcessing}
              className={cn("rounded-none font-mono text-xs", colors.inputBorder, colors.highlightHoverText)}
            >
              Cancel
            </Button>
            <Button
              onClick={processFiles}
              disabled={!canProcess}
              className="rounded-none border-2 border-primary bg-primary text-primary-foreground font-mono text-xs min-w-[5.5rem]"
            >
              {isProcessing ? (
                <div className="h-4 w-4 animate-spin border-2 border-primary-foreground border-t-transparent rounded-full" />
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog
      open={failureModalOpen}
      onOpenChange={(open) => {
        if (!open) handleFailureModalClose()
      }}
    >
      <DialogContent className="border-4 border-primary rounded-none bg-card sm:max-w-lg">
        <DialogHeader className="border-b-2 border-primary/30 pb-4">
          <DialogTitle className="font-mono text-primary">
            SOME IMPORTS SKIPPED
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            The following file(s) could not be imported. Successful files were still added.
          </DialogDescription>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {failureItems.length} file{failureItems.length === 1 ? "" : "s"} skipped
          </p>
        </DialogHeader>
        <ul className="max-h-64 space-y-3 overflow-y-auto py-4 font-mono text-sm">
          {failureItems.map((item, i) => (
            <li
              key={`${item.filename}-${i}`}
              className="flex flex-col gap-0.5 border-b border-primary/20 pb-3 last:border-0 last:pb-0"
            >
              <span className="font-medium text-foreground truncate" title={item.filename}>
                {item.filename}
              </span>
              <span className="text-xs text-muted-foreground">{item.reason}</span>
            </li>
          ))}
        </ul>
        <DialogFooter className="border-t-2 border-primary/30 pt-4">
          <Button
            onClick={handleFailureModalClose}
            className="rounded-none border-2 border-primary font-mono text-xs"
          >
            Ok
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
      <DialogContent className="border-4 border-primary rounded-none bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg text-primary">Import complete</DialogTitle>
        </DialogHeader>
        <p className="font-mono text-sm text-muted-foreground">
          Successfully imported {successImportedCount} game{successImportedCount === 1 ? "" : "s"}.
        </p>
        <div className="flex justify-end pt-2">
          <Button
            className="rounded-none border-2 border-primary/60 font-mono text-xs"
            onClick={() => setSuccessModalOpen(false)}
          >
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
