import { formatName } from "@/lib/utils"

/**
 * An asset's history as one list of events: added, assigned, returned, status changes, issues and
 * archiving. The assets page builds it in three places: the expanded row's timeline, the History
 * sheet and the History tab. They all go through `buildAssetActivities`, so the same event never
 * reads differently in two places.
 */

export type AssetActivityType =
  | "created"
  | "assignment"
  | "unassignment"
  | "status_change"
  | "issue_reported"
  | "issue_resolved"
  | "archived"

export interface AssetActivity {
  id: string
  asset_id: string
  timestamp: string
  type: AssetActivityType
  title: string
  /** An issue's description or an archive reason. */
  description?: string
  /** Who or where the asset went to (assignment) or came back from (return). */
  user_name?: string
  performed_by_name?: string
  details?: {
    assignment_type?: string
    notes?: string
    status?: string
    old_status?: string
    /** On a return: how many days the holder had it. */
    held_days?: number
  }
}

export const ASSET_ACTIVITY_LABELS: Record<AssetActivityType, string> = {
  created: "Added",
  assignment: "Assigned",
  unassignment: "Returned",
  status_change: "Status changed",
  issue_reported: "Issue reported",
  issue_resolved: "Issue resolved",
  archived: "Archived",
}

// ─── Raw rows, as the history API returns them ─────────────────────────────────

export interface AssetHistoryAssetRow {
  id: string
  unique_code: string
  asset_type: string
  asset_model: string | null
  created_at: string
  created_by: string | null
  deleted_at: string | null
  deleted_by: string | null
  delete_reason: string | null
}

export interface AssetHistoryAssignmentRow {
  id: string
  asset_id: string
  assigned_at: string
  handed_over_at: string | null
  assignment_notes: string | null
  handover_notes: string | null
  assigned_by: string | null
  assigned_to: string | null
  department: string | null
  office_location: string | null
  assignment_type: string | null
}

export interface AssetHistoryIssueRow {
  id: string
  asset_id: string
  description: string
  resolved: boolean
  created_at: string
  resolved_at: string | null
  created_by: string | null
  resolved_by: string | null
}

export interface AssetHistoryStatusRow {
  id: string
  asset_id: string
  created_at: string
  user_id: string | null
  old_status: string | null
  new_status: string | null
}

export interface AssetHistoryPayload {
  assets: AssetHistoryAssetRow[]
  assignments: AssetHistoryAssignmentRow[]
  issues: AssetHistoryIssueRow[]
  statusChanges: AssetHistoryStatusRow[]
  users: { id: string; first_name: string | null; last_name: string | null }[]
}

/**
 * Assigning or returning an asset also updates its status, and the audit log records that as a
 * separate change a moment later. A status change this close to an assignment or return is that
 * echo, not news, so the timeline leaves it out.
 */
const ECHO_WINDOW_MS = 5 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

export function buildAssetActivities(payload: AssetHistoryPayload): AssetActivity[] {
  const usersById = new Map(payload.users.map((u) => [u.id, u] as const))
  const personName = (id: string | null | undefined): string | null => {
    if (!id) return null
    const user = usersById.get(id)
    if (!user) return null
    return `${formatName(user.first_name ?? "")} ${formatName(user.last_name ?? "")}`.trim() || null
  }
  const holderName = (a: AssetHistoryAssignmentRow) =>
    (a.assigned_to ? personName(a.assigned_to) : null) || a.department || a.office_location || "Office"

  const activities: AssetActivity[] = []
  const assignTimes = new Map<string, number[]>()
  const returnTimes = new Map<string, number[]>()
  const remember = (map: Map<string, number[]>, assetId: string, at: string) => {
    const list = map.get(assetId) ?? []
    list.push(new Date(at).getTime())
    map.set(assetId, list)
  }

  for (const asset of payload.assets) {
    activities.push({
      id: `${asset.id}-created`,
      asset_id: asset.id,
      timestamp: asset.created_at,
      type: "created",
      title: "Added to inventory",
      performed_by_name: personName(asset.created_by) ?? undefined,
    })
    if (asset.deleted_at) {
      activities.push({
        id: `${asset.id}-archived`,
        asset_id: asset.id,
        timestamp: asset.deleted_at,
        type: "archived",
        title: "Archived",
        description: asset.delete_reason ?? undefined,
        performed_by_name: personName(asset.deleted_by) ?? undefined,
      })
    }
  }

  for (const a of payload.assignments) {
    const holder = holderName(a)
    remember(assignTimes, a.asset_id, a.assigned_at)
    activities.push({
      id: `${a.id}-assign`,
      asset_id: a.asset_id,
      timestamp: a.assigned_at,
      type: "assignment",
      title: `Assigned to ${holder}`,
      user_name: holder,
      performed_by_name: personName(a.assigned_by) ?? undefined,
      details: { notes: a.assignment_notes ?? undefined, assignment_type: a.assignment_type ?? undefined },
    })
    if (a.handed_over_at) {
      remember(returnTimes, a.asset_id, a.handed_over_at)
      const held = new Date(a.handed_over_at).getTime() - new Date(a.assigned_at).getTime()
      activities.push({
        id: `${a.id}-return`,
        asset_id: a.asset_id,
        timestamp: a.handed_over_at,
        type: "unassignment",
        title: `Returned by ${holder}`,
        user_name: holder,
        details: {
          notes: a.handover_notes ?? undefined,
          assignment_type: a.assignment_type ?? undefined,
          held_days: held >= 0 ? Math.max(1, Math.round(held / DAY_MS)) : undefined,
        },
      })
    }
  }

  for (const i of payload.issues) {
    activities.push({
      id: `${i.id}-issue`,
      asset_id: i.asset_id,
      timestamp: i.created_at,
      type: "issue_reported",
      title: "Issue reported",
      description: i.description,
      performed_by_name: personName(i.created_by) ?? undefined,
    })
    if (i.resolved && i.resolved_at) {
      activities.push({
        id: `${i.id}-resolved`,
        asset_id: i.asset_id,
        timestamp: i.resolved_at,
        type: "issue_resolved",
        title: "Issue resolved",
        description: i.description,
        performed_by_name: personName(i.resolved_by) ?? undefined,
      })
    }
  }

  const isEcho = (s: AssetHistoryStatusRow) => {
    const at = new Date(s.created_at).getTime()
    const near = (list: number[] | undefined) => (list ?? []).some((t) => Math.abs(t - at) < ECHO_WINDOW_MS)
    if (s.new_status === "assigned") return near(assignTimes.get(s.asset_id))
    if (s.new_status === "available") return near(returnTimes.get(s.asset_id))
    return false
  }

  for (const s of payload.statusChanges) {
    if (!s.new_status || s.new_status === s.old_status || isEcho(s)) continue
    activities.push({
      id: s.id,
      asset_id: s.asset_id,
      timestamp: s.created_at,
      type: "status_change",
      title: `Status changed to ${formatName(s.new_status)}`,
      performed_by_name: personName(s.user_id) ?? undefined,
      details: { old_status: s.old_status ?? undefined, status: s.new_status },
    })
  }

  // Newest first.
  return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
