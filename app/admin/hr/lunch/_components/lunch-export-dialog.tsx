"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ExportPeriodFields, useExportPeriod } from "@/components/admin/export-period-picker"
import { logger } from "@/lib/logger"
import { apiFetch } from "@/lib/api-client"

const log = logger("lunch-export-dialog")

type ExportFormat = "xlsx" | "csv" | "pdf"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  monthOptions: { value: string; label: string }[]
  department?: string
}

type LunchRow = {
  user_id: string
  full_name: string
  employee_number: string
  department: string | null
  lunch_count: number
  total_deduction: number
}

const HEADERS = ["S/N", "Employee Name", "Staff Code", "Department", "Lunch Count", "Grand Total", "Net Deduction"]

export function LunchExportDialog({ open, onOpenChange, monthOptions, department }: Props) {
  const picker = useExportPeriod()
  const [format, setFormat] = useState<ExportFormat>("xlsx")
  const [onlyWithMeals, setOnlyWithMeals] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    const range = picker.resolve()
    if (!range) {
      toast.error(picker.validationMessage())
      return
    }

    setExporting(true)
    try {
      const params = new URLSearchParams({
        start_date: range.start,
        end_date: range.end,
      })
      const res = await apiFetch(`/api/admin/hr/lunch?${params.toString()}`, { cache: "no-store" })
      const payload = (await res.json().catch(() => null)) as {
        summary?: LunchRow[]
        settings?: { cost?: number; subsidy_percent?: number }
      } | null

      if (!res.ok) throw new Error("Failed to load lunch data")

      let rows = payload?.summary ?? []
      if (department && department !== "all") {
        rows = rows.filter((r) => (r.department || "General") === department)
      }
      if (onlyWithMeals) {
        rows = rows.filter((r) => r.lunch_count > 0)
      }

      if (rows.length === 0) {
        toast.error("No lunch records found for that period")
        return
      }

      const subsidyPercent = Number(payload?.settings?.subsidy_percent ?? 50)
      const deductionShare = Math.max(0.01, (100 - subsidyPercent) / 100)

      const formattedRows = rows.map((r, i) => {
        const netDeduction = Number(r.total_deduction ?? 0)
        const grandTotal = Math.round(netDeduction / deductionShare)
        return [
          i + 1,
          r.full_name,
          r.employee_number,
          r.department || "General",
          r.lunch_count,
          grandTotal,
          netDeduction,
        ]
      })

      if (format === "csv") {
        const escapeCell = (value: string | number) => {
          const str = String(value ?? "")
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
        }
        const csv = [HEADERS, ...formattedRows].map((row) => row.map(escapeCell).join(",")).join("\n")
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `lunch_summary_${range.label}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else if (format === "xlsx") {
        const XLSX = await import("@e965/xlsx")
        const { default: saveAs } = await import("file-saver")
        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.aoa_to_sheet([HEADERS, ...formattedRows])
        XLSX.utils.book_append_sheet(workbook, worksheet, "Lunch Summary")
        const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
        saveAs(
          new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          `lunch_summary_${range.label}.xlsx`
        )
      } else {
        const { jsPDF } = await import("jspdf")
        const autoTable = (await import("jspdf-autotable")).default
        const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
        doc.setFontSize(14)
        doc.text(`Lunch Report — ${range.title}`, 40, 40)
        autoTable(doc, {
          head: [HEADERS],
          body: formattedRows.map((row) =>
            row.map((cell, colIdx) => {
              if (colIdx === 5 || colIdx === 6) {
                return `₦${Number(cell).toLocaleString("en-US")}`
              }
              return String(cell)
            })
          ),
          startY: 56,
          styles: { fontSize: 8, cellPadding: 4 },
          headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
        })
        doc.save(`lunch_summary_${range.label}.pdf`)
      }

      toast.success("Lunch report exported successfully")
      onOpenChange(false)
    } catch (err) {
      log.error({ err: String(err) }, "Failed to export lunch report")
      toast.error(err instanceof Error ? err.message : "Failed to export report")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Lunch Report</DialogTitle>
          <DialogDescription>
            Exports employee lunch summaries and deductions for the selected period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <ExportPeriodFields picker={picker} monthOptions={monthOptions} />

          <div className="space-y-2">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV (.csv)</SelectItem>
                <SelectItem value="pdf">PDF (.pdf)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="only-with-meals"
                checked={onlyWithMeals}
                onCheckedChange={(checked) => setOnlyWithMeals(checked === true)}
              />
              <Label htmlFor="only-with-meals" className="cursor-pointer text-sm font-normal">
                Only include staff with lunch records
              </Label>
            </div>
            <p className="text-muted-foreground text-xs">
              Leave unchecked to include all active employees with ₦0 deductions.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
