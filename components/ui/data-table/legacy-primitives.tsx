"use client"
import { useState, useCallback, useEffect, useRef } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowUpDown, ArrowUp, ArrowDown, X, GripVertical } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/patterns/empty-state"
import { TableGridSkeleton } from "@/components/skeletons/table-grid-skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { ColumnHelp } from "./column-help"

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}
export function useColumnResize(initialWidths: Record<string, number>) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(initialWidths)
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null)

  const startResize = useCallback((key: string, startX: number, startW: number) => {
    resizingRef.current = { key, startX, startW }

    const onMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return
      const delta = e.clientX - resizingRef.current.startX
      const newW = Math.max(60, resizingRef.current.startW + delta)
      setColWidths((prev) => ({ ...prev, [resizingRef.current!.key]: newW }))
    }

    const onMouseUp = () => {
      resizingRef.current = null
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }, [])

  return { colWidths, startResize }
}
export function TableSkeleton({
  rows,
  cols,
  headerClassName,
  borderless,
}: {
  rows: number
  cols: number
  headerClassName: string
  borderless?: boolean
}) {
  const table = <TableGridSkeleton columns={cols} rows={rows} headerClassName={headerClassName} />

  if (borderless) return table

  return (
    <Card>
      <CardContent className="p-0">{table}</CardContent>
    </Card>
  )
}
export interface SortableColHeadProps {
  id: string
  label: string
  description?: string
  align?: "left" | "center" | "right"
  hideOnMobile?: boolean
  sortable?: boolean
  resizable?: boolean
  sortConfig: { key: string; direction: "asc" | "desc" } | null
  colWidth?: number
  colClass?: string
  onSort?: () => void
  onResizeStart: (clientX: number, currentW: number) => void
}
export function SortableColHead({
  id,
  label,
  description,
  align,
  hideOnMobile,
  sortable,
  resizable,
  sortConfig,
  colWidth,
  colClass,
  onSort,
  onResizeStart,
}: SortableColHeadProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(colWidth ? { width: colWidth } : {}),
  }

  return (
    <TableHead
      ref={setNodeRef}
      style={style}
      className={cn(
        !colWidth && colClass,
        align === "right" && "text-right",
        align === "center" && "text-center",
        hideOnMobile && "hidden md:table-cell",
        sortable && "hover:text-foreground cursor-pointer transition-colors select-none",
        resizable && "relative",
        "group"
      )}
      onClick={sortable ? onSort : undefined}
      aria-sort={sortConfig?.key === id ? (sortConfig.direction === "asc" ? "ascending" : "descending") : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {/* Drag handle — shown on hover */}
        <span
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground mr-0.5 hidden cursor-grab group-hover:inline-flex active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Drag to reorder ${label} column`}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        {label}
        {description && <ColumnHelp label={label} text={description} />}
        {sortable &&
          (sortConfig?.key === id ? (
            sortConfig.direction === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
          ))}
      </span>
      {/* Resize handle */}
      {resizable && (
        <div
          role="separator"
          aria-label={`Resize ${label} column`}
          className="hover:bg-border active:bg-primary/40 absolute top-0 right-0 h-full w-1.5 cursor-col-resize bg-transparent transition-colors select-none"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const th = e.currentTarget.closest("th")
            const currentW = th ? th.getBoundingClientRect().width : (colWidth ?? 120)
            onResizeStart(e.clientX, currentW)
          }}
        />
      )}
    </TableHead>
  )
}
export function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 text-xs font-normal">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-muted ml-0.5 rounded-sm p-0.5 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  )
}
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, label, [role='menuitem'], [role='checkbox'], [data-row-click='ignore']"
export function isInteractiveTarget(target: HTMLElement) {
  return target.closest(INTERACTIVE_SELECTOR) !== null
}
export function TableEmptyState({
  EmptyIcon,
  emptyTitle,
  emptyDescription,
  hasActiveFilters,
  onClearFilters,
  emptyAction,
}: {
  EmptyIcon: React.ElementType<{ className?: string }>
  emptyTitle: string
  emptyDescription: string
  hasActiveFilters: boolean
  onClearFilters: () => void
  emptyAction?: React.ReactNode
}) {
  return (
    <EmptyState
      icon={EmptyIcon}
      title={emptyTitle}
      description={emptyDescription}
      className="border-0 bg-transparent py-16 sm:py-16"
      action={
        hasActiveFilters ? (
          <Button variant="outline" size="sm" onClick={onClearFilters} className="gap-2">
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : (
          (emptyAction ?? null)
        )
      }
    />
  )
}
