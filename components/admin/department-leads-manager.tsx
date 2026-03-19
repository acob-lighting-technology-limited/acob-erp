"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { TableSkeleton, QueryError } from "@/components/ui/query-states"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { User, Building, AlertCircle } from "lucide-react"
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
import { applyAssignableStatusFilter } from "@/lib/workforce/assignment-policy"
import type { PostgrestError } from "@supabase/supabase-js"

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

async function fetchDepartmentsWithLeads(): Promise<Department[]> {
  const supabase = createClient()
  const { data: depts, error: deptsError } = await supabase
    .from("departments")
    .select("*")
    .eq("is_active", true)
    .order("name")
  if (deptsError) throw deptsError

  const { data: leads, error: leadsError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, company_email, department, role")
    .eq("is_department_lead", true)
  if (leadsError) throw leadsError

  return depts.map((d) => {
    const lead = leads.find((l) => l.department === d.name)
    return {
      id: d.id,
      name: d.name,
      lead_id: lead ? lead.id : null,
      lead_name: lead ? `${lead.first_name || ""} ${lead.last_name || ""}`.trim() : null,
      lead_email: lead ? lead.company_email : null,
    }
  })
}

export function DepartmentLeadsManager() {
  const queryClient = useQueryClient()
  const [selectedDept, setSelectedDept] = useState<Department | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [users, setUsers] = useState<Profile[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [confirmWarning, setConfirmWarning] = useState<string | null>(null)

  const {
    data: departments = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["department-leads"],
    queryFn: fetchDepartmentsWithLeads,
  })

  const { mutate: assignLead, isPending: isSubmitting } = useMutation({
    mutationFn: async ({ deptId, userId }: { deptId: string; userId: string }) => {
      const supabase = createClient()
      const { error } = await supabase.rpc("assign_department_lead", {
        p_department_id: deptId,
        p_new_lead_id: userId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      const user = users.find((u) => u.id === selectedUserId)
      toast.success(`${user?.first_name || "User"} assigned as lead for ${selectedDept?.name}`)
      setIsDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ["department-leads"] })
    },
    onError: (error: PostgrestError | Error) => {
      toast.error(error.message || "Failed to assign lead")
    },
  })

  async function openAssignDialog(dept: Department) {
    setSelectedDept(dept)
    setSelectedUserId("")
    setConfirmWarning(null)

    try {
      const supabase = createClient()
      const baseQuery = supabase
        .from("profiles")
        .select("id, first_name, last_name, company_email, role, department, is_department_lead")
        .neq("role", "visitor")
        .order("first_name")
      const { data, error } = await applyAssignableStatusFilter(baseQuery, { allowLegacyNullStatus: false })

      if (error) {
        toast.error("Failed to load potential leads. Please try again.")
        return
      }

      setUsers(data as Profile[])
      setIsDialogOpen(true)
    } catch {
      toast.error("An unexpected error occurred.")
    }
  }

  async function handleUserSelect(userId: string) {
    setSelectedUserId(userId)
    const user = users.find((u) => u.id === userId)
    if (!user) return

    let warning = null
    if (user.is_department_lead && user.department !== selectedDept?.name) {
      warning = `\u26A0\uFE0F ${user.first_name || "User"} is currently the lead for "${user.department}". Assigning them here will remove them as lead of "${user.department}" (that department will have no lead), and make them lead of "${selectedDept?.name}" instead. Each person can only lead one department.`
    }
    setConfirmWarning(warning)
  }

  function handleAssign() {
    if (!selectedDept || !selectedUserId) return
    assignLead({ deptId: selectedDept.id, userId: selectedUserId })
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Department Leads
        </CardTitle>
        <CardDescription>
          Manage department lead assignments. Each department should have exactly one assigned lead.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : isError ? (
          <QueryError message="Could not load department leads." onRetry={refetch} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">S/N</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Assigned Lead</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept, index) => (
                <TableRow key={dept.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
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
                  <TableCell className="text-muted-foreground">{dept.lead_email || "\u2014"}</TableCell>
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
          <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assign Lead - {selectedDept?.name}</DialogTitle>
              <DialogDescription>Select a user to mark as the lead for this department.</DialogDescription>
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
