"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface LeaveType {
  id: string
  name: string
}

interface LeavePolicy {
  id: string
  leave_type_id: string
  annual_days: number
  eligibility: "all" | "female_only" | "male_only" | "custom"
  min_tenure_months: number
  notice_days: number
  accrual_mode: "calendar_days" | "business_days"
  leave_type?: { name: string }
}

export default function LeaveSettingsPage() {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [policies, setPolicies] = useState<LeavePolicy[]>([])
  const [holidays, setHolidays] = useState<any[]>([])
  const [slas, setSlas] = useState<any[]>([])
  const [dataQuality, setDataQuality] = useState<any[]>([])

  const [policyForm, setPolicyForm] = useState({
    leave_type_id: "",
    annual_days: 0,
    eligibility: "all",
    min_tenure_months: 0,
    notice_days: 0,
    accrual_mode: "calendar_days",
    carry_forward_cap: 0,
  })

  const [holidayForm, setHolidayForm] = useState({
    holiday_date: "",
    location: "global",
    name: "",
    is_business_day: false,
  })

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    const [typesRes, policyRes, holidayRes, slaRes, qualityRes] = await Promise.all([
      fetch("/api/hr/leave/types"),
      fetch("/api/hr/leave/policies"),
      fetch("/api/hr/leave/holidays"),
      fetch("/api/hr/leave/sla"),
      fetch("/api/hr/leave/data-quality"),
    ])

    const typesPayload = await typesRes.json()
    const policyPayload = await policyRes.json()
    const holidayPayload = await holidayRes.json()
    const slaPayload = await slaRes.json()
    const qualityPayload = await qualityRes.json()

    setLeaveTypes(typesPayload.data || [])
    setPolicies(policyPayload.data || [])
    setHolidays(holidayPayload.data || [])
    setSlas(slaPayload.data || [])
    setDataQuality(qualityPayload.data || [])
  }

  async function savePolicy() {
    try {
      const response = await fetch("/api/hr/leave/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policyForm),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to save policy")
      toast.success("Policy saved")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save policy")
    }
  }

  async function saveHoliday() {
    try {
      const response = await fetch("/api/hr/leave/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holidayForm),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to save holiday")
      toast.success("Holiday saved")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save holiday")
    }
  }

  async function saveSla(stage: string, due_hours: number, reminder_hours_before: number) {
    try {
      const response = await fetch("/api/hr/leave/sla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, due_hours, reminder_hours_before }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to save SLA")
      toast.success("SLA saved")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save SLA")
    }
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <Link href="/admin/hr" className="text-muted-foreground inline-flex items-center gap-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to HR Dashboard
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Leave Settings</h1>
        <p className="text-muted-foreground">Manage policies, holidays, SLA windows and profile data quality</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave Policy Rules</CardTitle>
          <CardDescription>Configure annual allocation and eligibility per leave type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <Select
                value={policyForm.leave_type_id}
                onValueChange={(value) => setPolicyForm((prev) => ({ ...prev, leave_type_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Annual Days</Label>
              <Input
                type="number"
                value={policyForm.annual_days}
                onChange={(e) => setPolicyForm((prev) => ({ ...prev, annual_days: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Min Tenure (months)</Label>
              <Input
                type="number"
                value={policyForm.min_tenure_months}
                onChange={(e) => setPolicyForm((prev) => ({ ...prev, min_tenure_months: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notice Days</Label>
              <Input
                type="number"
                value={policyForm.notice_days}
                onChange={(e) => setPolicyForm((prev) => ({ ...prev, notice_days: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Eligibility</Label>
              <Select
                value={policyForm.eligibility}
                onValueChange={(value) => setPolicyForm((prev) => ({ ...prev, eligibility: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="female_only">Female Only</SelectItem>
                  <SelectItem value="male_only">Male Only</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Accrual Mode</Label>
              <Select
                value={policyForm.accrual_mode}
                onValueChange={(value) => setPolicyForm((prev) => ({ ...prev, accrual_mode: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendar_days">Calendar Days</SelectItem>
                  <SelectItem value="business_days">Business Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Carry Forward Cap</Label>
              <Input
                type="number"
                value={policyForm.carry_forward_cap}
                onChange={(e) => setPolicyForm((prev) => ({ ...prev, carry_forward_cap: Number(e.target.value || 0) }))}
              />
            </div>
          </div>

          <Button onClick={savePolicy}>Save Policy</Button>

          <div className="space-y-2">
            {policies.map((policy) => (
              <div key={policy.id} className="rounded border p-3 text-sm">
                <p className="font-medium">{policy.leave_type?.name || policy.leave_type_id}</p>
                <p>
                  {policy.annual_days} days | {policy.eligibility} | {policy.accrual_mode} | notice {policy.notice_days}{" "}
                  day(s)
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holiday Calendar</CardTitle>
          <CardDescription>Used for business-day leave calculations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={holidayForm.holiday_date}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, holiday_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={holidayForm.location}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={holidayForm.name}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
          </div>
          <Button onClick={saveHoliday}>Add Holiday</Button>

          <div className="space-y-2">
            {holidays.map((holiday) => (
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

      <Card>
        <CardHeader>
          <CardTitle>Approval SLA</CardTitle>
          <CardDescription>Configure due and reminder timing per stage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {slas.map((sla) => (
            <div key={sla.id} className="flex flex-wrap items-center gap-2 rounded border p-3 text-sm">
              <span className="w-40 font-medium">{sla.stage}</span>
              <Input
                className="w-32"
                type="number"
                defaultValue={sla.due_hours}
                onBlur={(e) =>
                  saveSla(sla.stage, Number(e.target.value || sla.due_hours), Number(sla.reminder_hours_before))
                }
              />
              <span>due hours</span>
              <Input
                className="w-32"
                type="number"
                defaultValue={sla.reminder_hours_before}
                onBlur={(e) =>
                  saveSla(sla.stage, Number(sla.due_hours), Number(e.target.value || sla.reminder_hours_before))
                }
              />
              <span>reminder hours before</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile Data Quality</CardTitle>
          <CardDescription>Employees missing required leave-policy profile fields</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {dataQuality.length === 0 && <p className="text-sm">No data-quality gaps found.</p>}
          {dataQuality.map((entry: any) => (
            <div key={entry.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{entry.full_name || entry.company_email || entry.id}</p>
              <p>
                Missing:{" "}
                {[
                  !entry.gender && "gender",
                  !entry.employment_date && "employment_date",
                  !entry.employment_type && "employment_type",
                  !entry.work_location && "work_location",
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
