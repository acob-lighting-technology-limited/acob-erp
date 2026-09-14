import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { getEventsSession } from "@/lib/events/server"
import { loadDelegates, loadMdDeskAccess } from "@/lib/md-desk/server"

export const dynamic = "force-dynamic"
const log = logger("api-md-desk-delegates")

const DelegateSchema = z.object({
  profile_id: z.string().uuid(),
  can_edit: z.boolean().default(true),
})

// Delegates who share the MD's Desk. RLS on md_desk_delegates lets desk members
// read the list and only the MD (or an admin) change it; writes run as the caller.
export async function GET() {
  const session = await getEventsSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const access = await loadMdDeskAccess(session)
  if (!access.isMember && !access.canManageDelegates) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    return NextResponse.json({ delegates: await loadDelegates(session), access })
  } catch (err) {
    log.error({ err }, "Failed to load delegates")
    return NextResponse.json({ error: "Failed to load delegates" }, { status: 500 })
  }
}

async function guardWrite(request: NextRequest) {
  const rl = await rateLimit(`md-desk-delegates:${getClientId(request)}`, { limit: 20, windowSec: 60 })
  if (!rl.allowed) return { error: NextResponse.json({ error: "Too many requests" }, { status: 429 }) }
  const session = await getEventsSession()
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const access = await loadMdDeskAccess(session)
  if (!access.canManageDelegates) {
    return { error: NextResponse.json({ error: "Only the MD can change delegates" }, { status: 403 }) }
  }
  return { session }
}

export async function POST(request: NextRequest) {
  const guard = await guardWrite(request)
  if ("error" in guard) return guard.error
  const { session } = guard

  const parsed = DelegateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Pick a staff member" }, { status: 400 })

  const { error } = await session.supabase
    .from("md_desk_delegates")
    .upsert({ profile_id: parsed.data.profile_id, can_edit: parsed.data.can_edit, granted_by: session.userId })
  if (error) {
    log.error({ err: error }, "Failed to add delegate")
    return NextResponse.json({ error: "Failed to add delegate" }, { status: error.code === "42501" ? 403 : 500 })
  }

  await writeAuditLog(
    session.supabase,
    {
      action: "assign",
      entityType: "md_desk_delegate",
      entityId: parsed.data.profile_id,
      newValues: { can_edit: parsed.data.can_edit },
      context: { actorId: session.userId, source: "api", route: "/api/md-desk/delegates" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const guard = await guardWrite(request)
  if ("error" in guard) return guard.error
  const { session } = guard

  const profileId = new URL(request.url).searchParams.get("profile_id") || ""
  if (!z.string().uuid().safeParse(profileId).success) {
    return NextResponse.json({ error: "Invalid delegate" }, { status: 400 })
  }

  const { data, error } = await session.supabase
    .from("md_desk_delegates")
    .delete()
    .eq("profile_id", profileId)
    .select("profile_id")
  if (error) {
    log.error({ err: error }, "Failed to remove delegate")
    return NextResponse.json({ error: "Failed to remove delegate" }, { status: 500 })
  }
  if (!data || data.length === 0) return NextResponse.json({ error: "Delegate not found" }, { status: 404 })

  await writeAuditLog(
    session.supabase,
    {
      action: "unassign",
      entityType: "md_desk_delegate",
      entityId: profileId,
      context: { actorId: session.userId, source: "api", route: "/api/md-desk/delegates" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ ok: true })
}
