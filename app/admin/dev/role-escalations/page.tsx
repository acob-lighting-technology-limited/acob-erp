import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { ShieldEllipsis } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { EmptyState } from "@/components/ui/patterns"

function isEscalation(log: any): boolean {
  const text =
    `${log.action || ""} ${log.operation || ""} ${log.entity_type || ""} ${JSON.stringify(log.new_values || {})} ${JSON.stringify(log.old_values || {})} ${JSON.stringify(log.metadata || {})}`.toLowerCase()
  const touchesRole = text.includes("role")
  const elevated = ["admin", "super_admin", "developer", "admin_domains", "department_lead"].some(
    (r) => text.includes(`\"${r}\"`) || text.includes(r)
  )
  return touchesRole && elevated
}

export const dynamic = "force-dynamic"

export default async function DevRoleEscalationsPage() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase as any)
  const { data, error } = await dataClient
    .from("audit_logs")
    .select("id, action, operation, entity_type, entity_id, user_id, old_values, new_values, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(1200)

  const rows = (data || []).filter(isEscalation)

  return (
    <AdminTablePage
      title="Role Escalations"
      description="High-sensitivity role elevation/change stream"
      icon={ShieldEllipsis}
      backLinkHref="/admin/dev"
      backLinkLabel="Back to DEV"
    >
      <Card>
        <CardHeader>
          <CardTitle>Escalation Events ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor ID</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      title="No role escalations found"
                      description="No high-sensitivity role elevation events were detected in the current log window."
                      icon={ShieldEllipsis}
                      className="border-0 p-4"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                    <TableCell>{row.action}</TableCell>
                    <TableCell>{row.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs">{row.user_id || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{JSON.stringify(row.old_values || {})}</TableCell>
                    <TableCell className="font-mono text-xs">{JSON.stringify(row.new_values || {})}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminTablePage>
  )
}
