export type CsvValue = string | number | boolean | null | undefined

/** RFC 4180 CSV, with an Excel UTF-8 BOM and spreadsheet formula protection. */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            if (value == null) return ""
            let cell = String(value)
            // Skip injection guard for true numbers and string representations of plain numbers
            const isPlainNumber = typeof value === "number" || /^\s*[-+]?\d+(\.\d+)?\s*$/.test(cell)
            // Whitespace can hide a formula from a naïve first-character check.
            if (!isPlainNumber && /^\s*[=+\-@]/.test(cell)) cell = "'" + cell
            return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
          })
          .join(",")
      )
      .join("\r\n")
  )
}
