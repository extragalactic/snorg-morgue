"use client"

import { useRouter, useParams } from "next/navigation"
import { useEffect } from "react"
import DashboardPage from "@/app/dashboard/page"
import { PAGE_TO_TAB, TAB_TO_PAGE, VALID_PAGES } from "@/lib/slug"

export default function UsernamePagePage() {
  const router = useRouter()
  const params = useParams()
  const username = params?.username as string
  const page = params?.page as string

  const validPage = page && VALID_PAGES.includes(page)
  const activeTab = validPage ? PAGE_TO_TAB[page] : "analysis"

  useEffect(() => {
    if (username && page && !validPage) {
      router.replace(`/${username}/analytics`)
    }
  }, [username, page, validPage, router])

  const handleTabChange = (tabId: string) => {
    const nextPage = TAB_TO_PAGE[tabId]
    if (nextPage && username) {
      router.push(`/${username}/${nextPage}`)
    }
  }

  if (!validPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-mono">Loading…</p>
      </div>
    )
  }

  return (
    <DashboardPage activeTab={activeTab} onTabChange={handleTabChange} />
  )
}
