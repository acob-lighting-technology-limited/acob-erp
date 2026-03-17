"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHoliday = any

export interface HolidayFormState {
  holiday_date: string
  location: string
  name: string
  is_business_day: boolean
}

interface HolidayCalendarCardProps {
  holidays: AnyHoliday[]
  form: HolidayFormState
  onFormChange: (form: HolidayFormState) => void
  onSave: () => void
}

export function HolidayCalendarCard({ holidays, form, onFormChange, onSave }: HolidayCalendarCardProps) {
  const set = (patch: Partial<HolidayFormState>) => onFormChange({ ...form, ...patch })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holiday Calendar</CardTitle>
        <CardDescription>Used for business-day leave calculations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={form.holiday_date} onChange={(e) => set({ holiday_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
        </div>
        <Button onClick={onSave}>Add Holiday</Button>

        <div className="space-y-2">
          {holidays.map((holiday: AnyHoliday) => (
            <div key={holiday.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{holiday.name}</p>
              <p>
                {holiday.holiday_date} ({holiday.location})
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
