import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { PageHeader, PageWrapper } from "@/components/layout"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Bug, ShieldAlert } from "lucide-react"
import { UiErrorsContent, type UiErrorRow } from "./ui-errors-content"

export default async function DevUiErrorsPage() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase as any)

  const { data: logs, error } = await dataClient
    .from("audit_logs")
    .select("id, created_at, error_details, metadata, user_id")
    .eq("action", "client_error")
    .eq("entity_type", "ui_runtime")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    console.error("Error loading UI telemetry logs:", error)
  }

  const userIds = Array.from(new Set((logs || []).map((l: any) => l.user_id).filter(Boolean)))
  let usersMap = new Map<string, { first_name?: string; last_name?: string; company_email?: string }>()

  if (userIds.length > 0) {
    const { data: users } = await dataClient
      .from("profiles")
      .select("id, first_name, last_name, company_email")
      .in("id", userIds)
    usersMap = new Map((users || []).map((u: any) => [u.id, u]))
  }

  const rows: UiErrorRow[] = (logs || []).map((log: any) => {
    const meta = log.metadata && typeof log.metadata === "object" ? log.metadata : {}
    const source = String((meta as any).source || "unknown")
    const route = String((meta as any).route || (meta as any).href || "")
    const user = log.user_id ? usersMap.get(log.user_id) : null
    const userName =
      user?.first_name && user?.last_name
        ? `${user.first_name} ${user.last_name}`
        : user?.company_email || (log.user_id ? "Authenticated User" : "Anonymous")

    return {
      id: log.id,
      created_at: log.created_at,
      message: String(log.error_details || "Unknown error"),
      source,
      route,
      user_name: userName,
    }
  })

  const stats = {
    total: rows.length,
    last24h: rows.filter((r) => new Date(r.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000).length,
    boundaries: rows.filter((r) => r.source.includes("error_boundary")).length,
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="UI Error Monitor"
        description="Centralized frontend runtime errors captured from all pages during beta"
        icon={Bug}
        backLink={{ href: "/admin/dev", label: "Back to DEV" }}
      />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-muted-foreground text-xs sm:text-sm">Total Captured</p>
            <p className="text-lg font-bold sm:text-2xl">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-muted-foreground text-xs sm:text-sm">Last 24h</p>
            <p className="text-lg font-bold text-orange-600 sm:text-2xl">{stats.last24h}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 sm:p-4">
            <p className="text-muted-foreground text-xs sm:text-sm">Boundary Catches</p>
            <p className="text-lg font-bold text-red-600 sm:text-2xl">{stats.boundaries}</p>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <Card className="mb-6 border-red-200">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-red-700">
            <ShieldAlert className="h-4 w-4" />
            Failed to load logs from backend storage. Check server logs.
          </CardContent>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-8 text-sm">
            <AlertTriangle className="h-4 w-4" />
            No UI errors captured yet.
          </CardContent>
        </Card>
      ) : (
        <UiErrorsContent rows={rows} />
      )}
    </PageWrapper>
  )
}

