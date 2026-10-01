"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface PlanYearSelectProps {
  year: number | null | undefined
  years: number[] | null | undefined
  onChange: (year: number) => void
}

/**
 * Strategic plan year picker for the scorecard pages. Hidden while only one
 * plan year exists, so it appears by itself once next year's KPIs are loaded.
 */
export function PlanYearSelect({ year, years, onChange }: PlanYearSelectProps) {
  if (!year || !years || years.length < 2) return null
  return (
    <Select value={String(year)} onValueChange={(value) => onChange(Number(value))}>
      <SelectTrigger className="h-8 w-[110px]" aria-label="Plan year">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y} plan
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
