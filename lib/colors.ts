/**
 * Semantic color tokens for UI elements. Use these so global styles (Monitor,
 * Terminal, etc.) can change colors in one place via app/globals.css.
 *
 * How to add a new theme (e.g. "Light" or "High contrast"):
 * 1. In app/globals.css, add a class (e.g. .theme-light) and set all semantic
 *    variables: --primary, --success, --destructive, --average, --background,
 *    --foreground, --muted, --muted-foreground, etc.
 * 2. No changes needed here or in components; they use these tokens or
 *    Tailwind theme classes (text-primary, text-success, etc.).
 *
 * All tokens use theme variables from @theme (--color-primary, --color-success,
 * --color-destructive, --color-average). Do not use raw Tailwind palette
 * classes (e.g. text-yellow-400, text-green-500) in UI; use these or
 * theme tokens (text-primary, text-muted-foreground) instead.
 */
export const colors = {
  /** Interactive hover: links, nav items, button secondary state */
  highlightHover: "hover:text-primary hover:bg-primary/10",
  /** Hover text only (e.g. icon buttons) */
  highlightHoverText: "hover:text-primary",
  /** Success state: wins, positive outcome, trend up */
  success: "text-success",
  /** Success badge/chip (e.g. Victory badge) */
  successBadge:
    "bg-success/20 text-success border border-success/50",
  /** Destructive state: death, error, trend down */
  destructive: "text-destructive",
  /** Destructive badge/chip (e.g. Death badge) */
  destructiveBadge:
    "bg-destructive/20 text-destructive border border-destructive/50",
  /** Comparison / average value (e.g. global average, secondary stat) */
  average: "text-average",
  /** Average for background (e.g. toggle when “show averages” on) */
  averageBg: "bg-average border-average",
  /** Card outer border – consistent across themes */
  cardBorder: "border-2 border-primary/30",
  /** Card header / section divider border */
  cardBorderBottom: "border-b-2 border-primary/20",
  /** Input, select, button outline border */
  inputBorder: "border-2 border-primary/50",
  /** Focus ring */
  focusRing: "focus-visible:ring-ring focus-visible:ring-offset-2",
} as const

export type ColorKey = keyof typeof colors
