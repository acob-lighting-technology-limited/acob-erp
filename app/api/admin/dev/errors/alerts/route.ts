import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getRequestScope } from "@/lib/admin/api-scope"
import { canAccessAdminSection } from "@/lib/admin/rbac"
import { telemetryClient } from "@/lib/telemetry/server"

export async function POST(request: NextRequest) {
  const scope = await getRequestScope()
  if (!scope?.isAdminLike || !canAccessAdminSection(scope, "dev"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const parsed = z.object({ enabled: z.boolean() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  const { error } = await telemetryClient()
    .from("system_settings")
    .upsert({
      key: `error_monitor_alert_${scope.userId}`,
      value: { enabled: parsed.data.enabled, since: new Date().toISOString() },
      description: "Developer error alert subscription",
      updated_by: scope.userId,
      updated_at: new Date().toISOString(),
    })
  if (error) return NextResponse.json({ error: "Unable to update subscription" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
