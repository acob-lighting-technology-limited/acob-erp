import type { SupabaseClient } from "@supabase/supabase-js"
import type { AuditRequestContext } from "@/lib/audit/request-context"

export interface OnBehalfOf {
  id: string
  name: string | null
}

/**
 * Whose work a delegate was doing when they made a change, so the log reads "Rafiat, on behalf of
 * Onyekachukwu" and not only "delegate".
 *
 *  - An /admin delegate: middleware names the owner in a header.
 *  - A department-console delegate: found from the live delegation for that department. For a lead
 *    this finds nothing, so the extra lookup only ever adds a field for delegates.
 *
 * Never throws: the audit write must not fail because a name could not be found.
 */
export async function resolveOnBehalfOf(
  supabase: SupabaseClient,
  context: AuditRequestContext,
  actorId: string | undefined
): Promise<OnBehalfOf | null> {
  try {
    let ownerId = context.onBehalfOfId

    if (!ownerId && actorId && context.deptContextId && !context.editMode) {
      const { data } = await supabase
        .from("dept_delegations")
        .select("delegator_id")
        .eq("delegate_id", actorId)
        .eq("department_id", context.deptContextId)
        .is("revoked_at", null)
        .gt("valid_until", new Date().toISOString())
        .limit(1)
        .maybeSingle<{ delegator_id: string }>()
      ownerId = data?.delegator_id ?? null
    }

    if (!ownerId) return null

    const { data: person } = await supabase
      .from("staff_directory")
      .select("full_name, first_name, last_name")
      .eq("id", ownerId)
      .maybeSingle<{ full_name: string | null; first_name: string | null; last_name: string | null }>()
    const name =
      person?.full_name?.trim() || [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim() || null
    return { id: ownerId, name }
  } catch {
    return null
  }
}
