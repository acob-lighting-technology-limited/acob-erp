import { NextResponse } from "next/server"
import { canAccessAdminSection, resolveAdminScope } from "@/lib/admin/rbac"
import { loadEmployeeMailboxState } from "@/lib/employees/mailbox-offboarding"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/hr/employees/[userId]/mailbox — the employee's cPanel mailbox
 * (exists, login suspended, forwards, suggested forward target), for the
 * Change Status dialog.
 */
export async function GET(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope || !canAccessAdminSection(scope, "hr")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const state = await loadEmployeeMailboxState(getServiceRoleClientOrFallback(supabase), String(userId || "").trim())
  return NextResponse.json({ data: state })
}
