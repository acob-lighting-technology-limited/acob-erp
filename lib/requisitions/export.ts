import { toast } from "sonner"
import { logger } from "@/lib/logger"
import { formatWATDate, toLocalISODate } from "@/lib/utils/date"
import { STATUS_LABELS, progressLabel, requisitionSummary } from "./format"
import { FORM_LABELS } from "./limits"
import type { Requisition } from "./types"

const log = logger("requisitions-export")

export type RequisitionExportRow = Record<string, string | number>

export function buildRequisitionExportRows(rows: Requisition[]): RequisitionExportRow[] {
  return rows.map((r) => ({
    Reference: r.requisition_number,
    Form: FORM_LABELS[r.form_type],
    Date: formatWATDate(r.created_at),
    "Requested by": r.requester?.full_name || "",
    Department: r.department,
    Project: r.project_name || "",
    For: requisitionSummary(r),
    "Site location": r.site_location || "",
    Funding: r.funding_category_name || "",
    "Amount requested (₦)": Number(r.original_amount),
    "Amount (₦)": Number(r.amount),
    "Paid (₦)": Number(r.amount_paid),
    Status: STATUS_LABELS[r.status],
    "Where it is": progressLabel(r),
    Beneficiaries: r.beneficiary_details
      .map((b) => `${b.account_name} (${b.bank_name} ${b.account_number})`)
      .join("; "),
  }))
}

export async function exportRequisitionsToExcel(rows: Requisition[], filename?: string): Promise<void> {
  try {
    const XLSX = await import("@e965/xlsx")
    const { default: saveAs } = await import("file-saver")
    const data = buildRequisitionExportRows(rows)
    const ws = XLSX.utils.json_to_sheet(data)
    ws["!cols"] = Object.keys(data[0] || {}).map((key) => ({
      wch: Math.min(Math.max(key.length, ...data.map((row) => String(row[key] ?? "").length)), 50),
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Requisitions")
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    saveAs(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename ?? `requisitions-${toLocalISODate()}.xlsx`
    )
    toast.success("Requisitions exported to Excel")
  } catch (error) {
    log.error("Error exporting requisitions to Excel:", error)
    toast.error("Failed to export to Excel")
  }
}

export async function exportRequisitionsToPDF(rows: Requisition[], title: string, filename?: string): Promise<void> {
  try {
    const jsPDF = (await import("jspdf")).default
    const autoTable = (await import("jspdf-autotable")).default
    const doc = new jsPDF({ orientation: "landscape" })
    doc.setFontSize(16)
    doc.text(title, 14, 15)
    doc.setFontSize(10)
    doc.text(`Generated on: ${formatWATDate(new Date())} · ${rows.length} requisitions`, 14, 22)

    // The PDF keeps the columns that fit a landscape page; Excel has them all.
    const headers = [
      "Reference",
      "Form",
      "Date",
      "Requested by",
      "Department",
      "For",
      "Amount (₦)",
      "Paid (₦)",
      "Status",
    ]
    const body = buildRequisitionExportRows(rows).map((row) =>
      headers.map((h) => {
        const value = row[h]
        return typeof value === "number"
          ? value.toLocaleString("en-NG", { minimumFractionDigits: 2 })
          : String(value ?? "")
      })
    )
    autoTable(doc, {
      head: [headers],
      body,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [34, 139, 34], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    })
    doc.save(filename ?? `requisitions-${toLocalISODate()}.pdf`)
    toast.success("Requisitions exported to PDF")
  } catch (error) {
    log.error("Error exporting requisitions to PDF:", error)
    toast.error("Failed to export to PDF")
  }
}
