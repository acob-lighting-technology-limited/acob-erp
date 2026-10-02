import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"
import { serverError, validationError } from "@/lib/api/errors"
import { getClientId, rateLimit } from "@/lib/rate-limit"

const log = logger("api-notifications")

const MarkSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(500).optional(),
    all: z.literal(true).optional(),
    read: z.boolean(),
  })
  .refine((body) => Boolean(body.ids) !== Boolean(body.all), { message: "Send either ids or all, not both" })

const DeleteSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) })

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function authed(request: Request) {
  const rl = await rateLimit(`notifications:${getClientId(request)}`, { limit: 120, windowSec: 60 })
  if (!rl.allowed) return { response: NextResponse.json({ error: "Too many requests" }, { status: 429 }) }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  return { supabase, userId: user.id }
}

/**
 * PATCH /api/notifications — mark the caller's notifications read or unread.
 * Body: `{ ids: string[], read: boolean }` or `{ all: true, read: true }`.
 * Writes run as the caller; RLS + column grants limit them to `read`/`read_at`
 * on the caller's own rows.
 */
export async function PATCH(request: Request) {
  const auth = await authed(request)
  if ("response" in auth) return auth.response
  const parsed = MarkSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error.issues)

  const { ids, read } = parsed.data
  let query = auth.supabase
    .from("notifications")
    .update({ read, read_at: read ? new Date().toISOString() : null })
    .eq("user_id", auth.userId)
  query = ids ? query.in("id", ids) : query.eq("read", !read)

  const { error } = await query
  if (error) return serverError(log, error, "Could not update notifications")
  return NextResponse.json({ ok: true })
}

/** DELETE /api/notifications — delete the caller's own notifications. Body: `{ ids }`. */
export async function DELETE(request: Request) {
  const auth = await authed(request)
  if ("response" in auth) return auth.response
  const parsed = DeleteSchema.safeParse(await readJson(request))
  if (!parsed.success) return validationError(parsed.error.issues)

  const { error } = await auth.supabase
    .from("notifications")
    .delete()
    .eq("user_id", auth.userId)
    .in("id", parsed.data.ids)
  if (error) return serverError(log, error, "Could not delete notifications")
  return NextResponse.json({ ok: true })
}
