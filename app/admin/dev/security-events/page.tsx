import { createClient } from "@/lib/supabase/server"
import { PageHeader, PageWrapper } from "@/components/layout"
import { ShieldAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function isSecurityEvent(log: any): boolean {
  const text = `${log.action || ""} ${JSON.stringify(log.metadata || {})}`.toLowerCase()
  return (
    text.includes("auth") ||
    text.includes("permission_denied") ||
    text.includes("forbidden") ||
    text.includes("unauthorized") ||
    text.includes("security") ||
    text.includes("suspicious")
  )
}

export default async function DevSecurityEventsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, user_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(500)

  const rows = (data || []).filter(isSecurityEvent)

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="Security Events"
        description="Security-meaningful event stream derived from audit metadata"
        icon={ShieldAlert}
        backLink={{ href: "/admin/dev", label: "Back to DEV" }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Security Events ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <TableCell colSpan={5}>No security events found.</TableCell>
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
    </PageWrapper>
  )
}
