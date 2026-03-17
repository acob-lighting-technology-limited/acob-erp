"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { FormFieldGroup } from "@/components/ui/patterns"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"

interface WeeklyReportFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  weekFilter: number
  onWeekChange: (value: number) => void
  yearFilter: number
  onYearChange: (value: number) => void
  deptFilter: string
  onDeptChange: (value: string) => void
  allDepartments: string[]
  isDepartmentLead: boolean
  loading: boolean
  onRefresh: () => void
}

export function WeeklyReportFilters({
  searchQuery,
  onSearchChange,
  weekFilter,
  onWeekChange,
  yearFilter,
  onYearChange,
  deptFilter,
  onDeptChange,
  allDepartments,
  isDepartmentLead,
  loading,
  onRefresh,
}: WeeklyReportFiltersProps) {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1)
  const yearOptions = [
    currentOfficeWeek.year - 1,
    currentOfficeWeek.year,
    currentOfficeWeek.year + 1,
    currentOfficeWeek.year + 2,
  ]

  return (
    <div className="mb-6 flex flex-col items-end justify-between gap-4 md:flex-row">
      <div className="w-full max-w-md flex-1">
        <FormFieldGroup label="Search Content" className="space-y-1">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </FormFieldGroup>
      </div>
      <div className="flex w-full flex-wrap items-end gap-3 md:w-auto">
        <div className="w-[140px]">
          <Label className="mb-1.5 block text-xs font-semibold">Week</Label>
          <Select value={String(weekFilter)} onValueChange={(v) => onWeekChange(Number(v))}>
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
          <Select value={String(yearFilter)} onValueChange={(v) => onYearChange(Number(v))}>
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
          <Select value={deptFilter} onValueChange={onDeptChange} disabled={isDepartmentLead}>
            <SelectTrigger>
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every Department</SelectItem>
              {allDepartments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading} className="shrink-0">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
    </div>
  )
}
