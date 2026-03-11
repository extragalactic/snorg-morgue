"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

// Performance chart controls
type PerformanceSortMethod = "default" | "wins" | "attempts"
type PerformanceShowMode = "both" | "wins" | "attempts"
type PerformanceChartType = "species" | "background" | "gods"

// Morgues table controls
type MorgueResultFilter = "all" | "win" | "death"
type MorgueSortField = "character" | "combo" | "god" | "xl" | "place" | "duration" | "date" | "result" | null
type MorgueSortDirection = "asc" | "desc"

const SETTINGS_STORAGE_KEY = "snorg-user-settings-v1"

export interface UserSettings {
  performanceChart: {
    sortMethod: PerformanceSortMethod
    showMode: PerformanceShowMode
    chartType: PerformanceChartType
  }
  morguesTable: {
    searchQuery: string
    currentPage: number
    resultFilter: MorgueResultFilter
    speciesFilter: string
    backgroundFilter: string
    godFilter: string
    sortField: MorgueSortField
    sortDirection: MorgueSortDirection
  }
}

const defaultSettings: UserSettings = {
  performanceChart: {
    sortMethod: "default",
    showMode: "wins",
    chartType: "species",
  },
  morguesTable: {
    searchQuery: "",
    currentPage: 1,
    resultFilter: "all",
    speciesFilter: "all",
    backgroundFilter: "all",
    godFilter: "all",
    sortField: null,
    sortDirection: "asc",
  },
}

function loadInitialSettings(): UserSettings {
  if (typeof window === "undefined") return defaultSettings
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as Partial<UserSettings>
    return {
      performanceChart: {
        ...defaultSettings.performanceChart,
        ...(parsed.performanceChart ?? {}),
      },
      morguesTable: {
        ...defaultSettings.morguesTable,
        ...(parsed.morguesTable ?? {}),
      },
    }
  } catch {
    return defaultSettings
  }
}

interface SettingsContextType {
  settings: UserSettings
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(loadInitialSettings)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // ignore write errors
    }
  }, [settings])

  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return ctx
}

