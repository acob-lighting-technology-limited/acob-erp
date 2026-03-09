"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormFieldGroup } from "@/components/ui/patterns"

type LeaveTypeOption = {
  id: string
  name: string
  max_days?: number | null
  eligibility_status?: "eligible" | "not_eligible" | "missing_evidence"
  eligibility_reason?: string | null
}

export default function LeaveRequestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([])
  const [relieverOptions, setRelieverOptions] = useState<{ value: string; label: string }[]>([])
  const [formData, setFormData] = useState({
    leave_type_id: "",
    start_date: "",
    days_count: 1,
    reliever_identifier: "",
    reason: "",
    handover_note: "",
  })

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((leaveType) => leaveType.id === formData.leave_type_id),
    [leaveTypes, formData.leave_type_id]
  )

  const previewEnd = (() => {
    if (!formData.start_date || !formData.days_count) return ""
    const end = new Date(`${formData.start_date}T00:00:00.000Z`)
    end.setUTCDate(end.getUTCDate() + Number(formData.days_count) - 1)
    return end.toISOString().slice(0, 10)
  })()

  const previewResume = (() => {
    if (!previewEnd) return ""
    const resume = new Date(`${previewEnd}T00:00:00.000Z`)
    resume.setUTCDate(resume.getUTCDate() + 1)
    return resume.toISOString().slice(0, 10)
  })()

  useEffect(() => {
    const loadRelievers = async () => {
      const response = await fetch("/api/hr/leave/relievers")
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to load relievers")
      setRelieverOptions(payload.data || [])
    }

    const loadLeaveTypes = async () => {
      const response = await fetch("/api/hr/leave/types")
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to load leave types")
      setLeaveTypes(payload.data || [])
    }

    Promise.all([loadRelievers(), loadLeaveTypes()])
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to load leave setup")
      })
      .finally(() => {
        setLoadingTypes(false)
      })
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/hr/leave/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Failed to submit leave request")

      toast.success("Leave request submitted")
      router.push("/dashboard/leave")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageWrapper maxWidth="form">
      <PageHeader
        title="Submit Leave Request"
        description="Reliever approval is required before supervisor and HR review."
        backLink={{ href: "/dashboard/leave", label: "Back to leave management" }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Leave Request Form</CardTitle>
          <CardDescription>Provide all required details so your approval flow can start immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FormFieldGroup label="Leave Type">
              <Select
                value={formData.leave_type_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, leave_type_id: value }))}
                disabled={loadingTypes}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingTypes ? "Loading leave types..." : "Select leave type"} />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((leaveType) => (
                    <SelectItem
                      key={leaveType.id}
                      value={leaveType.id}
                      disabled={leaveType.eligibility_status === "not_eligible"}
                    >
                      {leaveType.name}
                      {leaveType.max_days ? ` (${leaveType.max_days} days)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLeaveType?.eligibility_reason && (
                <p className="text-muted-foreground text-xs">{selectedLeaveType.eligibility_reason}</p>
              )}
            </FormFieldGroup>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormFieldGroup label="Start Date">
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                />
              </FormFieldGroup>
              <FormFieldGroup label="Days">
                <Input
                  type="number"
                  min={1}
                  value={formData.days_count}
                  onChange={(e) => setFormData((prev) => ({ ...prev, days_count: Number(e.target.value || 1) }))}
                />
              </FormFieldGroup>
            </div>

            <div className="rounded border p-3 text-sm">
              <p>Computed End Date: {previewEnd || "-"}</p>
              <p>Computed Resume Date: {previewResume || "-"}</p>
            </div>

            <FormFieldGroup label="Reliever">
              <SearchableSelect
                value={formData.reliever_identifier}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, reliever_identifier: value }))}
                options={relieverOptions}
                placeholder="Select reliever"
                searchPlaceholder="Search employee..."
              />
            </FormFieldGroup>

            <FormFieldGroup label="Reason">
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                rows={3}
              />
            </FormFieldGroup>

            <FormFieldGroup label="Handover Note">
              <Textarea
                value={formData.handover_note}
                onChange={(e) => setFormData((prev) => ({ ...prev, handover_note: e.target.value }))}
                rows={3}
              />
            </FormFieldGroup>

            <Button type="submit" disabled={loading || loadingTypes}>
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
