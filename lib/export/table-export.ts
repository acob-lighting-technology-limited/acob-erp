import { toCsv, type CsvValue } from "./csv"
import type { UserOptions } from "jspdf-autotable"

export type TableExportFormat = "csv" | "xlsx" | "pdf"
export interface TableExportOptions {
  filename: string
  formats?: TableExportFormat[]
  title?: string
}
export interface TableExportColumn<T> {
  label: string
  accessor?: (row: T) => CsvValue
}

/** Preserve existing report presentation while sharing the actual file writers. */
export interface TableExportPresentation {
  sheetName?: string
  maxColumnWidth?: number
  pdf?: Pick<UserOptions, "startY" | "styles" | "headStyles" | "alternateRowStyles"> & {
    orientation?: "landscape" | "portrait"
    headingLines?: string[]
  }
}

export function getRecordExportColumns(
  rows: readonly Record<string, unknown>[]
): TableExportColumn<Record<string, unknown>>[] {
  return Object.keys(rows[0] ?? {}).map((label) => ({
    label,
    accessor: (row) => {
      const value = row[label]
      return value == null ? "" : typeof value === "number" || typeof value === "boolean" ? value : String(value)
    },
  }))
}

/** An ordered matrix shared by every writer; presentation-only columns are omitted. */
export function getTableExportData<T>(rows: readonly T[], columns: readonly TableExportColumn<T>[]) {
  const exportable = columns.filter((column) => column.accessor)
  return {
    headers: exportable.map((column) => column.label),
    rows: rows.map((row) => exportable.map((column) => column.accessor?.(row) ?? "")),
  }
}

export function downloadCsv(rows: readonly (readonly CsvValue[])[], filename: string): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    // Allow the browser to start the download before invalidating its URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** Called on demand. Spreadsheet/PDF libraries are never eager page imports. */
export async function exportTable<T>(
  rows: readonly T[],
  columns: readonly TableExportColumn<T>[],
  options: TableExportOptions,
  format: TableExportFormat,
  presentation: TableExportPresentation = {}
): Promise<void> {
  const matrix = getTableExportData(rows, columns)
  if (!matrix.headers.length) throw new Error("No exportable columns")
  const filename = `${options.filename.replace(/\.(csv|xlsx|pdf)$/i, "")}.${format}`
  if (format === "csv") {
    downloadCsv([matrix.headers, ...matrix.rows], filename)
    return
  }
  if (format === "xlsx") {
    const XLSX = await import("@e965/xlsx")
    const { saveAs } = await import("file-saver")
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet([matrix.headers, ...matrix.rows])
    if (presentation.maxColumnWidth)
      worksheet["!cols"] = matrix.headers.map((header, index) => ({
        wch: Math.min(
          presentation.maxColumnWidth ?? 50,
          matrix.rows.reduce((width, row) => Math.max(width, String(row[index]).length), header.length)
        ),
      }))
    XLSX.utils.book_append_sheet(workbook, worksheet, presentation.sheetName ?? "Export")
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename)
    return
  }
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")])
  const { orientation, headingLines, ...pdfStyles } = presentation.pdf ?? {}
  const doc = new jsPDF({ orientation: orientation ?? (matrix.headers.length > 6 ? "landscape" : "portrait") })
  if (options.title) {
    doc.setFontSize(16)
    doc.text(options.title, 14, 15)
  }
  doc.setFontSize(10)
  headingLines?.forEach((line, index) => doc.text(line, 14, 22 + index * 6))
  autoTable(doc, {
    head: [matrix.headers],
    body: matrix.rows.map((row) => row.map(String)),
    startY: options.title ? 22 : 14,
    styles: { fontSize: 9 },
    ...pdfStyles,
  })
  doc.save(filename)
}
