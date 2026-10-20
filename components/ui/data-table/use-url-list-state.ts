"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useDebounce } from "./legacy-primitives"

export interface UrlListFilter {
  key: string
  defaultValues?: string[]
}

export interface UseUrlListStateOptions<TView extends string = string> {
  /** Sync search query, filter values and view mode to URL query parameters. */
  urlSync?: boolean
  /** Debounce delay in ms for the search input (default: 300). */
  debounceDelay?: number
  /** Initial query value when not synced with URL. */
  initialSearch?: string
  /** Filter definitions with their keys and optional default values. */
  filters?: readonly UrlListFilter[]
  /** Controlled filter values (if parent owns state). */
  filterValues?: Record<string, string[]>
  /** Callback when filter values change in controlled mode. */
  onFilterValuesChange?: (filters: Record<string, string[]>) => void
  /** Allowed view modes for validating the ?view= parameter. */
  validViews?: readonly TView[]
  /** Default view mode when none in URL. */
  defaultViewMode?: TView | null
  /**
   * When true, preserves existing non-managed URL parameters when updating query string.
   * Default: false (matches standard DataTable URL sync).
   */
  preserveOtherParams?: boolean
}

export function useUrlListState<TView extends string = string>({
  urlSync = false,
  debounceDelay = 300,
  initialSearch: initialSearchProp = "",
  filters = [],
  filterValues: controlledFilterValues,
  onFilterValuesChange,
  validViews,
  defaultViewMode = null,
  preserveOtherParams = false,
}: UseUrlListStateOptions<TView> = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ─── Search state ──────────────────────────────────────────────────────────
  const initialSearch = urlSync ? (searchParams.get("q") ?? initialSearchProp) : initialSearchProp
  const [searchInput, setSearchInput] = useState(initialSearch)
  const searchQuery = useDebounce(searchInput, debounceDelay)

  // ─── Filter state ──────────────────────────────────────────────────────────
  const initialFilters = useMemo(() => {
    const init: Record<string, string[]> = {}
    for (const f of filters) {
      if (urlSync) {
        const val = searchParams.getAll(f.key)
        if (val.length > 0) {
          init[f.key] = val
          continue
        }
      }
      if (f.defaultValues && f.defaultValues.length > 0) {
        init[f.key] = f.defaultValues
      }
    }
    return init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount

  const [internalFilterValues, setInternalFilterValues] = useState<Record<string, string[]>>(initialFilters)
  const isFilterControlled = controlledFilterValues !== undefined
  const filterValues = controlledFilterValues ?? internalFilterValues

  const commitFilters = useCallback(
    (updater: (prev: Record<string, string[]>) => Record<string, string[]>) => {
      const next = updater(filterValues)
      if (!isFilterControlled) setInternalFilterValues(next)
      onFilterValuesChange?.(next)
    },
    [filterValues, isFilterControlled, onFilterValuesChange]
  )

  const handleFilterChange = useCallback(
    (key: string, values: string[]) => {
      commitFilters((prev) => ({ ...prev, [key]: values }))
    },
    [commitFilters]
  )

  const removeFilterPill = useCallback(
    (key: string, value: string) => {
      commitFilters((prev) => ({ ...prev, [key]: (prev[key] ?? []).filter((v) => v !== value) }))
    },
    [commitFilters]
  )

  const clearAllFilters = useCallback(() => {
    setSearchInput("")
    commitFilters(() => ({}))
  }, [commitFilters])

  // ─── View mode state ───────────────────────────────────────────────────────
  const [manualViewMode, setManualViewMode] = useState<TView | null>(() => {
    if (!urlSync) return defaultViewMode
    const fromUrl = searchParams.get("view")
    if (!fromUrl) return defaultViewMode
    if (validViews && !validViews.includes(fromUrl as TView)) return defaultViewMode
    return fromUrl as TView
  })

  // ─── URL Sync Effect ───────────────────────────────────────────────────────
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (!urlSync) return
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const params = preserveOtherParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams()

    if (searchQuery) {
      params.set("q", searchQuery)
    } else if (preserveOtherParams) {
      params.delete("q")
    }

    if (preserveOtherParams && filters) {
      for (const f of filters) {
        params.delete(f.key)
      }
    }
    for (const [key, vals] of Object.entries(filterValues)) {
      if (preserveOtherParams) params.delete(key)
      for (const v of vals) params.append(key, v)
    }

    if (manualViewMode) {
      params.set("view", manualViewMode)
    } else if (preserveOtherParams) {
      params.delete("view")
    }

    const queryStr = params.toString()
    router.replace(queryStr ? `${pathname}?${queryStr}` : pathname, { scroll: false })
  }, [searchQuery, filterValues, manualViewMode, urlSync, pathname, router, preserveOtherParams, filters, searchParams])

  return {
    router,
    pathname,
    searchParams,
    searchInput,
    setSearchInput,
    searchQuery,
    filterValues,
    setInternalFilterValues,
    commitFilters,
    handleFilterChange,
    removeFilterPill,
    clearAllFilters,
    manualViewMode,
    setManualViewMode,
  }
}
