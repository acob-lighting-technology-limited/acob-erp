import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getScopedDepartments, requireApiAdminScope } from "@/lib/admin/api-scope"
import { scopeCanEditRoute } from "@/lib/admin/rbac"
import { serverError, validationError } from "@/lib/api/errors"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { employeeDateEditSchema } from "@/lib/hr/employee-date-edit"
import { logger } from "@/lib/logger"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"

const log = logger("admin-hr-employee-dates")

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  const { scope, supabase } = auth
  const departments = getScopedDepartments(scope)
  if (!scope.isAdminLike || !scopeCanEditRoute(scope, "hr.employees") || departments?.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId } = await params
  if (!z.string().uuid().safeParse(userId).success)
    return NextResponse.json({ error: "Invalid employee" }, { status: 400 })

  const parsed = employeeDateEditSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return validationError(parsed.error.issues)
  const { field, value } = parsed.data

  const update = { [field]: value || null }
  const db = getServiceRoleClientOrFallback(supabase)
  let query = db
    .from("profiles")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", userId)
  if (departments) query = query.in("department", departments)
  const { data, error } = await query.select("id").maybeSingle()
  if (error) return serverError(log, error, "Could not save employee date")
  if (!data) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  await writeAuditLog(
    supabase,
    {
      action: "update",
      entityType: "profile",
      entityId: userId,
      newValues: update,
      context: { actorId: scope.userId, source: "api", route: "/api/admin/hr/employees/[userId]/dates" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ data })
}
