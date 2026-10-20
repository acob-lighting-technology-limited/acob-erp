"use client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { useDataTableState } from "./use-data-table-state"
import { FilterPill } from "./legacy-primitives"

export function DataTableStatusBar<TData>({ state }: { state: ReturnType<typeof useDataTableState<TData>> }) {
  const {
    data,
    bulkActions,
    selectable,
    isLoading,
    error,
    pagination,
    setSearchInput,
    searchQuery,
    selectedRows,
    setSelectedRows,
    activePage,
    pageSize,
    sortedData,
    total,
    activeFilterPills,
    hasActiveFilters,
    removeFilterPill,
    clearAllFilters,
    selectedItems,
  } = state
  const statusBar = (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2",
        "text-muted-foreground text-sm"
      )}
    >
      {/* Left: active filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {hasActiveFilters ? (
          <>
            {searchQuery.trim() && <FilterPill label={`"${searchQuery.trim()}"`} onRemove={() => setSearchInput("")} />}
            {activeFilterPills.map((pill) => (
              <FilterPill
                key={`${pill.key}:${pill.value}`}
                label={pill.label}
                onRemove={() => removeFilterPill(pill.key, pill.value)}
              />
            ))}
            <button
              onClick={clearAllFilters}
              className="text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              Clear all
            </button>
          </>
        ) : null}

        {/* Bulk actions */}
        {selectable && selectedRows.size > 0 && bulkActions && bulkActions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-foreground font-medium">{selectedRows.size} selected</span>
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={action.variant === "destructive" ? "destructive" : "outline"}
                onClick={() => {
                  action.onClick(selectedItems)
                  setSelectedRows(new Set())
                }}
                className="h-6 gap-1 px-2 text-xs"
              >
                {action.icon && <action.icon className="h-3 w-3" />}
                {action.label}
              </Button>
            ))}
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Right: row count */}
      {!isLoading && !error && (
        <span className="ml-auto shrink-0">
          {pagination ? (
            <>
              Showing{" "}
              <span className="text-foreground font-medium">
                {activePage * pageSize + 1}–{Math.min((activePage + 1) * pageSize, total)}
              </span>{" "}
              of <span className="text-foreground font-medium">{total}</span>
            </>
          ) : (
            <>
              <span className="text-foreground font-medium">{sortedData.length}</span> result
              {sortedData.length !== 1 ? "s" : ""}
              {hasActiveFilters && data.length !== sortedData.length && (
                <span className="text-muted-foreground"> of {data.length}</span>
              )}
            </>
          )}
        </span>
      )}
    </div>
  )

  // ─── Table inner ──────────────────────────────────────────────────────────

  return statusBar
}
