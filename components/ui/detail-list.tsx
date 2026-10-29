import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The building blocks of a record's detail view (a side sheet, an expanded row): a small uppercase
 * section heading, and labelled values laid out in a grid. Use these instead of hand-writing
 * "Label: value" lines, so every detail view reads the same way.
 */

export function SectionHeading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{title}</h3>
      {typeof aside === "string" ? <span className="text-muted-foreground text-xs">{aside}</span> : aside}
    </div>
  )
}

export function DetailField({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string
  value: ReactNode
  className?: string
  valueClassName?: string
}) {
  const empty = value === null || value === undefined || value === false || value === ""
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn(
          "text-foreground mt-0.5 text-xs font-medium break-words",
          empty && "text-muted-foreground",
          valueClassName
        )}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  )
}

export interface DetailListItem {
  label: string
  value: ReactNode
  /** Spans the whole row, for long text such as a reason or an address. */
  wide?: boolean
}

/** Labelled values, two columns on a phone and three from `sm`. An empty value shows an em dash. */
export function DetailList({ items, className }: { items: DetailListItem[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3", className)}>
      {items.map((item) => (
        <DetailField
          key={item.label}
          label={item.label}
          value={item.value}
          className={item.wide ? "col-span-full" : undefined}
          valueClassName={item.wide ? "font-normal leading-relaxed" : undefined}
        />
      ))}
    </dl>
  )
}
