import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseJsonBody } from "@/lib/api/parse-body"
import { createClient } from "@/lib/supabase/server"
import { getServiceRoleClientOrFallback } from "@/lib/supabase/admin"
import { ANNOUNCEMENTS } from "@/lib/whats-new"
import { logger } from "@/lib/logger"

const log = logger("api-whats-new-seen")
export const dynamic = "force-dynamic"

const KNOWN_IDS = new Set(ANNOUNCEMENTS.map((a) => a.id))

/** Records that the caller has seen these what's-new announcements. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = await parseJsonBody(
      request,
      z.object({
        ids: z.array(z.string().min(1).max(100)).min(1).max(50),
      })
    )
    if (!parsed.ok) return parsed.response

    // Only ids that exist in code — the table never fills with arbitrary strings.
    const ids = [...new Set(parsed.data.ids)].filter((id) => KNOWN_IDS.has(id))
    if (ids.length === 0) return NextResponse.json({ success: true })

    const dataClient = getServiceRoleClientOrFallback(supabase)
    const { error } = await dataClient.from("whats_new_seen").upsert(
      ids.map((id) => ({ user_id: user.id, announcement_id: id })),
      { onConflict: "user_id,announcement_id", ignoreDuplicates: true }
    )
    if (error) throw new Error(`Failed to record seen announcements: ${error.message}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: String(error) }, "Error in POST /api/whats-new/seen")
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
