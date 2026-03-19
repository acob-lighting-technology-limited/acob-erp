import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getSeparationBlockers } from "@/lib/hr/separation-blockers"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import { formatName } from "@/lib/utils"
import { EmptyState } from "@/components/ui/patterns"

export default async function OffboardingConflictsPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || !["developer", "super_admin", "admin"].includes(profile.role)) {
    redirect("/profile")
  }

  const { data: separatedUsers } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, company_email, department, separation_date, separation_reason")
    .eq("employment_status", "separated")
    .order("last_name", { ascending: true })

  const rows = await Promise.all(
    (separatedUsers || []).map(async (employee) => ({
      ...employee,
      blockers: await getSeparationBlockers(supabase, employee.id),
    }))
  )

  const conflicts = rows.filter((row) => row.blockers.total > 0)

  return (
    <AdminTablePage
      title="Offboarding Conflicts"
      description="Read-only report of separated users who still have active assignments or lead responsibilities."
      backLinkHref="/admin/hr/employees"
      backLinkLabel="Back to Employees"
    >
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Offboarding Conflict Report
          </CardTitle>
          <CardDescription>
            {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"} found among {rows.length} separated user
            {rows.length === 1 ? "" : "s"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conflicts.length === 0 ? (
            <EmptyState
              title="No offboarding conflicts found"
              description="No separated users with active assignments were found."
              icon={AlertTriangle}
              className="p-4"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Assets</TableHead>
                    <TableHead>Tasks</TableHead>
                    <TableHead>Task Assignments</TableHead>
                    <TableHead>Managed Projects</TableHead>
                    <TableHead>Project Memberships</TableHead>
                    <TableHead>Lead Roles</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflicts.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-medium">
                            {formatName(row.first_name)} {formatName(row.last_name)}
                          </div>
                          <div className="text-muted-foreground text-xs">{row.company_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{row.department || "-"}</TableCell>
                      <TableCell>{row.blockers.assets}</TableCell>
                      <TableCell>{row.blockers.tasks}</TableCell>
                      <TableCell>{row.blockers.task_assignments}</TableCell>
                      <TableCell>{row.blockers.managed_projects}</TableCell>
                      <TableCell>{row.blockers.project_memberships}</TableCell>
                      <TableCell>{row.blockers.lead_roles}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{row.blockers.total}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminTablePage>
  )
}
