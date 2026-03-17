"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ExportColumnsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  exportType: "excel" | "pdf" | null
  selectedColumns: Record<string, boolean>
  onColumnChange: (columns: Record<string, boolean>) => void
  onConfirm: () => void
}

export function ExportColumnsDialog({
  open,
  onOpenChange,
  exportType,
  selectedColumns,
  onColumnChange,
  onConfirm,
}: ExportColumnsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Select Columns to Export</DialogTitle>
          <DialogDescription>
            Choose which columns you want to include in your {exportType?.toUpperCase()} export
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          {Object.keys(selectedColumns).map((column) => (
            <div key={column} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={column}
                checked={selectedColumns[column]}
                onChange={(e) =>
                  onColumnChange({
                    ...selectedColumns,
                    [column]: e.target.checked,
                  })
                }
                className="text-primary focus:ring-primary h-4 w-4 rounded border-gray-300"
              />
              <label
                htmlFor={column}
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {column}
              </label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!Object.values(selectedColumns).some((v) => v)}>
            Export to {exportType?.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
