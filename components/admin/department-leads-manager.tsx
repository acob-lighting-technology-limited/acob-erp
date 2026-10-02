"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/ui/data-table"
import type { DataTableColumn, DataTableFilter } from "@/components/ui/data-table"
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

function LeadBadge({ dept }: { dept: Department }) {
  return dept.lead_id ? (
    <Badge variant="default">Assigned</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      No lead
    </Badge>
  )
}

const columns: DataTableColumn<Department>[] = [
  {
    key: "name",
    label: "Department",
    sortable: true,
    accessor: (dept) => dept.name,
    render: (dept) => <span className="font-medium">{dept.name}</span>,
  },
  {
    key: "lead_name",
    label: "Assigned Lead",
    sortable: true,
    accessor: (dept) => dept.lead_name || "",
    render: (dept) =>
      dept.lead_name ? (
        <div className="flex items-center gap-2">
          <Badge variant="default">Lead</Badge>
          <span>{dept.lead_name}</span>
        </div>
      ) : (
        <span className="text-muted-foreground italic">No Lead Assigned</span>
      ),
  },
  {
    key: "lead_email",
    label: "Email",
    accessor: (dept) => dept.lead_email || "",
    hideOnMobile: true,
    render: (dept) => <span className="text-muted-foreground">{dept.lead_email || "—"}</span>,
  },
]

const filters: DataTableFilter<Department>[] = [
  {
    key: "lead_status",
    label: "Lead",
    mode: "custom",
    options: [
      { value: "assigned", label: "Assigned" },
      { value: "unassigned", label: "No lead" },
    ],
    filterFn: (dept, values) => values.includes(dept.lead_id ? "assigned" : "unassigned"),
  },
]

interface DepartmentLeadsPayload {
  departments: Department[]
  candidates: Profile[]
}

async function fetchDepartmentLeads(): Promise<DepartmentLeadsPayload> {
  const res = await apiFetch("/api/admin/hr/department-leads", { cache: "no-store" })
  const body = (await res.json().catch(() => ({}))) as { data?: DepartmentLeadsPayload; error?: string }
  if (!res.ok || !body.data) throw new Error(body.error || "Failed to load department leads")
  return body.data
}

async function fetchDepartmentsWithLeads(): Promise<Department[]> {
  return (await fetchDepartmentLeads()).departments
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
      const res = await apiFetch("/api/admin/hr/department-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: deptId, userId }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || "Failed to assign lead")
      }
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
      const { candidates } = await fetchDepartmentLeads()
      setUsers(candidates)
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
        <DataTable<Department>
          data={departments}
          columns={columns}
          filters={filters}
          getRowId={(dept) => dept.id}
          searchPlaceholder="Search department, lead or email..."
          searchFn={(dept, query) =>
            [dept.name, dept.lead_name, dept.lead_email].some((value) => (value || "").toLowerCase().includes(query))
          }
          isLoading={isLoading}
          error={isError ? "Could not load department leads." : null}
          onRetry={refetch}
          rowActions={[
            {
              label: "Assign Lead",
              icon: User,
              onClick: openAssignDialog,
              hidden: (dept) => Boolean(dept.lead_id),
            },
            {
              label: "Change Lead",
              icon: User,
              onClick: openAssignDialog,
              hidden: (dept) => !dept.lead_id,
            },
          ]}
          viewToggle
          contactsView
          defaultViewMode={{ mobile: "contacts", desktop: "list" }}
          mobileRow={{
            title: (dept) => dept.name,
            subtitle: (dept) => dept.lead_name || "No lead assigned",
            trailing: (dept) => <LeadBadge dept={dept} />,
            onSelect: openAssignDialog,
          }}
          cardRenderer={(dept) => (
            <div className="space-y-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{dept.name}</p>
                <LeadBadge dept={dept} />
              </div>
              <div className="grid gap-1 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Lead</span>
                  <span className="truncate">{dept.lead_name || "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Email</span>
                  <span className="truncate">{dept.lead_email || "—"}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => openAssignDialog(dept)}>
                <User className="mr-2 h-4 w-4" />
                {dept.lead_id ? "Change Lead" : "Assign Lead"}
              </Button>
            </div>
          )}
          emptyTitle="No active departments"
          emptyDescription="Active departments appear here once they are created."
          emptyIcon={Building}
          skeletonRows={5}
        />

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
