"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Shared filter/toggle button used on Morgue list (All/Wins/Deaths) and Analytics (Wins/Attempts/Default etc). Same styling and hover (yellow in Tiles, green in ASCII). */
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
      variant={selected ? "default" : "outline"}
      size="sm"
      className={cn(
        "rounded-none border-2 font-mono text-xs hover:text-primary",
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  )
}
