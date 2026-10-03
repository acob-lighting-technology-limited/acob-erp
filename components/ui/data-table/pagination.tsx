"use client"
import { Button } from "@/components/ui/button"
import type { useDataTableState } from "./use-data-table-state"

export function DataTablePagination<TData>({ state }: { state: ReturnType<typeof useDataTableState<TData>> }) {
  const { pagination, totalPages, activePage, listRendersEverything, isLoading, error, handlePageChange } = state

  if (!pagination || totalPages <= 1 || listRendersEverything || isLoading || error) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm">
      <p className="text-muted-foreground">
        Page {activePage + 1} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={activePage === 0}
          onClick={() => handlePageChange(activePage - 1)}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={activePage + 1 >= totalPages}
          onClick={() => handlePageChange(activePage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
