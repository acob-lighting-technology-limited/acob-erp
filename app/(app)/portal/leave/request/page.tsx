"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function LeaveRequestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    leave_type_id: "",
    start_date: "",
    days_count: 1,
    reliever_identifier: "",
    reason: "",
    handover_note: "",
  })

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
    <div className="container mx-auto max-w-2xl p-6">
      <Link href="/dashboard/leave" className="text-muted-foreground mb-4 inline-flex items-center gap-2 text-sm">
        <ArrowLeft className="h-4 w-4" />
        Back to leave management
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Submit Leave Request</CardTitle>
          <CardDescription>Reliever approval is required before supervisor and HR review.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>Leave Type ID</Label>
              <Input
                value={formData.leave_type_id}
                onChange={(e) => setFormData((p) => ({ ...p, leave_type_id: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData((p) => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Days</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.days_count}
                  onChange={(e) => setFormData((p) => ({ ...p, days_count: Number(e.target.value || 1) }))}
                />
              </div>
            </div>

            <div className="rounded border p-3 text-sm">
              <p>Computed End Date: {previewEnd || "-"}</p>
              <p>Computed Resume Date: {previewResume || "-"}</p>
            </div>

            <div className="space-y-2">
              <Label>Reliever (name/email/id)</Label>
              <Input
                value={formData.reliever_identifier}
                onChange={(e) => setFormData((p) => ({ ...p, reliever_identifier: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => setFormData((p) => ({ ...p, reason: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Handover Note</Label>
              <Textarea
                value={formData.handover_note}
                onChange={(e) => setFormData((p) => ({ ...p, handover_note: e.target.value }))}
                rows={3}
              />
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
