"use client"

import { useState, useRef, ChangeEvent, DragEvent } from "react"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { parseCbtQuestionsFile, type CbtImportResult } from "@/lib/cbt/import"

interface ReviewCycleOption {
  id: string
  name: string
  review_type?: string | null
}

interface CbtUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycles: ReviewCycleOption[]
  selectedCycleId: string
  lockDepartment?: string
  departmentsList: string[]
  onSuccess: () => Promise<void> | void
}

export function CbtUploadDialog({
  open,
  onOpenChange,
  cycles,
  selectedCycleId,
  lockDepartment,
  departmentsList,
  onSuccess,
}: CbtUploadDialogProps) {
  const [cycleId, setCycleId] = useState(selectedCycleId)
  const [defaultDept, setDefaultDept] = useState(lockDepartment || "")
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [parseResult, setParseResult] = useState<CbtImportResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetState() {
    setFile(null)
    setParseResult(null)
    setParsing(false)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function processFile(selectedFile: File) {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase()
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      toast.error("Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.")
      return
    }

    setFile(selectedFile)
    setParsing(true)
    setParseResult(null)

    try {
      const buffer = await selectedFile.arrayBuffer()
      const result = await parseCbtQuestionsFile(buffer, {
        defaultDepartment: lockDepartment || defaultDept || undefined,
      })
      setParseResult(result)

      if (result.validRows.length === 0 && result.errors.length > 0) {
        toast.error(`Found ${result.errors.length} formatting errors in file.`)
      } else if (result.validRows.length > 0) {
        toast.success(`Parsed ${result.validRows.length} question(s) successfully!`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file")
      setParseResult(null)
    } finally {
      setParsing(false)
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) {
      void processFile(selected)
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) {
      void processFile(dropped)
    }
  }

  async function handleImport() {
    if (!cycleId) {
      toast.error("Please choose a review cycle.")
      return
    }
    if (!parseResult || parseResult.validRows.length === 0) {
      toast.error("No valid questions found to import.")
      return
    }

    setUploading(true)
    try {
      const response = await apiFetch("/api/hr/performance/cbt/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_cycle_id: cycleId,
          questions: parseResult.validRows,
        }),
      })

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        count?: number
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to import questions")
      }

      toast.success(`Successfully imported ${payload?.count ?? parseResult.validRows.length} question(s)!`)
      resetState()
      onOpenChange(false)
      await onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import questions")
    } finally {
      setUploading(false)
    }
  }

  // Count by department for preview
  const countByDepartment: Record<string, number> = {}
  if (parseResult) {
    for (const row of parseResult.validRows) {
      countByDepartment[row.department] = (countByDepartment[row.department] || 0) + 1
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) resetState()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="text-primary h-5 w-5" />
            Upload CBT Questions
          </DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) or CSV file with your questions. The system validates prompts, 4 options, and
            correct answers automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Cycle Selection */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="upload-cycle">Review Cycle</Label>
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger id="upload-cycle">
                  <SelectValue placeholder="Select review cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles
                    .filter((c) => !c.review_type || c.review_type.toLowerCase() === "quarterly")
                    .map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {cycle.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-dept">Department Scope</Label>
              {lockDepartment ? (
                <div className="bg-muted/40 flex h-10 items-center rounded-md border px-3 text-sm font-medium">
                  {lockDepartment} (Locked to your department)
                </div>
              ) : (
                <Select
                  value={defaultDept || "auto"}
                  onValueChange={(val) => {
                    const next = val === "auto" ? "" : val
                    setDefaultDept(next)
                    if (file) void processFile(file)
                  }}
                >
                  <SelectTrigger id="upload-dept">
                    <SelectValue placeholder="Detect from file" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect from file (Grouped)</SelectItem>
                    {departmentsList.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        Default to {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* File Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <FileSpreadsheet className="text-muted-foreground mx-auto mb-2 h-10 w-10" />
            <p className="text-sm font-medium">
              {file ? file.name : "Click to select or drag and drop your spreadsheet"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv)</p>
          </div>

          {/* Parsing Spinner */}
          {parsing && (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm">
              <div className="border-primary h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
              Parsing spreadsheet questions…
            </div>
          )}

          {/* Parse Results Preview */}
          {parseResult && !parsing && (
            <div className="bg-muted/20 space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-semibold">
                    {parseResult.validRows.length} valid question(s) ready to import
                  </span>
                </div>
                {parseResult.errors.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {parseResult.errors.length} issue(s) detected
                  </Badge>
                )}
              </div>

              {/* Department breakdown */}
              {Object.keys(countByDepartment).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.entries(countByDepartment).map(([dept, count]) => (
                    <Badge key={dept} variant="outline" className="text-xs">
                      {dept}: <strong>{count}</strong>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Errors List */}
              {parseResult.errors.length > 0 && (
                <div className="mt-3 max-h-36 space-y-1.5 overflow-y-auto rounded-md border border-red-500/20 bg-red-500/5 p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Some rows could not be parsed:
                  </p>
                  <ul className="text-muted-foreground list-disc space-y-1 pl-4">
                    {parseResult.errors.slice(0, 15).map((err, i) => (
                      <li key={i}>
                        Row {err.rowNumber}: {err.message}
                      </li>
                    ))}
                    {parseResult.errors.length > 15 && (
                      <li className="text-foreground font-medium">
                        ...and {parseResult.errors.length - 15} more error(s).
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              resetState()
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>

          <Button
            type="button"
            disabled={!parseResult || parseResult.validRows.length === 0 || uploading || !cycleId}
            onClick={() => void handleImport()}
          >
            {uploading ? "Importing…" : `Import ${parseResult?.validRows.length || 0} Questions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
