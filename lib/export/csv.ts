export type CsvValue = string | number | boolean | null | undefined

/** RFC 4180 CSV, with an Excel UTF-8 BOM and spreadsheet formula protection. */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let cell = value == null ? "" : String(value)
            // Whitespace can hide a formula from a naïve first-character check.
            if (/^\s*[=+\-@]/.test(cell)) cell = "'" + cell
            return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
          })
          .join(",")
      )
      .join("\r\n")
  )
}
