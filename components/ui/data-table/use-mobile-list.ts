"use client"
import { useMemo } from "react"
import type { DataTableProps } from "./types"
export function useMobileList<TData>({
  mobileRow,
  listSource,
  listRendersEverything,
  isServerPagination,
  activePage,
  pageSize,
  getRowId,
}: {
  mobileRow: DataTableProps<TData>["mobileRow"]
  listSource: TData[]
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
    if (!mobileRow.groupBy) return [{ heading: null as string | null, rows: listSource }]
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
      .map(([heading, rows]) => ({ heading, rows }))
  }, [mobileRow, listSource])
  return { snByRowId, mobileGroups }
}
