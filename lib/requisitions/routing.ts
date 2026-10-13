import {
  DEPT_ACCOUNTS,
  DEPT_ADMIN_HR,
  DEPT_CORPORATE_SERVICES,
  DEPT_EXECUTIVE_MANAGEMENT,
  DEPT_OPM,
  DEPT_PROJECT,
  DEPT_TECHNICAL,
  normalizeDepartmentName,
} from "@/shared/departments"
import type { RequisitionFormType, RequisitionRoleKey, RequisitionStageCode, RequisitionStageState } from "./types"

/**
 * Who signs a requisition, decided once at submission.
 *
 * Payment Request
 *   Project, Technical, O&M:  Reviewed —            Authorized dept lead  Verified Accounts Lead  Approved MD
 *   Every other department:   Reviewed HR Lead      Authorized HCS        Verified Accounts Lead  Approved MD
 * Petty Cash
 *   Authorized HR Lead, Approved the requester's department lead
 *
 * Nobody signs their own request and nobody signs two stages of one petty-cash
 * voucher; where that would happen the stage moves up a level (see the table in
 * docs/REQUISITIONS_PETTY_CASH_PLAN.md §2.3).
 */

/** Payment Requests from these departments skip Review and are authorized by their own lead. */
export const LEAD_AUTHORIZED_DEPARTMENTS: readonly string[] = [DEPT_PROJECT, DEPT_TECHNICAL, DEPT_OPM]

export const ROLE_LABELS: Record<Exclude<RequisitionRoleKey, "department_lead">, string> = {
  hr_lead: "HR Lead",
  hcs: "Head of Corporate Services",
  accounts_lead: "Accounts Lead",
  md: "Managing Director",
}

export interface RoutingProfile {
  id: string
  department: string | null
  is_department_lead: boolean | null
  lead_departments: string[] | null
}

export interface ResolvedStage {
  position: number
  stage_code: RequisitionStageCode
  role_key: RequisitionRoleKey
  role_label: string
  assignee_id: string | null
  state: Extract<RequisitionStageState, "pending" | "not_required">
  state_note: string | null
}

function leads(profile: RoutingProfile, department: string): boolean {
  if (!profile.is_department_lead) return false
  if (normalizeDepartmentName(profile.department) === department) return true
  return (profile.lead_departments || []).some((d) => normalizeDepartmentName(d) === department)
}

/** The lead of a department, preferring someone whose own department it is. */
export function findDepartmentLead(profiles: RoutingProfile[], department: string | null | undefined) {
  const target = normalizeDepartmentName(department)
  if (!target) return null
  const candidates = profiles.filter((p) => leads(p, target))
  return candidates.find((p) => normalizeDepartmentName(p.department) === target) || candidates[0] || null
}

interface Holders {
  hrLead: string | null
  hcs: string | null
  accountsLead: string | null
  md: string | null
  departmentLead: string | null
}

function resolveHolders(requester: RoutingProfile, profiles: RoutingProfile[]): Holders {
  return {
    hrLead: findDepartmentLead(profiles, DEPT_ADMIN_HR)?.id ?? null,
    hcs: findDepartmentLead(profiles, DEPT_CORPORATE_SERVICES)?.id ?? null,
    accountsLead: findDepartmentLead(profiles, DEPT_ACCOUNTS)?.id ?? null,
    md: findDepartmentLead(profiles, DEPT_EXECUTIVE_MANAGEMENT)?.id ?? null,
    departmentLead: findDepartmentLead(profiles, requester.department)?.id ?? null,
  }
}

type Slot = Omit<ResolvedStage, "position" | "stage_code">

function role(
  role_key: Exclude<RequisitionRoleKey, "department_lead">,
  assignee_id: string | null,
  note?: string
): Slot {
  return { role_key, role_label: ROLE_LABELS[role_key], assignee_id, state: "pending", state_note: note ?? null }
}

function departmentLeadRole(department: string, assignee_id: string): Slot {
  return {
    role_key: "department_lead",
    role_label: `${department} Lead`,
    assignee_id,
    state: "pending",
    state_note: null,
  }
}

function notRequired(role_key: RequisitionRoleKey, role_label: string, note: string): Slot {
  return { role_key, role_label, assignee_id: null, state: "not_required", state_note: note }
}

function paymentRequestStages(requester: RoutingProfile, h: Holders): Slot[] {
  const department = normalizeDepartmentName(requester.department)
  const leadAuthorized = LEAD_AUTHORIZED_DEPARTMENTS.includes(department)

  let reviewed: Slot
  if (leadAuthorized) {
    reviewed = notRequired("hr_lead", ROLE_LABELS.hr_lead, `Not required for ${department}`)
  } else if (h.hrLead && h.hrLead === requester.id) {
    reviewed = notRequired("hr_lead", ROLE_LABELS.hr_lead, "Not required: raised by the HR Lead")
  } else {
    reviewed = role("hr_lead", h.hrLead)
  }

  let authorized: Slot
  if (leadAuthorized && h.departmentLead && h.departmentLead !== requester.id) {
    authorized = departmentLeadRole(department, h.departmentLead)
  } else if (leadAuthorized && h.departmentLead === requester.id) {
    authorized = role("hcs", h.hcs, "Moved to HCS: raised by the department lead")
  } else if (leadAuthorized) {
    authorized = role("hcs", h.hcs, `Moved to HCS: ${department} has no lead`)
  } else if (h.hcs && h.hcs === requester.id) {
    authorized = role("md", h.md, "Moved to the MD: raised by HCS")
  } else {
    authorized = role("hcs", h.hcs)
  }

  // The Accounts Lead cannot verify their own request, but the stage is kept:
  // the MD's approval bypasses it, so the record shows it was skipped.
  const verified =
    h.accountsLead && h.accountsLead === requester.id
      ? role("accounts_lead", h.accountsLead, "Raised by the Accounts Lead: the MD's approval bypasses this stage")
      : role("accounts_lead", h.accountsLead)

  const approved =
    h.md && h.md === requester.id
      ? notRequired("md", ROLE_LABELS.md, "Not required: the MD's own request")
      : role("md", h.md)

  return [reviewed, authorized, verified, approved]
}

function pettyCashStages(requester: RoutingProfile, h: Holders): Slot[] {
  const department = normalizeDepartmentName(requester.department)

  const authorized =
    h.hrLead && h.hrLead === requester.id
      ? role("hcs", h.hcs, "Moved to HCS: raised by the HR Lead")
      : role("hr_lead", h.hrLead)

  let approved: Slot
  if (h.hcs && h.hcs === requester.id) {
    approved = role("md", h.md, "Moved to the MD: raised by HCS")
  } else if (h.departmentLead && h.departmentLead === requester.id) {
    approved = role("hcs", h.hcs, "Moved to HCS: raised by the department lead")
  } else if (department === DEPT_ADMIN_HR) {
    approved = role("hcs", h.hcs, "Moved to HCS: the HR Lead already authorizes")
  } else if (!h.departmentLead) {
    approved = role("hcs", h.hcs, `Moved to HCS: ${department || "this department"} has no lead`)
  } else {
    approved = departmentLeadRole(department, h.departmentLead)
  }

  // One person never signs both stages of a voucher.
  if (approved.assignee_id && approved.assignee_id === authorized.assignee_id) {
    approved = role("md", h.md, "Moved to the MD: the same person would sign both stages")
  }

  return [authorized, approved]
}

const STAGE_CODES: Record<RequisitionFormType, RequisitionStageCode[]> = {
  payment_request: ["reviewed", "authorized", "verified", "approved"],
  petty_cash: ["authorized", "approved"],
}

/**
 * The stages a new requisition goes through. `profiles` must include every
 * department lead (is_department_lead with their departments).
 */
export function resolveRequisitionStages(
  formType: RequisitionFormType,
  requester: RoutingProfile,
  profiles: RoutingProfile[]
): ResolvedStage[] {
  const holders = resolveHolders(requester, profiles)
  const slots =
    formType === "petty_cash" ? pettyCashStages(requester, holders) : paymentRequestStages(requester, holders)
  return slots.map((slot, index) => ({
    ...slot,
    position: index + 1,
    stage_code: STAGE_CODES[formType][index],
  }))
}

export const STAGE_LABELS: Record<RequisitionStageCode, string> = {
  reviewed: "Reviewed",
  authorized: "Authorized",
  verified: "Verified",
  approved: "Approved",
}

export const STAGE_VERBS: Record<RequisitionStageCode, string> = {
  reviewed: "review",
  authorized: "authorize",
  verified: "verify",
  approved: "approve",
}
