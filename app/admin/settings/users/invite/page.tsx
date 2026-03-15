"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase/client"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus, Mail } from "lucide-react"
import { toast } from "sonner"
import { getAssignableRolesForActor } from "@/lib/role-management"
import { FormFieldGroup } from "@/components/ui/patterns"

import { logger } from "@/lib/logger"

const log = logger("settings-users-invite")

async function fetchCurrentUserRole(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return ""
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  return me?.role || ""
}

export default function InviteUserPage() {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role: "employee",
    department: "",
  })

  const { data: currentUserRole = "" } = useQuery({
    queryKey: QUERY_KEYS.adminCurrentUserRole(),
    queryFn: fetchCurrentUserRole,
  })

  const roleOptions = getAssignableRolesForActor(currentUserRole)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.email) {
      toast.error("Email is required")
      return
    }

    setSending(true)

    try {
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite user")
      }

      toast.success(`Invitation sent to ${formData.email}`)
      router.push("/admin/settings/users")
    } catch (error: any) {
      log.error("Error inviting user:", error)
      toast.error(error.message || "Failed to invite user")
    } finally {
      setSending(false)
    }
  }

  return (
    <PageWrapper maxWidth="form" background="gradient">
      <PageHeader
        title="Invite User"
        description="Send an invitation to a new team member"
        icon={UserPlus}
        backLink={{ href: "/admin/settings/users", label: "Back to Users" }}
      />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>User Details</CardTitle>
            <CardDescription>Enter the new user's information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormFieldGroup label="Email Address *">
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@company.com"
                required
              />
            </FormFieldGroup>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="First Name">
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="First name"
                />
              </FormFieldGroup>
              <FormFieldGroup label="Last Name">
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Last name"
                />
              </FormFieldGroup>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="Role">
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role === "super_admin" ? "Super Admin" : role.charAt(0).toUpperCase() + role.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormFieldGroup>
              <FormFieldGroup label="Department">
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g., Engineering"
                />
              </FormFieldGroup>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.push("/admin/settings/users")}>
            Cancel
          </Button>
          <Button type="submit" disabled={sending}>
            <Mail className="mr-2 h-4 w-4" />
            Send Invitation
          </Button>
        </div>
      </form>
    </PageWrapper>
  )
}
