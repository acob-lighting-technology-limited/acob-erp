"use client"
import { useState, useCallback, useRef, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react"
import type { ExpandableConfig } from "./types"

export interface UseRowInteractionOptions<TData> {
  data: TData[]
  paginatedData: TData[]
  getRowId: (row: TData) => string
  expandable?: ExpandableConfig<TData>
}

export function useRowInteraction<TData>({
  data,
  paginatedData,
  getRowId,
  expandable,
}: UseRowInteractionOptions<TData>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const tableBodyRef = useRef<HTMLTableSectionElement>(null)
  const rowPointerDownRef = useRef<{ x: number; y: number } | null>(null)

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedRows.size === paginatedData.length && paginatedData.length > 0) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(paginatedData.map(getRowId)))
    }
  }, [paginatedData, selectedRows.size, getRowId])

  const handleRowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableRowElement>, rowId: string) => {
      if (!tableBodyRef.current) return
      const rows = Array.from(tableBodyRef.current.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]"))
      const idx = rows.findIndex((r) => r.dataset.rowId === rowId)
      if (e.key === "ArrowDown" && idx < rows.length - 1) {
        e.preventDefault()
        rows[idx + 1]?.focus()
      } else if (e.key === "ArrowUp" && idx > 0) {
        e.preventDefault()
        rows[idx - 1]?.focus()
      } else if (e.key === "Enter" || e.key === " ") {
        if (expandable) {
          e.preventDefault()
          toggleExpand(rowId)
        }
      }
    },
    [expandable, toggleExpand]
  )

  const clickWasTextSelection = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    const origin = rowPointerDownRef.current
    rowPointerDownRef.current = null
    if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 4) return true
    return Boolean(window.getSelection()?.toString().trim())
  }, [])

  return {
    expandedRows,
    setExpandedRows,
    selectedRows,
    setSelectedRows,
    tableBodyRef,
    rowPointerDownRef,
    toggleExpand,
    toggleSelect,
    toggleSelectAll,
    handleRowKeyDown,
    clickWasTextSelection,
  }
}
