/**
 * Plain-sentence descriptions of audit rows, shared by every activity feed
 * (profile, admin dashboard, department dashboard) and the audit log table.
 *
 * Feeds used to print the table name, an 8-character entity hash when a row
 * had no title, and the changed column names - "Updated Profile: #14b8f4a3
 * (Event, Next Path, Target Role)". That helps nobody: the hash is not a link
 * and column names do not say what changed. A sentence says who did what to
 * which record; the raw values stay on the audit log's detail panel.
 */

export type DescribableAuditRow = {
  action?: string | null
  operation?: string | null
  entity_type?: string | null
  table_name?: string | null
  entity_id?: string | null
  metadata?: Record<string, unknown> | null
  new_values?: Record<string, unknown> | null
  old_values?: Record<string, unknown> | null
}

export function normalizeToken(value?: string | null): string {
  if (!value) return ""
  return value.trim().toLowerCase().replace(/\s+/g, "_")
}

export function humanizeToken(value?: string | null, fallback = "System"): string {
  if (!value) return fallback
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pickObject(value: any): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value
}

export function actionVerb(value: string): string {
  const token = normalizeToken(value)
  if (["insert", "create", "created", "add", "added"].includes(token)) return "Created"
  if (["delete", "deleted", "remove", "removed"].includes(token)) return "Deleted"
  if (["assign", "assigned", "reassign", "reassigned"].includes(token)) return "Assigned"
  if (["approve", "approved"].includes(token)) return "Approved"
  if (["reject", "rejected"].includes(token)) return "Rejected"
  if (["status_change", "update", "updated", "edit", "edited", "modify", "modified"].includes(token)) return "Updated"
  return humanizeToken(value, "Updated")
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractTargetLabel(item: any): string | null {
  const newValues = pickObject(item.new_values || item?.metadata?.new_values)
  const oldValues = pickObject(item.old_values || item?.metadata?.old_values)

  const fullNameFromNew =
    newValues.first_name && newValues.last_name ? `${newValues.first_name} ${newValues.last_name}` : null
  const fullNameFromOld =
    oldValues.first_name && oldValues.last_name ? `${oldValues.first_name} ${oldValues.last_name}` : null

  if (fullNameFromNew) return fullNameFromNew
  if (fullNameFromOld) return fullNameFromOld

  const candidates = [
    newValues.title,
    newValues.name,
    newValues.project_name,
    newValues.asset_name,
    newValues.ticket_number,
    oldValues.title,
    oldValues.name,
    oldValues.project_name,
    oldValues.asset_name,
    oldValues.ticket_number,
  ]

  const label = candidates.find((value) => typeof value === "string" && value.trim().length > 0)
  if (label) return String(label).trim()

  if (typeof item.entity_id === "string" && item.entity_id.length > 0) {
    return `#${item.entity_id.slice(0, 8)}`
  }

  return null
}

/**
 * Friendly singular nouns. App writes log the singular entity type ("task")
 * while database triggers log the table name ("tasks"); both map to the same
 * noun so the two rows a single save produces collapse into one entry.
 */
const MODULE_NOUNS: Record<string, string> = {
  task: "task",
  tasks: "task",
  task_assignment: "task assignment",
  task_assignments: "task assignment",
  profile: "profile",
  profiles: "profile",
  user: "user",
  pending_user: "sign-up",
  leave_request: "leave request",
  leave_requests: "leave request",
  leave_request_manual: "leave request",
  leave_approvals: "leave approval",
  leave_evidence: "leave evidence",
  attendance_record: "attendance record",
  attendance_records: "attendance record",
  attendance_record_bulk: "attendance records",
  attendance_appeal: "attendance appeal",
  attendance_appeals: "attendance appeal",
  attendance_exemption: "attendance exemption",
  help_desk_ticket: "help desk ticket",
  help_desk_tickets: "help desk ticket",
  correspondence: "correspondence",
  correspondence_record: "correspondence",
  correspondence_records: "correspondence",
  feedback: "feedback",
  goal: "goal",
  goals: "goal",
  goals_objectives: "goal",
  action_item: "action item",
  action_items: "action item",
  general_meeting_attendance: "general meeting attendance",
  performance_review: "performance review",
  performance_reviews: "performance review",
  review_cycle: "review cycle",
  peer_feedback: "peer feedback",
  development_plan: "development plan",
  requisition: "requisition",
  requisitions: "requisition",
  fleet_booking: "fleet booking",
  fleet_bookings: "fleet booking",
  asset: "asset",
  assets: "asset",
  asset_assignment: "asset assignment",
  asset_assignments: "asset assignment",
  payment: "payment",
  payments: "payment",
  department_payments: "payment",
  payment_documents: "payment document",
  payment_category: "payment category",
  payment_categories: "payment category",
  department: "department",
  departments: "department",
  documentation: "document",
  user_documentation: "document",
  controlled_document: "controlled document",
  notification_preference: "notification preference",
  notification_preferences: "notification preferences",
  system_satisfaction_survey: "satisfaction survey",
  cbt_attempt: "CBT attempt",
  cbt_question: "CBT question",
  event: "event",
  events: "event",
  risk_register: "risk register entry",
  project: "project",
  projects: "project",
}

/** Events whose humanized key would still be jargon. */
const EVENT_SENTENCES: Record<string, string> = {
  developer_impersonation_started: "Started a developer sign-in as another user",
}

/**
 * `writeAuditLog` stores a non-standard action such as "task.status_update" as
 * the row's event. Those are verbs about the record, not prose events, so they
 * pick the verb instead of becoming the sentence ("task.status update").
 */
const DOTTED_EVENT_VERBS: Record<string, string> = {
  create: "Created",
  bulk_create: "Created",
  update: "Updated",
  status_update: "Updated",
  archive: "Archived",
  comment_create: "Commented on",
  user_complete: "Completed",
  acknowledge: "Acknowledged",
  carry_forward: "Carried forward",
  evidence_upload: "Uploaded evidence for",
  evidence_delete: "Removed evidence from",
  link_tasks: "Linked tasks to",
  upsert: "Saved",
}

function readEvent(row: DescribableAuditRow): string | null {
  const candidates = [row.metadata?.event, row.new_values?.event]
  const event = candidates.find((value) => typeof value === "string" && value.trim().length > 0)
  return event ? normalizeToken(String(event)) : null
}

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function activityModuleNoun(row: DescribableAuditRow): string {
  const moduleKey = normalizeToken(row.entity_type || row.table_name || "")
  return MODULE_NOUNS[moduleKey] || humanizeToken(moduleKey, "record").toLowerCase()
}

/** A prose sentence for a recorded event, or null when the row has none (or only a dotted action). */
export function describeAuditEvent(row: DescribableAuditRow): string | null {
  const event = readEvent(row)
  if (!event || event.includes(".")) return null
  return EVENT_SENTENCES[event] || sentenceCase(humanizeToken(event).toLowerCase())
}

/** The pieces a sentence is built from, kept apart so two rows of one save can merge. */
interface ActivityParts {
  event: string | null
  verb: string
  noun: string
  target: string | null
  /** New status, only when the row shows it actually changed. */
  statusTo: string | null
  ownProfile: boolean
  entityKey: string | null
}

function readStatusChange(row: DescribableAuditRow): string | null {
  const before = pickObject(row.old_values).status
  const after = pickObject(row.new_values).status
  if (typeof after !== "string" || !after || typeof before !== "string" || before === after) return null
  return humanizeToken(after).toLowerCase()
}

function describeParts(row: DescribableAuditRow, viewerId?: string): ActivityParts {
  const noun = activityModuleNoun(row)
  const event = readEvent(row)
  const dottedVerb = event?.includes(".") ? DOTTED_EVENT_VERBS[event.split(".").pop() || ""] : undefined
  // extractTargetLabel falls back to "#<entity hash>", which means nothing to a reader.
  const rawTarget = extractTargetLabel(row)

  return {
    event: describeAuditEvent(row),
    verb: dottedVerb || actionVerb(row.action || row.operation || "updated"),
    noun,
    target: rawTarget && !rawTarget.startsWith("#") ? rawTarget : null,
    statusTo: readStatusChange(row),
    ownProfile: Boolean(viewerId && row.entity_id === viewerId),
    entityKey: row.entity_id ? `${noun}:${row.entity_id}` : null,
  }
}

function renderParts(parts: ActivityParts): string {
  if (parts.event) return parts.event
  const { verb, noun, target, statusTo } = parts

  if (noun === "profile") {
    if (parts.ownProfile) return `${verb} your profile`
    return target ? `${verb} ${target}'s profile` : `${verb} a staff profile`
  }

  const subject = target ? `${noun} “${target}”` : noun
  if (statusTo && verb === "Updated") return `Moved ${subject} to ${statusTo}`
  return `${verb} ${subject}`
}

/**
 * Merges the parts of two rows from one save: the specific verb beats the
 * generic "Updated", and whichever row captured the title or the status
 * change supplies it - so the app's status row and the trigger's full-row
 * update become `Moved task "Payroll…" to completed`.
 */
function mergeParts(a: ActivityParts, b: ActivityParts): ActivityParts {
  return {
    event: a.event || b.event,
    verb: a.verb !== "Updated" ? a.verb : b.verb,
    noun: a.noun,
    target: a.target || b.target,
    statusTo: a.statusTo || b.statusTo,
    ownProfile: a.ownProfile || b.ownProfile,
    entityKey: a.entityKey || b.entityKey,
  }
}

/**
 * One sentence, verb first, no subject: `Created task "Add TikTok…"`.
 * Pass `viewerId` on a personal feed so the viewer's own profile reads as
 * "your profile". Describes a single row; feeds use `describeActivityFeed`.
 */
export function describeAuditActivity(row: DescribableAuditRow, options: { viewerId?: string } = {}): string {
  return renderParts(describeParts(row, options.viewerId))
}

/** Lower-cases the leading verb so the sentence can follow an actor's name. */
export function asPredicate(sentence: string): string {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1)
}

/** Rows from one save land within a second or two of each other. */
const SAME_SAVE_WINDOW_MS = 2 * 60 * 1000

type FeedRow = DescribableAuditRow & { created_at: string; user_id?: string | null }

/**
 * Describes a newest-first run of audit rows for a feed, folding the rows one
 * save produces (app write + database trigger, same actor, same record, within
 * two minutes) into a single sentence. The audit log table keeps every row.
 */
export function describeActivityFeed<R extends FeedRow>(
  rows: R[],
  options: { viewerId?: string } = {}
): { row: R; sentence: string }[] {
  const entries: { row: R; parts: ActivityParts }[] = []
  for (const row of rows) {
    const parts = describeParts(row, options.viewerId)
    const previous = entries[entries.length - 1]
    const sameSave =
      previous &&
      (previous.row.user_id ?? null) === (row.user_id ?? null) &&
      Math.abs(new Date(previous.row.created_at).getTime() - new Date(row.created_at).getTime()) <
        SAME_SAVE_WINDOW_MS &&
      ((parts.entityKey !== null && parts.entityKey === previous.parts.entityKey) ||
        renderParts(parts) === renderParts(previous.parts))
    if (sameSave) {
      previous.parts = mergeParts(previous.parts, parts)
      continue
    }
    entries.push({ row, parts })
  }
  return entries.map(({ row, parts }) => ({ row, sentence: renderParts(parts) }))
}

export { sentenceCase as activitySentenceCase }
