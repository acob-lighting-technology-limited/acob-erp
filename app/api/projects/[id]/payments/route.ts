import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { expandDepartmentScopeForQuery, getDepartmentScope, resolveAdminScope } from "@/lib/admin/rbac"
import { logger } from "@/lib/logger"
import type { ProjectKitRow, ProjectPaymentRow } from "@/lib/projects/project-payments"

export const dynamic = "force-dynamic"
const log = logger("project-payments-api")

type DbClient = Awaited<ReturnType<typeof createClient>>

/**
 * GET /api/projects/[id]/payments — the Starlink kits serving a project and the
 * payments charged to it. Admin surfaces only; payments follow the finance scope
 * the payments list uses.
 */
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const scope = await resolveAdminScope(supabase as DbClient, user.id)
  if (!scope) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const scopedDepartments = getDepartmentScope(scope, "finance")
  if (scopedDepartments && scopedDepartments.length === 0) {
    return NextResponse.json({ data: { kits: [], payments: [] } })
  }

  const dataClient = getServiceRoleClientOrFallback(supabase)

  let departmentIds: string[] | null = null
  if (scopedDepartments) {
    const { data: deptRows } = await dataClient
      .from("departments")
      .select("id")
      .in("name", expandDepartmentScopeForQuery(scopedDepartments))
    departmentIds = (deptRows || []).map((row: { id: string }) => row.id)
    if (departmentIds.length === 0) return NextResponse.json({ data: { kits: [], payments: [] } })
  }

  let paymentsQuery = dataClient
    .from("department_payments")
    .select(
      "id, title, category, payment_type, amount, amount_paid, currency, status, next_payment_due, payment_date, site_id, documents:payment_documents(document_type, applicable_date)"
    )
    .eq("project_id", id)
    .neq("status", "cancelled")
    .order("title")
  if (departmentIds) paymentsQuery = paymentsQuery.in("department_id", departmentIds)

  const [kitsRes, paymentsRes] = await Promise.all([
    dataClient
      .from("starlink_sites")
      .select("id, site_name, state, serial_number, kit_number, is_active")
      .eq("project_id", id)
      .order("site_name"),
    paymentsQuery,
  ])

  // 42703 = column missing: the linking migration is not live yet, so nothing is linked.
  const firstError = [kitsRes.error, paymentsRes.error].find((e) => e && e.code !== "42703")
  if (firstError) {
    log.error({ err: firstError.message, projectId: id }, "Failed to load project payments")
    return NextResponse.json({ error: "Failed to load project payments" }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      kits: (kitsRes.error ? [] : kitsRes.data || []) as ProjectKitRow[],
      payments: (paymentsRes.error ? [] : paymentsRes.data || []) as ProjectPaymentRow[],
    },
  })
}
