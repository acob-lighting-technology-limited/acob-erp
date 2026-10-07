import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { isRequisitionApprover, resolveRequisitionActor } from "@/lib/requisitions/authorization"

export interface RequisitionListOptions {
  userOnly?: boolean
  status?: string | null
  stage?: string | null
}

/**
 * The requisitions a signed-in user may see — shared by GET /api/requisitions
 * and server prefetches. Everyone sees their own; admins and the leads who sign
 * a stage see the whole queue; other department leads see their departments'.
 * Throws on a query failure.
 */
export async function listRequisitions(supabase: SupabaseClient, userId: string, options: RequisitionListOptions = {}) {
  const actor = await resolveRequisitionActor(supabase, userId)
  const seesAll = actor ? isRequisitionApprover(actor) : false
  const dataClient = getServiceRoleClientOrFallback(supabase)

  let query = dataClient
    .from("requisitions")
    .select(
      `
        *,
        requester:profiles!requisitions_user_id_fkey(id, full_name, department, company_email)
      `
    )
    .order("created_at", { ascending: false })

  if (options.userOnly || !actor) {
    query = query.eq("user_id", userId)
  } else if (!seesAll) {
    const depts = actor.ledDepartments
    query =
      depts.length > 0
        ? query.or(`user_id.eq.${userId},department.in.(${depts.map((d) => `"${d}"`).join(",")})`)
        : query.eq("user_id", userId)
  }
  if (options.status) query = query.eq("status", options.status)
  if (options.stage) query = query.eq("current_stage_code", options.stage)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}
