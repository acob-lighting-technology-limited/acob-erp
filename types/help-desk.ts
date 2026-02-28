export type HelpDeskPriority = "low" | "medium" | "high" | "urgent"

export type HelpDeskStatus =
  | "new"
  | "assigned"
  | "in_progress"
  | "pending_approval"
  | "approved_for_procurement"
  | "rejected"
  | "resolved"
  | "closed"
  | "cancelled"

export interface HelpDeskTicket {
  id: string
  ticket_number: string
  title: string
  description: string | null
  request_type: "support" | "procurement"
  category: string | null
  service_department: string
  priority: HelpDeskPriority
  status: HelpDeskStatus
  requester_id: string
  created_by: string
  assigned_to: string | null
  assigned_by: string | null
  approval_required: boolean
  sla_target_at: string | null
  submitted_at: string
  assigned_at: string | null
  started_at: string | null
  paused_at: string | null
  resumed_at: string | null
  resolved_at: string | null
  closed_at: string | null
  csat_rating: number | null
  csat_feedback: string | null
  created_at: string
  updated_at: string
}
