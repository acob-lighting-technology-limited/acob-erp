"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Search } from "lucide-react"
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
}: WeeklyReportFiltersBarProps) {
  const currentOfficeWeek = getCurrentOfficeWeek()
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
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>
    </div>
  )
}
