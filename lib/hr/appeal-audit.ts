/**
 * The steps an attendance appeal went through, for its audit history. Shared by the
 * admin appeals list, the review sheet and the employee's own attendance page.
 *
 * An admin's change fills the admin side when it is made, so that side reads "made the
 * change", never "Approved": the final decision is its own step, and an override is
 * shown as an override, never as the step it skipped.
 */

export type AuditableAppeal = {
  status: string
  stage?: string | null
  initiated_by_role?: string | null
  user_name?: string | null
  created_by_name?: string | null
  created_at: string
  department_lead_name?: string | null
  lead_reviewed_by?: string | null
  lead_reviewer_name?: string | null
  lead_reviewed_at?: string | null
  lead_resolution_note?: string | null
  admin_reviewer_name?: string | null
  admin_reviewed_at?: string | null
  admin_resolution_note?: string | null
  admin_hr_lead_name?: string | null
  reviewed_by?: string | null
  reviewer_name?: string | null
  reviewed_at?: string | null
  resolution_note?: string | null
  overridden_by_name?: string | null
  overridden_at?: string | null
  override_reason?: string | null
  overridden_stage?: string | null
}

export type AuditStepState = "done" | "waiting" | "rejected" | "skipped" | "override" | "none"

export type AuditStep = {
  key: "origin" | "lead" | "admin" | "outcome"
  label: string
  state: AuditStepState
  text: string
  by?: string | null
  note?: string | null
  at?: string | null
}

export function appealAuditSteps(a: AuditableAppeal): AuditStep[] {
  const isAdminChange = a.initiated_by_role === "admin_manual"
  const isLeadChange = a.initiated_by_role === "lead_on_behalf"
  const maker = a.created_by_name || (a.initiated_by_role === "employee" ? a.user_name : null)
  const overriddenStage = a.overridden_at ? a.overridden_stage : null
  const rejectedByLead = a.status === "rejected" && Boolean(a.lead_reviewed_by) && a.reviewed_by === a.lead_reviewed_by

  const steps: AuditStep[] = [
    {
      key: "origin",
      label: "Initiated by",
      state: "done",
      text: isAdminChange ? "Admin change" : isLeadChange ? "Lead on behalf" : "Employee appeal",
      by: maker,
      at: a.created_at,
    },
  ]

  // Lead side: the employee's own Department Lead (or the Admin & HR Lead when the
  // department has no lead).
  if (isLeadChange) {
    steps.push({ key: "lead", label: "Lead side", state: "done", text: "Made the change", by: maker })
  } else if (a.lead_reviewed_at) {
    steps.push({
      key: "lead",
      label: "Lead side",
      state: rejectedByLead ? "rejected" : "done",
      text: rejectedByLead ? "Rejected" : "Confirmed",
      by: a.lead_reviewer_name,
      note: a.lead_resolution_note,
      at: a.lead_reviewed_at,
    })
  } else if (overriddenStage === "pending_lead") {
    steps.push({ key: "lead", label: "Lead side", state: "skipped", text: "Skipped by override" })
  } else if (a.status === "pending" && a.stage === "pending_lead") {
    steps.push({
      key: "lead",
      label: "Lead side",
      state: "waiting",
      text: `Awaiting ${a.department_lead_name || "Department Lead"}`,
    })
  } else if ((a.status === "pending" && a.stage === "pending_hr_lead") || overriddenStage === "pending_hr_lead") {
    steps.push({
      key: "lead",
      label: "Admin & HR Lead",
      state: overriddenStage ? "skipped" : "waiting",
      text: overriddenStage ? "Skipped by override" : `Awaiting ${a.admin_hr_lead_name || "Admin & HR Lead"}`,
    })
  } else {
    steps.push({ key: "lead", label: "Lead side", state: "none", text: "Not needed" })
  }

  // Admin side: any admin.
  if (isAdminChange) {
    steps.push({ key: "admin", label: "Admin side", state: "done", text: "Made the change", by: maker })
  } else if (a.admin_reviewed_at) {
    const rejected = a.status === "rejected" && !rejectedByLead
    steps.push({
      key: "admin",
      label: "Admin side",
      state: rejected ? "rejected" : "done",
      text: rejected ? "Rejected" : "Approved",
      by: a.admin_reviewer_name,
      note: a.admin_resolution_note,
      at: a.admin_reviewed_at,
    })
  } else if (overriddenStage === "pending_admin") {
    steps.push({ key: "admin", label: "Admin side", state: "skipped", text: "Skipped by override" })
  } else if (a.status === "pending" && a.stage === "pending_admin") {
    steps.push({ key: "admin", label: "Admin side", state: "waiting", text: "Awaiting an admin" })
  } else if (a.status === "pending" && a.stage === "pending_lead") {
    steps.push({ key: "admin", label: "Admin side", state: "none", text: "Next, after the lead" })
  } else {
    steps.push({ key: "admin", label: "Admin side", state: "none", text: "Not needed" })
  }

  // Outcome
  if (a.overridden_at) {
    steps.push({
      key: "outcome",
      label: "Outcome",
      state: "override",
      text: "Approved by override",
      by: a.overridden_by_name,
      note: a.override_reason,
      at: a.overridden_at,
    })
  } else if (a.status === "approved") {
    steps.push({
      key: "outcome",
      label: "Outcome",
      state: "done",
      text: "Approved",
      by: a.reviewer_name,
      at: a.reviewed_at,
    })
  } else if (a.status === "rejected") {
    steps.push({
      key: "outcome",
      label: "Outcome",
      state: "rejected",
      text: "Rejected",
      by: a.reviewer_name,
      note: a.resolution_note,
      at: a.reviewed_at,
    })
  } else if (a.status === "resolved") {
    steps.push({
      key: "outcome",
      label: "Outcome",
      state: "done",
      text: "Resolved: the day was changed directly",
      note: a.resolution_note,
      at: a.reviewed_at,
    })
  }

  return steps
}
