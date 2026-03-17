"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { getCurrentOfficeWeek } from "@/lib/meeting-week"

interface ActionTrackerFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  week: number
  onWeekChange: (value: number) => void
  year: number
  onYearChange: (value: number) => void
  deptFilter: string
  onDeptFilterChange: (value: string) => void
  allDepartments: string[]
  loading: boolean
  onRefresh: () => void
}

export function ActionTrackerFilters({
  searchQuery,
  onSearchChange,
  week,
  onWeekChange,
  year,
  onYearChange,
  deptFilter,
  onDeptFilterChange,
  allDepartments,
  loading,
  onRefresh,
}: ActionTrackerFiltersProps) {
  const currentOfficeWeek = getCurrentOfficeWeek()
  const weekOptions = Array.from({ length: 53 }, (_, i) => i + 1)
  const yearOptions = [
    currentOfficeWeek.year - 1,
    currentOfficeWeek.year,
    currentOfficeWeek.year + 1,
    currentOfficeWeek.year + 2,
  ]

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex items-end gap-2">
        <div className="w-[140px]">
          <Label className="text-muted-foreground ml-1 text-[10px] font-bold uppercase">Week</Label>
          <Select value={String(week)} onValueChange={(v) => onWeekChange(Number(v))}>
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
          <Label className="text-muted-foreground ml-1 text-[10px] font-bold uppercase">Year</Label>
          <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
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
        <div className="w-52">
          <Label className="text-muted-foreground ml-1 text-[10px] font-bold uppercase">Department</Label>
          <Select value={deptFilter} onValueChange={onDeptFilterChange}>
            <SelectTrigger>
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {allDepartments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading} className="h-10 w-10 shrink-0">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>
    </div>
  )
}
