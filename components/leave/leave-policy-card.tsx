"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormFieldGroup } from "@/components/ui/patterns"

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

export interface PolicyFormState {
  leave_type_id: string
  annual_days: number
  eligibility: string
  min_tenure_months: number
  notice_days: number
  accrual_mode: string
  carry_forward_cap: number
}

interface LeavePolicyCardProps {
  leaveTypes: LeaveType[]
  policies: LeavePolicy[]
  form: PolicyFormState
  onFormChange: (form: PolicyFormState) => void
  onSave: () => void
}

export function LeavePolicyCard({ leaveTypes, policies, form, onFormChange, onSave }: LeavePolicyCardProps) {
  const set = (patch: Partial<PolicyFormState>) => onFormChange({ ...form, ...patch })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Policy Rules</CardTitle>
        <CardDescription>Configure annual allocation and eligibility per leave type</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <FormFieldGroup label="Leave Type">
            <Select value={form.leave_type_id} onValueChange={(value) => set({ leave_type_id: value })}>
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
          </FormFieldGroup>
          <div className="space-y-2">
            <Label>Annual Days</Label>
            <Input
              type="number"
              value={form.annual_days}
              onChange={(e) => set({ annual_days: Number(e.target.value || 0) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Min Tenure (months)</Label>
            <Input
              type="number"
              value={form.min_tenure_months}
              onChange={(e) => set({ min_tenure_months: Number(e.target.value || 0) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Notice Days</Label>
            <Input
              type="number"
              value={form.notice_days}
              onChange={(e) => set({ notice_days: Number(e.target.value || 0) })}
            />
          </div>
          <div className="space-y-2">
            <Label>Eligibility</Label>
            <Select value={form.eligibility} onValueChange={(value) => set({ eligibility: value })}>
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
            <Select value={form.accrual_mode} onValueChange={(value) => set({ accrual_mode: value })}>
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
              value={form.carry_forward_cap}
              onChange={(e) => set({ carry_forward_cap: Number(e.target.value || 0) })}
            />
          </div>
        </div>

        <Button onClick={onSave}>Save Policy</Button>

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
  )
}
