"use client"

import { useRouter, useParams } from "next/navigation"
import { useEffect } from "react"

export default function UsernameIndexPage() {
  const router = useRouter()
  const params = useParams()
  const username = params?.username as string

  useEffect(() => {
    if (username) router.replace(`/${username}/analytics`)
  }, [username, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground font-mono">Loading…</p>
    </div>
  )
}
