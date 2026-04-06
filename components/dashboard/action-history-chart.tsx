"use client"

import { useLayoutEffect, useMemo, useState } from "react"
import type { ActionHistory } from "@/lib/action-history"
import { normalizeActionKey } from "@/lib/action-history"
import { cn } from "@/lib/utils"
import { typography } from "@/lib/typography"

/** Dull dark → bright green; t is effective heat in [0,1]. Slightly boost mid/high spread. */
function heatColors(t: number): { bg: string; fg: string } {
  const x = Math.max(0, Math.min(1, t))
  const curved = x ** 0.88
  const h = 112 + curved * 26
  const s = 5 + curved ** 1.15 * 80
  const l = 13 + curved * 39
  const fg = l >= 44 ? "hsl(0 0% 6%)" : "hsl(0 0% 86%)"
  return { bg: `hsl(${h} ${s}% ${l}%)`, fg }
}

/** Empty cells (—): match modal/page background per theme (Monitor vs Terminal). */
function neutralCell(): { bg: string; fg: string } {
  return {
    bg: "var(--background)",
    fg: "var(--muted-foreground)",
  }
}

/**
 * Heat for one cell: share of this run's row peak, dampened when the row total is low vs your
 * typical totals (sum of per-band averages across morgues).
 */
function cellHeat(value: number, rowMax: number, globalFactor: number): number {
  if (!Number.isFinite(value) || value <= 0 || rowMax <= 0) return 0
  const withinRun = value / rowMax
  const f = Math.max(0, Math.min(1, globalFactor))
  return Math.max(0, Math.min(1, withinRun * f))
}

function sumExpectedRowTotal(
  levelGroups: string[],
  avgRow: Record<string, number> | undefined,
): number {
  if (!avgRow) return 0
  let s = 0
  for (const g of levelGroups) {
    const v = avgRow[g]
    if (v != null && Number.isFinite(v)) s += v
  }
  return s
}

export function ActionHistoryChart({
  data,
  averages,
}: {
  data: ActionHistory
  averages: Map<string, Record<string, number>>
}) {
  const [hoverRowIndex, setHoverRowIndex] = useState<number | null>(null)
  const [hotRowOverlayPx, setHotRowOverlayPx] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    if (hoverRowIndex === null) {
      setHotRowOverlayPx(null)
      return
    }
    const el = document.querySelector<HTMLTableRowElement>(`[data-action-chart-row="${hoverRowIndex}"]`)
    if (!el) {
      setHotRowOverlayPx(null)
      return
    }
    const update = () =>
      setHotRowOverlayPx({ w: el.offsetWidth, h: el.offsetHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hoverRowIndex])

  const colLabels = useMemo(
    () =>
      data.levelGroups.map((g) => {
        const m = g.match(/^(\d+)-(\d+)$/)
        return m ? `${m[1]}–${m[2]}` : g
      }),
    [data.levelGroups],
  )

  return (
    <div className="max-w-full min-w-0 overflow-hidden border border-primary/25 bg-card/40">
      <table className={cn("w-full min-w-0 border-separate border-spacing-0 font-mono text-xs", typography.bodyMono)}>
        <thead>
          <tr className="bg-muted/30">
            <th className="sticky left-0 z-50 relative w-0 whitespace-nowrap border-2 border-b-primary/30 border-r-primary/20 border-l-transparent border-t-transparent bg-card px-2 py-1.5 text-left text-primary">
              Action
            </th>
            {data.levelGroups.map((g, ci) => (
              <th
                key={g + ci}
                className={cn(
                  "border-2 border-b-primary/30 border-l-transparent border-t-transparent px-1.5 py-1.5 text-center text-muted-foreground whitespace-nowrap",
                  ci === data.levelGroups.length - 1 ? "border-r-transparent" : "border-r-primary/15",
                )}
              >
                {colLabels[ci]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => {
            const key = normalizeActionKey(row.name)
            const avgRow = averages.get(key)
            const rowHot = hoverRowIndex === ri
            const nCols = data.levelGroups.length

            const numericVals = data.levelGroups
              .map((_, i) => row.values[i])
              .filter((x): x is number => x != null && Number.isFinite(x))
            const rowMax = numericVals.length > 0 ? Math.max(...numericVals) : 0
            const rowTotal = numericVals.reduce((a, b) => a + b, 0)
            const expectedTotal = sumExpectedRowTotal(data.levelGroups, avgRow)
            const globalFactor =
              expectedTotal > 1e-9 ? Math.min(1, rowTotal / expectedTotal) : 1

            return (
              <tr
                key={`${key}-${ri}`}
                data-action-chart-row={ri}
                onMouseEnter={() => setHoverRowIndex(ri)}
                onMouseLeave={() => setHoverRowIndex(null)}
              >
                <td
                  className={cn(
                    "sticky left-0 w-0 whitespace-nowrap bg-card px-2 py-1 text-left text-foreground align-top border-2 overflow-visible",
                    rowHot
                      ? "relative z-[45] border-t-transparent border-b-primary/10 border-r-primary/20 border-l-transparent"
                      : "relative z-10 border-t-transparent border-r-primary/20 border-b-primary/10 border-l-transparent",
                  )}
                >
                  <span className="relative z-[1]">{row.name}</span>
                  {rowHot && hotRowOverlayPx != null && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -top-[2px] left-0 z-[2] bg-transparent"
                      style={{
                        width: hotRowOverlayPx.w,
                        height: hotRowOverlayPx.h + 2,
                        boxShadow: "inset 0 0 0 2px var(--color-primary)",
                      }}
                    />
                  )}
                </td>
                {data.levelGroups.map((g, ci) => {
                  const v = row.values[ci]
                  const display = v == null ? "—" : String(v)
                  const avg = avgRow?.[g]
                  const hasNum = v != null && Number.isFinite(v)
                  const n = hasNum ? (v as number) : 0
                  const bandAvg = avg != null && avg > 0
                  const bandRatio = bandAvg && hasNum ? n / (avg as number) : null
                  const t = hasNum ? cellHeat(n, rowMax, globalFactor) : 0
                  const colors = hasNum ? heatColors(t) : neutralCell()
                  const isLast = ci === nCols - 1

                  let title: string | undefined
                  if (v == null) title = undefined
                  else {
                    const parts: string[] = [`Count ${n}`]
                    if (rowMax > 0)
                      parts.push(`${((n / rowMax) * 100).toFixed(0)}% of this run's peak (${rowMax} max in any band)`)
                    if (expectedTotal > 1e-6)
                      parts.push(
                        `Run row total ${rowTotal} · ~${expectedTotal.toFixed(0)} typical total ${(100 * (rowTotal / expectedTotal)).toFixed(0)}%`,
                      )
                    if (bandAvg && bandRatio != null)
                      parts.push(`Band avg ${(avg as number).toFixed(1)} (${(bandRatio * 100).toFixed(0)}% of that)`)
                    else if (hasNum) parts.push("No band average yet")
                    title = parts.join(" · ")
                  }

                  return (
                    <td
                      key={`${g}-${ci}`}
                      className={cn(
                        "px-1.5 py-1 text-center align-middle tabular-nums border-2 border-t-transparent border-b-primary/10 border-l-transparent",
                        isLast ? "border-r-transparent" : "border-r-primary/10",
                      )}
                      style={{ backgroundColor: colors.bg, color: colors.fg }}
                      title={title}
                    >
                      {display}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
