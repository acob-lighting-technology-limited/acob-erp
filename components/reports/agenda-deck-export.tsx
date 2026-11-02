"use client"

import { useMemo, useState } from "react"
import { Loader2, Presentation } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PptxModeDialog } from "@/components/reports/pptx-mode-dialog"
import { createClient } from "@/lib/supabase/client"
import { getReportingOfficeWeek, getWeeksInOfficeYear } from "@/lib/meeting-week"
import { fetchWeeklyReportLockState, getDefaultMeetingDateIso } from "@/lib/weekly-report-lock"
import { loadWeeklyTaskSummaryOptions } from "@/lib/reports/weekly-task-summary"
import { GENERAL_MEETING_AGENDA } from "@/lib/reports/general-meeting-agenda"
import type { WeeklyDeptOrder, WeeklyPptxMode, WeeklyPptxTheme } from "@/lib/export-utils"

/** The week's Monday meeting as dd/mm/yy, so a week number can be picked by its date. */
function formatMeetingMonday(week: number, year: number) {
  const [yyyy, mm, dd] = getDefaultMeetingDateIso(week, year).split("-")
  return `${dd}/${mm}/${yyyy.slice(2)}`
}

/**
 * Builds and downloads the agenda deck for a meeting week, with progress and
 * anything left out reported in a toast. Shared by the hub button and the
 * weekly reports export's "Full meeting" option. Never throws.
 */
export async function runAgendaDeckExport({
  week,
  year,
  mode,
  theme,
  order,
}: {
  week: number
  year: number
  mode: WeeklyPptxMode
  theme: WeeklyPptxTheme
  order: WeeklyDeptOrder
}) {
  const toastId = toast.loading("Preparing the meeting deck…")
  const progress = (message: string) => toast.loading(message, { id: toastId })
  const warnings: string[] = []

  try {
    const [{ exportAgendaDeckToPPTX }, data] = await Promise.all([
      import("@/lib/export/agenda-deck"),
      import("@/lib/reports/agenda-deck-data"),
    ])

    const lockState = await fetchWeeklyReportLockState(createClient(), week, year).catch(() => null)
    const meetingDate = lockState?.meetingDate || getDefaultMeetingDateIso(week, year)

    progress("Loading weekly reports…")
    const reports = await data.fetchAgendaWeeklyReports(week, year)
    let taskSummaryOptions
    if (mode === "full") {
      taskSummaryOptions = await loadWeeklyTaskSummaryOptions(week, year).catch(() => {
        warnings.push("task counts")
        return undefined
      })
    }

    progress("Rendering the Knowledge Sharing Session…")
    const kss = await data.loadAgendaKss(week, year).catch(() => {
      warnings.push("KSS")
      return []
    })

    progress("Loading last week's summary of minutes…")
    const minutes = await data.loadAgendaMinutes(meetingDate).catch(() => {
      warnings.push("summary of minutes")
      return { label: "Summary of Minutes", note: "The summary of minutes could not be loaded." }
    })

    progress("Capturing the birthday slide…")
    const birthdays = await data.loadAgendaBirthdays(meetingDate)
    if (birthdays.some((slide) => !slide.image)) warnings.push("birthdays")

    progress("Building the PowerPoint…")
    await exportAgendaDeckToPPTX({
      week,
      year,
      meetingDate,
      mode,
      theme,
      order,
      taskSummaryOptions,
      reports,
      kss,
      minutes,
      birthdays,
    })

    if (warnings.length > 0) {
      toast.warning(`Meeting deck exported without: ${warnings.join(", ")}. See the section slides for details.`, {
        id: toastId,
      })
    } else {
      toast.success("Meeting deck exported", { id: toastId })
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Could not export the meeting deck", { id: toastId })
  }
}

/**
 * "Export Agenda Deck" on the General Meeting hub: picks the meeting week, then
 * reuses the weekly export's layout/theme/order steps, and builds one deck that
 * follows the standing agenda (see lib/export/agenda-deck.ts).
 */
export function AgendaDeckExportButton() {
  const reportingWeek = useMemo(() => getReportingOfficeWeek(), [])
  const [week, setWeek] = useState(reportingWeek.week)
  const [year, setYear] = useState(reportingWeek.year)
  const [weekDialogOpen, setWeekDialogOpen] = useState(false)
  const [modeDialogOpen, setModeDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const yearOptions = [reportingWeek.year - 1, reportingWeek.year, reportingWeek.year + 1]
  const weekOptions = useMemo(() => Array.from({ length: getWeeksInOfficeYear(year) }, (_, i) => i + 1), [year])

  const runExport = async (mode: WeeklyPptxMode, theme: WeeklyPptxTheme, order: WeeklyDeptOrder) => {
    setModeDialogOpen(false)
    setIsExporting(true)
    await runAgendaDeckExport({ week, year, mode, theme, order })
    setIsExporting(false)
  }

  return (
    <>
      <Button onClick={() => setWeekDialogOpen(true)} disabled={isExporting} className="gap-2">
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
        <span className="hidden sm:inline">Export Agenda Deck</span>
        <span className="sm:hidden">Agenda</span>
      </Button>

      <Dialog open={weekDialogOpen} onOpenChange={setWeekDialogOpen}>
        {/* overflow-visible: the dialog's default overflow-y-auto makes it the clipping
            boundary for the week list, which then gets squeezed inside this short dialog. */}
        <DialogContent className="w-[95vw] max-w-md overflow-visible">
          <DialogHeader>
            <DialogTitle>Export Agenda Deck</DialogTitle>
            <DialogDescription>
              One PowerPoint in agenda order: {GENERAL_MEETING_AGENDA.map((item) => item.title).join(", ")}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-[2fr_1fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="agenda-deck-week">Meeting week</Label>
              <Select value={String(week)} onValueChange={(value) => setWeek(Number(value))}>
                <SelectTrigger id="agenda-deck-week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {`Week ${option} · ${formatMeetingMonday(option, year)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="agenda-deck-year">Year</Label>
              <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
                <SelectTrigger id="agenda-deck-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWeekDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setWeekDialogOpen(false)
                setModeDialogOpen(true)
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PptxModeDialog open={modeDialogOpen} onOpenChange={setModeDialogOpen} onSelect={runExport} />
    </>
  )
}
