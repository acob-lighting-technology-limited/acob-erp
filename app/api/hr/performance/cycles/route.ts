import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

const log = logger("hr-performance-cycles")
export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: cycles, error } = await supabase
      .from("review_cycles")
      .select("*")
      .order("start_date", { ascending: false })

    if (error) {
      log.error({ err: String(error) }, "Error fetching review cycles:")
      return NextResponse.json({ error: "Failed to fetch review cycles" }, { status: 500 })
    }

    return NextResponse.json({ data: cycles })
  } catch (error) {
    log.error({ err: String(error) }, "Error in GET /api/hr/performance/cycles:")
    return NextResponse.json({ error: "An error occurred" }, { status: 500 })
  }
}
