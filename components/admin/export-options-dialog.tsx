"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FileIcon, FileSpreadsheet, FileText, Presentation } from "lucide-react"

type ExportOptionIcon = "excel" | "pdf" | "word" | "pptx"

interface ExportOption {
  id: string
  label: string
  icon?: ExportOptionIcon
}

interface ExportOptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  options: ExportOption[]
  onSelect: (id: string) => void
}

const iconMap = {
  excel: FileSpreadsheet,
  pdf: FileText,
  word: FileIcon,
  pptx: Presentation,
} as const

export function ExportOptionsDialog({
  open,
  onOpenChange,
  title = "Export Data",
  options,
  onSelect,
}: ExportOptionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const Icon = iconMap[option.icon || "pdf"]
            return (
              <Button
                key={option.id}
                variant="outline"
                className="justify-start gap-2"
                onClick={() => {
                  onSelect(option.id)
                  onOpenChange(false)
                }}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </Button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
