"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

export type ThemeStyle = "tiles" | "ascii"

interface ThemeContextType {
  themeStyle: ThemeStyle
  setThemeStyle: (style: ThemeStyle) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Get initial theme from localStorage or default
function getInitialTheme(): ThemeStyle {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("dcss-theme-style") as ThemeStyle
    if (saved === "tiles" || saved === "ascii") {
      return saved
    }
  }
  return "tiles"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>(getInitialTheme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Apply theme class to html element
    const html = document.documentElement
    html.classList.remove("theme-tiles", "theme-ascii")
    html.classList.add(`theme-${themeStyle}`)
    localStorage.setItem("dcss-theme-style", themeStyle)
  }, [themeStyle])

  return (
    <ThemeContext.Provider value={{ themeStyle, setThemeStyle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
