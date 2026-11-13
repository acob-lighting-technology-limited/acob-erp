import type { SupabaseClient } from "@supabase/supabase-js"
import type { AcceptanceStatus } from "@/lib/assets/acceptance"

export interface StaffAssignmentRow {
  id: string
  asset_id: string
  assigned_to: string | null
  is_current: boolean | null
  acceptance_status: AcceptanceStatus
  asset: { unique_code: string; asset_type: string; asset_model: string | null } | null
}

/**
 * An assignment the signed-in person is acting on from /accounts/assets, with its asset. Returns
 * `null` when it does not exist or is not theirs, so a caller answers 404 either way and never
 * reveals someone else's assignment.
 */
export async function loadOwnAssignment(
  db: SupabaseClient,
  assignmentId: string,
  userId: string
): Promise<{ row: StaffAssignmentRow | null; error: unknown }> {
  const { data, error } = await db
    .from("asset_assignments")
    .select("id, asset_id, assigned_to, is_current, acceptance_status")
    .eq("id", assignmentId)
    .maybeSingle()
  if (error) return { row: null, error }
  const assignment = data as Omit<StaffAssignmentRow, "asset"> | null
  if (!assignment || assignment.assigned_to !== userId) return { row: null, error: null }

  const { data: asset, error: assetError } = await db
    .from("assets")
    .select("unique_code, asset_type, asset_model")
    .eq("id", assignment.asset_id)
    .maybeSingle()
  if (assetError) return { row: null, error: assetError }
  return { row: { ...assignment, asset: (asset as StaffAssignmentRow["asset"]) ?? null }, error: null }
}

export function assetLabel(row: Pick<StaffAssignmentRow, "asset">): string {
  if (!row.asset) return "an asset"
  return row.asset.asset_model ? `${row.asset.unique_code} (${row.asset.asset_model})` : row.asset.unique_code
}
