"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Star, FileText } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface User {
  id: string
  first_name: string
  last_name: string
  department_id: string
}

interface ReviewCycle {
  id: string
  name: string
  review_type: string
}

export default function CreateReviewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [cycles, setCycles] = useState<ReviewCycle[]>([])
  const [formData, setFormData] = useState({
    user_id: "",
    review_cycle_id: "",
    overall_rating: 0,
    strengths: "",
    areas_for_improvement: "",
    goals_achieved: 0,
    goals_total: 0,
    manager_comments: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const supabase = createClient()

      // Fetch department users (for leads) or all users (for admins)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_department_lead, department_id")
        .eq("id", user.id)
        .single()

      let usersQuery = supabase.from("profiles").select("id, first_name, last_name, department_id").neq("id", user.id)

      // If lead, only show department users
      if (profile?.is_department_lead && !["admin", "super_admin"].includes(profile.role)) {
        usersQuery = usersQuery.eq("department_id", profile.department_id)
      }

      const { data: usersData } = await usersQuery
      if (usersData) setUsers(usersData)

      // Fetch active review cycles
      const cyclesResponse = await fetch("/api/hr/performance/cycles")
      const cyclesData = await cyclesResponse.json()
      if (cyclesData.cycles) setCycles(cyclesData.cycles)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch("/api/hr/performance/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create review")
      }

      toast.success("Performance review created successfully")

      router.push("/hr")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  function renderRatingSelector() {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => setFormData({ ...formData, overall_rating: rating })}
            className="p-1"
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                rating <= formData.overall_rating
                  ? "fill-yellow-500 text-yellow-500"
                  : "text-gray-300 hover:text-yellow-300"
              }`}
            />
          </button>
        ))}
      </div>
    )
  }

  if (loading) {
    return <div className="container mx-auto p-6 text-center">Loading...</div>
  }

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <Link href="/admin/hr" className="text-muted-foreground hover:text-foreground flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to HR Dashboard
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Performance Review
          </CardTitle>
          <CardDescription>Evaluate an employee's performance</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Employee Selection */}
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={formData.user_id} onValueChange={(value) => setFormData({ ...formData, user_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Review Cycle */}
            <div className="space-y-2">
              <Label>Review Cycle</Label>
              <Select
                value={formData.review_cycle_id}
                onValueChange={(value) => setFormData({ ...formData, review_cycle_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select review cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.name} ({cycle.review_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Overall Rating */}
            <div className="space-y-2">
              <Label>Overall Rating</Label>
              {renderRatingSelector()}
              <p className="text-muted-foreground text-sm">
                {formData.overall_rating === 0 ? "Click to rate" : `${formData.overall_rating} out of 5`}
              </p>
            </div>

            {/* Goals */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Goals Achieved</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.goals_achieved}
                  onChange={(e) => setFormData({ ...formData, goals_achieved: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Goals</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.goals_total}
                  onChange={(e) => setFormData({ ...formData, goals_total: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Strengths */}
            <div className="space-y-2">
              <Label>Strengths</Label>
              <Textarea
                value={formData.strengths}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                placeholder="What does this employee do well?"
                rows={3}
              />
            </div>

            {/* Areas for Improvement */}
            <div className="space-y-2">
              <Label>Areas for Improvement</Label>
              <Textarea
                value={formData.areas_for_improvement}
                onChange={(e) => setFormData({ ...formData, areas_for_improvement: e.target.value })}
                placeholder="What areas need development?"
                rows={3}
              />
            </div>

            {/* Manager Comments */}
            <div className="space-y-2">
              <Label>Additional Comments</Label>
              <Textarea
                value={formData.manager_comments}
                onChange={(e) => setFormData({ ...formData, manager_comments: e.target.value })}
                placeholder="Any other feedback or notes..."
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving || !formData.user_id || !formData.overall_rating}>
              {saving ? "Saving..." : "Submit Review"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
