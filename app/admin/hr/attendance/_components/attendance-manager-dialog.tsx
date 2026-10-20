"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, ShieldOff, MapPin, CheckCircle2, Plane, Clock, Sunrise, Timer, AlertCircle } from "lucide-react"

import { Holiday, AttendanceManagerDialogProps } from "./attendance-manager/shared"
import { ExemptionTab } from "./attendance-manager/exemption-tab"
import { HolidayTab } from "./attendance-manager/holiday-tab"
import { EarlyClosureTab } from "./attendance-manager/early-closure-tab"
import { LateResumptionTab } from "./attendance-manager/late-resumption-tab"
import { ManualRecordsTab } from "./attendance-manager/manual-records-tab"
import { LeaveTab } from "./attendance-manager/leave-tab"

// ────────────────────────────────────────────────────────────
// Main Dialog
// ────────────────────────────────────────────────────────────

export function AttendanceManagerDialog({
  open,
  onOpenChange,
  reports,
  yearMonth,
  onHolidaysChanged,
  onReportChanged,
}: AttendanceManagerDialogProps) {
  const [activeTab, setActiveTab] = useState("exemption")

  // Reset to first tab on open
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) setActiveTab("exemption")
    prevOpen.current = open
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance Manager</DialogTitle>
          <DialogDescription>
            Manage exemptions, holidays, early closures, late resumptions, LWP, IWP, OOS, waivers, and leave records.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/60 flex h-auto w-full flex-wrap items-center justify-start gap-1 p-1">
            <TabsTrigger value="exemption" className="data-[state=active]:bg-background shrink-0 px-2.5 py-1.5 text-xs">
              <ShieldOff className="mr-1 h-3.5 w-3.5 shrink-0" />
              Exempt
            </TabsTrigger>
            <TabsTrigger value="holiday" className="data-[state=active]:bg-background shrink-0 px-2.5 py-1.5 text-xs">
              <CalendarDays className="mr-1 h-3.5 w-3.5 shrink-0" />
              Holiday
            </TabsTrigger>
            <TabsTrigger value="closure" className="data-[state=active]:bg-background shrink-0 px-2.5 py-1.5 text-xs">
              <Clock className="mr-1 h-3.5 w-3.5 shrink-0" />
              Closure
            </TabsTrigger>
            <TabsTrigger
              value="resumption"
              className="data-[state=active]:bg-background shrink-0 px-2.5 py-1.5 text-xs"
            >
              <Sunrise className="mr-1 h-3.5 w-3.5 shrink-0" />
              Resumption
            </TabsTrigger>
            <TabsTrigger value="lwp" className="data-[state=active]:bg-background shrink-0 px-2.5 py-1.5 text-xs">
              <Timer className="mr-1 h-3.5 w-3.5 shrink-0" />
              LWP
            </TabsTrigger>
            <TabsTrigger value="iwp" className="data-[state=active]:bg-background shrink-0 px-2.5 py-1.5 text-xs">
              <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" />
              IWP
            </TabsTrigger>
            <TabsTrigger value="oos" className="data-[state=active]:bg-background shrink-0 px-2.5 py-1.5 text-xs">
              <MapPin className="mr-1 h-3.5 w-3.5 shrink-0" />
              OOS
            </TabsTrigger>
            <TabsTrigger value="waiver" className="data-[state=active]:bg-background shrink-0 px-2.5 py-1.5 text-xs">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5 shrink-0" />
              Waiver
            </TabsTrigger>
            <TabsTrigger value="leave" className="data-[state=active]:bg-background shrink-0 px-2.5 py-1.5 text-xs">
              <Plane className="mr-1 h-3.5 w-3.5 shrink-0" />
              Leave
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exemption">
            <ExemptionTab reports={reports} yearMonth={yearMonth} onDone={onReportChanged} />
          </TabsContent>

          <TabsContent value="holiday">
            <HolidayTab onChanged={onHolidaysChanged} />
          </TabsContent>

          <TabsContent value="closure">
            <EarlyClosureTab onChanged={onReportChanged} />
          </TabsContent>

          <TabsContent value="resumption">
            <LateResumptionTab onChanged={onReportChanged} />
          </TabsContent>

          <TabsContent value="lwp">
            <ManualRecordsTab
              reports={reports}
              onDone={onReportChanged}
              status="lateness_with_permission"
              badge="LWP"
              applyLabel="Apply LWP"
              placeholder="e.g. Heavy rainfall / traffic congestion"
              intro={
                <>
                  Grant <strong>Lateness With Permission (LWP)</strong> for selected employees on a specific date or
                  date range.
                </>
              }
            />
          </TabsContent>

          <TabsContent value="iwp">
            <ManualRecordsTab
              reports={reports}
              onDone={onReportChanged}
              status="incomplete_with_permission"
              badge="IWP"
              applyLabel="Apply IWP"
              placeholder="e.g. Power outage at close / scanner malfunction"
              intro={
                <>
                  Grant <strong>Incomplete With Permission (IWP)</strong> for selected employees who were punctual but
                  missed clocking out.
                </>
              }
            />
          </TabsContent>

          <TabsContent value="oos">
            <ManualRecordsTab
              reports={reports}
              onDone={onReportChanged}
              status="out_of_station"
              badge="OOS"
              oosModes
              applyLabel="Apply OOS"
              placeholder="e.g. Field assignment to Lagos branch"
              intro={
                <>
                  Mark employees as <strong>Out of Station</strong> for a date range. This creates attendance records
                  with OOS status, counting as an approved absence.
                </>
              }
            />
          </TabsContent>

          <TabsContent value="waiver">
            <ManualRecordsTab
              reports={reports}
              onDone={onReportChanged}
              status="waiver"
              sendWaiverReason
              badge="Waiver"
              applyLabel="Apply Waiver"
              placeholder="e.g. National conference attendance"
              intro={
                <>
                  Apply an attendance <strong>waiver</strong> for selected employees over a date range. Waived days are
                  counted separately and do not penalise the attendance score.
                </>
              }
            />
          </TabsContent>

          <TabsContent value="leave">
            <LeaveTab reports={reports} onDone={onReportChanged} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
