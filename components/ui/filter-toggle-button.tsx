"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Shared filter/toggle (Morgues All/Wins/Deaths, DCSS Chargen VIEW row, Win Performance, etc.). Font matches Chargen `VIEW:` (`text-sm`). */
export function FilterToggleButton({
  selected,
  onClick,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant={selected ? "default" : "ghost"}
      size="sm"
      className={cn(
        "rounded-none border-2 font-mono text-sm transition-[background-color,border-color,color,box-shadow] duration-150 ease-out",
        // Unselected: ghost avoids outline’s dark:border-input (invisible on dark bg); explicit light edge via foreground
        selected
          ? [
              "border-primary bg-primary text-primary-foreground",
              "hover:text-primary-foreground",
              "hover:shadow-[0_0_22px_-4px_var(--color-primary)]",
            ]
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
