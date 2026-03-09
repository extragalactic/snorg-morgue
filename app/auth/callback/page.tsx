"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthCallbackPage() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"exchanging" | "done" | "error">("exchanging")

  useEffect(() => {
    const code = searchParams.get("code")
    if (!code) {
      setStatus("error")
      return
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(() => {
        setStatus("done")
        window.location.href = "/dashboard"
      })
      .catch(() => setStatus("error"))
  }, [searchParams])

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-destructive">Sign-in failed. Please try again from the login page.</p>
        <a href="/" className="text-primary underline">Go to login</a>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Completing sign-in…</p>
    </div>
  )
}
