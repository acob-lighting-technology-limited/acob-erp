"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { WeeklyPptxMode, WeeklyPptxTheme } from "@/lib/export-utils"

interface PptxModeDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onExport: (mode: WeeklyPptxMode, theme: WeeklyPptxTheme) => void
}

export function PptxModeDialog({ isOpen, onOpenChange, onExport }: PptxModeDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select PPTX Mode</DialogTitle>
          <DialogDescription>Choose layout mode and theme for the PowerPoint export.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button variant="outline" onClick={() => onExport("compact", "light")} className="justify-start">
            Compact (Light)
          </Button>
          <Button variant="outline" onClick={() => onExport("full", "light")} className="justify-start">
            Full (Light)
          </Button>
          <Button variant="outline" onClick={() => onExport("compact", "dark")} className="justify-start">
            Compact (Dark)
          </Button>
          <Button onClick={() => onExport("full", "dark")} className="justify-start">
            Full (Dark)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
