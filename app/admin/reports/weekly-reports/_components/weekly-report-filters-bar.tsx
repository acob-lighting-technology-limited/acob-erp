"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

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
  meetingGraceHours: number
  setMeetingGraceHours: (v: number) => void
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
  meetingGraceHours,
  setMeetingGraceHours,
  savingMeetingWindow,
  saveMeetingWindow,
}: WeeklyReportFiltersBarProps) {
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
          <div className="w-24">
            <Label className="mb-1.5 block text-xs font-semibold">Week</Label>
            <Input
              type="number"
              value={weekFilter}
              onChange={(e) => setWeekFilter(parseInt(e.target.value) || weekFilter)}
            />
          </div>
          <div className="w-28">
            <Label className="mb-1.5 block text-xs font-semibold">Year</Label>
            <Input
              type="number"
              value={yearFilter}
              onChange={(e) => setYearFilter(parseInt(e.target.value) || yearFilter)}
            />
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
          <p className="mb-2 text-xs font-semibold">Meeting Date Lock Window (selected week)</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="w-full max-w-[220px]">
              <Label className="mb-1.5 block text-xs font-semibold">Meeting Date</Label>
              <Input type="date" value={meetingDateInput} onChange={(e) => setMeetingDateInput(e.target.value)} />
            </div>
            <div className="w-full max-w-[180px]">
              <Label className="mb-1.5 block text-xs font-semibold">Grace Hours</Label>
              <Input
                type="number"
                value={meetingGraceHours}
                onChange={(e) => setMeetingGraceHours(parseInt(e.target.value) || 0)}
                min={0}
                max={24}
              />
            </div>
            <Button onClick={saveMeetingWindow} disabled={savingMeetingWindow} className="gap-2">
              {savingMeetingWindow && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Meeting Window
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-[11px]">
            Use this when meeting shifts from Monday (e.g., public holiday to Tuesday).
          </p>
        </div>
      )}
    </div>
  )
}
