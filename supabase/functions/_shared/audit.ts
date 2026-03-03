export type AuditSource = "edge" | "system"

export interface EdgeAuditPayload {
  action: string
  entityType: string
  entityId: string
  actorId?: string | null
  department?: string | null
  siteId?: string | null
  metadata?: Record<string, unknown>
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  source: AuditSource
  route?: string
  requestId?: string
}

type SupabaseLike = {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

function normalizeAction(action: string): string {
  const raw = action.trim().toLowerCase()
  if (
    [
      "create",
      "update",
      "delete",
      "assign",
      "unassign",
      "approve",
      "reject",
      "dispatch",
      "send",
      "status_change",
    ].includes(raw)
  ) {
    return raw
  }
  if (raw.includes("approve")) return "approve"
  if (raw.includes("reject")) return "reject"
  if (raw.includes("assign")) return raw.includes("unassign") ? "unassign" : "assign"
  if (raw.includes("dispatch")) return "dispatch"
  if (raw.includes("send") || raw.includes("sent")) return "send"
  if (raw.includes("status") || raw.includes("pivot")) return "status_change"
  if (raw.includes("create")) return "create"
  if (raw.includes("delete")) return "delete"
  return "update"
}

export async function writeEdgeAuditLog(supabase: SupabaseLike, payload: EdgeAuditPayload) {
  if (!payload.entityId?.trim()) throw new Error("audit payload missing entityId")
  if (!payload.entityType?.trim()) throw new Error("audit payload missing entityType")
  if (!payload.action?.trim()) throw new Error("audit payload missing action")

  const metadata = {
    ...(payload.metadata || {}),
    source: payload.source,
    route: payload.route || null,
    request_id: payload.requestId || crypto.randomUUID(),
    event: payload.action,
  }

  const { data, error } = await supabase.rpc("log_audit", {
    p_action: normalizeAction(payload.action),
    p_entity_type: payload.entityType,
    p_entity_id: payload.entityId,
    p_user_id: payload.actorId || null,
    p_old_values: payload.oldValues || null,
    p_new_values: payload.newValues || null,
    p_metadata: metadata,
    p_site_id: payload.siteId || null,
    p_department: payload.department || null,
  })

  if (error) throw new Error(`Failed to write audit log: ${JSON.stringify(error)}`)

  return data
}
