import { createClient } from "@/lib/supabase/server"
import { PageHeader, PageWrapper } from "@/components/layout"
import { ShieldEllipsis } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function isEscalation(log: any): boolean {
  const text = `${log.action || ""} ${log.entity_type || ""} ${JSON.stringify(log.new_values || {})}`.toLowerCase()
  const touchesRole = text.includes("role")
  const elevated = ["admin", "super_admin", "developer"].some((r) => text.includes(`\"${r}\"`) || text.includes(r))
  return touchesRole && elevated
}

export default async function DevRoleEscalationsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, user_id, old_values, new_values, created_at")
    .in("entity_type", ["profile", "profiles", "user", "admin_action"])
    .order("created_at", { ascending: false })
    .limit(400)

  const rows = (data || []).filter(isEscalation)

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Role Escalations"
        description="High-sensitivity role elevation/change stream"
        icon={ShieldEllipsis}
        backLink={{ href: "/admin/dev", label: "Back to DEV" }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Escalation Events ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableCell colSpan={6}>No role escalations found.</TableCell>
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
    </PageWrapper>
  )
}
