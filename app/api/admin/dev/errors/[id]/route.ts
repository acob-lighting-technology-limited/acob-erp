import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getRequestScope } from "@/lib/admin/api-scope"
import { canAccessAdminSection } from "@/lib/admin/rbac"
import { telemetryClient } from "@/lib/telemetry/server"
import { writeAuditLog } from "@/lib/audit/write-audit"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await getRequestScope()
  if (!scope?.isAdminLike || !canAccessAdminSection(scope, "dev")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  const parsed = z
    .object({ resolved: z.boolean(), ids: z.array(z.string().uuid()).min(1).max(500).optional() })
    .safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  const client = telemetryClient()
  const ids = [...new Set(parsed.data.ids || [id])]
  if (!ids.includes(id)) return NextResponse.json({ error: "Invalid event group" }, { status: 400 })
  const { data, error } = await client
    .from("audit_logs")
    .select("id, metadata")
    .in("id", ids)
    .in("action", ["client_error", "system_error"])
    .in("entity_type", ["ui_runtime", "system_runtime"])
    .returns<{ id: string; metadata: Record<string, unknown> | null }[]>()
  if (error) return NextResponse.json({ error: "Unable to load event" }, { status: 500 })
  if (!data || data.length !== ids.length) return NextResponse.json({ error: "Event not found" }, { status: 404 })
  for (let index = 0; index < data.length; index += 10) {
    const results = await Promise.all(
      data.slice(index, index + 10).map((event) =>
        client
          .from("audit_logs")
          .update({
            metadata: {
              ...event.metadata,
              resolved: parsed.data.resolved,
              resolved_at: parsed.data.resolved ? new Date().toISOString() : null,
              resolved_by: parsed.data.resolved ? scope.userId : null,
            },
          })
          .eq("id", event.id)
      )
    )
    if (results.some((result) => result.error))
      return NextResponse.json({ error: "Unable to update all events; refresh and retry" }, { status: 500 })
  }
  await writeAuditLog(
    client,
    {
      action: "status_change",
      entityType: "error_resolution",
      entityId: id,
      metadata: { resolved: parsed.data.resolved, eventIds: ids },
      context: { actorId: scope.userId, source: "api" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ ok: true })
}
