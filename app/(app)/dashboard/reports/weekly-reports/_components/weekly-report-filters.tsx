"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { FormFieldGroup } from "@/components/ui/patterns"

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
        <div className="w-24">
          <Label className="mb-1.5 block text-xs font-semibold">Week</Label>
          <Input
            type="number"
            value={weekFilter}
            onChange={(e) => onWeekChange(parseInt(e.target.value) || weekFilter)}
          />
        </div>
        <div className="w-28">
          <Label className="mb-1.5 block text-xs font-semibold">Year</Label>
          <Input
            type="number"
            value={yearFilter}
            onChange={(e) => onYearChange(parseInt(e.target.value) || yearFilter)}
          />
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
