"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { slugifyUsername, TAB_TO_PAGE } from "@/lib/slug"

/** True if path is a public morgue detail URL: /username/morgues/shortId */
function isPublicMorguePath(pathname: string | null): boolean {
  if (!pathname) return false
  const segments = pathname.split("/").filter(Boolean)
  return segments.length === 3 && segments[1] === "morgues"
}

/** True if path is the permission-denied page (allow unauthenticated render). */
function isPermissionDeniedPath(pathname: string | null): boolean {
  if (!pathname) return false
  const segments = pathname.split("/").filter(Boolean)
  return segments.length === 2 && segments[1] === "permission-denied"
}

export default function UsernameLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const publicMorgue = isPublicMorguePath(pathname ?? null)
  const permissionDenied = isPermissionDeniedPath(pathname ?? null)

  useEffect(() => {
    if (isLoading) return
    // Public morgue URL: allow without auth (no redirect).
    if (publicMorgue) return
    if (permissionDenied) return
    if (!user) {
      router.replace(pathname ? `/${pathname.split("/").filter(Boolean)[0]}/permission-denied` : "/")
      return
    }
    const slug = slugifyUsername(user.name)
    if (!slug) return
    const segments = pathname?.split("/").filter(Boolean) ?? []
    const usernameInPath = segments[0]
    if (usernameInPath && usernameInPath !== slug) {
      router.replace(`/${slug}/${TAB_TO_PAGE.analysis}`)
      return
    }
    if (usernameInPath === slug && segments.length === 1) {
      router.replace(`/${slug}/${TAB_TO_PAGE.analysis}`)
    }
  }, [user, isLoading, pathname, router, publicMorgue, permissionDenied])

  // Public morgue or permission-denied: no auth required.
  if (publicMorgue || permissionDenied) return <>{children}</>

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-mono">Loading…</p>
      </div>
    )
  }

  return <>{children}</>
}
