export interface HelpDeskTicket {
  id: string
  ticket_number: string
  title: string
  service_department: string
  request_type: "support" | "procurement"
  priority: "low" | "medium" | "high" | "urgent"
  status: string
  assigned_to: string | null
  requester_id: string
  created_at: string
  resolved_at: string | null
  csat_rating: number | null
  handling_mode?: string | null
  support_mode?: string | null
  requester_department?: string | null
}

export interface HelpDeskTicketDetailResponse {
  ticket: HelpDeskTicket & {
    description?: string | null
    category?: string | null
    category_id?: string | null
    created_by?: string | null
    updated_at?: string | null
    closed_at?: string | null
    csat_feedback?: string | null
  }
  comments: Array<{
    id: string
    body?: string | null
    comment?: string | null
    created_at?: string | null
    actor_id?: string | null
  }>
  approvals: Array<{
    id: string
    approval_stage?: string | null
    status?: string | null
    decision_notes?: string | null
    requested_at?: string | null
    decided_at?: string | null
  }>
  events: Array<{
    id: string
    event_type?: string | null
    old_status?: string | null
    new_status?: string | null
    created_at?: string | null
  }>
}

export interface HelpDeskContentProps {
  userId: string
  userDepartment: string | null
  canReviewPendingApprovals: boolean
  initialDepartments: string[]
  initialTickets: HelpDeskTicket[]
  initialError?: string | null
}
