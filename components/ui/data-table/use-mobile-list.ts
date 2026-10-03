"use client"
import { useMemo, type ReactNode } from "react"
import type { DataTableProps } from "./types"
export function useMobileList<TData>({
  mobileRow,
  listSource,
  allRows,
  listRendersEverything,
  isServerPagination,
  activePage,
  pageSize,
  getRowId,
}: {
  mobileRow: DataTableProps<TData>["mobileRow"]
  listSource: TData[]
  /** Every row after filter and sort — section summaries cover the whole section, not one page. */
  allRows: TData[]
  listRendersEverything: boolean
  isServerPagination: boolean
  activePage: number
  pageSize: number
  getRowId: (row: TData) => string
}) {
  // Serial numbers count down the list actually being rendered — the whole set
  // starts at 1, a page carries its own offset.
  const snByRowId = useMemo(() => {
    const offset = listRendersEverything || isServerPagination ? 0 : activePage * pageSize
    const map = new Map<string, number>()
    listSource.forEach((row, index) => map.set(getRowId(row), offset + index + 1))
    return map
  }, [listSource, listRendersEverything, isServerPagination, activePage, pageSize, getRowId])
  const mobileGroups = useMemo(() => {
    if (!mobileRow) return []
    const sections = mobileRow.sections
    if (sections) {
      // Records sections keep data order (newest week first when sorted by date).
      const page = new Map<string, TData[]>()
      for (const row of listSource) {
        const heading = sections.by(row)
        if (!page.has(heading)) page.set(heading, [])
        page.get(heading)!.push(row)
      }
      const summaries = new Map<string, ReactNode>()
      if (sections.summary) {
        const all = new Map<string, TData[]>()
        for (const row of allRows) {
          const heading = sections.by(row)
          if (!page.has(heading)) continue
          if (!all.has(heading)) all.set(heading, [])
          all.get(heading)!.push(row)
        }
        for (const [heading, rows] of all) summaries.set(heading, sections.summary(rows))
      }
      return Array.from(page.entries()).map(([heading, rows]) => ({
        heading: heading as string | null,
        summary: summaries.get(heading) ?? null,
        rows,
      }))
    }
    if (!mobileRow.groupBy) return [{ heading: null as string | null, summary: null as ReactNode, rows: listSource }]
    const map = new Map<string, TData[]>()
    for (const row of listSource) {
      const heading = mobileRow.groupBy(row)
      if (!map.has(heading)) map.set(heading, [])
      map.get(heading)!.push(row)
    }
    // Sections are ordered by their heading, not by which row happened to appear
    // first: sort the table by any column and the A–Z book must still read A–Z.
    // Headings that do not start with a letter or digit ("#", "—") collect at the
    // end, the way a contacts app files them.
    const isSymbol = (heading: string) => !/^[\p{L}\p{N}]/u.test(heading)
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        if (isSymbol(a) !== isSymbol(b)) return isSymbol(a) ? 1 : -1
        return a.localeCompare(b, undefined, { numeric: true })
      })
      .map(([heading, rows]) => ({ heading: heading as string | null, summary: null as ReactNode, rows }))
  }, [mobileRow, listSource, allRows])
  return { snByRowId, mobileGroups }
}
