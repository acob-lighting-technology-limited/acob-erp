"use client"
import { Card } from "@/components/ui/card"
import { TableExportButton } from "./export-button"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDataTableState } from "./use-data-table-state"
import type { DataTableProps } from "./types"
import { TableSkeleton, TableEmptyState } from "./legacy-primitives"
import { DataTableToolbar } from "./toolbar"
import { DataTableStatusBar } from "./status-bar"
import { DataTableTableView } from "./table-view"
import { DataTableContactsView } from "./contacts-view"
import { DataTableDetailSheet } from "./detail-sheet"
import { DataTableCardView } from "./card-view"
import { DataTablePagination } from "./pagination"

export function DataTable<TData>(props: DataTableProps<TData>) {
  const state = useDataTableState(props)
  const {
    rowActions,
    cardRenderer,
    mobileRow,
    headerClassName,
    showRowNumbers,
    skeletonRows,
    isLoading,
    error,
    onRetry,
    EmptyIcon,
    emptyTitle,
    emptyDescription,
    emptyAction,
    pageExport,
    exportConfig,
    contactsAvailable,
    viewMode,
    responsivePair,
    rootRef,
    visibleColumns,
    isServerPagination,
    sortedData,
    paginatedData,
    hasActiveFilters,
    clearAllFilters,
    showToolbar,
    listSource,
  } = state

  const toolbar = <DataTableToolbar state={state} />
  const statusBar = <DataTableStatusBar state={state} />
  const tableInner = <DataTableTableView state={state} />
  const mobileList = mobileRow ? <DataTableContactsView state={state} /> : null
  const detailSheet = <DataTableDetailSheet state={state} />

  return (
    <div ref={rootRef} className="space-y-3">
      {exportConfig && (!pageExport || pageExport.slot) && (
        <TableExportButton
          rows={sortedData}
          columns={visibleColumns}
          config={exportConfig}
          slot={pageExport?.slot}
          disabled={isLoading || !!error || isServerPagination}
        />
      )}
      {detailSheet}
      {/* Card view: toolbar card + grid below */}
      {!isLoading && !error && viewMode === "card" && cardRenderer ? (
        <>
          {showToolbar && (
            <Card>
              {toolbar}
              {statusBar}
            </Card>
          )}
          <DataTableCardView state={state} />
        </>
      ) : (
        /* Table / skeleton / error — all in one card */
        <Card>
          {toolbar}
          {statusBar}

          {isLoading ? (
            /* Skeleton rows — responsive contacts list below md, table above md */
            <div className="border-t">
              {responsivePair ? (
                <>
                  <div className="divide-y md:hidden">
                    {Array.from({ length: Math.min(skeletonRows, 6) }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3">
                        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-36 max-w-full" />
                          <Skeleton className="h-3 w-48 max-w-full" />
                        </div>
                        <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block">
                    <TableSkeleton
                      rows={skeletonRows}
                      cols={visibleColumns.length + (showRowNumbers ? 1 : 0) + (rowActions?.length ? 1 : 0)}
                      headerClassName={headerClassName}
                      borderless
                    />
                  </div>
                </>
              ) : (
                <TableSkeleton
                  rows={skeletonRows}
                  cols={visibleColumns.length + (showRowNumbers ? 1 : 0) + (rowActions?.length ? 1 : 0)}
                  headerClassName={headerClassName}
                  borderless
                />
              )}
            </div>
          ) : error ? (
            <div className="space-y-3 border-t py-12 text-center">
              <p className="text-sm text-red-500">{error}</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          ) : responsivePair && mobileList ? (
            /* Both shapes in the DOM; the media query decides. No first-paint flash. */
            <>
              <div className="border-t md:hidden">
                {listSource.length === 0 ? (
                  <TableEmptyState
                    EmptyIcon={EmptyIcon}
                    emptyTitle={emptyTitle}
                    emptyDescription={emptyDescription}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearAllFilters}
                    emptyAction={emptyAction}
                  />
                ) : (
                  mobileList
                )}
              </div>
              <div className="hidden border-t md:block">{tableInner}</div>
            </>
          ) : viewMode === "contacts" && mobileList ? (
            /* Contacts mode: the same list at every width, no table underneath. */
            <div className="border-t">
              {listSource.length === 0 ? (
                <TableEmptyState
                  EmptyIcon={EmptyIcon}
                  emptyTitle={emptyTitle}
                  emptyDescription={emptyDescription}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={clearAllFilters}
                  emptyAction={emptyAction}
                />
              ) : (
                mobileList
              )}
            </div>
          ) : mobileList && !contactsAvailable ? (
            /* No separate List mode exists, so the table has to stand down below
               `md` and let the row list represent it. */
            <>
              <div className="border-t md:hidden">
                {paginatedData.length === 0 ? (
                  <TableEmptyState
                    EmptyIcon={EmptyIcon}
                    emptyTitle={emptyTitle}
                    emptyDescription={emptyDescription}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearAllFilters}
                    emptyAction={emptyAction}
                  />
                ) : (
                  mobileList
                )}
              </div>
              <div className="hidden border-t md:block">{tableInner}</div>
            </>
          ) : (
            <div className="border-t">{tableInner}</div>
          )}

          <DataTablePagination state={state} />
        </Card>
      )}
    </div>
  )
}
