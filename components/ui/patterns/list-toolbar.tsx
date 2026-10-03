"use client"

import React, { useState, useEffect, type ReactNode } from "react"
import { Search, X, SlidersHorizontal as FiltersIcon, type LucideIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableMultiSelect } from "@/components/ui/searchable-multi-select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { DataTableFilter } from "@/components/ui/data-table/types"
import { useUrlListState, type UrlListFilter } from "@/components/ui/data-table/use-url-list-state"

export { useUrlListState }

/** Debounces list queries without coupling the shared toolbar to a data source. */
export function useDebouncedListSearch(value: string, delay = 250): string {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export interface ListToolbarSearchConfig {
  value?: string
  onChange?: (value: string) => void
  onDebouncedChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  debounceMs?: number
  minLength?: number
  "aria-label"?: string
}

export interface ListToolbarViewOption<TView extends string = string> {
  key: TView
  label: string
  Icon: LucideIcon
  hint?: string
}

export interface ListToolbarViewConfig<TView extends string = string> {
  value: TView
  onChange: (value: TView) => void
  options: ListToolbarViewOption<TView>[]
}

export interface ListToolbarProps<TData = unknown, TView extends string = string> {
  /** Search configuration, custom ReactNode, or false to disable */
  search?: ListToolbarSearchConfig | ReactNode | boolean
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  onDebouncedSearchChange?: (debounced: string) => void

  /** Filter configuration (array of DataTableFilter) or custom ReactNode */
  filters?: DataTableFilter<TData>[] | ReactNode
  filterValues?: Record<string, string[]>
  onFilterValuesChange?: (filters: Record<string, string[]>) => void
  onFilterChange?: (key: string, values: string[]) => void

  /** View toggle configuration or custom ReactNode */
  view?: ListToolbarViewConfig<TView> | ReactNode
  viewMode?: TView
  onViewChange?: (view: TView) => void
  viewOptions?: ListToolbarViewOption<TView>[]

  /** Additional actions slot (refresh, create, export buttons, etc.) */
  actions?: ReactNode

  /** Always-visible count for records rendered below this toolbar */
  resultCount?: number
  resultLabel?: string

  /** Sync search, filter, and view state to URL query params */
  urlSync?: boolean
  preserveOtherParams?: boolean

  className?: string
}

function isSearchConfig(search: unknown): search is ListToolbarSearchConfig {
  return typeof search === "object" && search !== null && !React.isValidElement(search)
}

function isViewConfig<TView extends string>(view: unknown): view is ListToolbarViewConfig<TView> {
  return typeof view === "object" && view !== null && "options" in view && !React.isValidElement(view)
}

export function ListToolbar<TData = unknown, TView extends string = string>({
  search,
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  onDebouncedSearchChange,
  filters,
  filterValues: controlledFilterValues,
  onFilterValuesChange,
  onFilterChange,
  view,
  viewMode: controlledViewMode,
  onViewChange,
  viewOptions: rawViewOptions,
  actions,
  resultCount,
  resultLabel = "results",
  urlSync = false,
  preserveOtherParams = true,
  className,
}: ListToolbarProps<TData, TView>) {
  const isFilterArray = Array.isArray(filters)
  const filterDefs: readonly UrlListFilter[] = isFilterArray
    ? (filters as DataTableFilter<TData>[]).map((f) => ({ key: f.key, defaultValues: f.defaultValues }))
    : []

  const searchConfig = isSearchConfig(search) ? search : undefined
  const viewConfig = isViewConfig<TView>(view) ? view : undefined

  const searchVal = searchConfig?.value ?? searchValue
  const onSearchValChange = searchConfig?.onChange ?? onSearchChange
  const onDebouncedValChange = searchConfig?.onDebouncedChange ?? onDebouncedSearchChange
  const searchPlaceholderText = searchConfig?.placeholder ?? searchPlaceholder
  const searchDisabled = search === false || searchConfig?.disabled === true
  const searchMinLength = searchConfig?.minLength ?? 0
  const debounceDelay = searchConfig?.debounceMs ?? 250

  const resolvedViewMode = viewConfig?.value ?? controlledViewMode
  const resolvedOnViewChange = viewConfig?.onChange ?? onViewChange
  const resolvedViewOptions = viewConfig?.options ?? rawViewOptions

  const urlState = useUrlListState<TView>({
    urlSync,
    debounceDelay,
    filters: filterDefs,
    filterValues: controlledFilterValues,
    onFilterValuesChange,
    validViews: resolvedViewOptions?.map((o) => o.key),
    preserveOtherParams,
  })

  // Connect search state
  const isSearchControlled = searchVal !== undefined
  const currentSearchInput = isSearchControlled ? searchVal : urlState.searchInput
  const debouncedQuery = useDebouncedListSearch(currentSearchInput, debounceDelay)

  const handleSearchInput = (val: string) => {
    if (isSearchControlled) {
      onSearchValChange?.(val)
    } else {
      urlState.setSearchInput(val)
    }
  }

  useEffect(() => {
    if (onDebouncedValChange) {
      if (searchMinLength > 0 && debouncedQuery.trim().length > 0 && debouncedQuery.trim().length < searchMinLength) {
        onDebouncedValChange("")
      } else {
        onDebouncedValChange(debouncedQuery)
      }
    }
  }, [debouncedQuery, onDebouncedValChange, searchMinLength])

  // Connect filter state
  const activeFilterValues = controlledFilterValues ?? urlState.filterValues
  const handleFilterUpdate = (key: string, values: string[]) => {
    if (onFilterChange) {
      onFilterChange(key, values)
    }
    urlState.handleFilterChange(key, values)
  }

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Calculate active filter count for mobile badge
  const activeFilterCount = isFilterArray
    ? (filters as DataTableFilter<TData>[]).reduce((acc, f) => {
        const vals = activeFilterValues[f.key]
        return acc + (vals && vals.length > 0 ? vals.length : 0)
      }, 0)
    : 0

  // Render search box
  const renderSearch = () => {
    if (searchDisabled) return null
    if (React.isValidElement(search)) return search

    return (
      <div className="relative min-w-0 flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={searchPlaceholderText}
          value={currentSearchInput}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="h-9 pr-9 pl-10"
          aria-label={searchConfig?.["aria-label"] ?? "Search"}
        />
        {currentSearchInput ? (
          <button
            type="button"
            onClick={() => handleSearchInput("")}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    )
  }

  // Render filters
  const renderFilters = () => {
    if (!filters) return null
    if (React.isValidElement(filters)) return filters
    if (!isFilterArray || (filters as DataTableFilter<TData>[]).length === 0) return null

    const filterList = filters as DataTableFilter<TData>[]

    return (
      <>
        {/* Mobile filter sheet trigger */}
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="relative h-9 w-9 md:hidden" aria-label="Filters">
              <FiltersIcon className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto px-4 sm:px-6">
            <div className="mx-auto w-full max-w-lg space-y-4 py-2">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="space-y-3 pb-2">
                {filterList.map((filter) => (
                  <div key={filter.key} className="space-y-1.5">
                    <p className="text-muted-foreground text-xs font-medium">{filter.label}</p>
                    {filter.render ? (
                      filter.render(activeFilterValues[filter.key] ?? [], (vals) =>
                        handleFilterUpdate(filter.key, vals)
                      )
                    ) : filter.multi === false ? (
                      <Select
                        value={activeFilterValues[filter.key]?.[0] ?? "all"}
                        onValueChange={(val) => handleFilterUpdate(filter.key, val === "all" ? [] : [val])}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={filter.placeholder ?? filter.label} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{filter.placeholder ?? `All ${filter.label}`}</SelectItem>
                          {filter.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <SearchableMultiSelect
                        label={filter.label}
                        icon={filter.icon}
                        values={activeFilterValues[filter.key] ?? []}
                        options={filter.options}
                        onChange={(vals) => handleFilterUpdate(filter.key, vals)}
                        placeholder={filter.placeholder ?? `All ${filter.label}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <SheetFooter className="flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    urlState.clearAllFilters()
                    if (onFilterValuesChange) onFilterValuesChange({})
                  }}
                >
                  Clear all
                </Button>
                <SheetClose asChild>
                  <Button className="flex-1">Apply</Button>
                </SheetClose>
              </SheetFooter>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop filter selects */}
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          {filterList.map((filter) =>
            filter.render ? (
              <div key={filter.key}>
                {filter.render(activeFilterValues[filter.key] ?? [], (vals) => handleFilterUpdate(filter.key, vals))}
              </div>
            ) : filter.multi === false ? (
              <Select
                key={filter.key}
                value={activeFilterValues[filter.key]?.[0] ?? "all"}
                onValueChange={(val) => handleFilterUpdate(filter.key, val === "all" ? [] : [val])}
              >
                <SelectTrigger className="h-9 w-32.5 sm:w-37.5">
                  <SelectValue placeholder={filter.placeholder ?? filter.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{filter.placeholder ?? `All ${filter.label}`}</SelectItem>
                  {filter.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <SearchableMultiSelect
                key={filter.key}
                label={filter.label}
                icon={filter.icon}
                values={activeFilterValues[filter.key] ?? []}
                options={filter.options}
                onChange={(vals) => handleFilterUpdate(filter.key, vals)}
                placeholder={filter.placeholder ?? `All ${filter.label}`}
              />
            )
          )}
        </div>
      </>
    )
  }

  // Render view toggle
  const renderViewToggle = () => {
    if (React.isValidElement(view)) return view
    if (!resolvedViewOptions || resolvedViewOptions.length <= 1) return null

    const currentMode = resolvedViewMode ?? urlState.manualViewMode ?? resolvedViewOptions[0]?.key

    const setMode = (key: TView) => {
      if (resolvedOnViewChange) {
        resolvedOnViewChange(key)
      } else {
        urlState.setManualViewMode(key)
      }
    }

    return (
      <div
        className="border-input inline-flex h-9 items-center rounded-lg border bg-transparent p-1"
        role="group"
        aria-label="View mode"
      >
        {resolvedViewOptions.map(({ key, label, Icon, hint }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setMode(key)}
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  currentMode === key
                    ? "bg-muted text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={`${label} view`}
                aria-pressed={currentMode === key}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            </TooltipTrigger>
            {hint && (
              <TooltipContent side="top">
                <p>{hint}</p>
              </TooltipContent>
            )}
          </Tooltip>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
          {renderSearch()}
          {renderFilters()}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {renderViewToggle()}
          {actions}
        </div>
      </div>
      {typeof resultCount === "number" && (
        <p className="text-muted-foreground text-sm">
          {resultCount} {resultCount === 1 ? resultLabel.replace(/s$/, "") : resultLabel}
        </p>
      )}
    </div>
  )
}
