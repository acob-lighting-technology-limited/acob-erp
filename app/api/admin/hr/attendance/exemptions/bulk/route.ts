import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { rateLimit, getClientId } from "@/lib/rate-limit"
import { requireApiAdminScope, getScopedDepartments, requireAttendanceAdmin } from "@/lib/admin/api-scope"
import {
  freezeExemptionAtToday,
  recordExemptionChange,
  snapshotExemption,
  stageExemptionChange,
  type ExemptionChange,
} from "@/lib/hr/exemptions"

const BulkExemptionSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1),
  mode: z.enum(["off", "weekly", "monthly", "infinite", "period"]),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  weeks: z.array(z.number().int().min(1).max(6)).optional(),
  months: z.array(z.string().regex(/^\d{4}-\d{2}$/)).optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  reason: z.string().max(240).optional().nullable(),
})

async function ensureAdmin(request: NextRequest) {
  const rl = await rateLimit(`admin-attendance-exemptions-bulk:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) return { error: NextResponse.json({ error: "Too many requests" }, { status: 429 }) }

  const scopeResult = await requireApiAdminScope()
  if (!scopeResult.ok) return { error: scopeResult.response }
  return { supabase: scopeResult.supabase, userId: scopeResult.scope.userId, scope: scopeResult.scope }
}

export async function PATCH(request: NextRequest) {
  const auth = await ensureAdmin(request)
  if ("error" in auth) return auth.error
  const adminOnly = requireAttendanceAdmin(auth.scope)
  if (adminOnly) return adminOnly

  const parsed = BulkExemptionSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }

  const { mode, reason } = parsed.data
  const dataClient = getServiceRoleClientOrFallback(auth.supabase)

  // Filter requested user_ids to only those within this admin/lead's department scope
  let user_ids = parsed.data.user_ids
  const depts = getScopedDepartments(auth.scope)
  if (depts !== null) {
    if (depts.length === 0) return NextResponse.json({ error: "No accessible departments" }, { status: 403 })
    const { data: scopedProfiles } = await dataClient
      .from("profiles")
      .select("id")
      .in("id", user_ids)
      .in("department", depts)
    user_ids = (scopedProfiles ?? []).map((p) => p.id)
    if (user_ids.length === 0) return NextResponse.json({ error: "No accessible employees selected" }, { status: 403 })
  }

  // "Off" freezes each exemption at today rather than wiping history (see
  // freezeExemptionAtToday). Past exempt days are preserved; nothing new going forward.
  if (mode === "off") {
    for (const userId of user_ids) {
      const before = await snapshotExemption(dataClient, userId)
      await freezeExemptionAtToday(dataClient, userId, auth.userId)
      await recordExemptionChange(dataClient, {
        userId,
        actorId: auth.userId,
        mode,
        reason,
        before,
        after: await snapshotExemption(dataClient, userId),
      })
    }
    return NextResponse.json({ message: "Exemptions stopped — history preserved up to today" })
  }

  // Two-stage rule: each person's exemption is staged and applied once confirmed.
  const change: ExemptionChange = {
    mode,
    month: parsed.data.month,
    weeks: parsed.data.weeks,
    months: parsed.data.months,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    reason,
  }
  let staged = 0
  const failures: string[] = []
  for (const userId of user_ids) {
    const result = await stageExemptionChange(dataClient, auth.scope, userId, change)
    if (result.ok) staged++
    else if (result.status === 400) return NextResponse.json({ error: result.error }, { status: 400 })
    else failures.push(result.error)
  }
  if (staged === 0 && failures.length > 0) {
    return NextResponse.json({ error: failures[0] }, { status: 409 })
  }
  return NextResponse.json({
    staged: true,
    message: `Exemption staged for ${staged} employee(s), awaiting confirmation.${failures.length ? ` ${failures.length} not staged: ${failures[0]}` : ""}`,
  })
}
