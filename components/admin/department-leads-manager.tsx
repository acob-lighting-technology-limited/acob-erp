"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { User, Building, Pencil, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Department {
  id: string
  name: string
  lead_id?: string | null
  lead_name?: string | null
  lead_email?: string | null
}

interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  email?: string | null
  company_email?: string | null
  role: string
  department: string | null
  is_department_lead: boolean
}

export function DepartmentLeadsManager() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDept, setSelectedDept] = useState<Department | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [users, setUsers] = useState<Profile[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [confirmWarning, setConfirmWarning] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const supabase = createClient()

      // 1. Fetch departments
      const { data: depts, error: deptsError } = await supabase
        .from("departments")
        .select("*")
        .eq("is_active", true)
        .order("name")

      if (deptsError) throw deptsError

      // 2. Fetch leads for these departments
      // Strategy: Find active profiles where is_department_lead is true
      const { data: leads, error: leadsError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email, department, role")
        .eq("is_department_lead", true)

      if (leadsError) throw leadsError

      // Map leads to departments
      // Note: profiles.department currently stores the name (text), not ID.
      // But we should try to match by name for now as the table shows department name usage.

      const mappedDepts = depts.map((d) => {
        // Find lead whose department name matches this department name
        const lead = leads.find((l) => l.department === d.name)
        return {
          id: d.id,
          name: d.name,
          lead_id: lead ? lead.id : null,
          lead_name: lead ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : null,
          lead_email: lead ? lead.company_email : null,
        }
      })

      setDepartments(mappedDepts)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load department leads")
    } finally {
      setLoading(false)
    }
  }

  async function openAssignDialog(dept: Department) {
    setSelectedDept(dept)
    setSelectedUserId("")
    setConfirmWarning(null)

    // Fetch potential leads (active users, not admins/super_admins usually?)
    // Or anyone can be lead? Usually employee/leads.
    // User said "Team Lead" is a role.
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email, role, department, is_department_lead")
        .eq("employment_status", "active")
        .neq("role", "visitor") // Exclude visitors
        .order("first_name")

      if (error) {
        console.error("Error fetching potential leads:", error)
        toast.error("Failed to load potential leads. Please try again.")
        return
      }

      setUsers(data as Profile[])
      setIsDialogOpen(true)
    } catch (err) {
      console.error("Unexpected error in openAssignDialog:", err)
      toast.error("An unexpected error occurred.")
    }
  }

  async function handleUserSelect(userId: string) {
    setSelectedUserId(userId)
    const user = users.find((u) => u.id === userId)
    if (!user) return

    let warning = null

    // Check if user is already a lead
    if (user.is_department_lead) {
      warning = `${user.first_name || "User"} is already a lead for ${user.department}. They will be reassigned to ${selectedDept?.name}.`
    }
    // Check if user has a different role that will be changed
    else if (user.role !== "lead") {
      warning = `${user.first_name || "User"} is currently a "${user.role}". Their role will be changed to "Lead".`
    }

    setConfirmWarning(warning)
  }

  async function handleAssign() {
    if (!selectedDept || !selectedUserId) return
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const user = users.find((u) => u.id === selectedUserId)

      // Use RPC for atomic demote/promote/assign operation
      // This ensures data consistency (atomic transaction)
      const { error } = await supabase.rpc("assign_department_lead", {
        p_department_id: selectedDept.id,
        p_new_lead_id: selectedUserId,
      })

      if (error) throw error

      toast.success(`${user?.first_name || "User"} assigned as lead for ${selectedDept.name}`)
      setIsDialogOpen(false)
      fetchData() // Refresh list
    } catch (error: any) {
      console.error("Error assigning lead:", error)
      toast.error(error.message || "Failed to assign lead")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Department Leads
        </CardTitle>
        <CardDescription>
          Manage team leads for each department. Each department must have exactly one lead.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Assigned Lead</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.name}</TableCell>
                  <TableCell>
                    {dept.lead_name ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Lead</Badge>
                        <span>{dept.lead_name}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">No Lead Assigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{dept.lead_email || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openAssignDialog(dept)}>
                      <User className="mr-2 h-4 w-4" />
                      {dept.lead_id ? "Change Lead" : "Assign Lead"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Lead - {selectedDept?.name}</DialogTitle>
              <DialogDescription>
                Select a user to lead this department. This will update their role to "Lead".
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <SearchableSelect
                  value={selectedUserId}
                  onValueChange={handleUserSelect}
                  placeholder="Search or select a user..."
                  searchPlaceholder="Search users..."
                  portal={false}
                  options={users.map((u) => {
                    const name = `${u.first_name || ""} ${u.last_name || ""}`.trim()
                    const display = name || u.company_email || u.email || "Unknown user"
                    return {
                      value: u.id,
                      label: `${display} (${u.role})`,
                    }
                  })}
                />
              </div>

              {confirmWarning && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>{confirmWarning}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={!selectedUserId || isSubmitting}>
                {isSubmitting ? "Assigning..." : "Confirm Assignment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
