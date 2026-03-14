/**
 * Semantic typography tokens. Use these class strings across the site for
 * consistent type hierarchy. Change the Tailwind classes here to update
 * the look site-wide (e.g. bump primaryTitle from text-lg to text-xl).
 */
export const typography = {
  /** Page or main section title (e.g. "PERFORMANCE ANALYTICS") */
  primaryTitle:
    "font-mono text-xl text-primary",

  /** Double primaryTitle – e.g. tooltip display for hours played */
  displayHours:
    "font-mono text-[2.5rem] text-primary leading-none",

  /** Card/section header (e.g. "RUNES COLLECTED PER GAME", "TOP 10 KILLERS") */
  secondaryTitle:
    "font-mono text-base text-primary",

  /** Small heading or label (e.g. "SORT BY:", "LEVEL XL") */
  subtitle:
    "font-mono text-xs text-primary",

  /** Subtitle with muted color */
  subtitleMuted:
    "font-mono text-xs text-muted-foreground",

  /** Body text */
  body:
    "text-sm text-foreground",

  /** Body text, muted */
  bodyMuted:
    "text-sm text-muted-foreground",

  /** Body text, monospace (e.g. character names, values) */
  bodyMono:
    "font-mono text-sm text-foreground",

  /** Body monospace, muted */
  bodyMonoMuted:
    "font-mono text-sm text-muted-foreground",

  /** Larger body (e.g. morgue content) */
  bodyLg:
    "font-mono text-base leading-relaxed",

  /** Caption / small label */
  caption:
    "text-xs text-muted-foreground",

  /** Caption, monospace */
  captionMono:
    "font-mono text-xs text-muted-foreground",

  /** Stat card or big number */
  statValue:
    "font-mono text-2xl text-primary",

  /** Button / nav label size */
  buttonLabel:
    "font-mono text-xs",
} as const

export type TypographyKey = keyof typeof typography
