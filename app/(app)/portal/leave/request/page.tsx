"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { ArrowLeft, Calendar } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface LeaveType {
  id: string
  name: string
  max_days: number
}

interface LeaveBalance {
  leave_type_id: string
  total_days: number
  used_days: number
}

export default function LeaveRequestPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [formData, setFormData] = useState({
    leave_type_id: "",
    start_date: "",
    end_date: "",
    reason: "",
  })

  useEffect(() => {
    fetchLeaveTypes()
    fetchBalances()
  }, [])

  async function fetchLeaveTypes() {
    const supabase = createClient()
    const { data } = await supabase.from("leave_types").select("id, name, max_days").eq("is_active", true)
    if (data) setLeaveTypes(data)
  }

  async function fetchBalances() {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("leave_balances")
      .select("leave_type_id, total_days, used_days")
      .eq("user_id", user.id)
    if (data) setBalances(data)
  }

  function calculateDays(): number {
    if (!formData.start_date || !formData.end_date) return 0
    const start = new Date(formData.start_date)
    const end = new Date(formData.end_date)
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    return diff > 0 ? diff : 0
  }

  function getAvailableDays(): number {
    const balance = balances.find((b) => b.leave_type_id === formData.leave_type_id)
    if (!balance) return 0
    return balance.total_days - balance.used_days
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/hr/leave/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          days_count: calculateDays(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request")
      }

      toast.success("Leave request submitted successfully")
      router.push("/hr/leave")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const daysRequested = calculateDays()
  const availableDays = getAvailableDays()
  const isValid =
    formData.leave_type_id &&
    formData.start_date &&
    formData.end_date &&
    formData.reason.length >= 10 &&
    daysRequested <= availableDays

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <Link href="/dashboard/leave" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Leave
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Request Leave
          </CardTitle>
          <CardDescription>Submit a new leave request for approval</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="leave_type">Leave Type</Label>
              <Select
                value={formData.leave_type_id}
                onValueChange={(value) => setFormData({ ...formData, leave_type_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.leave_type_id && (
                <p className="text-muted-foreground text-sm">Available: {availableDays} days</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.start_date || new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            {daysRequested > 0 && (
              <div
                className={`rounded-lg p-3 ${daysRequested <= availableDays ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
              >
                Days requested: {daysRequested}
                {daysRequested > availableDays && " (exceeds available balance)"}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Please provide a reason for your leave request (min 10 characters)"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={4}
              />
              <p className="text-muted-foreground text-sm">{formData.reason.length}/10 characters minimum</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !isValid}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
