import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { resolveAdminScope, canAccessAdminSection } from "@/lib/admin/rbac"
import { archivePaymentToSharePoint, sweepPaidPaymentsForArchive } from "@/lib/payments/archive"
import { getClientId, rateLimit } from "@/lib/rate-limit"

/**
 * POST /api/payments/archive
 * Admin-only: archives unarchived payment documents for paid payments to SharePoint.
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`payments-archive:${getClientId(request)}`, { limit: 10, windowSec: 60 })
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
  const isFinanceAdmin =
    scope && (scope.role === "developer" || scope.role === "super_admin" || canAccessAdminSection(scope, "finance"))

  if (!isFinanceAdmin) {
    return NextResponse.json({ error: "Forbidden: finance admin access required" }, { status: 403 })
  }

  const dataClient = getServiceRoleClientOrFallback(supabase)
  const body = await request.json().catch(() => ({}))
  const paymentId = typeof body?.payment_id === "string" ? body.payment_id.trim() : null

  if (paymentId) {
    const result = await archivePaymentToSharePoint(dataClient, paymentId)
    return NextResponse.json({ data: result })
  }

  const sweepResult = await sweepPaidPaymentsForArchive(dataClient, 25)
  return NextResponse.json({ data: sweepResult })
}
