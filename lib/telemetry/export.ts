import { toast } from "sonner"
import { logger } from "@/lib/logger"

const log = logger("error-monitor-export")

export interface ErrorExportRow {
  Status: string
  Occurrences: number
  Users: number
  Affected: string
  Source: string
  Route: string
  Message: string
  "Last Seen (WAT)": string
  Reference: string
  Stack: string
  Context: string
}

/**
 * Error messages and stacks are reported by browsers, so anyone can choose
 * their text. A cell starting with = + - @ (or a tab/CR) is run as a formula
 * when the file is opened in Excel; a leading quote keeps it as plain text.
 */
export function neutralizeFormula<T>(value: T): T {
  return (typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value) as T
}

function neutralizeRow(row: ErrorExportRow): ErrorExportRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, neutralizeFormula(value)])
  ) as unknown as ErrorExportRow
}

export async function exportErrorsToExcel(rows: ErrorExportRow[], filename: string): Promise<void> {
  try {
    const XLSX = await import("@e965/xlsx")
    const { default: saveAs } = await import("file-saver")
    const worksheet = XLSX.utils.json_to_sheet(rows.map(neutralizeRow))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Errors")
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    saveAs(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${filename}.xlsx`
    )
    toast.success("Exported to Excel")
  } catch (error) {
    log.error({ err: String(error) }, "Failed to export errors to Excel")
    toast.error("Failed to export to Excel")
  }
}

export function exportErrorsToCsv(rows: ErrorExportRow[], filename: string): void {
  try {
    const headers = Object.keys(rows[0] ?? {}) as (keyof ErrorExportRow)[]
    const escape = (cell: unknown) => `"${String(neutralizeFormula(cell) ?? "").replace(/"/g, '""')}"`
    const lines = [headers, ...rows.map((row) => headers.map((header) => row[header]))].map((line) =>
      line.map(escape).join(",")
    )
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${filename}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("Exported to CSV")
  } catch (error) {
    log.error({ err: String(error) }, "Failed to export errors to CSV")
    toast.error("Failed to export to CSV")
  }
}
