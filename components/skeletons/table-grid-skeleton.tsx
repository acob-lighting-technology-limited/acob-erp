import { cn } from "@/lib/utils"

export type TableGridSkeletonProps = {
  columns?: number
  rows?: number
  /** Header row classes; DataTable passes its own so the two stay identical. */
  headerClassName?: string
  className?: string
}

function cellWidth(c: number, columns: number) {
  return c === 0 ? "w-8" : c === 1 ? "w-32" : c === columns - 1 ? "w-16" : "w-24"
}

/**
 * The shimmer table grid — header row plus body rows. Shared by
 * TablePageSkeleton (route-level loading.tsx) and DataTable's own isLoading
 * state so both render the exact same grid.
 */
export function TableGridSkeleton({
  columns = 5,
  rows = 8,
  headerClassName = "bg-muted/80 sticky top-0 z-10",
  className,
}: TableGridSkeletonProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full caption-bottom text-sm">
        <thead className={cn("[&_tr]:border-b", headerClassName)}>
          <tr className="border-b transition-colors">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={`head-${i}`} className="h-12 px-4 text-left align-middle font-medium">
                <div className="bg-muted h-4 w-24 animate-pulse rounded-md" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={`row-${r}`} className="border-b transition-colors">
              {Array.from({ length: columns }).map((__, c) => (
                <td key={`cell-${r}-${c}`} className="p-4 align-middle">
                  <div className={cn("bg-muted h-4 animate-pulse rounded-md", cellWidth(c, columns))} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
