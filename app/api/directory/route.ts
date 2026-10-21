import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getClientId, rateLimit } from "@/lib/rate-limit"
import { loadDirectory } from "@/lib/directory/load"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
const log = logger("directory")

export async function GET(request: NextRequest) {
  const rl = await rateLimit(`directory:${getClientId(request)}`, { limit: 60, windowSec: 60 })
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests", code: "RATE_LIMITED" }, { status: 429 })

  // Any authenticated employee may view the directory — it is intentionally org-wide.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    return NextResponse.json({ data: await loadDirectory(supabase) })
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "Failed to fetch directory")
    return NextResponse.json({ error: "Failed to load directory" }, { status: 500 })
  }
}
