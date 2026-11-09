import { NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/access/candidates")
export const dynamic = "force-dynamic"

/**
 * People who can hold /admin edit access: active staff with the admin role. Used by
 * the grant and delegation pickers. The server re-checks every grant, so this list
 * is only a convenience.
 */
export async function GET() {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  const { scope, supabase } = auth
  if (!scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const client = getServiceRoleClientOrFallback(supabase)
  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, first_name, last_name, role, department, employment_status")
    .in("role", ["admin", "super_admin", "developer"])
    .neq("employment_status", "exited")
    .neq("id", scope.userId)
    .order("full_name", { ascending: true })
    .returns<
      Array<{
        id: string
        full_name: string | null
        first_name: string | null
        last_name: string | null
        role: string
        department: string | null
      }>
    >()
  if (error) return serverError(log, error)

  return NextResponse.json({
    data: (data ?? []).map((person) => ({
      id: person.id,
      name: person.full_name?.trim() || [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unknown",
      role: person.role,
      department: person.department,
    })),
  })
}
