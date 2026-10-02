import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { writeAuditLog } from "@/lib/audit/write-audit"
import { logger } from "@/lib/logger"
import { serverError, validationError } from "@/lib/api/errors"
import { getClientId, rateLimit } from "@/lib/rate-limit"

const log = logger("feedback-item-route")

const UpdateFeedbackSchema = z.object({
  feedbackType: z.enum(["concern", "complaint", "suggestion", "required_item"]),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).optional().nullable(),
})

type FeedbackRow = {
  id: string
  user_id: string | null
  feedback_type: string
  title: string
  description: string | null
}

/**
 * Loads the feedback row and confirms the caller submitted it. Anonymous and
 * someone else's feedback both return 404 so ids cannot be probed.
 */
async function loadOwnFeedback(request: NextRequest, id: string) {
  const rl = await rateLimit(`feedback-item:${getClientId(request)}`, { limit: 30, windowSec: 60 })
  if (!rl.allowed) return { response: NextResponse.json({ error: "Too many requests" }, { status: 429 }) }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }

  const db = getServiceRoleClientOrFallback(supabase)
  const { data: row, error } = await db
    .from("feedback")
    .select("id, user_id, feedback_type, title, description")
    .eq("id", id)
    .maybeSingle<FeedbackRow>()
  if (error) return { response: serverError(log, error, "Could not load feedback") }
  if (!row || row.user_id !== user.id) {
    return { response: NextResponse.json({ error: "Feedback not found" }, { status: 404 }) }
  }
  return { supabase, db, userId: user.id, row }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnFeedback(request, id)
  if ("response" in ctx) return ctx.response

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    // validated below
  }
  const parsed = UpdateFeedbackSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const newValues = {
    feedback_type: parsed.data.feedbackType,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
  }
  const { error } = await ctx.db
    .from("feedback")
    .update({ ...newValues, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return serverError(log, error, "Could not update feedback")

  await writeAuditLog(
    ctx.supabase,
    {
      action: "update",
      entityType: "feedback",
      entityId: id,
      oldValues: { feedback_type: ctx.row.feedback_type, title: ctx.row.title, description: ctx.row.description },
      newValues,
      context: { actorId: ctx.userId, source: "api", route: "/api/feedback/[id]" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnFeedback(request, id)
  if ("response" in ctx) return ctx.response

  const { error } = await ctx.db.from("feedback").delete().eq("id", id)
  if (error) return serverError(log, error, "Could not delete feedback")

  await writeAuditLog(
    ctx.supabase,
    {
      action: "delete",
      entityType: "feedback",
      entityId: id,
      oldValues: { feedback_type: ctx.row.feedback_type, title: ctx.row.title, description: ctx.row.description },
      context: { actorId: ctx.userId, source: "api", route: "/api/feedback/[id]" },
    },
    { failOpen: true }
  )
  return NextResponse.json({ ok: true })
}
