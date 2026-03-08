"use client"

import { useState, useCallback } from "react"
import { Upload, X, FileText, CheckCircle, AlertCircle } from "lucide-react"
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
import { supabase } from "@/lib/supabase"
import { uploadMorgues } from "@/lib/morgue-api"
import { useAuth } from "@/contexts/auth-context"
import { toast } from "@/hooks/use-toast"

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

export function UploadDialog({ onUploadComplete }: UploadDialogProps) {
  const { userId } = useAuth()
  const [open, setOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<PendingFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [failureModalOpen, setFailureModalOpen] = useState(false)
  const [failureItems, setFailureItems] = useState<{ filename: string; reason: string }[]>([])

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
    const toUpload: { name: string; text: string }[] = []
    const failedReads: { name: string; error: string }[] = []

    for (const p of pending) {
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
                  error: "Partial game files cannot be uploaded. Morgue filenames must start with 'morgue-'.",
                }
              : f
          )
        )
        failedReads.push({
          name: p.name,
          error: "Partial game files cannot be uploaded. Morgue filenames must start with 'morgue-'.",
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
        toast({
          title: "Upload complete",
          description:
            result.failed.length > 0
              ? `${result.success} morgue${result.success === 1 ? "" : "s"} added. ${result.failed.length} file${result.failed.length === 1 ? "" : "s"} could not be imported — see details below.`
              : `${result.success} morgue${result.success === 1 ? "" : "s"} added.`,
        })
        onUploadComplete?.()
      }
      const allFailures: { filename: string; reason: string }[] = [
        ...result.failed.map((f) => ({ filename: f.filename, reason: f.error })),
        ...failedReads.map((f) => ({ filename: f.name, reason: f.error })),
      ]
      if (allFailures.length > 0) {
        setFailureItems(allFailures)
        setFailureModalOpen(true)
      }
    } else if (failedReads.length > 0) {
      setFailureItems(failedReads.map((f) => ({ filename: f.name, reason: f.error })))
      setFailureModalOpen(true)
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
      <DialogContent className="border-4 border-primary rounded-none bg-card sm:max-w-lg">
        <DialogHeader className="border-b-2 border-primary/30 pb-4">
          <DialogTitle className="font-mono text-primary">
            UPLOAD MORGUE FILES
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative flex flex-col items-center justify-center border-2 border-dashed p-8 transition-colors",
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
            <p className="mb-3 text-xs text-muted-foreground">
              or click to browse (.txt only)
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

          {files.length > 0 && (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center justify-between border-2 bg-secondary/50 p-3",
                    file.status === "error"
                      ? "border-red-500/50"
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
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {file.status === "error" && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
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
          )}

          <div className="flex justify-end gap-2 border-t-2 border-primary/30 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
                setFiles([])
              }}
              disabled={isProcessing}
              className="rounded-none border-2 border-primary/50 font-mono text-xs hover:text-yellow-400"
            >
              Cancel
            </Button>
            <Button
              onClick={processFiles}
              disabled={!canProcess}
              className="rounded-none border-2 border-primary bg-primary text-primary-foreground font-mono text-xs"
            >
              {isProcessing ? "Processing…" : "Process Files"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={failureModalOpen} onOpenChange={setFailureModalOpen}>
      <DialogContent className="border-4 border-primary rounded-none bg-card sm:max-w-lg">
        <DialogHeader className="border-b-2 border-primary/30 pb-4">
          <DialogTitle className="font-mono text-primary">
            IMPORT FAILED
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            The following file(s) could not be imported. Successful files were still added.
          </DialogDescription>
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
            onClick={() => setFailureModalOpen(false)}
            className="rounded-none border-2 border-primary font-mono text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
