import { toast } from "sonner"
import { downloadCsv } from "@/lib/export/table-export"
import { logger } from "@/lib/logger"

const log = logger("directory-export")

export interface DirectoryExportRow {
  Name: string
  Designation: string
  Department: string
  "Department Lead": string
  "Company Email": string
  "Additional Email": string
  Phone: string
  "Additional Phone": string
  Office: string
}

export async function exportDirectoryToExcel(rows: DirectoryExportRow[], filename: string): Promise<void> {
  try {
    const XLSX = await import("@e965/xlsx")
    const { default: saveAs } = await import("file-saver")
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Directory")
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    saveAs(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${filename}.xlsx`
    )
    toast.success("Exported to Excel")
  } catch (error) {
    log.error({ err: String(error) }, "Failed to export directory to Excel")
    toast.error("Failed to export to Excel")
  }
}

export function exportDirectoryToCsv(rows: DirectoryExportRow[], filename: string): void {
  try {
    const headers: (keyof DirectoryExportRow)[] = [
      "Name",
      "Designation",
      "Department",
      "Department Lead",
      "Company Email",
      "Additional Email",
      "Phone",
      "Additional Phone",
      "Office",
    ]
    downloadCsv([headers, ...rows.map((row) => headers.map((key) => row[key]))], `${filename}.csv`)
    toast.success("Exported to CSV")
  } catch (error) {
    log.error({ err: String(error) }, "Failed to export directory to CSV")
    toast.error("Failed to export to CSV")
  }
}
