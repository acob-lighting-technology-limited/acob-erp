"use client"
import { Fragment } from "react"
import { DndContext, closestCenter } from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers"
import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { useDataTableState } from "./use-data-table-state"
import { SortableColHead, isInteractiveTarget, TableEmptyState } from "./legacy-primitives"

export function DataTableTableView<TData>({ state }: { state: ReturnType<typeof useDataTableState<TData>> }) {
  const {
    getRowId,
    expandable,
    rowActions,
    forceRowActionsDropdown,
    selectable,
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
    contactsAvailable,
    sortConfig,
    expandedRows,
    selectedRows,
    visibleColumns,
    sensors,
    handleColumnDragEnd,
    activePage,
    pageSize,
    paginatedData,
    hasActiveFilters,
    handleSort,
    toggleExpand,
    toggleSelect,
    toggleSelectAll,
    clearAllFilters,
    tableBodyRef,
    handleRowKeyDown,
    rowPointerDownRef,
    clickWasTextSelection,
    totalCols,
  } = state
  const tableInner = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleColumnDragEnd}
    >
      <div className="overflow-x-auto">
        <Table style={minWidth ? { minWidth } : undefined}>
          <TableHeader className={cn(headerClassName, "sticky top-0 z-10")}>
            <SortableContext items={visibleColumns.map((c) => c.key)} strategy={horizontalListSortingStrategy}>
              <TableRow>
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all rows"
                    />
                  </TableHead>
                )}
                {showRowNumbers && expandable && expandAtStart ? (
                  <TableHead className="w-16 text-center">S/N</TableHead>
                ) : (
                  <>
                    {expandable && expandAtStart && <TableHead className="w-10 text-center" />}
                    {showRowNumbers && <TableHead className="w-12 text-center">S/N</TableHead>}
                  </>
                )}
                {visibleColumns.map((col) => (
                  <SortableColHead
                    key={col.key}
                    id={col.key}
                    label={col.label}
                    description={col.description}
                    align={col.align}
                    hideOnMobile={col.hideOnMobile && !contactsAvailable}
                    sortable={col.sortable}
                    resizable={col.resizable}
                    sortConfig={sortConfig}
                    colWidth={colWidths[col.key]}
                    colClass={col.width}
                    onSort={() => handleSort(col.key)}
                    onResizeStart={(clientX, currentW) => startResize(col.key, clientX, currentW)}
                  />
                ))}
                {expandable && !expandAtStart && <TableHead className="w-10" />}
                {rowActions && rowActions.length > 0 && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </SortableContext>
          </TableHeader>

          <TableBody ref={tableBodyRef}>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={totalCols} className="p-0">
                  <TableEmptyState
                    EmptyIcon={EmptyIcon}
                    emptyTitle={emptyTitle}
                    emptyDescription={emptyDescription}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearAllFilters}
                    emptyAction={emptyAction}
                  />
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, index) => {
                const rowId = getRowId(row)
                const isExpanded = expandedRows.has(rowId)
                const canExpand = expandable && (!expandable.canExpand || expandable.canExpand(row))
                const globalIndex = activePage * pageSize + index

                return (
                  <Fragment key={rowId}>
                    <TableRow
                      data-row-id={rowId}
                      tabIndex={0}
                      onKeyDown={(e) => handleRowKeyDown(e, rowId)}
                      onMouseDown={(e) => {
                        rowPointerDownRef.current = { x: e.clientX, y: e.clientY }
                      }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (isInteractiveTarget(target)) {
                          return
                        }
                        // Highlighting text inside a row must not trigger selection.
                        if (clickWasTextSelection(e)) return
                        if (canExpand) {
                          toggleExpand(rowId)
                        }
                      }}
                      className={cn(
                        isExpanded && "border-b-0",
                        selectedRows.has(rowId) && "bg-muted/50",
                        canExpand && "hover:bg-muted/30 cursor-pointer",
                        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                      )}
                    >
                      {selectable && (
                        <TableCell className="w-10 text-center">
                          <Checkbox
                            checked={selectedRows.has(rowId)}
                            onCheckedChange={() => toggleSelect(rowId)}
                            aria-label={`Select row ${globalIndex + 1}`}
                          />
                        </TableCell>
                      )}
                      {showRowNumbers && expandable && expandAtStart ? (
                        <TableCell className="text-muted-foreground w-16 text-center font-mono text-xs font-medium whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {canExpand ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground h-6 w-6 shrink-0 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleExpand(rowId)
                                }}
                                aria-label={isExpanded ? "Collapse row" : "Expand row"}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            ) : null}
                            <span>{globalIndex + 1}</span>
                          </div>
                        </TableCell>
                      ) : (
                        <>
                          {expandable && expandAtStart && (
                            <TableCell className="w-10 text-center">
                              {canExpand ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleExpand(rowId)
                                  }}
                                  aria-label={isExpanded ? "Collapse row" : "Expand row"}
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : null}
                            </TableCell>
                          )}
                          {showRowNumbers && (
                            <TableCell className="text-muted-foreground w-12 text-center font-mono text-xs font-medium">
                              {globalIndex + 1}
                            </TableCell>
                          )}
                        </>
                      )}
                      {visibleColumns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn(
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center",
                            col.hideOnMobile && !contactsAvailable && "hidden md:table-cell"
                          )}
                        >
                          {col.render ? col.render(row, globalIndex) : col.accessor ? (col.accessor(row) ?? "-") : "-"}
                        </TableCell>
                      ))}
                      {expandable && !expandAtStart && (
                        <TableCell>
                          {canExpand ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleExpand(rowId)}
                              aria-label={isExpanded ? "Collapse row" : "Expand row"}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          ) : null}
                        </TableCell>
                      )}
                      {rowActions && rowActions.length > 0 && (
                        <TableCell className="text-right">
                          {(() => {
                            const visible = rowActions.filter((a) => !a.hidden || !a.hidden(row))
                            if (visible.length === 0) return null
                            if (visible.length === 1 && !forceRowActionsDropdown) {
                              const action = visible[0]
                              return (
                                <Button
                                  size="sm"
                                  variant={action.variant === "destructive" ? "destructive" : "outline"}
                                  onClick={() => {
                                    action.onClick(row)
                                  }}
                                  className="h-7 gap-1 px-2 text-xs"
                                >
                                  {action.icon && <action.icon className="h-3.5 w-3.5" />}
                                  {action.label}
                                </Button>
                              )
                            }
                            return (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                  {visible.map((action) => (
                                    <DropdownMenuItem
                                      key={action.label}
                                      onClick={() => {
                                        action.onClick(row)
                                      }}
                                      className={cn(
                                        "gap-2 text-sm",
                                        action.variant === "destructive" && "text-destructive focus:text-destructive"
                                      )}
                                    >
                                      {action.icon && <action.icon className="h-3.5 w-3.5" />}
                                      {action.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )
                          })()}
                        </TableCell>
                      )}
                    </TableRow>

                    {expandable && isExpanded && canExpand && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={totalCols} className="p-4">
                          {expandable.render(row)}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </DndContext>
  )

  return tableInner
}
