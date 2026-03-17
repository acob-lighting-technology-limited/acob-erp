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
import { Download, CheckCircle2 } from "lucide-react"

interface AssetExportDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  exportType: "excel" | "pdf" | "word" | null
  selectedColumns: Record<string, boolean>
  setSelectedColumns: (columns: Record<string, boolean>) => void
  onExportConfirm: () => void
}

export function AssetExportDialog({
  isOpen,
  onOpenChange,
  exportType,
  selectedColumns,
  setSelectedColumns,
  onExportConfirm,
}: AssetExportDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <Download className="text-primary h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">Select Columns to Export</DialogTitle>
              <DialogDescription className="mt-1">
                Choose which columns you want to include in your{" "}
                <span className="text-primary font-semibold">{exportType?.toUpperCase()}</span> export
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <div className="bg-muted/50 mb-3 flex items-center justify-between rounded-lg px-3 py-2">
            <span className="text-muted-foreground text-sm font-medium">
              {Object.values(selectedColumns).filter((v) => v).length} of {Object.keys(selectedColumns).length} columns
              selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const allSelected = Object.values(selectedColumns).every((v) => v)
                setSelectedColumns(
                  Object.keys(selectedColumns).reduce(
                    (acc, key) => ({ ...acc, [key]: !allSelected }),
                    {} as Record<string, boolean>
                  )
                )
              }}
              className="h-7 text-xs"
            >
              {Object.values(selectedColumns).every((v) => v) ? "Deselect All" : "Select All"}
            </Button>
          </div>
          <div className="bg-background/50 max-h-96 space-y-1.5 overflow-y-auto rounded-lg border p-2">
            {Object.keys(selectedColumns).map((column) => (
              <div
                key={column}
                className={`group hover:bg-muted/80 flex items-center space-x-3 rounded-md px-3 py-2.5 transition-colors ${
                  selectedColumns[column] ? "bg-primary/5 hover:bg-primary/10" : ""
                }`}
              >
                <Checkbox
                  id={column}
                  checked={selectedColumns[column]}
                  onCheckedChange={(checked) => {
                    setSelectedColumns({
                      ...selectedColumns,
                      [column]: checked === true,
                    })
                  }}
                  className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                />
                <Label
                  htmlFor={column}
                  className={`flex-1 cursor-pointer text-sm font-medium transition-colors ${
                    selectedColumns[column]
                      ? "text-foreground"
                      : "text-muted-foreground group-hover:text-foreground dark:group-hover:text-foreground"
                  }`}
                >
                  {column}
                </Label>
                {selectedColumns[column] && <CheckCircle2 className="text-primary h-4 w-4" />}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onExportConfirm} disabled={!Object.values(selectedColumns).some((v) => v)} className="gap-2">
            <Download className="h-4 w-4" />
            Export to {exportType?.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
