"use client"
import { useContext, useState, useMemo, useCallback, useEffect, useRef } from "react"
import { LayoutGrid, List, Table2 as TableProperties, Inbox } from "lucide-react"
import { TableExportContext } from "./export-context"
import { useIsMobile } from "@/hooks/use-mobile"
import { useMobileList } from "./use-mobile-list"
import type { DataTableProps, PaginationConfig, SortConfig } from "./types"
import { getDetailConfig } from "./detail-config"
import { useColumnResize } from "./legacy-primitives"
import { useUrlListState } from "./use-url-list-state"
import { useRowInteraction } from "./use-row-interaction"
import { useTableDataProcessing } from "./use-table-data-processing"
import { useColumnOrderVisibility } from "./use-column-order-visibility"

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
  }, [])
  const { colWidths, startResize } = useColumnResize(initialColWidths)

  // ─── URL Sync & List State ───────────────────────────────────────────────
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

  // ─── View mode ───────────────────────────────────────────────────────────
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

  // ─── External callbacks ──────────────────────────────────────────────────
  useEffect(() => {
    if (onSearchChange) onSearchChange(searchQuery)
  }, [searchQuery, onSearchChange])

  useEffect(() => {
    if (onFilterChange) onFilterChange(filterValues)
  }, [filterValues, onFilterChange])

  // ─── Sorting State ───────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)

  // ─── Sticky offsets ───────────────────────────────────────────────────────
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (!stickyToolbar) {
      root.style.setProperty("--dt-sticky-offset", "0px")
      return
    }
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

  // ─── Column visibility & order ───────────────────────────────────────────
  const { hiddenColumns, setHiddenColumns, visibleColumns, sensors, handleColumnDragEnd, columnOrder } =
    useColumnOrderVisibility({ columns })

  // ─── Pagination ──────────────────────────────────────────────────────────
  const [clientPage, setClientPage] = useState(0)
  const isServerPagination = pagination?.serverSide === true
  const activePage = isServerPagination ? currentPage : clientPage
  const pageSize = pagination?.pageSize ?? data.length

  useEffect(() => {
    if (!isServerPagination) setClientPage(0)
  }, [searchQuery, filterValues, data.length, isServerPagination])

  // ─── Data processing (Filter, Sort, Paginate) ────────────────────────────
  const { filteredData, sortedData, paginatedData, total, totalPages } = useTableDataProcessing({
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
  })

  // ─── Row Interaction (Selection, Expansion, Keyboard Nav) ─────────────────
  const {
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
  } = useRowInteraction({
    data,
    paginatedData,
    getRowId,
    expandable,
  })

  // ─── Active filters summary ──────────────────────────────────────────────
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

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleSort = useCallback((key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) return prev.direction === "asc" ? { key, direction: "desc" } : null
      return { key, direction: "asc" }
    })
  }, [])

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (isServerPagination && onPageChange) onPageChange(newPage)
      else setClientPage(newPage)
    },
    [isServerPagination, onPageChange]
  )

  const selectedItems = useMemo(
    () => data.filter((row) => selectedRows.has(getRowId(row))),
    [data, selectedRows, getRowId]
  )

  const totalCols =
    visibleColumns.length +
    (selectable ? 1 : 0) +
    (showRowNumbers && expandable && expandAtStart ? 1 : (showRowNumbers ? 1 : 0) + (expandable ? 1 : 0)) +
    (rowActions && rowActions.length > 0 ? 1 : 0)

  const viewOptions = [
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
    commitFilters,
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
    setExpandedRows,
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
