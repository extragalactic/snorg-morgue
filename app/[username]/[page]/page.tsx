"use client"

import { useRouter, useParams } from "next/navigation"
import { useState, useEffect } from "react"
import DashboardPage from "@/app/dashboard/page"
import { PAGE_TO_TAB, TAB_TO_PAGE, VALID_PAGES } from "@/lib/slug"

export default function UsernamePagePage() {
  const router = useRouter()
  const params = useParams()
  const username = params?.username as string
  const page = params?.page as string

  const validPage = page && VALID_PAGES.includes(page)
  const tabFromUrl = validPage ? PAGE_TO_TAB[page] : "analysis"

  // Client tab state: synced from URL so direct visits and back/forward work; tab clicks only update state + pushState (no Next.js navigation = no refresh).
  const [activeTab, setActiveTab] = useState(tabFromUrl)
  useEffect(() => {
    setActiveTab(tabFromUrl)
  }, [tabFromUrl])

  useEffect(() => {
    const onPopState = () => {
      const path = typeof window !== "undefined" ? window.location.pathname : ""
      const segments = path.split("/").filter(Boolean)
      if (segments.length >= 2 && username === segments[0]) {
        const pageSeg = segments[1]
        const tab = PAGE_TO_TAB[pageSeg]
        if (tab) setActiveTab(tab)
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [username])

  useEffect(() => {
    if (username && page && !validPage) {
      router.replace(`/${username}/analytics`)
    }
  }, [username, page, validPage, router])

  const handleTabChange = (tabId: string) => {
    const nextPage = TAB_TO_PAGE[tabId]
    if (!nextPage || !username) return
    setActiveTab(tabId)
    const path = `/${username}/${nextPage}`
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", path)
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
    <DashboardPage
      activeTab={activeTab}
      onTabChange={handleTabChange}
      usernameSlug={username}
    />
  )
}
