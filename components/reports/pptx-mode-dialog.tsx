"use client"

import { useState } from "react"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { WeeklyDeptOrder, WeeklyPptxMode, WeeklyPptxTheme } from "@/lib/export-utils"
import type { WeeklyTaskSummaryPlacement } from "@/lib/reports/weekly-task-summary"

interface PptxModeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (
    mode: WeeklyPptxMode,
    theme: WeeklyPptxTheme,
    order: WeeklyDeptOrder,
    taskPlacement: WeeklyTaskSummaryPlacement
  ) => void
  showOrderStep?: boolean
}

type Step = "layout" | "theme" | "order" | "tasks"

export function PptxModeDialog({ open, onOpenChange, onSelect, showOrderStep = true }: PptxModeDialogProps) {
  const [step, setStep] = useState<Step>("layout")
  const [mode, setMode] = useState<WeeklyPptxMode>("full")
  const [theme, setTheme] = useState<WeeklyPptxTheme>("light")
  const [order, setOrder] = useState<WeeklyDeptOrder>("default")

  // Task counts only have a place in the full layout; compact skips the step.
  const steps: Step[] = [
    "layout",
    "theme",
    ...(showOrderStep ? (["order"] as const) : []),
    ...(mode === "full" ? (["tasks"] as const) : []),
  ]
  const stepIndex = steps.indexOf(step)

  const advance = (next: { mode?: WeeklyPptxMode; theme?: WeeklyPptxTheme; order?: WeeklyDeptOrder }) => {
    const nextMode = next.mode ?? mode
    const nextTheme = next.theme ?? theme
    const nextOrder = next.order ?? order
    const remaining: Step[] = [
      "layout",
      "theme",
      ...(showOrderStep ? (["order"] as const) : []),
      ...(nextMode === "full" ? (["tasks"] as const) : []),
    ]
    const following = remaining[remaining.indexOf(step) + 1]
    if (following) {
      setStep(following)
    } else {
      onSelect(nextMode, nextTheme, nextOrder, "none")
    }
  }

  const goBack = () => {
    const previous = steps[stepIndex - 1]
    if (previous) setStep(previous)
  }

  const handleOpenChange = (o: boolean) => {
    if (!o) setStep("layout")
    onOpenChange(o)
  }

  const handleModeSelect = (m: WeeklyPptxMode) => {
    setMode(m)
    advance({ mode: m })
  }

  const handleThemeSelect = (t: WeeklyPptxTheme) => {
    setTheme(t)
    advance({ theme: t })
  }

  const handleOrderSelect = (o: WeeklyDeptOrder) => {
    setOrder(o)
    advance({ order: o })
  }

  const handleTasksSelect = (placement: WeeklyTaskSummaryPlacement) => {
    onSelect(mode, theme, order, placement)
  }

  const stepConfig: Record<Step, { title: string; description: string }> = {
    layout: { title: "Layout", description: "Choose the slide layout for your PowerPoint export." },
    theme: { title: "Theme", description: "Choose the colour theme." },
    order: { title: "Department Order", description: "Choose how departments are ordered in the presentation." },
    tasks: {
      title: "Task Counts",
      description: "Show each department's completed tasks, and each assignee's completed / assigned count.",
    },
  }
  // Before the layout is chosen the step count is not known yet; assume full.
  const totalSteps = steps.length

  const backButton = (
    <Button variant="ghost" size="sm" className="mt-1 gap-1 self-start" onClick={goBack}>
      <ChevronLeft className="h-4 w-4" /> Back
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle>
            Step {stepIndex + 1} of {totalSteps} — {stepConfig[step].title}
          </DialogTitle>
          <DialogDescription>{stepConfig[step].description}</DialogDescription>
        </DialogHeader>

        {step === "layout" && (
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

        {step === "theme" && (
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
            {backButton}
          </div>
        )}

        {step === "order" && (
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
            {backButton}
          </div>
        )}

        {step === "tasks" && (
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleTasksSelect("none")}
            >
              <span className="font-semibold">Normal</span>
              <span className="text-muted-foreground text-xs font-normal">No task counts</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleTasksSelect("work_done")}
            >
              <span className="font-semibold">On Work Done</span>
              <span className="text-muted-foreground text-xs font-normal">
                Total in the Work Done title, staff strip underneath
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleTasksSelect("work_done_column")}
            >
              <span className="font-semibold">Beside Work Done</span>
              <span className="text-muted-foreground text-xs font-normal">
                Narrow task summary column next to Work Done
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col items-start justify-center gap-0.5 px-4"
              onClick={() => handleTasksSelect("challenges")}
            >
              <span className="font-semibold">Beside Challenges</span>
              <span className="text-muted-foreground text-xs font-normal">
                Taller Challenges row, split with a task summary card
              </span>
            </Button>
            {backButton}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
