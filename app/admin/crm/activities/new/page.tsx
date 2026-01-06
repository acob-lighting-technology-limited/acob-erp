"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import type { CreateActivityInput, CRMContact, CRMOpportunity } from "@/types/crm"

export default function NewActivityPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedContactId = searchParams.get("contact_id")
  const preselectedOpportunityId = searchParams.get("opportunity_id")

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contacts, setContacts] = useState<CRMContact[]>([])
  const [opportunities, setOpportunities] = useState<CRMOpportunity[]>([])
  const [users, setUsers] = useState<{ id: string; first_name: string; last_name: string }[]>([])

  const [formData, setFormData] = useState<CreateActivityInput>({
    type: "call",
    subject: "",
    description: "",
    contact_id: preselectedContactId || "",
    opportunity_id: preselectedOpportunityId || "",
    due_date: new Date().toISOString().split("T")[0],
    priority: "normal",
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [contactsRes, opportunitiesRes, usersRes] = await Promise.all([
        fetch("/api/crm/contacts?limit=100"),
        fetch("/api/crm/opportunities?status=open&limit=100"),
        fetch("/api/admin/users"),
      ])

      const contactsData = await contactsRes.json()
      const opportunitiesData = await opportunitiesRes.json()
      const usersData = await usersRes.json()

      setContacts(contactsData.data || [])
      setOpportunities(opportunitiesData.data || [])
      setUsers(usersData.users || [])
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.subject.trim()) {
      toast.error("Subject is required")
      return
    }
    if (!formData.contact_id && !formData.opportunity_id) {
      toast.error("Please select a contact or opportunity")
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error)
      }

      toast.success("Activity logged")

      // Navigate back to the source if we came from a contact or opportunity
      if (preselectedContactId) {
        router.push(`/admin/crm/contacts/${preselectedContactId}`)
      } else if (preselectedOpportunityId) {
        router.push(`/admin/crm/opportunities/${preselectedOpportunityId}`)
      } else {
        router.push("/admin/crm/activities")
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to log activity")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/crm/activities">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Log Activity</h1>
          <p className="text-muted-foreground">Record a call, email, meeting, or task</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Activity Details */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Activity Type *</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">📞 Call</SelectItem>
                      <SelectItem value="email">📧 Email</SelectItem>
                      <SelectItem value="meeting">📅 Meeting</SelectItem>
                      <SelectItem value="task">✅ Task</SelectItem>
                      <SelectItem value="note">📝 Note</SelectItem>
                      <SelectItem value="follow_up">🔔 Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(v) => setFormData({ ...formData, priority: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Follow-up call about proposal"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add notes about this activity..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Related To */}
          <Card>
            <CardHeader>
              <CardTitle>Related To</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_id">Contact</Label>
                <Select
                  value={formData.contact_id || ""}
                  onValueChange={(v) => setFormData({ ...formData, contact_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.contact_name} {contact.company_name && `(${contact.company_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="opportunity_id">Opportunity</Label>
                <Select
                  value={formData.opportunity_id || ""}
                  onValueChange={(v) => setFormData({ ...formData, opportunity_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an opportunity (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {opportunities.map((opp) => (
                      <SelectItem key={opp.id} value={opp.id}>
                        {opp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Scheduling */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduling</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date || ""}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration_minutes">Duration (minutes)</Label>
                  <Input
                    id="duration_minutes"
                    type="number"
                    min="0"
                    value={formData.duration_minutes || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || undefined })
                    }
                    placeholder="e.g., 30"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location || ""}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., Office, Zoom, Google Meet"
                />
              </div>
            </CardContent>
          </Card>

          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To</Label>
                <Select
                  value={formData.assigned_to || ""}
                  onValueChange={(v) => setFormData({ ...formData, assigned_to: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign to (defaults to you)" />
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
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" asChild>
              <Link href="/admin/crm/activities">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Log Activity
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
