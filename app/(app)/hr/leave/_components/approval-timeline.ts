import { formatName } from "@/lib/utils"
import { formatWATDateTime } from "@/lib/utils/date"
import { resolveLeaveRouteStages } from "@/lib/hr/leave-stages"
import type { LeaveApprovalAudit, LeaveRequest } from "../page"

/** Stage names and the approval trail of a leave request, as the leave page shows them. */

export type PersonNameRef = {
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  company_email?: string | null
}

export function approvalStageLabel(code?: string | null) {
  const value = String(code || "").toLowerCase()
  if (value.includes("reliever")) return "Reliever"
  if (value.includes("department_lead")) return "Department Lead"
  if (value.includes("admin_hr_lead")) return "Admin and HR Lead"
  if (value.includes("hcs")) return "HCS"
  if (value.includes("md")) return "MD"
  return formatName(code || "Stage")
}

export function approvalStageKey(code?: string | null) {
  const value = String(code || "").toLowerCase()
  if (value.includes("reliever")) return "reliever"
  if (value.includes("department_lead")) return "department_lead"
  if (value.includes("admin_hr_lead")) return "admin_hr_lead"
  if (value.includes("hcs")) return "hcs"
  if (value.includes("md")) return "md"
  return value || "unknown"
}

export function resolvePersonName(person?: PersonNameRef | null) {
  if (!person) return ""
  const full = String(person.full_name || "").trim()
  if (full) return full
  const composed = `${person.first_name || ""} ${person.last_name || ""}`.trim()
  if (composed) return composed
  const email = String(person.company_email || "").trim()
  if (email) return email.split("@")[0] || email
  return ""
}

export function getApprovalTimeline(row: LeaveRequest) {
  const timeline = [...(row.approvals || [])].sort((left, right) => {
    const leftOrder = Number(left.stage_order || left.approval_level || 999)
    const rightOrder = Number(right.stage_order || right.approval_level || 999)
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    return String(left.approved_at || "").localeCompare(String(right.approved_at || ""))
  })

  const stageAuditMap = new Map<string, LeaveApprovalAudit>()
  for (const item of timeline) {
    const key = approvalStageKey(item.stage_code)
    const existing = stageAuditMap.get(key)
    if (!existing) {
      stageAuditMap.set(key, item)
      continue
    }

    const existingTime = existing.approved_at ? new Date(existing.approved_at).getTime() : 0
    const nextTime = item.approved_at ? new Date(item.approved_at).getTime() : 0
    if (nextTime >= existingTime) {
      stageAuditMap.set(key, item)
    }
  }

  if (timeline.length === 0) {
    if (row.reliever_decision_at) {
      stageAuditMap.set("reliever", {
        id: `${row.id}-reliever-fallback`,
        status: row.status === "rejected" ? "rejected" : "approved",
        stage_code: "pending_reliever",
        approved_at: row.reliever_decision_at,
        approver: row.reliever
          ? {
              id: row.reliever.id,
              full_name: row.reliever.full_name,
              company_email: row.reliever.company_email,
            }
          : null,
      })
    }

    if (row.supervisor_decision_at) {
      stageAuditMap.set("department_lead", {
        id: `${row.id}-deptlead-fallback`,
        status: row.status === "rejected" ? "rejected" : "approved",
        stage_code: "pending_department_lead",
        approved_at: row.supervisor_decision_at,
        approver: row.supervisor
          ? {
              id: row.supervisor.id,
              full_name: row.supervisor.full_name,
              company_email: row.supervisor.company_email,
            }
          : null,
      })
    }

    if (row.hr_decision_at) {
      stageAuditMap.set("admin_hr_lead", {
        id: `${row.id}-hr-fallback`,
        status: row.status === "rejected" ? "rejected" : "approved",
        stage_code: "pending_admin_hr_lead",
        approved_at: row.hr_decision_at,
        approver: row.approved_by_profile
          ? {
              id: row.approved_by_profile.id,
              full_name: row.approved_by_profile.full_name,
              company_email: row.approved_by_profile.company_email,
            }
          : null,
      })
    }
  }

  const stageOrder = resolveLeaveRouteStages(row)
  const stageName: Record<string, string> = {
    reliever: "Reliever",
    department_lead: "Department Lead",
    admin_hr_lead: "Admin & HR Lead",
    hcs: "HCS",
    md: "MD",
  }
  const currentStageKey = approvalStageKey(row.current_stage_code || row.approval_stage)
  const hasRelieverAssignee = Boolean(row.reliever?.id)
  const relieverHandledByLead =
    Boolean(row.reliever?.id) &&
    Boolean(row.supervisor?.id) &&
    row.reliever?.id === row.supervisor?.id &&
    Boolean(stageAuditMap.get("department_lead"))
  const departmentLeadApproverName = resolvePersonName(stageAuditMap.get("department_lead")?.approver)
  const advancedPastReliever = ["department_lead", "admin_hr_lead", "hcs", "md"].includes(currentStageKey)

  const lines: string[] = []
  for (const stageKey of stageOrder) {
    const item = stageAuditMap.get(stageKey)
    const stageActorName =
      resolvePersonName(item?.approver) ||
      (stageKey === "reliever"
        ? resolvePersonName(row.reliever) || null
        : stageKey === "department_lead"
          ? resolvePersonName(row.supervisor) || null
          : stageKey === "admin_hr_lead"
            ? resolvePersonName(row.approved_by_profile) || null
            : null)
    if (item) {
      lines.push(
        `${stageName[stageKey]}: ${formatName(item.status)}${stageActorName ? ` by ${stageActorName}` : ""}${item.approved_at ? ` (${formatWATDateTime(item.approved_at)})` : ""}`
      )
    } else if (stageKey === "reliever" && !hasRelieverAssignee) {
      lines.push(`${stageName[stageKey]}: Not required`)
    } else if (stageKey === "reliever" && relieverHandledByLead) {
      lines.push(`${stageName[stageKey]}: Handled by ${departmentLeadApproverName || "Department Lead"}`)
    } else if (stageKey === "reliever" && advancedPastReliever && currentStageKey !== "reliever") {
      lines.push(`${stageName[stageKey]}: Skipped by route rules`)
    } else {
      lines.push(`${stageName[stageKey]}: Pending`)
    }
  }
  return lines.join("\n")
}
