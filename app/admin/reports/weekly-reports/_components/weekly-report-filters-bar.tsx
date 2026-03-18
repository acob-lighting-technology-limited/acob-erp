"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Search, Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"

interface WeeklyReportFiltersBarProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  weekFilter: number
  setWeekFilter: (v: number) => void
  yearFilter: number
  setYearFilter: (v: number) => void
  deptFilter: string
  setDeptFilter: (v: string) => void
  initialDepartments: string[]
  loading: boolean
  refetchReports: () => void
  isAdminRole: boolean
  meetingDateInput: string
  setMeetingDateInput: (v: string) => void
  meetingTimeInput: string
  setMeetingTimeInput: (v: string) => void
  meetingGraceHours: number
  setMeetingGraceHours: (v: number) => void
  kssDepartmentInput: string
  setKssDepartmentInput: (v: string) => void
  kssPresenterIdInput: string
  setKssPresenterIdInput: (v: string) => void
  presenterOptions: Array<{
    id: string
    full_name: string
  }>
  isWeekSetupLocked: boolean
  savingMeetingWindow: boolean
  saveMeetingWindow: () => void
}

export function WeeklyReportFiltersBar({
  searchQuery,
  setSearchQuery,
  weekFilter,
  setWeekFilter,
  yearFilter,
  setYearFilter,
  deptFilter,
  setDeptFilter,
  initialDepartments,
  loading,
  refetchReports,
  isAdminRole,
  meetingDateInput,
  setMeetingDateInput,
  meetingTimeInput,
  setMeetingTimeInput,
  meetingGraceHours,
  setMeetingGraceHours,
  kssDepartmentInput,
  setKssDepartmentInput,
  kssPresenterIdInput,
  setKssPresenterIdInput,
  presenterOptions,
  isWeekSetupLocked,
  savingMeetingWindow,
  saveMeetingWindow,
}: WeeklyReportFiltersBarProps) {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const [isWeekSetupOpen, setIsWeekSetupOpen] = useState(false)
  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1)
  const yearOptions = [
    currentOfficeWeek.year - 1,
    currentOfficeWeek.year,
    currentOfficeWeek.year + 1,
    currentOfficeWeek.year + 2,
  ]

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-col items-end justify-between gap-4 md:flex-row">
        <div className="w-full max-w-md flex-1">
          <Label className="mb-1.5 block text-xs font-semibold">Search Content</Label>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex w-full flex-wrap items-end gap-3 md:w-auto">
          <div className="w-[140px]">
            <Label className="mb-1.5 block text-xs font-semibold">Week</Label>
            <Select value={String(weekFilter)} onValueChange={(v) => setWeekFilter(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    Week {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-[120px]">
            <Label className="mb-1.5 block text-xs font-semibold">Year</Label>
            <Select value={String(yearFilter)} onValueChange={(v) => setYearFilter(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[12rem] flex-1 md:flex-none">
            <Label className="mb-1.5 block text-xs font-semibold">Department</Label>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every Department</SelectItem>
                {initialDepartments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetchReports()}
            disabled={loading}
            className="shrink-0"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isAdminRole && (
        <div className="bg-muted/30 rounded-lg border p-3">
          <button
            type="button"
            onClick={() => setIsWeekSetupOpen((open) => !open)}
            className="flex w-full items-start justify-between gap-4 text-left"
          >
            <div>
              <p className="mb-1 text-xs font-semibold">{`Week Setup: W${weekFilter}, ${yearFilter}`}</p>
              <p className="text-muted-foreground text-[11px]">
                This is the source of truth for reminders, meeting mail, KSS, Minutes of Meeting, Action Points, and the
                weekly report lock window for the selected office week.
              </p>
            </div>
            <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
              {isWeekSetupOpen ? "Hide" : "Show"}
              <ChevronDown className={cn("h-4 w-4 transition-transform", isWeekSetupOpen && "rotate-180")} />
            </span>
          </button>

          {isWeekSetupOpen && (
            <>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
                <div className="w-full max-w-[220px]">
                  <Label className="mb-1.5 block text-xs font-semibold">Actual Meeting Date</Label>
                  <Input
                    type="date"
                    value={meetingDateInput}
                    onChange={(e) => setMeetingDateInput(e.target.value)}
                    disabled={isWeekSetupLocked}
                  />
                </div>
                <div className="w-full max-w-[160px]">
                  <Label className="mb-1.5 block text-xs font-semibold">Meeting Time</Label>
                  <Input
                    type="time"
                    value={meetingTimeInput}
                    onChange={(e) => setMeetingTimeInput(e.target.value)}
                    disabled={isWeekSetupLocked}
                  />
                </div>
                <div className="w-full min-w-[220px]">
                  <Label className="mb-1.5 block text-xs font-semibold">KSS Department</Label>
                  <Select
                    value={kssDepartmentInput}
                    onValueChange={(value) => {
                      setKssDepartmentInput(value)
                      setKssPresenterIdInput("none")
                    }}
                    disabled={isWeekSetupLocked}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select department</SelectItem>
                      {initialDepartments.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full min-w-[220px]">
                  <Label className="mb-1.5 block text-xs font-semibold">KSS Presenter</Label>
                  <Select
                    value={kssPresenterIdInput}
                    onValueChange={setKssPresenterIdInput}
                    disabled={isWeekSetupLocked || kssDepartmentInput === "none"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select presenter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select presenter</SelectItem>
                      {presenterOptions.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full max-w-[180px]">
                  <Label className="mb-1.5 block text-xs font-semibold">Grace Hours After Meeting</Label>
                  <Input
                    type="number"
                    value={meetingGraceHours}
                    onChange={(e) => setMeetingGraceHours(parseInt(e.target.value) || 0)}
                    min={0}
                    max={24}
                    disabled={isWeekSetupLocked}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  onClick={saveMeetingWindow}
                  disabled={savingMeetingWindow || isWeekSetupLocked}
                  className="gap-2"
                >
                  {savingMeetingWindow && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Week Setup
                </Button>
                <span className="text-muted-foreground text-[11px]">
                  {isWeekSetupLocked
                    ? "This week is locked after the meeting grace window, so the setup is read-only."
                    : "Saving here updates the week's meeting date, meeting time, and KSS presenter setup together."}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-[11px]">
                Change this whenever the meeting moves from its usual day, for example from Monday to Tuesday.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
