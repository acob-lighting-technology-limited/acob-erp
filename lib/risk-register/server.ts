import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdminScope } from "@/lib/admin/api-scope"
import { getScopedDepartments } from "@/lib/admin/api-scope"
import { logger } from "@/lib/logger"
import type { RiskRow } from "./model"

const log = logger("risk-register")

export const RISK_REGISTER_PATH = "/admin/corporate-services/risk-register"

/** Every department a risk touches: lead, supporting and control owners. */
export function involvedDepartments(
  risk: Pick<RiskRow, "department" | "supporting_departments" | "control_owner_departments">
) {
  return [risk.department, ...risk.supporting_departments, ...risk.control_owner_departments]
}

/** Mirrors public.current_user_lead_departments(), which the RLS policies use. */
export function leadsDepartment(scope: AdminScope, department: string): boolean {
  if (!scope.isDepartmentLead) return false
  return scope.leadDepartments.includes(department) || scope.department === department
}

/**
 * Narrow rows to the caller's admin scope. RLS already enforces access; this
 * keeps a lead-mode admin to the departments they are acting for.
 */
export function filterRisksToScope<T extends RiskRow>(rows: T[], scope: AdminScope): T[] {
  const depts = getScopedDepartments(scope)
  if (depts === null) return rows
  if (depts.length === 0) return rows.filter((r) => r.control_owner_id === scope.userId)
  const allowed = new Set(depts)
  return rows.filter((r) => r.control_owner_id === scope.userId || involvedDepartments(r).some((d) => allowed.has(d)))
}

/** Tell a newly named control owner. Never throws. */
export async function notifyControlOwner(
  supabase: SupabaseClient,
  risk: Pick<RiskRow, "id" | "risk_name" | "department" | "control_owner_id">,
  actorId: string
) {
  if (!risk.control_owner_id || risk.control_owner_id === actorId) return
  try {
    await supabase.rpc("create_notification", {
      p_user_id: risk.control_owner_id,
      p_type: "system",
      p_category: "system",
      p_title: "Risk Assigned to You",
      p_message: `You are the control owner for "${risk.risk_name}" (${risk.department}) on the risk register.`,
      p_priority: "normal",
      p_link_url: RISK_REGISTER_PATH,
      p_actor_id: actorId,
      p_entity_type: "risk_register",
      p_entity_id: risk.id,
    })
  } catch (err) {
    log.error({ err: String(err), riskId: risk.id }, "control owner notification failed")
  }
}
