"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Colour tone for the button. "success" matches the Wins data colour (green). */
type FilterToggleTone = "primary" | "success"

const TONE_SELECTED: Record<FilterToggleTone, string[]> = {
  primary: [
    "border-primary bg-primary text-primary-foreground",
    "hover:text-primary-foreground",
    "hover:shadow-[0_0_22px_-4px_var(--color-primary)]",
  ],
  success: [
    "border-success bg-success text-white",
    "hover:text-white",
    "hover:shadow-[0_0_22px_-4px_var(--color-success)]",
  ],
}

/** Shared filter/toggle (Morgues All/Wins/Deaths, DCSS Chargen mode row, Win Performance, etc.). */
export function FilterToggleButton({
  selected,
  onClick,
  children,
  className,
  tone = "primary",
  ...props
}: React.ComponentProps<typeof Button> & {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  /** Selected-state colour. Use "success" for Wins toggles to match the green Wins data. */
  tone?: FilterToggleTone
}) {
  return (
    <Button
      variant={selected ? "default" : "ghost"}
      size="sm"
      className={cn(
        "rounded-none border-2 font-mono text-sm transition-[background-color,border-color,color,box-shadow] duration-150 ease-out",
        // Unselected: ghost avoids outline’s dark:border-input (invisible on dark bg); explicit light edge via foreground
        selected
          ? TONE_SELECTED[tone]
          : [
              "border-foreground/55 bg-primary/10 text-primary shadow-none",
              "hover:border-primary hover:bg-primary/30 hover:text-primary",
              "hover:ring-2 hover:ring-primary/50 hover:ring-offset-0",
            ],
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  )
}
