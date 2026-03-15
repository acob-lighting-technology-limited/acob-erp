export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "assign"
  | "unassign"
  | "approve"
  | "reject"
  | "dispatch"
  | "send"
  | "status_change"

export type AuditEntityType =
  | "feedback"
  | "documentation"
  | "help_desk_ticket"
  | "correspondence_record"
  | "communications_mail"
  | "mail_summary"
  | "profile"
  | "asset"
  | "asset_assignment"
  | (string & {})

export type AuditSource = "ui" | "api" | "edge" | "system"

export interface AuditContext {
  actorId?: string
  department?: string | null
  siteId?: string | null
  requestId?: string | null
  source: AuditSource
  route?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface AuditPayload {
  action: string
  entityType: AuditEntityType
  entityId: string
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  context: AuditContext
}

const NORMALIZED_ACTIONS: AuditAction[] = [
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
]

function coerceString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function generateRequestId(): string {
  // crypto.randomUUID() is available in Node 18+, all modern browsers,
  // and Next.js Edge Runtime — no Math.random() fallback needed.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  // Last-resort fallback using cryptographically-secure random bytes.
  // Math.random() is intentionally NOT used here because it is not
  // cryptographically secure and could produce collisions under load.
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint8Array(16)
    crypto.getRandomValues(buf)
    buf[6] = (buf[6] & 0x0f) | 0x40 // version 4
    buf[8] = (buf[8] & 0x3f) | 0x80 // variant bits
    const hex = Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("")
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
  }
  // Should never reach here in a supported runtime.
  throw new Error("No cryptographically secure random source available")
}

export function normalizeAuditAction(action: string): { action: AuditAction; event?: string } {
  const raw = action.trim().toLowerCase()

  if ((NORMALIZED_ACTIONS as string[]).includes(raw)) {
    return { action: raw as AuditAction }
  }

  if (raw.includes("approve")) return { action: "approve", event: action }
  if (raw.includes("reject")) return { action: "reject", event: action }
  if (raw.includes("assign")) return { action: raw.includes("unassign") ? "unassign" : "assign", event: action }
  if (raw.includes("dispatch")) return { action: "dispatch", event: action }
  if (raw.includes("send") || raw.includes("sent")) return { action: "send", event: action }
  if (raw.includes("status") || raw.includes("pivot")) return { action: "status_change", event: action }
  if (raw.includes("create") || raw.endsWith("_created")) return { action: "create", event: action }
  if (raw.includes("delete") || raw.endsWith("_deleted")) return { action: "delete", event: action }

  return { action: "update", event: action }
}

export function isCriticalAuditAction(inputAction: string, event?: string): boolean {
  const action = inputAction.toLowerCase()
  const eventText = (event || "").toLowerCase()
  const text = `${action} ${eventText}`

  return (
    action === "approve" ||
    action === "reject" ||
    action === "dispatch" ||
    action === "assign" ||
    action === "unassign" ||
    action === "status_change" ||
    text.includes("approval") ||
    text.includes("status") ||
    text.includes("assign") ||
    text.includes("dispatch") ||
    text.includes("pivot")
  )
}

export function buildAuditRpcParams(payload: AuditPayload) {
  const entityId = coerceString(payload.entityId)
  const entityType = coerceString(payload.entityType)
  const actionText = coerceString(payload.action)

  if (!entityId) {
    throw new Error("audit payload missing entityId")
  }
  if (!entityType) {
    throw new Error("audit payload missing entityType")
  }
  if (!actionText) {
    throw new Error("audit payload missing action")
  }

  const normalized = normalizeAuditAction(actionText)
  const requestId = payload.context.requestId || generateRequestId()

  const metadata: Record<string, unknown> = {
    ...(payload.metadata || {}),
    source: payload.context.source,
    route: payload.context.route || null,
    request_id: requestId,
    ip_address: payload.context.ipAddress || null,
    user_agent: payload.context.userAgent || null,
  }

  if (normalized.event && !metadata.event) {
    metadata.event = normalized.event
  }

  return {
    p_action: normalized.action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_user_id: payload.context.actorId || null,
    p_old_values: payload.oldValues || null,
    p_new_values: payload.newValues || null,
    p_metadata: metadata,
    p_site_id: payload.context.siteId || null,
    p_department: payload.context.department || null,
    _normalizedAction: normalized.action,
    _event: typeof metadata.event === "string" ? metadata.event : undefined,
  }
}
