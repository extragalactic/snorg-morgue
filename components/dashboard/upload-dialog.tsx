"use client"

import { useState, useCallback } from "react"
import { Upload, X, FileText, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface UploadedFile {
  id: string
  name: string
  size: number
  status: "uploading" | "complete" | "error"
}

export function UploadDialog() {
  const [open, setOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<UploadedFile[]>([])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const processFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      status: "uploading" as const,
    }))

    setFiles((prev) => [...prev, ...newFiles])

    // Simulate upload completion
    newFiles.forEach((file) => {
      setTimeout(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, status: "complete" as const } : f
          )
        )
      }, 1000 + Math.random() * 1000)
    })
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files)
      }
    },
    [processFiles]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files)
      }
    },
    [processFiles]
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
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
          {/* Drop Zone */}
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
              or click to browse
            </p>
            <input
              type="file"
              multiple
              accept=".txt,.morgue"
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

          {/* File List */}
          {files.length > 0 && (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between border-2 border-primary/30 bg-secondary/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-foreground truncate max-w-[200px]">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === "uploading" && (
                      <div className="h-4 w-4 animate-spin border-2 border-primary border-t-transparent" />
                    )}
                    {file.status === "complete" && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-none hover:bg-destructive/20"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t-2 border-primary/30 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-none border-2 border-primary/50 font-mono text-xs hover:text-yellow-400"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setFiles([])
                setOpen(false)
              }}
              disabled={files.length === 0 || files.some((f) => f.status === "uploading")}
              className="rounded-none border-2 border-primary bg-primary text-primary-foreground font-mono text-xs"
            >
              Process Files
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
