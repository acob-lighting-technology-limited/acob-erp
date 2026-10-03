"use client"
import {
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { type DragEndEvent, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { LayoutGrid, List, Table2 as TableProperties, Inbox } from "lucide-react"
import { TableExportContext } from "./export-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMobileList } from "./use-mobile-list"
import type { DataTableProps, PaginationConfig, SortConfig } from "./types"
import { getDetailConfig } from "./detail-config"
import { logger } from "@/lib/logger"
import { useColumnResize } from "./legacy-primitives"
import { useUrlListState } from "./use-url-list-state"
const log = logger("components-ui-data-table-data-table")
const AUTO_PAGINATE_AFTER = 200
const AUTO_PAGINATION: PaginationConfig = { pageSize: 50 }
export function useDataTableState<TData>({
  export: tableExport,
  data,
  columns,
  getRowId,
  // Search
  searchPlaceholder = "Search...",
  searchFn,
  searchDisabled = false,
  // Filters
  filters = [],
  filterValues: controlledFilterValues,
  onFilterValuesChange,
  // Sorting
  sortFn,
  // Pagination
  pagination: paginationProp,
  totalRows,
  currentPage = 0,
  onPageChange,
  onSearchChange,
  onFilterChange,
  onProcessedDataChange,
  // Expandable
  expandable,
  expandableColumnPosition = "start",
  // Actions
  rowActions,
  forceRowActionsDropdown,
  bulkActions,
  selectable = false,
  // View
  viewToggle = false,
  cardRenderer,
  contactsView = false,
  defaultViewMode,
  mobileRow,
  // URL sync
  urlSync = false,
  // Appearance
  headerClassName = "bg-muted/80",
  minWidth,
  showRowNumbers = true,
  columnToggle = true,
  stickyToolbar = false,
  skeletonRows = 8,
  // State
  isLoading = false,
  error = null,
  onRetry,
  // Empty
  emptyIcon: EmptyIcon = Inbox,
  emptyTitle = "No results found",
  emptyDescription = "Try adjusting your search or filters.",
  emptyAction,
}: DataTableProps<TData>) {
  const pageExport = useContext(TableExportContext)
  const exportConfig = tableExport === undefined ? pageExport?.config : tableExport
  // A table with no pagination renders every row. Past AUTO_PAGINATE_AFTER rows
  // that is thousands of DOM nodes on a phone, so page it at 50 unless the
  // caller chose otherwise (audit 7.3).
  const pagination = paginationProp ?? (data.length > AUTO_PAGINATE_AFTER ? AUTO_PAGINATION : undefined)
  const expandAtStart = expandableColumnPosition !== "end"
  // ─── Column resize ─────────────────────────────────────────────────────────
  const initialColWidths = useMemo(() => {
    const map: Record<string, number> = {}
    for (const col of columns) {
      if (col.resizable && col.initialWidth) map[col.key] = col.initialWidth
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // stable on mount
  const { colWidths, startResize } = useColumnResize(initialColWidths)

  // ─── URL Sync & List State (Search, Filters, View Mode) ───────────────────
  const {
    searchInput,
    setSearchInput,
    searchQuery,
    filterValues,
    commitFilters,
    handleFilterChange,
    removeFilterPill,
    clearAllFilters,
    manualViewMode,
    setManualViewMode,
  } = useUrlListState<"list" | "card" | "contacts">({
    urlSync,
    debounceDelay: 300,
    filters,
    filterValues: controlledFilterValues,
    onFilterValuesChange,
    validViews: ["list", "card", "contacts"],
  })

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [detailRow, setDetailRow] = useState<TData | null>(null)
  const detailConfig = useMemo(() => getDetailConfig(mobileRow, columns), [mobileRow, columns])

  // ─── View mode (user-controlled; never auto-switch) ──────────────────────
  const contactsAvailable = contactsView && Boolean(mobileRow)
  const isMobile = useIsMobile()
  const resolvedDefaultViewMode =
    defaultViewMode && typeof defaultViewMode === "object"
      ? isMobile
        ? defaultViewMode.mobile
        : defaultViewMode.desktop
      : defaultViewMode
  const requestedViewMode = manualViewMode ?? resolvedDefaultViewMode ?? "list"
  const viewMode = requestedViewMode === "contacts" && !contactsAvailable ? "list" : requestedViewMode

  const responsivePair =
    !manualViewMode &&
    contactsAvailable &&
    !mobileRow?.groupBy &&
    defaultViewMode &&
    typeof defaultViewMode === "object" &&
    defaultViewMode.mobile === "contacts" &&
    defaultViewMode.desktop === "list"
  // ─── Trigger external search callback ──────────────────────────────────────
  useEffect(() => {
    if (onSearchChange) onSearchChange(searchQuery)
  }, [searchQuery, onSearchChange])
  // ─── Trigger external filter callback ──────────────────────────────────────
  useEffect(() => {
    if (onFilterChange) onFilterChange(filterValues)
  }, [filterValues, onFilterChange])
  // ─── Sort state ────────────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  // ─── Expanded rows ─────────────────────────────────────────────────────────
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  // ─── Selected rows ─────────────────────────────────────────────────────────
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  // ─── Sticky offsets ───────────────────────────────────────────────────────
  // Group headings stick *below* the pinned toolbar, not at the viewport top —
  // otherwise the letter slides under the toolbar and the section is unlabelled
  // exactly while you are scrolling through it. The toolbar's height varies with
  // breakpoint and filter count, so it is measured rather than guessed.
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (!stickyToolbar) {
      root.style.setProperty("--dt-sticky-offset", "0px")
      return
    }
    // Matches the toolbar's top: app bar plus any sticky app banner (--app-banner-h).
    const measure = () => {
      const height = toolbarRef.current?.offsetHeight ?? 0
      root.style.setProperty("--dt-sticky-offset", `calc(4rem + var(--app-banner-h, 0px) + ${height}px)`)
    }
    measure()
    const node = toolbarRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [stickyToolbar])
  // ─── Column visibility ────────────────────────────────────────────────────
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultVisible === false).map((c) => c.key))
  )
  // ─── Column order (drag-to-reorder) ───────────────────────────────────────
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map((c) => c.key))
  // Keep order in sync when columns prop changes (e.g. tab switch)
  useEffect(() => {
    setColumnOrder((prev) => {
      const incoming = columns.map((c) => c.key)
      // Preserve existing order for keys that still exist, append new ones
      const kept = prev.filter((k) => incoming.includes(k))
      const added = incoming.filter((k) => !prev.includes(k))
      return [...kept, ...added]
    })
  }, [columns])
  const orderedColumns = useMemo(
    () =>
      columnOrder.map((key) => columns.find((c) => c.key === key)).filter((c): c is (typeof columns)[number] => !!c),
    [columns, columnOrder]
  )
  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => !hiddenColumns.has(c.key)),
    [orderedColumns, hiddenColumns]
  )
  // ─── DnD sensors ─────────────────────────────────────────────────────────
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
  // ─── Client page ──────────────────────────────────────────────────────────
  const [clientPage, setClientPage] = useState(0)
  const isServerPagination = pagination?.serverSide === true
  const activePage = isServerPagination ? currentPage : clientPage
  const pageSize = pagination?.pageSize ?? data.length
  // ─── Reset page on filter/search/dataset change ───────────────────────────
  // data.length covers the parent swapping the row set under us (e.g. a scope
  // tab), which would otherwise strand the user on a page that no longer exists.
  useEffect(() => {
    if (!isServerPagination) setClientPage(0)
  }, [searchQuery, filterValues, data.length, isServerPagination])
  // ─── Filtering ─────────────────────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (isServerPagination) return data
    let result = data
    // Search
    if (searchFn && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((row) => searchFn(row, q))
    }
    // Filters
    for (const filter of filters) {
      const selected = filterValues[filter.key]
      if (!selected || selected.length === 0) continue
      // An explicit filterFn always wins, whether or not mode is "custom" —
      // cross-column filters supply one without setting mode.
      if (filter.filterFn) {
        result = result.filter((row) => filter.filterFn!(row, selected))
        continue
      }
      // Otherwise match the column sharing this filter's key. Plenty of filters
      // key off a field that is displayed via a custom `render` (so the column
      // has no accessor) or is not shown as a column at all; for those, read the
      // row's own property of that name rather than silently filtering nothing.
      const col = columns.find((c) => c.key === filter.key)
      const accessor = col?.accessor
      const readValue = accessor
        ? (row: TData) => accessor(row)
        : (row: TData) => (row as Record<string, unknown> | null)?.[filter.key]
      if (process.env.NODE_ENV !== "production" && !accessor) {
        const resolvesOnRow = result.some((row) => (row as Record<string, unknown> | null)?.[filter.key] !== undefined)
        if (!resolvesOnRow) {
          log.warn(
            `[DataTable] Filter "${filter.key}" matches no column accessor and no row property, ` +
              `so selecting it will not filter anything. Add a column with this key and an ` +
              `accessor, or give the filter a filterFn.`
          )
        }
      }
      result = result.filter((row) => selected.includes(String(readValue(row) ?? "")))
    }
    return result
  }, [data, searchQuery, searchFn, filterValues, filters, columns, isServerPagination])
  // ─── Sorting ───────────────────────────────────────────────────────────────
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
  // Keep the latest sortedData in a ref so the effect can read it without
  // depending on its (unstable) identity. `sortedData` gets a new reference
  // whenever the parent rebuilds the `columns` array (a common inline pattern),
  // and including it here would refire this effect → re-render the parent →
  // new columns → new sortedData → infinite loop (React #185). The signature
  // is the real "did the result set change?" trigger.
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
  // ─── Pagination ────────────────────────────────────────────────────────────
  const total = isServerPagination ? (totalRows ?? data.length) : sortedData.length
  const totalPages = pagination ? Math.ceil(total / pageSize) : 1
  const paginatedData = useMemo(() => {
    if (isServerPagination || !pagination) return sortedData
    return sortedData.slice(clientPage * pageSize, (clientPage + 1) * pageSize)
  }, [sortedData, isServerPagination, pagination, clientPage, pageSize])
  // ─── Active filters summary ────────────────────────────────────────────────
  const activeFilterPills = useMemo(() => {
    const pills: { key: string; value: string; label: string }[] = []
    for (const filter of filters) {
      const selected = filterValues[filter.key] ?? []
      for (const val of selected) {
        const opt = filter.options.find((o: { value: string }) => o.value === val)
        pills.push({ key: filter.key, value: val, label: `${filter.label}: ${opt?.label ?? val}` })
      }
    }
    return pills
  }, [filters, filterValues])
  const hasActiveFilters = searchQuery.trim().length > 0 || activeFilterPills.length > 0
  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) return prev.direction === "asc" ? { key, direction: "desc" } : null
      return { key, direction: "asc" }
    })
  }, [])
  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])
  const toggleSelect = useCallback((id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
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
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (isServerPagination && onPageChange) onPageChange(newPage)
      else setClientPage(newPage)
    },
    [isServerPagination, onPageChange]
  )
  // ─── Keyboard navigation on rows ─────────────────────────────────────────
  const tableBodyRef = useRef<HTMLTableSectionElement>(null)
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
  // Where the pointer went down on a row, so a click that was really a text-selection
  // drag doesn't get treated as "expand this row".
  const rowPointerDownRef = useRef<{ x: number; y: number } | null>(null)
  /** True when the click was a drag or left text highlighted — i.e. the user was copying. */
  const clickWasTextSelection = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    const origin = rowPointerDownRef.current
    rowPointerDownRef.current = null
    if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > 4) return true
    return Boolean(window.getSelection()?.toString().trim())
  }, [])
  const selectedItems = useMemo(
    () => data.filter((row) => selectedRows.has(getRowId(row))),
    [data, selectedRows, getRowId]
  )
  // ─── Column count for colSpan ─────────────────────────────────────────────
  const totalCols =
    visibleColumns.length +
    (selectable ? 1 : 0) +
    (showRowNumbers && expandable && expandAtStart ? 1 : (showRowNumbers ? 1 : 0) + (expandable ? 1 : 0)) +
    (rowActions && rowActions.length > 0 ? 1 : 0)
  // ─── Toolbar (shared across all states) ──────────────────────────────────
  // Three genuinely distinct renderings, and they stay distinct at every width:
  // List is the row anatomy, Cards is the grid, Table is the real table (which
  // scrolls horizontally on a phone rather than being swapped for the list).
  // `hideOnMobile` is also ignored here — it exists to squeeze a table that is a
  // page's *only* mobile rendering, and choosing Table over an available List is
  // an explicit request to see the columns.
  const viewOptions = [
    // "Contacts" only when the list is actually grouped like an address book;
    // on a records page it is just the list view and must not claim otherwise.
    ...(contactsAvailable
      ? [
          mobileRow?.groupBy
            ? { key: "contacts" as const, label: "Contacts", Icon: List, hint: "Contacts list (A–Z)" }
            : { key: "contacts" as const, label: "List", Icon: List, hint: "List view" },
        ]
      : []),
    ...(cardRenderer ? [{ key: "card" as const, label: "Cards", Icon: LayoutGrid, hint: "Card grid" }] : []),
    { key: "list" as const, label: "Table", Icon: TableProperties, hint: "Data table" },
  ]
  const showViewToggle = viewToggle && viewOptions.length > 1
  const showToolbar = !searchDisabled || filters.length > 0 || columnToggle || showViewToggle
  const listRendersEverything = viewMode === "contacts" && Boolean(mobileRow?.groupBy)
  const listSource = listRendersEverything ? sortedData : paginatedData
  const { snByRowId, mobileGroups } = useMobileList({
    mobileRow,
    listSource,
    allRows: sortedData,
    listRendersEverything,
    isServerPagination,
    activePage,
    pageSize,
    getRowId,
  })
  return {
    columns,
    searchPlaceholder,
    searchDisabled,
    filters,
    columnToggle,
    stickyToolbar,
    searchInput,
    setSearchInput,
    filterValues,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    setManualViewMode,
    contactsAvailable,
    viewMode,
    responsivePair,
    toolbarRef,
    hiddenColumns,
    setHiddenColumns,
    activeFilterPills,
    handleFilterChange,
    clearAllFilters,
    viewOptions,
    showViewToggle,
    showToolbar,
    data,
    bulkActions,
    selectable,
    isLoading,
    error,
    pagination,
    searchQuery,
    selectedRows,
    setSelectedRows,
    activePage,
    pageSize,
    sortedData,
    total,
    hasActiveFilters,
    removeFilterPill,
    selectedItems,
    getRowId,
    expandable,
    rowActions,
    forceRowActionsDropdown,
    headerClassName,
    minWidth,
    showRowNumbers,
    EmptyIcon,
    emptyTitle,
    emptyDescription,
    emptyAction,
    expandAtStart,
    colWidths,
    startResize,
    sortConfig,
    expandedRows,
    visibleColumns,
    sensors,
    handleColumnDragEnd,
    paginatedData,
    handleSort,
    toggleExpand,
    toggleSelect,
    toggleSelectAll,
    tableBodyRef,
    handleRowKeyDown,
    rowPointerDownRef,
    clickWasTextSelection,
    totalCols,
    mobileRow,
    setDetailRow,
    detailConfig,
    snByRowId,
    mobileGroups,
    detailRow,
    cardRenderer,
    skeletonRows,
    onRetry,
    pageExport,
    exportConfig,
    rootRef,
    isServerPagination,
    totalPages,
    handlePageChange,
    listRendersEverything,
    listSource,
  }
}
