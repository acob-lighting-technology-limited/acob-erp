import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { canAccessAdminSection, resolveAdminScope } from "@/lib/admin/rbac"
import { EDIT_AREAS, EDIT_AREA_LABELS } from "@/lib/admin/policy-v2"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { serverError } from "@/lib/api/errors"
import { logger } from "@/lib/logger"

const log = logger("api/admin/dev/area-owners")
export const dynamic = "force-dynamic"

const ADMIN_ROLES = ["admin", "super_admin", "developer"]

const AddSchema = z.object({
  area: z.enum(EDIT_AREAS as unknown as [string, ...string[]]),
  userId: z.string().uuid("Invalid user id"),
})

type NameRow = { id: string; full_name: string | null; first_name: string | null; last_name: string | null }

function nameOf(row: NameRow | undefined) {
  if (!row) return "Unknown"
  return row.full_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Unknown"
}

/** Developer area only: the same gate as the rest of /admin/dev. */
async function requireDeveloper() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const scope = await resolveAdminScope(supabase, user.id)
  if (!scope || !canAccessAdminSection(scope, "dev")) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true as const, supabase, userId: user.id }
}

/** GET: every owner of every guarded area, and the people who can be named. */
export async function GET() {
  const auth = await requireDeveloper()
  if (!auth.ok) return auth.response
  const client = getServiceRoleClientOrFallback(auth.supabase)

  const { data: owners, error } = await client
    .from("edit_area_owners")
    .select("id, area, user_id, added_by, created_at")
    .order("created_at", { ascending: true })
    .returns<Array<{ id: string; area: string; user_id: string; added_by: string | null; created_at: string }>>()
  if (error) return serverError(log, error)

  const { data: people, error: peopleError } = await client
    .from("profiles")
    .select("id, full_name, first_name, last_name, role, department, employment_status")
    .in("role", ADMIN_ROLES)
    .neq("employment_status", "exited")
    .order("full_name", { ascending: true })
    .returns<Array<NameRow & { role: string; department: string | null }>>()
  if (peopleError) return serverError(log, peopleError)

  const names = new Map((people ?? []).map((person) => [person.id, nameOf(person)]))
  const missing = Array.from(
    new Set((owners ?? []).flatMap((row) => [row.user_id, row.added_by]).filter(Boolean) as string[])
  ).filter((id) => !names.has(id))
  if (missing.length > 0) {
    const { data: extra } = await client
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("id", missing)
      .returns<NameRow[]>()
    for (const person of extra ?? []) names.set(person.id, nameOf(person))
  }

  return NextResponse.json({
    data: {
      owners: (owners ?? []).map((row) => ({
        id: row.id,
        area: row.area,
        area_label: EDIT_AREA_LABELS[row.area as keyof typeof EDIT_AREA_LABELS] ?? row.area,
        user_id: row.user_id,
        owner_name: names.get(row.user_id) ?? "Unknown",
        added_by_name: row.added_by ? (names.get(row.added_by) ?? "Unknown") : "Set up from the leads",
        created_at: row.created_at,
      })),
      candidates: (people ?? []).map((person) => ({
        id: person.id,
        name: nameOf(person),
        role: person.role,
        department: person.department,
      })),
      areas: EDIT_AREAS.map((area) => ({ value: area, label: EDIT_AREA_LABELS[area] })),
    },
  })
}

/** POST: name an owner of an area. They must hold an admin-side role. */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(`admin-dev-area-owners:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })

  const auth = await requireDeveloper()
  if (!auth.ok) return auth.response
  const client = getServiceRoleClientOrFallback(auth.supabase)

  const parsed = AddSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 })
  }
  const { area, userId } = parsed.data

  const { data: person } = await client
    .from("profiles")
    .select("id, full_name, first_name, last_name, role, employment_status")
    .eq("id", userId)
    .maybeSingle<NameRow & { role: string | null; employment_status: string | null }>()
  if (!person || person.employment_status === "exited" || !ADMIN_ROLES.includes(String(person.role ?? ""))) {
    return NextResponse.json({ error: "An owner must be an active admin, super admin or developer." }, { status: 400 })
  }

  const { data: created, error } = await client
    .from("edit_area_owners")
    .upsert({ area, user_id: userId, added_by: auth.userId }, { onConflict: "area,user_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle<{ id: string }>()
  if (error) return serverError(log, error)

  await writeAuditLog(
    auth.supabase,
    {
      action: "create",
      entityType: "edit_area_owner",
      entityId: created?.id ?? userId,
      newValues: { area, owner: nameOf(person) },
      context: { actorId: auth.userId, source: "api", route: "/api/admin/dev/area-owners" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ ok: true })
}

/** DELETE: remove an owner. An area always keeps at least one, so nobody is locked out of it. */
export async function DELETE(request: NextRequest) {
  const auth = await requireDeveloper()
  if (!auth.ok) return auth.response
  const client = getServiceRoleClientOrFallback(auth.supabase)

  const id = z.string().uuid().safeParse(request.nextUrl.searchParams.get("id"))
  if (!id.success) return NextResponse.json({ error: "An owner id is required" }, { status: 400 })

  const { data: row } = await client
    .from("edit_area_owners")
    .select("id, area, user_id")
    .eq("id", id.data)
    .maybeSingle<{ id: string; area: string; user_id: string }>()
  if (!row) return NextResponse.json({ error: "Owner not found" }, { status: 404 })

  const { count } = await client
    .from("edit_area_owners")
    .select("id", { count: "exact", head: true })
    .eq("area", row.area)
  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: "An area must keep at least one owner. Add the new owner first." },
      { status: 400 }
    )
  }

  const { error } = await client.from("edit_area_owners").delete().eq("id", row.id)
  if (error) return serverError(log, error)

  await writeAuditLog(
    auth.supabase,
    {
      action: "delete",
      entityType: "edit_area_owner",
      entityId: row.id,
      oldValues: { area: row.area, owner_id: row.user_id },
      context: { actorId: auth.userId, source: "api", route: "/api/admin/dev/area-owners" },
    },
    { failOpen: true }
  )

  return NextResponse.json({ ok: true })
}
