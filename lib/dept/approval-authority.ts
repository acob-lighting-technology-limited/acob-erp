import type { SupabaseClient } from "@supabase/supabase-js"
import { isSameDepartment } from "@/shared/departments"
import { DEPT_APPROVALS, type ApprovalPage } from "./approval-permissions"

type Grant = { id: string; delegator_id: string; department_id: string }
type Department = { id: string; name: string; department_head_id: string | null }

export async function loadApprovalDelegations(db: SupabaseClient, actorId: string, page: ApprovalPage) {
  const permission = DEPT_APPROVALS.find((entry) => entry.page === page)
  if (!permission) return []
  const { data: grants, error } = await db
    .from("dept_delegations")
    .select("id, delegator_id, department_id")
    .eq("delegate_id", actorId)
    .is("revoked_at", null)
    .gt("valid_until", new Date().toISOString())
    .contains("pages", [page, permission.key])
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<Grant[]>()
  if (error || !grants?.length) return []
  const { data: departments, error: departmentError } = await db
    .from("departments")
    .select("id, name, department_head_id")
    .in("id", [...new Set(grants.map((grant) => grant.department_id))])
    .eq("is_active", true)
    .limit(500)
    .returns<Department[]>()
  if (departmentError) return []
  const current = new Map(departments?.map((department) => [department.id, department]))
  return grants.flatMap((grant) => {
    const department = current.get(grant.department_id)
    return department && department.department_head_id === grant.delegator_id
      ? [{ delegationId: grant.id, onBehalfOf: grant.delegator_id, department: department.name }]
      : []
  })
}

export type ApprovalDelegation = Awaited<ReturnType<typeof loadApprovalDelegations>>[number]

export function delegationForDepartment(grants: ApprovalDelegation[], department: string | null | undefined) {
  return department ? grants.find((grant) => isSameDepartment(grant.department, department)) : undefined
}
