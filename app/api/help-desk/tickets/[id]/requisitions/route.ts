import { NextRequest, NextResponse } from "next/server"
import { apiError, ApiErrorCode } from "@/lib/api/errors"
import { getViewerContext } from "@/lib/requisitions/server"
import { requireRequisitionUser, requisitionErrorResponse } from "@/lib/requisitions/route-helpers"
import { normalizeDepartmentName } from "@/shared/departments"

/**
 * GET /api/help-desk/tickets/[id]/requisitions — requisitions raised for a
 * ticket, as a summary (reference, form, amount, status) for the ticket's
 * people. Bank details and the approval trail stay on the requisition itself.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRequisitionUser()
  if ("error" in auth) return auth.error
  const { user, admin } = auth
  const { id } = await params

  try {
    const [{ data: ticket }, viewer] = await Promise.all([
      admin
        .from("help_desk_tickets")
        .select("id, requester_id, assigned_to, service_department")
        .eq("id", id)
        .maybeSingle(),
      getViewerContext(admin, user.id),
    ])
    const canSee =
      ticket &&
      (ticket.requester_id === user.id ||
        ticket.assigned_to === user.id ||
        viewer.isAdminLike ||
        viewer.leadDepartments.includes(normalizeDepartmentName(ticket.service_department)))
    if (!canSee) return apiError("Ticket not found", ApiErrorCode.NOT_FOUND, 404)

    const { data, error } = await admin
      .from("requisitions")
      .select(
        "id, requisition_number, form_type, amount, amount_paid, status, created_at, requester:profiles!requisitions_user_id_fkey(full_name)"
      )
      .eq("help_desk_ticket_id", id)
      .order("created_at", { ascending: true })
    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (err) {
    return requisitionErrorResponse(err, "Failed to load ticket requisitions")
  }
}
