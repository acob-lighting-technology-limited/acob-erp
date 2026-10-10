import { NextResponse } from "next/server"
import { z } from "zod"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { requireStarlinkKitAccess } from "@/lib/starlink/kit-access"

export const dynamic = "force-dynamic"

const log = logger("starlink-kit-api")

const UpdateKitSchema = z
  .object({
    site_name: z.string().trim().min(1).optional(),
    state: z.string().trim().optional().nullable(),
    kit_number: z.string().trim().optional().nullable(),
    email: z.string().trim().email().optional().nullable().or(z.literal("")),
    project_id: z.string().uuid().optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .strict()

/**
 * PATCH /api/starlink/kits/[id] — rename a kit, move it to another project, or
 * mark it inactive. A project change also moves the kit's payments.
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const rl = await rateLimit(`starlink-kits:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  const access = await requireStarlinkKitAccess()
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const { dataClient, userId } = access

  const parsed = UpdateKitSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid update" }, { status: 400 })
  }
  const changes = { ...parsed.data }
  if (changes.email === "") changes.email = null
  if (changes.kit_number === "") changes.kit_number = null

  const { data: before } = await dataClient
    .from("starlink_sites")
    .select("site_name, project_id, is_active")
    .eq("id", id)
    .maybeSingle()
  if (!before) return NextResponse.json({ error: "Kit not found" }, { status: 404 })

  const { error } = await dataClient
    .from("starlink_sites")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) {
    log.error({ err: error.message }, "Failed to update Starlink kit")
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Keep the kit's payments on the same project, and their title on its name.
  const paymentChanges: Record<string, unknown> = {}
  if (changes.project_id !== undefined) paymentChanges.project_id = changes.project_id
  if (changes.site_name) paymentChanges.title = changes.site_name
  if (Object.keys(paymentChanges).length > 0) {
    const { error: paymentError } = await dataClient
      .from("department_payments")
      .update({ ...paymentChanges, updated_at: new Date().toISOString() })
      .eq("site_id", id)
    if (paymentError) log.error({ err: paymentError.message }, "Failed to carry kit change onto its payments")
  }

  await writeAuditLog(
    access.supabase,
    {
      action: "update",
      entityType: "starlink_kit",
      entityId: id,
      oldValues: before,
      newValues: changes,
      context: { actorId: userId, source: "api", route: `/api/starlink/kits/${id}` },
    },
    { failOpen: true }
  )

  return NextResponse.json({ data: { id } })
}
