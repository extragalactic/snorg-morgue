"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "@/contexts/auth-context"

const STORAGE_KEY = "snorg-browse-target"

export interface BrowseTarget {
  userId: string
  /** profiles.username_slug for display and public URLs */
  usernameSlug: string
}

interface BrowseContextValue {
  browseTarget: BrowseTarget | null
  setBrowseTarget: (target: BrowseTarget | null) => void
  clearBrowseTarget: () => void
}

const BrowseContext = createContext<BrowseContextValue | undefined>(undefined)

function readStoredTarget(): BrowseTarget | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BrowseTarget>
    if (
      typeof parsed.userId === "string" &&
      parsed.userId.length > 0 &&
      typeof parsed.usernameSlug === "string" &&
      parsed.usernameSlug.length > 0
    ) {
      return { userId: parsed.userId, usernameSlug: parsed.usernameSlug }
    }
  } catch {
    // ignore
  }
  return null
}

export function BrowseProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth()
  const [browseTarget, setBrowseTargetState] = useState<BrowseTarget | null>(null)

  useEffect(() => {
    setBrowseTargetState(readStoredTarget())
  }, [])

  const hadUserRef = useRef(false)
  useEffect(() => {
    if (userId) hadUserRef.current = true
    else if (hadUserRef.current) {
      hadUserRef.current = false
      setBrowseTargetState(null)
      if (typeof window === "undefined") return
      try {
        window.sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
    }
  }, [userId])

  const setBrowseTarget = useCallback((target: BrowseTarget | null) => {
    setBrowseTargetState(target)
    if (typeof window === "undefined") return
    try {
      if (target) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(target))
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      // ignore
    }
  }, [])

  const clearBrowseTarget = useCallback(() => {
    setBrowseTargetState(null)
    if (typeof window === "undefined") return
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const value = useMemo(
    () => ({ browseTarget, setBrowseTarget, clearBrowseTarget }),
    [browseTarget, setBrowseTarget, clearBrowseTarget],
  )

  return <BrowseContext.Provider value={value}>{children}</BrowseContext.Provider>
}

export function useBrowse() {
  const ctx = useContext(BrowseContext)
  if (!ctx) {
    throw new Error("useBrowse must be used within BrowseProvider")
  }
  return ctx
}
