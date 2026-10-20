import { NextResponse } from "next/server"
import { requireApiAdminScope } from "@/lib/admin/api-scope"
import { getServiceClient } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api-admin-hr-data-health")

export const dynamic = "force-dynamic"

const INACTIVE_DAYS = 30

type Person = { id: string; name: string; department: string | null }

/**
 * Data-health check for the HR dashboard (audit 2.4): active staff with no
 * department, departments with no lead (so nobody's leave or tasks route to a
 * manager), and people who have not signed in for 30 days. Admins only — it
 * reads every profile and the auth sign-in dates.
 */
export async function GET() {
  const auth = await requireApiAdminScope()
  if (!auth.ok) return auth.response
  if (!auth.scope.isAdminLike) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const service = getServiceClient()
  if (!service) return NextResponse.json({ error: "Not configured." }, { status: 503 })

  try {
    const [profilesRes, departmentsRes] = await Promise.all([
      service
        .from("profiles")
        .select(
          "id, first_name, last_name, department, department_id, employment_status, is_department_lead, lead_department_ids"
        )
        .neq("employment_status", "exited"),
      service.from("departments").select("id, name").eq("is_active", true),
    ])
    if (profilesRes.error) return serverError(log, profilesRes.error)
    if (departmentsRes.error) return serverError(log, departmentsRes.error)

    const profiles = profilesRes.data ?? []
    const toPerson = (p: (typeof profiles)[number]): Person => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed",
      department: p.department ?? null,
    })

    const missingDepartment = profiles.filter((p) => !p.department_id).map(toPerson)

    const ledDepartmentIds = new Set(
      profiles.flatMap((p) => (Array.isArray(p.lead_department_ids) ? (p.lead_department_ids as string[]) : []))
    )
    const departmentsWithoutLead = (departmentsRes.data ?? [])
      .filter((d) => !ledDepartmentIds.has(d.id))
      .map((d) => ({ id: d.id, name: d.name as string }))

    // Sign-in dates live in auth.users; page through the admin API. Auth rows
    // created by raw SQL (NULL token columns) make GoTrue fail the whole page
    // with "Database error finding users" — report the other checks anyway and
    // mark sign-in data unavailable rather than failing the card.
    const lastSignIn = new Map<string, string | null>()
    let signInAvailable = true
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
      if (error) {
        log.warn({ err: error.message }, "auth user list failed; sign-in check skipped")
        signInAvailable = false
        break
      }
      for (const user of data.users) lastSignIn.set(user.id, user.last_sign_in_at ?? null)
      if (data.users.length < 200) break
    }
    const cutoff = Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000
    const inactive = signInAvailable
      ? profiles
          .filter((p) => {
            const at = lastSignIn.get(p.id)
            return !at || Date.parse(at) < cutoff
          })
          .map((p) => ({ ...toPerson(p), lastSignInAt: lastSignIn.get(p.id) ?? null }))
          .sort((a, b) => (a.lastSignInAt ?? "").localeCompare(b.lastSignInAt ?? ""))
      : null

    return NextResponse.json({
      activeStaff: profiles.length,
      missingDepartment,
      departmentsWithoutLead,
      inactive,
      inactiveDays: INACTIVE_DAYS,
    })
  } catch (error) {
    return serverError(log, error)
  }
}
