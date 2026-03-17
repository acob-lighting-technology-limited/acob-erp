"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActionTrackerFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  weekFilter: number
  onWeekChange: (value: number) => void
  yearFilter: number
  onYearChange: (value: number) => void
  deptFilter: string
  onDeptChange: (value: string) => void
  departments: string[]
  loading: boolean
  onRefresh: () => void
}

export function ActionTrackerFilters({
  searchQuery,
  onSearchChange,
  weekFilter,
  onWeekChange,
  yearFilter,
  onYearChange,
  deptFilter,
  onDeptChange,
  departments,
  loading,
  onRefresh,
}: ActionTrackerFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search by description or department..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex items-end gap-2">
        <div className="w-24">
          <Label className="text-muted-foreground mb-1.5 block px-1 text-[10px] font-bold tracking-wider uppercase">
            Week
          </Label>
          <Input
            type="number"
            value={weekFilter}
            onChange={(e) => onWeekChange(parseInt(e.target.value) || weekFilter)}
          />
        </div>
        <div className="w-28">
          <Label className="text-muted-foreground mb-1.5 block px-1 text-[10px] font-bold tracking-wider uppercase">
            Year
          </Label>
          <Input
            type="number"
            value={yearFilter}
            onChange={(e) => onYearChange(parseInt(e.target.value) || yearFilter)}
          />
        </div>
        <div className="w-52">
          <Label className="text-muted-foreground mb-1.5 block px-1 text-[10px] font-bold tracking-wider uppercase">
            Department
          </Label>
          <Select value={deptFilter} onValueChange={onDeptChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
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
