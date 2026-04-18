/** localStorage keys for dashboard chart toggles (client-only). */

export const LS_CHARGEN_VIEW_MODE = "snorg-morgue:chargen-view-mode" as const
export const LS_SPECIES_BG_COMBO_MODE = "snorg-morgue:species-bg-combo-mode" as const

export type ChargenViewMode = "species" | "background" | "gods"
export type SpeciesBgComboMode = "wins" | "attempts"

export function readChargenViewMode(): ChargenViewMode | null {
  if (typeof window === "undefined") return null
  try {
    const v = localStorage.getItem(LS_CHARGEN_VIEW_MODE)
    if (v === "species" || v === "background" || v === "gods") return v
  } catch {
    /* private mode / quota */
  }
  return null
}

export function writeChargenViewMode(m: ChargenViewMode): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LS_CHARGEN_VIEW_MODE, m)
  } catch {
    /* ignore */
  }
}

export function readSpeciesBgComboMode(): SpeciesBgComboMode | null {
  if (typeof window === "undefined") return null
  try {
    const v = localStorage.getItem(LS_SPECIES_BG_COMBO_MODE)
    if (v === "wins" || v === "attempts") return v
  } catch {
    /* ignore */
  }
  return null
}

export function writeSpeciesBgComboMode(m: SpeciesBgComboMode): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LS_SPECIES_BG_COMBO_MODE, m)
  } catch {
    /* ignore */
  }
}
