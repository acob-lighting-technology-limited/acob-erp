import type { LucideIcon } from "lucide-react"
import type { DataTableColumn, DataTableDetailAction, DataTableDetailField, RowAction } from "./types"

// What the phone detail sheet shows, worked out from the table's own definition. Kept free of React
// components so it can be tested directly: the sheet is the one surface a phone has for a row, so what
// reaches it (every column, every row action) matters as much as how it looks.

/** Columns that exist for the table's own mechanics, never data a reader wants in the sheet. */
const MECHANICAL_COLUMN = /^(sn|s\/n|select|selection|expand|actions?|menu|more)$/i

/** Placeholders a table prints for "nothing here"; dropped from a synthesized sheet. */
const EMPTY_PLACEHOLDERS = new Set(["", "-", "—"])

export type SheetField = DataTableDetailField

/**
 * One field per column. A column with an `accessor` contributes its plain value. A column with only a
 * `render` (a status badge, an amount, a progress bar) used to vanish from the sheet; now its rendered cell
 * is shown, unless it is a mechanical column or opts out with `sheet: false`.
 */
export function columnsToSheetFields<TData>(columns: DataTableColumn<TData>[], row: TData): SheetField[] {
  const fields: SheetField[] = []
  for (const column of columns) {
    if (column.sheet === false || !column.label || MECHANICAL_COLUMN.test(column.key)) continue

    if (column.accessor) {
      const value = String(column.accessor(row) ?? "")
      if (!EMPTY_PLACEHOLDERS.has(value)) fields.push({ label: column.label, value })
      continue
    }

    if (column.render) {
      const node = column.render(row, 0)
      if (node === null || node === undefined || node === false || node === "") continue
      fields.push({ label: column.label, value: null, node })
    }
  }
  return fields
}

/**
 * Footer actions for a row, built from the table's `rowActions` so a phone can do what the desktop menu
 * can. An `onSelect` becomes "Open" and leads. Hidden actions are dropped per row, and destructive ones
 * go last so the primary action is the first thing under a thumb.
 */
export function deriveSheetActions<TData>(
  rowActions: RowAction<TData>[] | undefined,
  row: TData,
  options: { onSelect?: (row: TData) => void; openIcon?: LucideIcon } = {}
): DataTableDetailAction[] {
  const visible = (rowActions ?? []).filter((action) => !action.hidden?.(row))
  const safe = visible.filter((action) => action.variant !== "destructive")
  const destructive = visible.filter((action) => action.variant === "destructive")

  const ordered: Array<Pick<DataTableDetailAction, "label" | "icon" | "onClick"> & { destructive: boolean }> = []
  if (options.onSelect) {
    const onSelect = options.onSelect
    ordered.push({ label: "Open", icon: options.openIcon, onClick: () => onSelect(row), destructive: false })
  }
  for (const action of safe) {
    ordered.push({ label: action.label, icon: action.icon, onClick: () => action.onClick(row), destructive: false })
  }
  for (const action of destructive) {
    ordered.push({ label: action.label, icon: action.icon, onClick: () => action.onClick(row), destructive: true })
  }

  return ordered.map(({ destructive: isDestructive, ...action }, index) => ({
    ...action,
    variant: isDestructive ? "destructive" : index === 0 ? "default" : "outline",
  }))
}

/**
 * A footer holds a thumb's worth of buttons. Up to `max` show as buttons; with more, the first `max - 1`
 * show and the rest go behind "More", so eight actions never become eight squeezed buttons.
 */
export function splitSheetActions<T>(actions: T[], max = 3): { visible: T[]; overflow: T[] } {
  if (actions.length <= max) return { visible: actions, overflow: [] }
  return { visible: actions.slice(0, max - 1), overflow: actions.slice(max - 1) }
}

/** A value is shown stacked under its label (full width) rather than beside it when it would not fit a line. */
export function isLongField(field: Pick<SheetField, "value" | "fullWidth" | "colSpan" | "href">): boolean {
  const value = field.value == null ? "" : String(field.value)
  return (
    Boolean(field.fullWidth) ||
    (field.colSpan != null && field.colSpan > 1) ||
    value.length > 35 ||
    value.includes("\n") ||
    Boolean(field.href)
  )
}
