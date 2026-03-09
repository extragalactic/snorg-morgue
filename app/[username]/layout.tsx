"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { slugifyUsername } from "@/lib/slug"

export default function UsernameLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      router.replace("/")
      return
    }
    const slug = slugifyUsername(user.name)
    if (!slug) return
    const segments = pathname?.split("/").filter(Boolean) ?? []
    const usernameInPath = segments[0]
    if (usernameInPath && usernameInPath !== slug) {
      router.replace(`/${slug}/analytics`)
      return
    }
    if (usernameInPath === slug && segments.length === 1) {
      router.replace(`/${slug}/analytics`)
    }
  }, [user, isLoading, pathname, router])

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-mono">Loading…</p>
      </div>
    )
  }

  return <>{children}</>
}
