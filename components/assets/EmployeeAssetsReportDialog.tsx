"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, Users, CheckCircle2 } from "lucide-react"

interface EmployeeAssetsReportDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  employeeReportExportType: "excel" | "pdf" | "word" | null
  employeeReportSelectedTypes: Record<string, boolean>
  setEmployeeReportSelectedTypes: (types: Record<string, boolean>) => void
  assetTypes: { label: string; code: string; requiresSerialModel: boolean }[]
  employeesCount: number
  onConfirm: () => void
}

export function EmployeeAssetsReportDialog({
  isOpen,
  onOpenChange,
  employeeReportExportType,
  employeeReportSelectedTypes,
  setEmployeeReportSelectedTypes,
  assetTypes,
  employeesCount,
  onConfirm,
}: EmployeeAssetsReportDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <Users className="text-primary h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Employee Assets Report</DialogTitle>
              <DialogDescription className="mt-1">
                Export to <span className="text-primary font-semibold">{employeeReportExportType?.toUpperCase()}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-muted-foreground text-sm">
              This report lists{" "}
              <span className="text-foreground font-semibold">{employeesCount} employees members</span> as rows.
              Employee without selected assets show <span className="bg-muted rounded px-1 font-mono text-xs">-</span>.
            </p>
          </div>

          {/* Asset Type Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Select Asset Types as Columns:</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const allSelected = Object.values(employeeReportSelectedTypes).every((v) => v)
                  const newSelection: Record<string, boolean> = {}
                  assetTypes.forEach((t) => {
                    newSelection[t.code] = !allSelected
                  })
                  setEmployeeReportSelectedTypes(newSelection)
                }}
                className="h-7 text-xs"
              >
                {Object.values(employeeReportSelectedTypes).every((v) => v) ? "Deselect All" : "Select All"}
              </Button>
            </div>
            <div className="bg-background/50 max-h-64 space-y-1.5 overflow-y-auto rounded-lg border p-2">
              {assetTypes.map((type) => (
                <div
                  key={type.code}
                  className={`group hover:bg-muted/80 flex items-center space-x-3 rounded-md px-3 py-2 transition-colors ${
                    employeeReportSelectedTypes[type.code] ? "bg-primary/5 hover:bg-primary/10" : ""
                  }`}
                >
                  <Checkbox
                    id={`employees-report-${type.code}`}
                    checked={employeeReportSelectedTypes[type.code] || false}
                    onCheckedChange={(checked) => {
                      setEmployeeReportSelectedTypes({
                        ...employeeReportSelectedTypes,
                        [type.code]: checked === true,
                      })
                    }}
                    className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                  />
                  <Label
                    htmlFor={`employees-report-${type.code}`}
                    className={`flex-1 cursor-pointer text-sm font-medium transition-colors ${
                      employeeReportSelectedTypes[type.code]
                        ? "text-foreground"
                        : "text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    {type.label}
                  </Label>
                  {employeeReportSelectedTypes[type.code] && <CheckCircle2 className="text-primary h-4 w-4" />}
                </div>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {Object.values(employeeReportSelectedTypes).filter((v) => v).length} of {assetTypes.length} types selected
            </p>
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="gap-2"
            disabled={!Object.values(employeeReportSelectedTypes).some((v) => v)}
          >
            <Download className="h-4 w-4" />
            Export to {employeeReportExportType?.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
