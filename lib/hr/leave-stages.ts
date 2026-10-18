import { formatName } from "@/lib/utils"

export type RouteSnapshotStage = {
  stage_order?: number | null
  stage_code?: string | null
  approver_role_code?: string | null
  approver_user_id?: string | null
}

export function approvalStageKey(code?: string | null): string {
  const value = String(code || "").toLowerCase()
  if (value.includes("reliever")) return "reliever"
  if (value.includes("department_lead") || value.includes("supervisor")) return "department_lead"
  if (value.includes("admin_hr_lead") || value.includes("hr_pending")) return "admin_hr_lead"
  if (value.includes("hcs")) return "hcs"
  if (value.includes("md")) return "md"
  return value || "unknown"
}

export function approvalStageLabel(code?: string | null): string {
  const value = String(code || "").toLowerCase()
  if (value.includes("reliever")) return "Reliever"
  if (value.includes("department_lead") || value.includes("supervisor")) return "Department Lead"
  if (value.includes("admin_hr_lead") || value.includes("hr_pending")) return "Admin and HR Lead"
  if (value.includes("hcs")) return "HCS"
  if (value.includes("md")) return "MD"
  return formatName(code || "Stage")
}

export const LEAVE_STAGE_NAMES: Record<string, string> = {
  reliever: "Reliever",
  department_lead: "Department Lead",
  admin_hr_lead: "Admin and HR Lead",
  hcs: "Head, Corporate Services (HCS)",
  md: "Managing Director (MD)",
}

export function resolveLeaveRouteStages(
  leave?: {
    route_snapshot?: RouteSnapshotStage[] | null
    requester_route_kind?: string | null
    approvals?: Array<{ stage_code?: string | null }> | null
    current_stage_code?: string | null
    approval_stage?: string | null
    reliever_id?: string | null
    reliever?: { id?: string | null } | null
  } | null
): string[] {
  if (!leave) return ["reliever", "department_lead", "admin_hr_lead", "md"]

  // 1. If route_snapshot is populated, it is the authoritative source of truth.
  if (Array.isArray(leave.route_snapshot) && leave.route_snapshot.length > 0) {
    const sorted = [...leave.route_snapshot].sort((a, b) => (Number(a.stage_order) || 0) - (Number(b.stage_order) || 0))
    const stages = sorted
      .map((s) => approvalStageKey(s.approver_role_code || s.stage_code))
      .filter((k) => k && k !== "unknown")

    // Also ensure any approved stage from historical approvals is included if missing
    if (Array.isArray(leave.approvals)) {
      for (const app of leave.approvals) {
        const key = approvalStageKey(app.stage_code)
        if (key && key !== "unknown" && !stages.includes(key)) {
          stages.push(key)
        }
      }
    }

    if (stages.length > 0) {
      return Array.from(new Set(stages))
    }
  }

  // 2. Fallback based on requester_route_kind when route_snapshot is missing (legacy records)
  const kind = String(leave.requester_route_kind || "").toLowerCase()
  let stages: string[]
  if (kind === "dept_lead") {
    stages = ["reliever", "admin_hr_lead", "md"]
  } else if (kind === "admin_hr_lead") {
    stages = ["reliever", "hcs", "md"]
  } else if (kind === "hcs") {
    stages = ["reliever", "admin_hr_lead", "md"]
  } else if (kind === "md") {
    stages = ["reliever", "admin_hr_lead"]
  } else {
    // standard employee: reliever -> dept_lead -> hr_lead -> md (NO HCS)
    stages = ["reliever", "department_lead", "admin_hr_lead", "md"]
  }

  // If reliever was not assigned for this request, omit reliever
  const hasReliever = Boolean(leave.reliever_id || leave.reliever?.id)
  if (!hasReliever) {
    stages = stages.filter((s) => s !== "reliever")
  }

  // If there's an approval for a stage not in the default list, include it
  if (Array.isArray(leave.approvals)) {
    for (const app of leave.approvals) {
      const key = approvalStageKey(app.stage_code)
      if (key && key !== "unknown" && !stages.includes(key)) {
        stages.push(key)
      }
    }
  }

  return Array.from(new Set(stages))
}
