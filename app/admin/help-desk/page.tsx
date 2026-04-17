import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { AdminHelpDeskContent } from "./management/admin-help-desk-content"
import {
  expandDepartmentScopeForQuery,
  getDepartmentScope,
  normalizeDepartmentName,
  resolveAdminScope,
} from "@/lib/admin/rbac"
import { listAssignableProfiles } from "@/lib/workforce/assignment-policy"
import type { EmployeeOption, HelpDeskTicket, LeadDirectoryMember } from "@/components/help-desk/ticket-queue-table"

type HelpDeskTicketRow = HelpDeskTicket & {
  requester_id: string
  current_approval_stage?: string | null
  requester_department?: string | null
}

const STAGE_ORDER = [
  "requester_department_lead",
  "service_department_lead",
  "head_corporate_services",
  "managing_director",
] as const

function normalizeApprovalStage(stage: string | null | undefined) {
  if (!stage) return null
  if (stage === "department_lead") return "service_department_lead"
  return stage
}

function stageRank(stage: string | null | undefined) {
  const normalized = normalizeApprovalStage(stage)
  if (!normalized) return Number.MAX_SAFE_INTEGER
  const rank = STAGE_ORDER.indexOf(normalized as (typeof STAGE_ORDER)[number])
  return rank >= 0 ? rank : Number.MAX_SAFE_INTEGER
}

async function getData() {
  const supabase = await createClient()
  const dataClient = getServiceRoleClientOrFallback(supabase)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { redirectTo: "/auth/login" as const }
  }

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope) {
    return { redirectTo: "/profile" as const }
  }
  const departmentScope = getDepartmentScope(scope, "general")
  const queryDepartmentScope = departmentScope ? expandDepartmentScopeForQuery(departmentScope) : null

  let ticketsQuery = dataClient.from("help_desk_tickets").select("*").order("created_at", { ascending: false })
  if (queryDepartmentScope && queryDepartmentScope.length === 0) {
    ticketsQuery = ticketsQuery.eq("id", "__none__")
  }

  const [{ data: tickets }, { data: employees }] = await Promise.all([
    ticketsQuery,
    listAssignableProfiles(dataClient, {
      select: "id, first_name, last_name, department, employment_status",
      departmentScope: queryDepartmentScope,
      allowLegacyNullStatus: false,
    }),
  ])

  const requesterIds = Array.from(
    new Set(((tickets as HelpDeskTicketRow[] | null) || []).map((t) => t.requester_id).filter(Boolean))
  )
  const { data: requesterProfiles } =
    requesterIds.length > 0
      ? await dataClient.from("profiles").select("id, department").in("id", requesterIds)
      : { data: [] as Array<{ id: string; department: string | null }> }
  const requesterDepartmentMap = new Map(
    ((requesterProfiles as Array<{ id: string; department: string | null }> | null) || []).map((row) => [
      row.id,
      row.department || null,
    ])
  )

  const enrichedTickets = ((tickets as HelpDeskTicketRow[] | null) || []).map((ticket) => ({
    ...ticket,
    requester_department: requesterDepartmentMap.get(ticket.requester_id) || null,
  })) as HelpDeskTicketRow[]

  const ticketIds = enrichedTickets.map((ticket) => ticket.id).filter(Boolean)
  const { data: pendingApprovals } =
    ticketIds.length > 0
      ? await dataClient
          .from("help_desk_approvals")
          .select("ticket_id, approval_stage, status, requested_at")
          .in("ticket_id", ticketIds)
          .eq("status", "pending")
          .order("requested_at", { ascending: true })
      : {
          data: [] as Array<{
            ticket_id: string
            approval_stage: string | null
            status: string
            requested_at: string | null
          }>,
        }
  const pendingStageByTicketId = new Map<string, string>()
  for (const approval of pendingApprovals || []) {
    const normalizedStage = normalizeApprovalStage(approval.approval_stage)
    if (!normalizedStage) continue
    const existing = pendingStageByTicketId.get(approval.ticket_id)
    if (!existing || stageRank(normalizedStage) < stageRank(existing)) {
      pendingStageByTicketId.set(approval.ticket_id, normalizedStage)
    }
  }
  const ticketsWithStage = enrichedTickets.map((ticket) => ({
    ...ticket,
    current_approval_stage:
      normalizeApprovalStage(ticket.current_approval_stage) || pendingStageByTicketId.get(ticket.id) || null,
  }))

  const { data: leadDirectoryRows } = await listAssignableProfiles(dataClient, {
    select:
      "id, full_name, first_name, last_name, role, department, is_department_lead, lead_departments, employment_status",
    leadOnly: true,
  })
  const leadDirectory = (
    (leadDirectoryRows as Array<{
      id: string
      full_name: string | null
      first_name: string | null
      last_name: string | null
      role: string | null
      department: string | null
      lead_departments: string[] | null
    }> | null) || []
  ).map((profile) => ({
    id: profile.id,
    full_name:
      profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || "Unnamed Lead",
    role: profile.role || "",
    department: profile.department || null,
    lead_departments: Array.isArray(profile.lead_departments) ? profile.lead_departments : [],
  })) as LeadDirectoryMember[]

  const scopedDepartments = departmentScope
    ? new Set(departmentScope.map((departmentName) => normalizeDepartmentName(departmentName)))
    : null
  const scopedTickets = departmentScope
    ? ticketsWithStage.filter((ticket) => {
        const serviceDepartment = normalizeDepartmentName(ticket.service_department || "")
        const requesterDepartment = normalizeDepartmentName(ticket.requester_department || "")
        return Boolean(scopedDepartments?.has(serviceDepartment) || scopedDepartments?.has(requesterDepartment))
      })
    : ticketsWithStage

  return {
    tickets: scopedTickets,
    employees: employees,
    leadDirectory,
    viewer: {
      id: user.id,
      role: scope.role,
      department: scope.department,
      is_department_lead: scope.isDepartmentLead,
      lead_departments: scope.leadDepartments,
      managed_departments: scope.managedDepartments,
    },
  }
}

export default async function AdminHelpDeskPage() {
  const data = await getData()

  if ("redirectTo" in data) {
    redirect(data.redirectTo || "/auth/login")
  }

  return (
    <AdminHelpDeskContent
      initialTickets={data.tickets as HelpDeskTicket[]}
      employees={data.employees as EmployeeOption[]}
      leadDirectory={data.leadDirectory as LeadDirectoryMember[]}
      viewer={data.viewer}
    />
  )
}
