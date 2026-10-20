"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import { type DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import type { DataTableColumn } from "./types"

export interface UseColumnOrderVisibilityOptions<TData> {
  columns: DataTableColumn<TData>[]
}

export function useColumnOrderVisibility<TData>({ columns }: UseColumnOrderVisibilityOptions<TData>) {
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultVisible === false).map((c) => c.key))
  )
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map((c) => c.key))

  // Keep the user's order, drop removed columns, append new ones — adjusted during render.
  const [orderedFor, setOrderedFor] = useState(columns)
  if (orderedFor !== columns) {
    setOrderedFor(columns)
    setColumnOrder((prev) => {
      const incoming = columns.map((c) => c.key)
      const kept = prev.filter((k) => incoming.includes(k))
      const added = incoming.filter((k) => !prev.includes(k))
      return [...kept, ...added]
    })
  }

  const orderedColumns = useMemo(
    () =>
      columnOrder.map((key) => columns.find((c) => c.key === key)).filter((c): c is (typeof columns)[number] => !!c),
    [columns, columnOrder]
  )
  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => !hiddenColumns.has(c.key)),
    [orderedColumns, hiddenColumns]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIdx = prev.indexOf(String(active.id))
        const newIdx = prev.indexOf(String(over.id))
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }, [])

  return {
    hiddenColumns,
    setHiddenColumns,
    columnOrder,
    setColumnOrder,
    orderedColumns,
    visibleColumns,
    sensors,
    handleColumnDragEnd,
  }
}
