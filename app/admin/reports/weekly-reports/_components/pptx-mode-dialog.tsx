"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { WeeklyPptxMode, WeeklyPptxTheme } from "@/lib/export-utils"

interface PptxModeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (mode: WeeklyPptxMode, theme: WeeklyPptxTheme) => void
}

export function PptxModeDialog({ open, onOpenChange, onSelect }: PptxModeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select PPTX Mode</DialogTitle>
          <DialogDescription>Choose layout mode and theme for the PowerPoint export.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button variant="outline" onClick={() => onSelect("compact", "light")} className="justify-start">
            Compact (Light)
          </Button>
          <Button variant="outline" onClick={() => onSelect("full", "light")} className="justify-start">
            Full (Light)
          </Button>
          <Button variant="outline" onClick={() => onSelect("compact", "dark")} className="justify-start">
            Compact (Dark)
          </Button>
          <Button onClick={() => onSelect("full", "dark")} className="justify-start">
            Full (Dark)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
