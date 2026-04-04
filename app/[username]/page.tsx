"use client"

import { useRouter, useParams } from "next/navigation"
import { useEffect } from "react"
import { TAB_TO_PAGE } from "@/lib/slug"

export default function UsernameIndexPage() {
  const router = useRouter()
  const params = useParams()
  const username = params?.username as string

  useEffect(() => {
    if (username) router.replace(`/${username}/${TAB_TO_PAGE.analysis}`)
  }, [username, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground font-mono">Loading…</p>
    </div>
  )
}
