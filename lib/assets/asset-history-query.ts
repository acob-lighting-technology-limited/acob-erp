import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AssetHistoryAssetRow,
  AssetHistoryAssignmentRow,
  AssetHistoryIssueRow,
  AssetHistoryPayload,
  AssetHistoryStatusRow,
} from "@/lib/assets/asset-activity"

/**
 * The raw rows behind asset history: the assets themselves (added / archived), every assignment,
 * every issue and every status change from the audit log, plus the names of everyone involved.
 * `assetIds` limits it to those assets; `null` reads every asset (a global admin's History tab).
 * The client turns this into a timeline with `buildAssetActivities`.
 */
export async function fetchAssetHistory(
  db: SupabaseClient,
  assetIds: string[] | null
): Promise<{ data: AssetHistoryPayload; error: null } | { data: null; error: unknown }> {
  if (assetIds && assetIds.length === 0) {
    return { data: { assets: [], assignments: [], issues: [], statusChanges: [], users: [] }, error: null }
  }

  let assetsQuery = db
    .from("assets")
    .select("id, unique_code, asset_type, asset_model, created_at, created_by, deleted_at, deleted_by, delete_reason")
  let assignmentsQuery = db
    .from("asset_assignments")
    .select(
      "id, asset_id, assigned_at, handed_over_at, assignment_notes, handover_notes, assigned_by, assigned_to, department, office_location, assignment_type"
    )
  let issuesQuery = db
    .from("asset_issues")
    .select("id, asset_id, description, resolved, created_at, resolved_at, created_by, resolved_by")
  // Only the status out of each audit row: the full old/new snapshots are most of the payload.
  let statusQuery = db
    .from("audit_logs")
    .select(
      "id, asset_id:record_id, created_at, user_id, old_status:old_values->>status, new_status:new_values->>status"
    )
    .eq("table_name", "assets")
    .eq("operation", "UPDATE")

  if (assetIds) {
    assetsQuery = assetsQuery.in("id", assetIds)
    assignmentsQuery = assignmentsQuery.in("asset_id", assetIds)
    issuesQuery = issuesQuery.in("asset_id", assetIds)
    statusQuery = statusQuery.in("record_id", assetIds)
  }

  const [assetsRes, assignmentsRes, issuesRes, statusRes] = await Promise.all([
    assetsQuery,
    assignmentsQuery,
    issuesQuery,
    statusQuery,
  ])
  const failed = assetsRes.error || assignmentsRes.error || issuesRes.error || statusRes.error
  if (failed) return { data: null, error: failed }

  const assets = (assetsRes.data ?? []) as AssetHistoryAssetRow[]
  const assignments = (assignmentsRes.data ?? []) as AssetHistoryAssignmentRow[]
  const issues = (issuesRes.data ?? []) as AssetHistoryIssueRow[]
  const statusChanges = ((statusRes.data ?? []) as AssetHistoryStatusRow[]).filter(
    (row) => row.new_status && row.new_status !== row.old_status
  )

  const userIds = new Set<string>()
  const add = (id: string | null) => {
    if (id) userIds.add(id)
  }
  assets.forEach((a) => {
    add(a.created_by)
    add(a.deleted_by)
  })
  assignments.forEach((a) => {
    add(a.assigned_by)
    add(a.assigned_to)
  })
  issues.forEach((i) => {
    add(i.created_by)
    add(i.resolved_by)
  })
  statusChanges.forEach((s) => add(s.user_id))

  let users: AssetHistoryPayload["users"] = []
  if (userIds.size > 0) {
    const { data, error } = await db.from("profiles").select("id, first_name, last_name").in("id", Array.from(userIds))
    if (error) return { data: null, error }
    users = (data ?? []) as AssetHistoryPayload["users"]
  }

  return { data: { assets, assignments, issues, statusChanges, users }, error: null }
}
