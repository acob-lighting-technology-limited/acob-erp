import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { resolveAdminScope } from "@/lib/admin/rbac"
import { archiveHelpDeskTicketToSharePoint, sweepResolvedTicketsForArchive } from "@/lib/help-desk/archive"
import { getClientId, rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/help-desk/archive
 * Admin-only: archives attachments from resolved/closed help desk tickets to SharePoint.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`help-desk-archive:${getClientId(request)}`, { limit: 10, windowSec: 60 })
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const scope = await resolveAdminScope(supabase, user.id)
  const isItAdmin =
    scope &&
    (scope.role === "developer" || scope.role === "super_admin" || scope.role === "admin" || scope.isDepartmentLead)

  if (!isItAdmin) {
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 })
  }

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const body = await request.json().catch(() => ({}))
  const ticketId = typeof body?.ticket_id === "string" ? body.ticket_id.trim() : null

  if (ticketId) {
    const result = await archiveHelpDeskTicketToSharePoint(dataClient, ticketId)
    return NextResponse.json({ data: result })
  }

  const sweepResult = await sweepResolvedTicketsForArchive(dataClient, 25)
  return NextResponse.json({ data: sweepResult })
}
