"use client"

import { Badge } from "@/components/ui/badge"
import { formatName } from "@/lib/utils"
import type { RouteSnapshotStage } from "@/lib/hr/leave-stages"

/** Leave request item types and the stage/approver display helpers shared by the leave approvals page and its dialogs. Split from leave/view.tsx (audit 6.1). */
export interface LeaveItem {
  id: string
  user_id: string
  start_date: string
  end_date: string
  resume_date: string
  days_count: number
  reason: string
  handover_note?: string | null
  handover_checklist_url?: string | null
  status: string
  approval_stage: string
  current_stage_code?: string
  current_stage_order?: number
  current_approver_user_id?: string
  reliever_id?: string | null
  supervisor_id?: string | null
  created_at: string
  admin_manual?: boolean | null
  approved_at?: string | null
  user?: {
    id?: string
    first_name?: string | null
    last_name?: string | null
    full_name: string
    company_email: string
    department?: string
  }
  reliever?: {
    id?: string
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
    company_email?: string | null
  } | null
  supervisor?: {
    id?: string
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
    company_email?: string | null
  } | null
  approved_by_profile?: {
    id?: string
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
    company_email?: string | null
  } | null
  leave_type?: { name: string }
  current_approver?: { id: string; full_name: string; company_email: string; role?: string | null } | null
  approvals?: Array<{
    id: string
    approver_id?: string | null
    approval_level?: number | null
    status?: string | null
    comments?: string | null
    approved_at?: string | null
    stage_code?: string | null
    stage_order?: number | null
    approver?: {
      id?: string
      full_name?: string | null
      first_name?: string | null
      last_name?: string | null
      company_email?: string | null
    } | null
  }>
  evidence?: Array<{
    id: string
    document_type: string
    file_url: string
    status: "pending" | "verified" | "rejected"
    notes?: string | null
  }>
  required_documents?: string[]
  missing_documents?: string[]
  evidence_complete?: boolean
  requester_route_kind?: string | null
  route_snapshot?: RouteSnapshotStage[] | null
}

export interface LeaveActionHistoryItem {
  id: string
  leave_request_id: string
  status?: string | null
  comments?: string | null
  approved_at?: string | null
  stage_code?: string | null
  request?: LeaveItem | null
}

export type PersonNameRef = {
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  company_email?: string | null
}

export const STAGE_LABELS: Record<string, string> = {
  pending_reliever: "Waiting Reliever",
  pending_department_lead: "Waiting Department Lead",
  pending_admin_hr_lead: "Waiting Admin and HR Lead",
  pending_md: "Waiting MD",
  pending_hcs: "Waiting HCS",
  reliever_pending: "Waiting Reliever",
  supervisor_pending: "Waiting Department Lead",
  hr_pending: "Waiting Admin and HR Lead",
  completed: "Completed",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

export function expectedApproverLabel(item: LeaveItem) {
  const status = String(item.status || "").toLowerCase()
  if (["approved", "completed", "rejected", "cancelled"].includes(status)) {
    return "-"
  }
  if (item.current_approver?.full_name) return item.current_approver.full_name
  const stage = item.current_stage_code || item.approval_stage
  const expectedByStage: Record<string, string> = {
    pending_reliever: "Assigned Reliever",
    reliever_pending: "Assigned Reliever",
    pending_department_lead: "Department Lead",
    supervisor_pending: "Department Lead",
    pending_admin_hr_lead: "Admin and HR Lead",
    hr_pending: "Admin and HR Lead",
    pending_md: "Managing Director (MD)",
    pending_hcs: "Head, Corporate Services (HCS)",
  }
  return expectedByStage[stage] || "Pending approver"
}

export function getStageBadge(item: LeaveItem) {
  const rawStage = item.current_stage_code || item.approval_stage || ""
  const stage = rawStage.toLowerCase()
  const label = STAGE_LABELS[rawStage] || rawStage

  let colorClass = "bg-muted/10 text-muted-foreground border-muted-foreground/20"
  if (stage.includes("reliever")) {
    colorClass = "bg-purple-500/10 text-purple-500 border-purple-500/20"
  } else if (stage.includes("department_lead") || stage.includes("supervisor")) {
    colorClass = "bg-amber-500/10 text-amber-500 border-amber-500/20"
  } else if (stage.includes("admin_hr_lead") || stage.includes("hr_pending")) {
    colorClass = "bg-blue-500/10 text-blue-500 border-blue-500/20"
  } else if (stage.includes("md")) {
    colorClass = "bg-rose-500/10 text-rose-500 border-rose-500/20"
  } else if (stage.includes("hcs")) {
    colorClass = "bg-violet-500/10 text-violet-500 border-violet-500/20"
  } else if (stage === "completed" || stage === "approved") {
    colorClass = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  } else if (stage === "rejected") {
    colorClass = "bg-red-500/10 text-red-500 border-red-500/20"
  } else if (stage === "cancelled") {
    colorClass = "bg-muted/10 text-muted-foreground border-muted-foreground/20"
  }

  return (
    <Badge variant="outline" className={colorClass}>
      {label}
    </Badge>
  )
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

export function approvalStageLabel(code?: string | null) {
  const value = String(code || "").toLowerCase()
  if (value.includes("reliever")) return "Reliever"
  if (value.includes("department_lead")) return "Department Lead"
  if (value.includes("admin_hr_lead")) return "Admin and HR Lead"
  if (value.includes("hcs")) return "HCS"
  if (value.includes("md")) return "MD"
  return formatName(code || "Stage")
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
