import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { serverError } from "@/lib/api/errors"
import { loadOwnAssignment } from "@/lib/assets/staff-assignment"
import { logger } from "@/lib/logger"

const log = logger("api/assets/assignments/id/accept")

export const dynamic = "force-dynamic"

const ParamsSchema = z.object({ id: z.string().uuid() })

/**
 * The signed-in person confirms they received an asset assigned to them. Also allowed after it was
 * counted as accepted automatically, which upgrades it to a real confirmation. Idempotent.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const parsedParams = ParamsSchema.safeParse(await params)
  if (!parsedParams.success) return NextResponse.json({ error: "Invalid assignment" }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = getServiceRoleClientOrFallback(supabase)
  const { row, error } = await loadOwnAssignment(db, parsedParams.data.id, user.id)
  if (error) return serverError(log, error)
  if (!row) return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
  if (!row.is_current) {
    return NextResponse.json({ error: "This asset is no longer assigned to you" }, { status: 409 })
  }
  if (row.acceptance_status === "accepted") return NextResponse.json({ ok: true })
  if (row.acceptance_status === "disputed") {
    return NextResponse.json(
      { error: "You reported that you did not receive this asset. An asset admin is looking into it." },
      { status: 409 }
    )
  }
  if (row.acceptance_status !== "pending" && row.acceptance_status !== "auto_accepted") {
    return NextResponse.json({ error: "This assignment does not need confirming" }, { status: 409 })
  }

  const { error: updateError } = await db
    .from("asset_assignments")
    .update({ acceptance_status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("acceptance_status", row.acceptance_status)
  if (updateError) return serverError(log, updateError)
  return NextResponse.json({ ok: true })
}
