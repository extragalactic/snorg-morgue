"use client"

import Link from "next/link"
import { ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function PermissionDeniedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background p-4">
      <ShieldX className="h-12 w-12 text-muted-foreground" />
      <div className="text-center space-y-2">
        <h1 className="font-mono text-lg text-primary">You don&apos;t have permission to view this page</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          This area is only available to the account owner. Sign in with the correct account to view it, or ask the owner to share a direct link to a morgue file.
        </p>
      </div>
      <Button asChild variant="outline" className="rounded-none border-2 border-primary/50 font-mono">
        <Link href="/">Go to login</Link>
      </Button>
    </div>
  )
}
