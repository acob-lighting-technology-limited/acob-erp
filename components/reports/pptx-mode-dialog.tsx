"use client"

import { useState } from "react"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { WeeklyDeptOrder, WeeklyPptxMode, WeeklyPptxTheme } from "@/lib/export-utils"

interface PptxModeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (mode: WeeklyPptxMode, theme: WeeklyPptxTheme, order: WeeklyDeptOrder) => void
  showOrderStep?: boolean
}

type Step = 1 | 2 | 3

export function PptxModeDialog({ open, onOpenChange, onSelect, showOrderStep = true }: PptxModeDialogProps) {
  const [step, setStep] = useState<Step>(1)
  const [mode, setMode] = useState<WeeklyPptxMode>("full")
  const [theme, setTheme] = useState<WeeklyPptxTheme>("light")

  const handleOpenChange = (o: boolean) => {
    if (!o) setStep(1)
    onOpenChange(o)
  }

  const handleModeSelect = (m: WeeklyPptxMode) => {
    setMode(m)
    setStep(2)
  }

  const handleThemeSelect = (t: WeeklyPptxTheme) => {
    setTheme(t)
    if (showOrderStep) {
      setStep(3)
    } else {
      onSelect(mode, t, "default")
    }
  }

  const handleOrderSelect = (order: WeeklyDeptOrder) => {
    onSelect(mode, theme, order)
  }

  const totalSteps = showOrderStep ? 3 : 2

  const stepConfig = {
    1: {
      title: `Step 1 of ${totalSteps} — Layout`,
      description: "Choose the slide layout for your PowerPoint export.",
    },
    2: {
      title: `Step 2 of ${totalSteps} — Theme`,
      description: "Choose the colour theme.",
    },
    3: {
      title: "Step 3 of 3 — Department Order",
      description: "Choose how departments are ordered in the presentation.",
    },
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>{stepConfig[step].title}</DialogTitle>
          <DialogDescription>{stepConfig[step].description}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleModeSelect("compact")}
            >
              <span className="font-semibold">Compact</span>
              <span className="text-muted-foreground text-xs font-normal">2 slides per department</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleModeSelect("full")}
            >
              <span className="font-semibold">Full</span>
              <span className="text-muted-foreground text-xs font-normal">3 slides per department</span>
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleThemeSelect("light")}
            >
              <span className="font-semibold">Light</span>
              <span className="text-muted-foreground text-xs font-normal">White background, dark text</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleThemeSelect("dark")}
            >
              <span className="font-semibold">Dark</span>
              <span className="text-muted-foreground text-xs font-normal">Black background, light text</span>
            </Button>
            <Button variant="ghost" size="sm" className="mt-1 gap-1 self-start" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleOrderSelect("default")}
            >
              <span className="font-semibold">Default</span>
              <span className="text-muted-foreground text-xs font-normal">
                ACOB standard order (Accounts → Business Growth → IT…)
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleOrderSelect("alpha")}
            >
              <span className="font-semibold">Alphabetical</span>
              <span className="text-muted-foreground text-xs font-normal">Departments sorted A → Z</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleOrderSelect("random")}
            >
              <span className="font-semibold">Random</span>
              <span className="text-muted-foreground text-xs font-normal">Shuffle department order on each export</span>
            </Button>
            <Button variant="ghost" size="sm" className="mt-1 gap-1 self-start" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
