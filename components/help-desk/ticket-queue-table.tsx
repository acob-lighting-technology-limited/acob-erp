export interface HelpDeskTicket {
  id: string
  ticket_number: string
  title: string
  requester_department: string | null
  service_department: string
  priority: "low" | "medium" | "high" | "urgent"
  status: string
  handling_mode: "individual" | "queue" | "department" | null
  current_approval_stage: string | null
  assigned_to: string | null
  request_type: "support" | "procurement"
  sla_target_at: string | null
}

export interface EmployeeOption {
  id: string
  first_name: string
  last_name: string
  department: string | null
  employment_status?: string | null
}

export interface LeadDirectoryMember {
  id: string
  full_name: string
  role: string
  department: string | null
  lead_departments: string[]
}

function stageLabel(stage: string | null) {
  if (!stage) return "-"
  if (stage === "department_lead") return "Lead Approval"
  if (stage === "requester_department_lead") return "Lead Approval"
  if (stage === "service_department_lead") return "Lead Approval"
  if (stage === "head_corporate_services") return "HCS Approval"
  if (stage === "managing_director") return "MD Approval"
  return stage.replaceAll("_", " ")
}

function managesDepartment(
  member: { department: string | null; lead_departments: string[] },
  department: string | null
) {
  if (!department) return false
  return member.department === department || member.lead_departments.includes(department)
}

export function resolveCurrentStage(ticket: HelpDeskTicket) {
  if (ticket.status === "pending_approval") return stageLabel(ticket.current_approval_stage)
  if (ticket.status === "new") return "Intake"
  if (ticket.status === "pending_lead_review") return "Lead Approval"
  if (ticket.status === "department_queue") return "Queue Handling"
  if (ticket.status === "department_assigned") return "Department Execution"
  if (ticket.status === "assigned" || ticket.status === "in_progress") return "Execution"
  if (ticket.status === "approved_for_procurement") return "Procurement Approved"
  if (ticket.status === "rejected") return "Rejected"
  if (ticket.status === "resolved") return "Resolved"
  if (ticket.status === "closed") return "Closed"
  if (ticket.status === "cancelled") return "Cancelled"
  return "-"
}

export function resolveApproverName(ticket: HelpDeskTicket, leadDirectory: LeadDirectoryMember[]) {
  const getLeadName = (department: string | null, fallbackScope: string) => {
    const approver = leadDirectory.find((member) => managesDepartment(member, department))
    if (approver?.full_name?.trim()) return approver.full_name
    return `No lead assigned (${fallbackScope})`
  }

  if (ticket.status === "pending_approval") {
    if (ticket.current_approval_stage === "department_lead") {
      return getLeadName(ticket.service_department, ticket.service_department || "service department")
    }
    if (ticket.current_approval_stage === "requester_department_lead") {
      return getLeadName(ticket.requester_department, ticket.requester_department || "requester department")
    }
    if (ticket.current_approval_stage === "service_department_lead") {
      return getLeadName(ticket.service_department, ticket.service_department || "service department")
    }
    if (ticket.current_approval_stage === "head_corporate_services") {
      return getLeadName("Corporate Services", "Corporate Services")
    }
    if (ticket.current_approval_stage === "managing_director") {
      return getLeadName("Executive Management", "Executive Management")
    }
    return stageLabel(ticket.current_approval_stage)
  }
  if (ticket.status === "pending_lead_review") {
    return getLeadName(ticket.service_department, ticket.service_department || "service department")
  }
  if (ticket.status === "department_queue") return "-"
  if (ticket.status === "new") return "Pending Triage"
  if (ticket.status === "department_assigned" || ticket.status === "assigned" || ticket.status === "in_progress")
    return "Assigned Staff"
  return "-"
}
