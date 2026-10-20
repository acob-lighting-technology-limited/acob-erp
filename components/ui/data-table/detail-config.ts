import { ExternalLink } from "lucide-react"
import type { DataTableDetailConfig, DataTableProps } from "./types"
/** A mobile row opens a sheet synthesized from all accessor columns, including wide columns. */
export function getDetailConfig<TData>(
  mobileRow: DataTableProps<TData>["mobileRow"],
  columns: DataTableProps<TData>["columns"]
): DataTableDetailConfig<TData> | undefined {
  if (mobileRow?.detail) return mobileRow.detail
  if (!mobileRow) return undefined
  const fieldColumns = columns.filter((column) => column.accessor)
  const onSelect = mobileRow.onSelect
  return {
    title: mobileRow.title,
    subtitle: mobileRow.subtitle,
    fields: (row: TData) =>
      fieldColumns
        .map((column) => ({ label: column.label, value: String(column.accessor?.(row) ?? "") }))
        // A synthesized sheet has no editorial eye on it, so blanks and the
        // placeholders a table renders in their place are dropped here instead.
        .filter((field) => field.value !== "" && field.value !== "-" && field.value !== "—"),
    actions: onSelect
      ? (row: TData) => [{ label: "Open", icon: ExternalLink, onClick: () => onSelect(row) }]
      : undefined,
  }
}
