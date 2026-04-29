import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TicketDetailContent } from "./ticket-detail-content"
import { canLeadDepartment } from "@/lib/help-desk/server"

export default async function HelpDeskTicketPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const [profileResult, ticketResult, commentsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("role, department, is_department_lead, lead_departments")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("help_desk_tickets").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("help_desk_comments").select("*").eq("ticket_id", params.id).order("created_at", { ascending: true }),
  ])

  const [eventsResult, approvalsResult] = ticketResult.data
    ? await Promise.all([
        supabase
          .from("help_desk_events")
          .select("*")
          .eq("ticket_id", params.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("help_desk_approvals")
          .select("*")
          .eq("ticket_id", params.id)
          .order("requested_at", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }]

  const role = String(profileResult.data?.role || "").toLowerCase()
  const ticket = ticketResult.data

  if (!ticket) {
    redirect("/help-desk")
  }

  const isAdmin = ["developer", "admin", "super_admin"].includes(role)
  const canView =
    isAdmin ||
    canLeadDepartment(profileResult.data, ticket.service_department) ||
    canLeadDepartment(profileResult.data, ticket.requester_department) ||
    ticket.requester_id === user.id ||
    ticket.assigned_to === user.id

  if (!canView) {
    redirect("/help-desk")
  }

  return (
    <TicketDetailContent
      ticket={ticket}
      viewerId={user.id}
      canRate={ticket.requester_id === user.id && ["resolved", "closed"].includes(String(ticket.status))}
      events={eventsResult.data || []}
      approvals={approvalsResult.data || []}
      comments={commentsResult.data || []}
    />
  )
}
