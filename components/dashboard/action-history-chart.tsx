"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
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

/**
 * Heat for the Total column only: this run's total vs your typical total for that action
 * (sum of per-band `avg_count` = expected sum of bands per morgue on average). No comparison
 * to in-row peak — avoids a single low use spanning one band from reading as "max heat".
 * Bright green only when total is high relative to that baseline (~3× → full saturation).
 */
function totalCellHeat(total: number, expectedTotalSumOfBandAvgs: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  if (!Number.isFinite(expectedTotalSumOfBandAvgs) || expectedTotalSumOfBandAvgs < 1e-6) return 0
  const ratio = total / expectedTotalSumOfBandAvgs
  const FULL_AT_RATIO = 3
  return Math.max(0, Math.min(1, ratio / FULL_AT_RATIO))
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
  const [rowHighlightRect, setRowHighlightRect] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (hoverRowIndex === null) {
      setRowHighlightRect(null)
      return
    }
    const update = () => {
      const el = document.querySelector<HTMLTableRowElement>(
        `[data-action-chart-row="${hoverRowIndex}"]`,
      )
      if (!el) {
        setRowHighlightRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      setRowHighlightRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      })
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    const wrap = wrapRef.current
    const ro = wrap ? new ResizeObserver(update) : null
    if (wrap) ro?.observe(wrap)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
      ro?.disconnect()
    }
  }, [hoverRowIndex])

  const colLabels = useMemo(
    () =>
      data.levelGroups.map((g) => {
        const m = g.match(/^(\d+)-(\d+)$/)
        return m ? `${m[1]}–${m[2]}` : g
      }),
    [data.levelGroups],
  )

  const rowHighlightPortal =
    typeof document !== "undefined" &&
    hoverRowIndex !== null &&
    rowHighlightRect != null &&
    createPortal(
      <div
        aria-hidden
        className="pointer-events-none fixed z-[200] shadow-[inset_0_0_0_2px_var(--primary)]"
        style={{
          top: rowHighlightRect.top,
          left: rowHighlightRect.left,
          width: rowHighlightRect.width,
          height: rowHighlightRect.height,
        }}
      />,
      document.body,
    )

  return (
    <div
      ref={wrapRef}
      className="max-w-full min-w-0 overflow-x-auto border border-primary/25 bg-card/40"
    >
      {rowHighlightPortal}
      <table
        className={cn(
          "w-max max-w-full min-w-0 table-auto border-separate border-spacing-0 font-mono text-xs",
          typography.bodyMono,
        )}
      >
        <colgroup>
          <col style={{ maxWidth: "12rem" }} />
          {data.levelGroups.map((g, i) => (
            <col key={`${g}-${i}`} style={{ width: 120, maxWidth: 120 }} />
          ))}
          <col style={{ width: 120, maxWidth: 120 }} />
        </colgroup>
        <thead>
          <tr className="bg-muted/30">
            <th className="sticky left-0 z-50 relative max-w-48 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-2 border-b-primary/30 border-r-primary/20 border-l-transparent border-t-transparent bg-card px-2 py-1.5 text-left text-primary">
              Action
            </th>
            {data.levelGroups.map((g, ci) => (
              <th
                key={g + ci}
                className={cn(
                  "max-w-[120px] min-w-0 overflow-hidden text-ellipsis border-2 border-b-primary/30 border-l-transparent border-t-transparent px-1.5 py-1.5 text-center text-muted-foreground whitespace-nowrap",
                  "border-r-primary/15",
                )}
              >
                {colLabels[ci]}
              </th>
            ))}
            <th className="max-w-[120px] min-w-0 overflow-hidden text-ellipsis border-2 border-b-primary/30 border-l-transparent border-r-transparent border-t-transparent px-1.5 py-1.5 text-center text-muted-foreground whitespace-nowrap">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => {
            const key = normalizeActionKey(row.name)
            const avgRow = averages.get(key)
            const rowHot = hoverRowIndex === ri

            const numericVals = data.levelGroups
              .map((_, i) => row.values[i])
              .filter((x): x is number => x != null && Number.isFinite(x))
            const rowMax = numericVals.length > 0 ? Math.max(...numericVals) : 0
            const rowTotal = numericVals.reduce((a, b) => a + b, 0)
            const rowDisplayTotal =
              row.total != null && Number.isFinite(row.total)
                ? (row.total as number)
                : rowTotal > 0
                  ? rowTotal
                  : null
            const expectedTotal = sumExpectedRowTotal(data.levelGroups, avgRow)
            const globalFactor =
              expectedTotal > 1e-9 ? Math.min(1, rowTotal / expectedTotal) : 1

            const totalDisplay = rowDisplayTotal == null ? "—" : String(rowDisplayTotal)
            const totalN = rowDisplayTotal ?? 0
            const hasTotalNum = rowDisplayTotal != null
            const totalT = hasTotalNum ? totalCellHeat(totalN, expectedTotal) : 0
            const totalColors = hasTotalNum ? heatColors(totalT) : neutralCell()

            let totalTitle: string | undefined
            if (!hasTotalNum) totalTitle = undefined
            else {
              const parts: string[] = [`Total ${totalN}`]
              if (expectedTotal > 1e-6) {
                parts.push(
                  `~${expectedTotal.toFixed(1)} typical total for this action (sum of your per-band averages); this run ${(100 * (totalN / expectedTotal)).toFixed(0)}% of that`,
                )
              } else {
                parts.push("No typical total yet (needs averages from your other morgues with Action tables)")
              }
              if (rowTotal !== totalN && rowTotal > 0)
                parts.push(`Band sum ${rowTotal}`)
              if (
                row.total != null &&
                Number.isFinite(row.total) &&
                rowTotal > 0 &&
                Math.abs((row.total as number) - rowTotal) > 0.5
              )
                parts.push(`Morgue total column ${row.total} (bands sum to ${rowTotal})`)
              totalTitle = parts.join(" · ")
            }

            return (
              <tr
                key={`${key}-${ri}`}
                data-action-chart-row={ri}
                onMouseEnter={() => setHoverRowIndex(ri)}
                onMouseLeave={() => setHoverRowIndex(null)}
              >
                <td
                  className={cn(
                    "sticky left-0 max-w-48 min-w-0 bg-card px-2 py-1 text-left text-foreground align-top border-2 overflow-visible",
                    rowHot
                      ? "relative z-[45] border-t-transparent border-b-primary/10 border-r-primary/20 border-l-transparent"
                      : "relative z-10 border-t-transparent border-r-primary/20 border-b-primary/10 border-l-transparent",
                  )}
                  title={row.name}
                >
                  <span className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                    {row.name}
                  </span>
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
                        "max-w-[120px] min-w-0 overflow-visible px-1.5 py-1 text-center align-middle tabular-nums border-2 border-t-transparent border-b-primary/10 border-l-transparent border-r-primary/10",
                      )}
                      style={{ backgroundColor: colors.bg, color: colors.fg }}
                      title={title}
                    >
                      {display}
                    </td>
                  )
                })}
                <td
                  className={cn(
                    "max-w-[120px] min-w-0 overflow-visible px-1.5 py-1 text-center align-middle tabular-nums border-2 border-t-transparent border-r-transparent border-b-primary/10 border-l-transparent",
                  )}
                  style={{ backgroundColor: totalColors.bg, color: totalColors.fg }}
                  title={totalTitle}
                >
                  {totalDisplay}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
