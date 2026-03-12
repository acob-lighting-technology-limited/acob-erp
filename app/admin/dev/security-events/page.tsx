import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { ShieldAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { EmptyState } from "@/components/ui/patterns"

function isSecurityEvent(log: any): boolean {
  const text =
    `${log.action || ""} ${log.operation || ""} ${log.entity_type || ""} ${log.status || ""} ` +
    `${JSON.stringify(log.metadata || {})} ${JSON.stringify(log.old_values || {})} ${JSON.stringify(log.new_values || {})}`.toLowerCase()
  const roleChangeSignal =
    text.includes("role") ||
    text.includes("super_admin") ||
    text.includes("developer") ||
    text.includes("is_admin") ||
    text.includes("admin_domains") ||
    text.includes("lead_departments")

  return (
    text.includes("auth") ||
    text.includes("permission_denied") ||
    text.includes("forbidden") ||
    text.includes("unauthorized") ||
    text.includes("security") ||
    text.includes("suspicious") ||
    text.includes("failed") ||
    text.includes("invalid") ||
    text.includes("blocked") ||
    text.includes("escalat") ||
    roleChangeSignal
  )
}

export const dynamic = "force-dynamic"

export default async function DevSecurityEventsPage() {
  await requireAdminSectionAccess("dev")

  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase as any)
  const { data, error } = await dataClient
    .from("audit_logs")
    .select(
      "id, action, operation, entity_type, entity_id, user_id, status, metadata, old_values, new_values, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(1200)

  const rows = (data || []).filter(isSecurityEvent)

  return (
    <AdminTablePage
      title="Security Events"
      description="Security-meaningful event stream derived from audit metadata"
      icon={ShieldAlert}
      backLinkHref="/admin/dev"
      backLinkLabel="Back to DEV"
    >
      <Card>
        <CardHeader>
          <CardTitle>Security Events ({rows.length})</CardTitle>
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
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <EmptyState
                      title="No security events found"
                      description="No security-significant events were detected in the current log window."
                      icon={ShieldAlert}
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
                    <TableCell className="font-mono text-xs">{JSON.stringify(row.metadata || {})}</TableCell>
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
