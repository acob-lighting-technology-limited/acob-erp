"use client"
import { useMemo, useRef, useEffect } from "react"
import { logger } from "@/lib/logger"
import type { DataTableColumn, DataTableFilter, PaginationConfig, SortConfig } from "./types"

const log = logger("components-ui-data-table-data-table")

export interface UseTableDataProcessingOptions<TData> {
  data: TData[]
  columns: DataTableColumn<TData>[]
  filters: DataTableFilter<TData>[]
  filterValues: Record<string, string[]>
  searchQuery: string
  searchFn?: (row: TData, query: string) => boolean
  sortConfig: SortConfig | null
  sortFn?: (data: TData[], sort: SortConfig) => TData[]
  getRowId: (row: TData) => string
  onProcessedDataChange?: (data: TData[]) => void
  pagination?: PaginationConfig
  clientPage: number
  pageSize: number
  isServerPagination: boolean
  totalRows?: number
}

export function useTableDataProcessing<TData>({
  data,
  columns,
  filters,
  filterValues,
  searchQuery,
  searchFn,
  sortConfig,
  sortFn,
  getRowId,
  onProcessedDataChange,
  pagination,
  clientPage,
  pageSize,
  isServerPagination,
  totalRows,
}: UseTableDataProcessingOptions<TData>) {
  // ─── Filtering ───────────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (isServerPagination) return data
    let result = data
    if (searchFn && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((row) => searchFn(row, q))
    }
    for (const filter of filters) {
      const selected = filterValues[filter.key]
      if (!selected || selected.length === 0) continue
      if (filter.filterFn) {
        result = result.filter((row) => filter.filterFn!(row, selected))
        continue
      }
      const col = columns.find((c) => c.key === filter.key)
      const accessor = col?.accessor
      const readValue = accessor
        ? (row: TData) => accessor(row)
        : (row: TData) => (row as Record<string, unknown> | null)?.[filter.key]
      if (process.env.NODE_ENV !== "production" && !accessor) {
        const resolvesOnRow = result.some((row) => (row as Record<string, unknown> | null)?.[filter.key] !== undefined)
        if (!resolvesOnRow) {
          log.warn(`[DataTable] Filter "${filter.key}" matches no column accessor and no row property.`)
        }
      }
      result = result.filter((row) => selected.includes(String(readValue(row) ?? "")))
    }
    return result
  }, [data, searchQuery, searchFn, filterValues, filters, columns, isServerPagination])

  // ─── Sorting ─────────────────────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (isServerPagination) return filteredData
    if (!sortConfig) return filteredData
    if (sortFn) return sortFn(filteredData, sortConfig)
    const col = columns.find((c) => c.key === sortConfig.key)
    if (!col?.accessor) return filteredData
    return [...filteredData].sort((a, b) => {
      const aVal = String(col.accessor!(a) ?? "")
      const bVal = String(col.accessor!(b) ?? "")
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true })
      return sortConfig.direction === "asc" ? cmp : -cmp
    })
  }, [filteredData, sortConfig, sortFn, columns, isServerPagination])

  const processedDataSignature = useMemo(() => sortedData.map((row) => getRowId(row)).join("|"), [sortedData, getRowId])
  const sortedDataRef = useRef(sortedData)
  const onProcessedDataChangeRef = useRef(onProcessedDataChange)
  useEffect(() => {
    sortedDataRef.current = sortedData
  }, [sortedData])
  useEffect(() => {
    onProcessedDataChangeRef.current = onProcessedDataChange
  }, [onProcessedDataChange])
  useEffect(() => {
    if (onProcessedDataChangeRef.current) onProcessedDataChangeRef.current(sortedDataRef.current)
  }, [processedDataSignature])

  // ─── Pagination Calculations ──────────────────────────────────────────────
  const total = isServerPagination ? (totalRows ?? data.length) : sortedData.length
  const totalPages = pagination ? Math.ceil(total / pageSize) : 1
  const paginatedData = useMemo(() => {
    if (isServerPagination || !pagination) return sortedData
    return sortedData.slice(clientPage * pageSize, (clientPage + 1) * pageSize)
  }, [sortedData, isServerPagination, pagination, clientPage, pageSize])

  return {
    filteredData,
    sortedData,
    paginatedData,
    total,
    totalPages,
  }
}
