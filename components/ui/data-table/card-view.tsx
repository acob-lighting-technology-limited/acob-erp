"use client"
import type { MouseEvent as ReactMouseEvent } from "react"
import { cn } from "@/lib/utils"
import type { useDataTableState } from "./use-data-table-state"
import { isInteractiveTarget, TableEmptyState } from "./legacy-primitives"

export function DataTableCardView<TData>({ state }: { state: ReturnType<typeof useDataTableState<TData>> }) {
  const {
    getRowId,
    cardRenderer,
    mobileRow,
    EmptyIcon,
    emptyTitle,
    emptyDescription,
    emptyAction,
    setDetailRow,
    detailConfig,
    paginatedData,
    hasActiveFilters,
    clearAllFilters,
  } = state

  if (!cardRenderer) return null

  if (paginatedData.length === 0) {
    return (
      <TableEmptyState
        EmptyIcon={EmptyIcon}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
        emptyAction={emptyAction}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {paginatedData.map((row) => {
        const rowId = getRowId(row)
        const handleCardClick = (e: ReactMouseEvent<HTMLDivElement>) => {
          const target = e.target as HTMLElement
          if (isInteractiveTarget(target)) {
            return
          }
          if (detailConfig) setDetailRow(row)
          else if (mobileRow?.onSelect) mobileRow.onSelect(row)
        }

        return (
          <div
            key={rowId}
            onClick={handleCardClick}
            className={cn("h-full", (Boolean(detailConfig) || Boolean(mobileRow?.onSelect)) && "cursor-pointer")}
          >
            {cardRenderer(row)}
          </div>
        )
      })}
    </div>
  )
}
