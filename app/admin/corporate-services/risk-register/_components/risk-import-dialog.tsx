"use client"

import { useRef, useState } from "react"
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { apiFetch } from "@/lib/api-client"
import type { RiskImportPreview } from "@/lib/risk-register/import"
import type { RiskRow } from "@/lib/risk-register/model"

interface RiskImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: (risks: RiskRow[]) => void
}

export function RiskImportDialog({ open, onOpenChange, onImported }: RiskImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<RiskImportPreview | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isReading, setIsReading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  function reset() {
    setPreview(null)
    setSelected(new Set())
    if (inputRef.current) inputRef.current.value = ""
  }

  function handleOpenChange(next: boolean) {
    if (!next && !isImporting) reset()
    onOpenChange(next)
  }

  async function previewFile(file: File) {
    setIsReading(true)
    try {
      const form = new FormData()
      form.set("file", file)
      const response = await apiFetch("/api/corporate-services/risk-register/import", { method: "POST", body: form })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || "Could not read the workbook")
      const next = json.data as RiskImportPreview
      setPreview(next)
      setSelected(new Set(next.rows.flatMap((row, index) => (row.duplicate ? [] : [index]))))
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not read the workbook")
      reset()
    } finally {
      setIsReading(false)
    }
  }

  async function importSelected() {
    if (!preview || selected.size === 0) return
    setIsImporting(true)
    try {
      const rows = preview.rows.filter((_, index) => selected.has(index)).map((row) => row.risk)
      const response = await apiFetch("/api/corporate-services/risk-register/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: preview.fileName, rows }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || "Import failed")
      const imported = (json.data || []) as RiskRow[]
      onImported(imported)
      toast.success(`${imported.length} risk${imported.length === 1 ? "" : "s"} imported`)
      reset()
      onOpenChange(false)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  const duplicates = preview?.rows.filter((row) => row.duplicate).length || 0
  const warningCount = preview?.rows.reduce((total, row) => total + row.warnings.length, 0) || 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" aria-hidden />
            <DialogTitle>Import Risk Register</DialogTitle>
          </div>
          <DialogDescription>
            Upload the completed ACOB `.xlsx` template. Review normalized departments, recurring timelines, owners, and
            duplicates before saving.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <button
              type="button"
              className="border-muted-foreground/30 hover:border-primary focus-visible:ring-ring flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => inputRef.current?.click()}
              disabled={isReading}
            >
              {isReading ? (
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-8 w-8" aria-hidden />
              )}
              <span className="font-medium">{isReading ? "Reading workbook…" : "Choose Excel workbook"}</span>
              <span className="text-muted-foreground text-xs">.xlsx only · maximum 2 MB · up to 200 risks</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void previewFile(file)
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary">{preview.rows.length} rows found</Badge>
              <Badge variant="outline">{selected.size} selected</Badge>
              {warningCount > 0 && <Badge variant="outline">{warningCount} review notes</Badge>}
              {duplicates > 0 && <Badge variant="destructive">{duplicates} duplicates skipped</Badge>}
            </div>

            {preview.errors.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" aria-hidden />
                <AlertTitle>Workbook issues</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {preview.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea className="h-[min(52vh,32rem)] rounded-lg border">
              <div className="divide-y">
                {preview.rows.map((row, index) => (
                  <div key={`${row.sourceSheet}-${row.sourceRow}`} className="flex gap-3 p-3">
                    <Checkbox
                      checked={selected.has(index)}
                      disabled={row.duplicate}
                      aria-label={`Import ${row.risk.risk_name}`}
                      onCheckedChange={(checked) =>
                        setSelected((current) => {
                          const next = new Set(current)
                          if (checked) next.add(index)
                          else next.delete(index)
                          return next
                        })
                      }
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{row.risk.risk_name}</p>
                          <p className="text-muted-foreground text-xs">
                            {row.sourceSheet} · row {row.sourceRow} · {row.risk.department} · I{row.risk.impact} × L
                            {row.risk.likelihood}
                          </p>
                        </div>
                        {row.duplicate ? (
                          <Badge variant="destructive">Already exists</Badge>
                        ) : row.warnings.length > 0 ? (
                          <Badge variant="outline">Review mapping</Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white">
                            <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden /> Ready
                          </Badge>
                        )}
                      </div>
                      {row.warnings.map((warning) => (
                        <p
                          key={`${warning.code}-${warning.message}`}
                          className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-300"
                        >
                          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                          {warning.message}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {preview && (
            <Button variant="outline" onClick={reset} disabled={isImporting}>
              Choose Another File
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          {preview && (
            <Button onClick={importSelected} disabled={selected.size === 0 || preview.errors.length > 0 || isImporting}>
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Import {selected.size} Risk{selected.size === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
